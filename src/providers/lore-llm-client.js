/**
 * lore-llm-client.js — Saga
 * Provider abstraction for continuity scanning, lore context detection, and lore generation.
 *
 * Provider roles:
 *   continuity — Utility Provider: frequent, fast/cheap tasks such as compression and continuity scans
 *   lore       — Reasoning Provider: deeper context and lore-generation tasks
 *
 * Internal kind names are retained for backward-compatible settings storage.
 */

import { getSettings } from '../state/state-manager.js';
import { loadNamedApiKey } from '../state/secure-keyring.js';
import { assertLoreOutputSize, consumeBoundedLoreResponse, createProviderResourceError, getLoreRequestLimits, readBoundedLoreResponseText, runBoundedLoreRequest, throwIfLoreRequestAborted } from './bounded-lore-request.js';
import {
    LORE_RESPONSE_ERROR_CODES,
    collectLoreResponseFinishReasons as collectFinishReasons,
    createLoreResponseError,
    extractLoreContentText as extractTextFromContent,
    extractLoreResponseReasoning as extractChatCompletionReasoning,
    extractLoreResponseText as extractChatCompletionText,
    isLoreResponseTokenLimitFinishReason as isTokenLimitFinishReason,
    normalizeLoreResponseFinishReason as normalizeFinishReason,
} from './lore-response-normalizer.js';

const PROVIDER_KINDS = new Set(['continuity', 'lore']);
const CONNECTION_PROFILE_ID_FIELDS = Object.freeze(['id', 'name', 'profileId', 'uuid', 'profile_id', 'label']);
const CONNECTION_PROFILE_MODEL_KEYS = new Set([
    'model',
    'modelid',
    'modelname',
    'selectedmodel',
    'selectedmodelid',
    'apimodel',
    'onlineapimodel',
    'custommodel',
    'chatcompletionmodel',
    'completionmodel',
    'llmmodel',
    'aimodel',
]);
const cachedKeys = new Map();

function normalizeProviderKind(kind = 'lore') {
    const normalized = String(kind || 'lore').toLowerCase();
    return PROVIDER_KINDS.has(normalized) ? normalized : 'lore';
}

function capName(kind) {
    return kind === 'continuity' ? 'continuity' : 'lore';
}

function getProviderSettings(kind = 'lore', settingsOverride = null) {
    const settings = settingsOverride || getSettings();
    const k = normalizeProviderKind(kind);
    const prefix = capName(k);
    const title = k === 'continuity' ? 'Utility' : 'Reasoning';

    return {
        kind: k,
        title,
        provider: settings[`${prefix}Provider`] || 'st',
        profileId: settings[`${prefix}ProfileId`] || '',
        openAIBaseUrl: settings[`${prefix}OpenAIBaseUrl`] || '',
        openAIModel: settings[`${prefix}OpenAIModel`] || '',
        openAIKeySet: !!settings[`${prefix}OpenAIKeySet`],
        temperature: Number(settings[`${prefix}Temperature`] ?? 0.7),
        topP: Number(settings[`${prefix}TopP`] ?? 0.98),
        maxTokens: Number(settings[`${prefix}MaxTokens`] || 8192),
        secretName: `${prefix}OpenAI`,
    };
}

function normalizeOpenAIChatEndpoint(baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) throw new Error('OpenAI-compatible base URL is missing.');
    if (base.endsWith('/chat/completions')) return base;
    if (base.endsWith('/v1')) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
}

function normalizeOpenAIBaseUrl(baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) throw new Error('OpenAI-compatible base URL is missing.');
    if (base.endsWith('/v1')) return base;
    if (base.endsWith('/v1/chat/completions')) return base.replace(/\/chat\/completions$/, '/v1');
    if (base.endsWith('/chat/completions')) return base.replace(/\/chat\/completions$/, '');
    return `${base}/v1`;
}

function emitLoreRequestProgress(options = {}, event = {}) {
    if (options.signal?.aborted) return;
    if (typeof options.onProgress !== 'function') return;
    try {
        options.onProgress({
            ...event,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.warn('[Saga] Lore request progress callback failed:', error);
    }
}

function wantsStreamingResponse(options = {}) {
    return options.stream === true && typeof options.onProgress === 'function';
}

function extractStreamDeltaText(json) {
    const choice = Array.isArray(json?.choices) ? json.choices[0] : null;
    const delta = choice?.delta || {};
    return extractTextFromContent(delta.content)
        || extractTextFromContent(delta.text)
        || extractTextFromContent(choice?.text)
        || '';
}

function extractStreamReasoningDelta(json) {
    const choice = Array.isArray(json?.choices) ? json.choices[0] : null;
    const delta = choice?.delta || {};
    return extractTextFromContent(delta.reasoning)
        || extractTextFromContent(delta.reasoning_content)
        || extractTextFromContent(delta.reasoningContent)
        || extractTextFromContent(delta.reasoning_details)
        || '';
}

function assertNotTokenLimitedResponse(cfg, json, options = {}) {
    const reason = collectFinishReasons(json).find(isTokenLimitFinishReason);
    if (!reason) return;

    const maxTokens = Math.max(1, Number(options.maxTokens || cfg.maxTokens || 8192) || 8192);
    throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT, `${cfg.title} provider stopped because it hit the response token limit (${reason}; max ${maxTokens}). Increase ${cfg.title} Max Tokens, reduce source messages/chunk size, or use a model/provider with a larger output limit.`, {
        providerTitle: cfg.title,
        finishReason: reason,
        maxTokens,
    });
}

function makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options = {}) {
    const alreadyConstrained = String(systemPrompt || '').includes('CRITICAL OUTPUT REQUIREMENT FOR THINKING MODELS:')
        || String(userPrompt || '').includes('Do not leave message.content empty.');
    if (alreadyConstrained) return { system: systemPrompt, user: userPrompt };

    const expectedOutput = String(options.expectedOutput || options.outputFormat || 'json').toLowerCase();
    const wantsText = /text|plain|compression|compressed/.test(expectedOutput);
    const system = wantsText
        ? `${systemPrompt}

CRITICAL OUTPUT REQUIREMENT FOR THINKING MODELS:
- Put the final compressed text in message.content, not hidden reasoning.
- Output only the requested plain-text block.
- Do not include analysis, markdown fences, XML tags, JSON, or commentary.
- Keep the visible answer within the requested length limit.`
        : `${systemPrompt}

CRITICAL OUTPUT REQUIREMENT FOR THINKING MODELS:
- Put the final answer in message.content, not hidden reasoning.
- Output only the requested JSON object.
- Do not include analysis, markdown, XML tags, or prose.
- Keep the JSON compact and omit unchanged/empty optional fields.`;
    const user = wantsText
        ? `${userPrompt}

Return the final compressed text now in visible message.content. Do not leave message.content empty. Do not output JSON or commentary.`
        : `${userPrompt}

Return the final JSON now. The first character of your visible answer must be { and the last character must be }. Do not leave message.content empty.`;
    return { system, user };
}

function prepareLoreRequestPrompts(systemPrompt, userPrompt, options = {}) {
    if (options.forceVisibleOutput === true) {
        return makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options);
    }
    return { system: systemPrompt, user: userPrompt };
}

function getSillyTavernContext() {
    return typeof SillyTavern !== 'undefined' ? SillyTavern.getContext?.() : null;
}

function collectPossibleArrays(root, keys) {
    const seen = new Set();
    const visited = new Set();
    const arrays = [];
    const keySet = new Set(keys.map(k => String(k).toLowerCase()));

    function add(value) {
        if (Array.isArray(value) && !seen.has(value)) {
            seen.add(value);
            arrays.push(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            const values = Object.values(value);
            if (values.length && values.every(v => v && typeof v === 'object')) {
                if (!seen.has(value)) {
                    seen.add(value);
                    arrays.push(values);
                }
            }
        }
    }

    function visit(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 6 || visited.has(obj)) return;
        visited.add(obj);
        for (const key of keys) add(obj[key]);
        for (const [key, value] of Object.entries(obj)) {
            const lower = key.toLowerCase();
            if (keySet.has(lower) || keys.some(k => lower.includes(String(k).toLowerCase()))) add(value);
        }
        for (const value of Object.values(obj)) {
            if (value && typeof value === 'object') visit(value, depth + 1);
        }
    }
    visit(root);
    return arrays;
}
function getConnectionProfiles(ctx = getSillyTavernContext()) {
    const roots = [
        ctx,
        typeof globalThis !== 'undefined' ? globalThis.connectionManager : null,
        typeof globalThis !== 'undefined' ? globalThis.ConnectionManager : null,
        typeof globalThis !== 'undefined' ? globalThis.extension_settings : null,
        typeof globalThis !== 'undefined' ? globalThis.power_user : null,
    ];
    const arrays = roots.flatMap(root => collectPossibleArrays(root, ['connectionProfiles', 'connection_profiles', 'profileList', 'profiles', 'connectionManagerProfiles']));
    const out = [];
    const seen = new Set();
    for (const arr of arrays) {
        for (const item of arr) {
            if (!item || typeof item !== 'object') continue;
            const id = String(item.id || item.name || item.profileId || item.uuid || item.profile_id || item.label || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push(item);
        }
    }
    return out;
}

export function getAvailableConnectionProfiles() {
    return getConnectionProfiles();
}

function cleanProviderText(value) {
    if (value === undefined || value === null || typeof value === 'object') return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

function firstProviderText(...values) {
    for (const value of values) {
        const text = cleanProviderText(value);
        if (text) return text;
    }
    return '';
}

function normalizeProviderKey(key = '') {
    return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isConnectionProfileModelKey(key = '') {
    const normalized = normalizeProviderKey(key);
    if (!normalized || normalized === 'models') return false;
    if (CONNECTION_PROFILE_MODEL_KEYS.has(normalized)) return true;
    if (!normalized.includes('model')) return false;
    if (/(list|lists|option|options|map|mapping|setting|settings|parameter|parameters|provider|providers|source|sources|preset|presets)$/.test(normalized)) return false;
    return normalized.endsWith('model') || normalized.endsWith('modelid') || normalized.endsWith('modelname');
}

function isConnectionProfileModelCollectionKey(key = '') {
    const normalized = normalizeProviderKey(key);
    return normalized === 'models'
        || normalized.startsWith('availablemodels')
        || /(list|lists|option|options|map|mapping)$/.test(normalized);
}

function findModelValueInObject(root, depth = 0, seen = new Set()) {
    if (!root || typeof root !== 'object' || depth > 5 || seen.has(root)) return '';
    seen.add(root);
    const entries = Object.entries(root);

    for (const [key, value] of entries) {
        if (!isConnectionProfileModelKey(key)) continue;
        const text = cleanProviderText(value);
        if (text) return text;
    }

    for (const [key, value] of entries) {
        if (!value || typeof value !== 'object') continue;
        if (isConnectionProfileModelCollectionKey(key)) continue;
        const nested = findModelValueInObject(value, depth + 1, seen);
        if (nested) return nested;
    }

    return '';
}

function getConnectionProfileId(profile = {}) {
    return firstProviderText(...CONNECTION_PROFILE_ID_FIELDS.map(key => profile?.[key]));
}

function getConnectionProfileLabel(profile = {}, fallback = '') {
    return firstProviderText(profile?.name, profile?.label, profile?.profileName, profile?.title, fallback);
}

function getConnectionProfileById(profileId = '') {
    const id = cleanProviderText(profileId);
    if (!id) return null;
    return getConnectionProfiles().find(profile => getConnectionProfileId(profile) === id
        || CONNECTION_PROFILE_ID_FIELDS.some(key => cleanProviderText(profile?.[key]) === id)) || null;
}

function getConnectionProfileModelName(profile = {}) {
    return findModelValueInObject(profile);
}

function getCurrentSillyTavernModelName(ctx = getSillyTavernContext()) {
    return firstProviderText(
        ctx?.onlineApiModel,
        ctx?.model,
        ctx?.modelName,
        ctx?.apiModel,
        ctx?.selectedModel,
        typeof globalThis !== 'undefined' ? globalThis.onlineApiModel : '',
        typeof globalThis !== 'undefined' ? globalThis.selectedModel : '',
    );
}

export function getProviderModelStatus(kind = 'lore', settings = null) {
    const cfg = getProviderSettings(kind, settings);
    if (cfg.provider === 'openai_compatible') {
        const model = cleanProviderText(cfg.openAIModel);
        return {
            kind: cfg.kind,
            provider: cfg.provider,
            model,
            label: model || 'Model not set',
            sourceLabel: 'OpenAI-compatible endpoint',
            exact: !!model,
            tooltip: model
                ? `${cfg.title} Provider model: ${model}.`
                : `${cfg.title} Provider uses an OpenAI-compatible endpoint, but no model ID is saved yet.`,
        };
    }

    if (cfg.provider === 'profile') {
        const profile = getConnectionProfileById(cfg.profileId);
        const model = getConnectionProfileModelName(profile || {});
        const profileLabel = getConnectionProfileLabel(profile || {}, cfg.profileId || 'Connection Profile');
        const fallback = profileLabel ? `Profile: ${profileLabel}` : 'Connection Profile';
        return {
            kind: cfg.kind,
            provider: cfg.provider,
            model,
            label: model || fallback,
            sourceLabel: 'Connection Profile',
            profileLabel,
            exact: !!model,
            tooltip: model
                ? `${cfg.title} Provider model from ${fallback}: ${model}.`
                : `${cfg.title} Provider model could not be detected; showing selected ${fallback}.`,
        };
    }

    if (cfg.provider === 'st') {
        const model = getCurrentSillyTavernModelName();
        return {
            kind: cfg.kind,
            provider: cfg.provider,
            model,
            label: model || 'Current ST model',
            sourceLabel: 'Current SillyTavern Model',
            exact: !!model,
            tooltip: model
                ? `${cfg.title} Provider uses the active SillyTavern model: ${model}.`
                : `${cfg.title} Provider uses the active SillyTavern model; Saga could not read its model ID from this session.`,
        };
    }

    return {
        kind: cfg.kind,
        provider: cfg.provider,
        model: '',
        label: 'Provider not set',
        sourceLabel: cfg.provider || 'Provider',
        exact: false,
        tooltip: `${cfg.title} Provider source is not recognized.`,
    };
}

export async function loadApiKey(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    const key = await loadNamedApiKey(cfg.secretName);
    if (key) cachedKeys.set(cfg.secretName, key);
    return key;
}

export function clearCachedApiKey(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    cachedKeys.delete(cfg.secretName);
}

async function getApiKey(cfg) {
    const cached = cachedKeys.get(cfg.secretName);
    if (cached) return cached;
    const loaded = await loadNamedApiKey(cfg.secretName);
    if (loaded) cachedKeys.set(cfg.secretName, loaded);
    return loaded;
}

function getCachedApiKey(cfg) {
    return cachedKeys.get(cfg.secretName) || '';
}

function validateProviderShape(cfg) {
    try {
        if (cfg.provider === 'openai_compatible') {
            if (!String(cfg.openAIBaseUrl || '').trim()) {
                return { ok: false, provider: cfg.provider, kind: cfg.kind, message: `${cfg.title} OpenAI-compatible Base URL is missing.` };
            }
            if (!String(cfg.openAIModel || '').trim()) {
                return { ok: false, provider: cfg.provider, kind: cfg.kind, message: `${cfg.title} OpenAI-compatible model is missing. Type or select a model ID.` };
            }
            return { ok: true, provider: cfg.provider, kind: cfg.kind };
        }

        if (cfg.provider === 'profile') {
            if (!String(cfg.profileId || '').trim()) {
                return { ok: false, provider: cfg.provider, kind: cfg.kind, message: `No ${cfg.title.toLowerCase()} connection profile is selected.` };
            }
            const ctx = getSillyTavernContext();
            if (!ctx?.ConnectionManagerRequestService?.sendRequest) {
                return { ok: false, provider: cfg.provider, kind: cfg.kind, message: 'ConnectionManagerRequestService is unavailable in this SillyTavern session.' };
            }
            return { ok: true, provider: cfg.provider, kind: cfg.kind };
        }

        if (cfg.provider === 'st') {
            const ctx = getSillyTavernContext();
            if (!ctx || (typeof ctx.generateRaw !== 'function' && typeof ctx.generateQuietPrompt !== 'function')) {
                return { ok: false, provider: cfg.provider, kind: cfg.kind, message: 'Current SillyTavern model generation API is unavailable. Select a connection profile or OpenAI-compatible endpoint.' };
            }
            return { ok: true, provider: 'st', kind: cfg.kind };
        }

        return { ok: false, provider: cfg.provider, kind: cfg.kind, message: `Unknown ${cfg.title.toLowerCase()} provider: ${cfg.provider}` };
    } catch (e) {
        return { ok: false, provider: cfg.provider, kind: cfg.kind, message: e?.message || String(e) };
    }
}

export function validateLoreProviderConfiguration(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    const shape = validateProviderShape(cfg);
    if (!shape.ok) return shape;

    if (cfg.provider === 'openai_compatible' && !getCachedApiKey(cfg) && !cfg.openAIKeySet) {
        return { ok: false, provider: cfg.provider, kind: cfg.kind, message: `${cfg.title} OpenAI-compatible API key is missing. Store an API key first.` };
    }
    return shape;
}

export async function validateLoreProviderConfigurationAsync(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    const validation = validateLoreProviderConfiguration(kind);
    if (!validation.ok || cfg.provider !== 'openai_compatible') return validation;

    const key = await getApiKey(cfg);
    if (!key) {
        return {
            ok: false,
            provider: cfg.provider,
            kind: cfg.kind,
            message: `${cfg.title} OpenAI-compatible API key is stored but could not be read. Store the key again for this session.`,
        };
    }
    return validation;
}

export async function testLoreConnection(kind = 'lore') {
    const validation = await validateLoreProviderConfigurationAsync(kind);
    if (!validation.ok) throw new Error(validation.message);

    const response = await sendLoreRequest(
        'You are a connection test endpoint. Output only valid JSON.',
        'Return exactly: {"ok":true}',
        { maxTokens: 32, prefill: '', providerKind: kind },
    );

    const text = String(response || '').trim();
    if (!text) throw new Error('Connection test returned an empty response.');
    return { ok: true, provider: validation.provider, kind: validation.kind, response: text.slice(0, 300) };
}

async function buildOpenAIHeaders(cfg) {
    const headers = { 'Content-Type': 'application/json' };
    const apiKey = await getApiKey(cfg);
    if (!apiKey) throw new Error(`${cfg.title} OpenAI-compatible API key is unavailable. Store the key again for this session.`);
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
}

function buildOpenAIEndpoint(cfg) {
    return normalizeOpenAIChatEndpoint(cfg.openAIBaseUrl);
}

async function readOpenAICompatibleStream(response, cfg, options = {}) {
    if (!response.body || typeof response.body.getReader !== 'function') {
        emitLoreRequestProgress(options, {
            type: 'phase',
            phase: 'fallback',
            message: `${cfg.title} endpoint did not expose a readable stream; waiting for final response.`,
            streamSupported: false,
        });
        const text = await readBoundedLoreResponseText(response, options);
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) {}
        return { text, json, content: extractChatCompletionText(json), reasoningPreview: extractChatCompletionReasoning(json), streamed: false };
    }

    const decoder = new TextDecoder();
    const limits = getLoreRequestLimits(options);
    let buffer = '';
    let content = '';
    let reasoningPreview = '';
    let visibleStarted = false;
    let lastDeltaAt = 0;
    const finishReasons = [];

    emitLoreRequestProgress(options, {
        type: 'stream_start',
        phase: 'streaming',
        message: `Receiving ${cfg.title} response...`,
        streamSupported: true,
    });

    function consumeSseLine(line) {
        const trimmed = String(line || '').trim();
        if (!trimmed || !trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;

        if (new TextEncoder().encode(line).byteLength > limits.maxSseBufferBytes) throw createProviderResourceError('provider_response_too_large', 'Provider SSE event exceeded its buffer limit.');
        let json = null;
        try { json = JSON.parse(payload); } catch (_) { throw createProviderResourceError('provider_stream_malformed', 'Provider stream contained malformed JSON.'); }

        const reason = collectFinishReasons(json).find(Boolean);
        if (reason) finishReasons.push(reason);

        const reasoningDelta = extractStreamReasoningDelta(json);
        const textDelta = extractStreamDeltaText(json);
        if (reasoningDelta && !textDelta) {
            reasoningPreview = `${reasoningPreview}${reasoningDelta}`.slice(-12000);
            if (!visibleStarted) {
                const now = Date.now();
                if (now - lastDeltaAt > 500) {
                    lastDeltaAt = now;
                    emitLoreRequestProgress(options, {
                        type: 'reasoning',
                        phase: 'reasoning',
                        message: 'Model is reasoning; visible response has not started yet.',
                        receivedChars: content.length,
                        streamSupported: true,
                    });
                }
            }
            return;
        }
        if (!textDelta) return;

        visibleStarted = true;
        content += textDelta;
        assertLoreOutputSize(content, options);
        const now = Date.now();
        if (now - lastDeltaAt > 150 || textDelta.includes('\n')) {
            lastDeltaAt = now;
            emitLoreRequestProgress(options, {
                type: 'delta',
                phase: 'receiving',
                message: 'Receiving visible response...',
                delta: textDelta,
                accumulated: content,
                receivedChars: content.length,
                streamSupported: true,
            });
        }
    }

    await consumeBoundedLoreResponse(response, options, value => {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) consumeSseLine(line);
        if (new TextEncoder().encode(buffer).byteLength > limits.maxSseBufferBytes) throw createProviderResourceError('provider_response_too_large', 'Provider SSE buffer exceeded its byte limit.');
    });
    buffer += decoder.decode();
    if (buffer) {
        for (const line of buffer.split(/\r?\n/)) consumeSseLine(line);
    }

    const finishReason = finishReasons.find(Boolean) || 'stop';
    const json = {
        choices: [{
            message: { content },
            finish_reason: finishReason,
        }],
    };
    emitLoreRequestProgress(options, {
        type: 'stream_complete',
        phase: 'complete',
        message: `Received ${content.length} visible character${content.length === 1 ? '' : 's'}.`,
        accumulated: content,
        receivedChars: content.length,
        finishReason,
        streamSupported: true,
    });
    return {
        text: JSON.stringify(json),
        json,
        content,
        reasoningPreview,
        streamed: true,
    };
}

async function sendViaOpenAICompatible(cfg, systemPrompt, userPrompt, options = {}) {
    const endpoint = buildOpenAIEndpoint(cfg);
    const headers = await buildOpenAIHeaders(cfg);
    const shouldStream = wantsStreamingResponse(options);

    const requestBody = {
        model: cfg.openAIModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: Number(cfg.temperature ?? 0.7),
        top_p: Number(cfg.topP ?? 0.98),
        max_tokens: Number(options.maxTokens || cfg.maxTokens || 8192),
        stream: shouldStream,
    };

    async function post(body) {
        if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        emitLoreRequestProgress(options, {
            type: 'phase',
            phase: body.stream ? 'connecting_stream' : 'waiting',
            message: body.stream ? `Opening ${cfg.title} streaming response...` : `Waiting for ${cfg.title} response...`,
            streamSupported: body.stream === true,
        });
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            credentials: 'omit',
            signal: options.signal,
        });
        if (body.stream && response.ok) {
            const streamed = await readOpenAICompatibleStream(response, cfg, options);
            return { response, text: streamed.text, json: streamed.json, content: streamed.content, reasoningPreview: streamed.reasoningPreview, streamed: streamed.streamed };
        }
        const text = await readBoundedLoreResponseText(response, options);
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) {}
        return { response, text, json };
    }

    let attempt = await post(requestBody);

    const isCompatibilityError = result => [400, 422].includes(result.response.status);
    function throwHttpError(result) {
        const status = result.response.status;
        const code = [401, 403].includes(status) ? 'provider_auth_failed' : status === 429 ? 'provider_rate_limited' : status >= 500 ? 'provider_server_error' : 'provider_request_rejected';
        const error = createProviderResourceError(code, `${cfg.title} OpenAI request failed (${status}): ${result.text.slice(0, 500)}`, { status });
        error.status = status; error.retryAfter = result.response.headers?.get?.('retry-after') || '';
        throw error;
    }

    if (isCompatibilityError(attempt) && /max_tokens/i.test(attempt.text)) {
        requestBody.max_completion_tokens = requestBody.max_tokens;
        delete requestBody.max_tokens;
        attempt = await post(requestBody);
    }

    if (isCompatibilityError(attempt) && /temperature|top_p/i.test(attempt.text)) {
        delete requestBody.temperature;
        delete requestBody.top_p;
        attempt = await post(requestBody);
    }

    if (isCompatibilityError(attempt) && requestBody.stream && /stream/i.test(attempt.text)) {
        emitLoreRequestProgress(options, {
            type: 'phase',
            phase: 'fallback',
            message: `${cfg.title} endpoint rejected streaming; retrying as a final response.`,
            streamSupported: false,
        });
        requestBody.stream = false;
        attempt = await post(requestBody);
    }

    if (!attempt.response.ok) {
        throwHttpError(attempt);
    }

    assertNotTokenLimitedResponse(cfg, attempt.json, options);

    let content = extractChatCompletionText(attempt.json);
    if (!content || !content.trim()) {
        const reasoning = attempt.reasoningPreview || extractChatCompletionReasoning(attempt.json);
        if (reasoning && reasoning.trim()) {
            const retryPrompts = makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options);
            const retryBody = {
                ...requestBody,
                messages: [
                    { role: 'system', content: retryPrompts.system },
                    { role: 'user', content: retryPrompts.user },
                ],
                temperature: Math.min(Number(requestBody.temperature ?? 0.2), 0.2),
                top_p: Math.min(Number(requestBody.top_p ?? 0.9), 0.9),
                // Thinking/reasoning models can consume the entire response budget in hidden reasoning.
                // On the final-only retry, ask compatible providers to minimize reasoning. If rejected,
                // the request is retried again without this field below.
                reasoning_effort: 'low',
            };
            const originalMax = Number(requestBody.max_tokens || requestBody.max_completion_tokens || options.maxTokens || cfg.maxTokens || 8192);
            const expandedMax = Math.max(originalMax * 2, 8192);
            if (requestBody.max_completion_tokens !== undefined) retryBody.max_completion_tokens = Math.min(8192, expandedMax);
            else retryBody.max_tokens = Math.min(8192, expandedMax);

            let retry = await post(retryBody);
            if (isCompatibilityError(retry) && /reasoning_effort/i.test(retry.text)) {
                delete retryBody.reasoning_effort;
                retry = await post(retryBody);
            }
            if (!retry.response.ok) throwHttpError(retry);
            if (retry.response.ok) {
                assertNotTokenLimitedResponse(cfg, retry.json, { ...options, maxTokens: Number(retryBody.max_tokens || retryBody.max_completion_tokens || options.maxTokens || cfg.maxTokens || 8192) });
                content = extractChatCompletionText(retry.json);
                if (content && content.trim()) return content;
            }
            throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.REASONING_ONLY, `${cfg.title} OpenAI-compatible endpoint returned reasoning-only output with empty message.content. Retried with final-only visible-output instructions but still received no visible content. Use a non-thinking model, raise max tokens, or lower the model's reasoning effort. Reasoning preview: ${reasoning.slice(0, 300)}`, {
                providerTitle: cfg.title,
                reasoningPreview: reasoning.slice(0, 300),
                retried: true,
            });
        }
        throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT, `${cfg.title} OpenAI-compatible endpoint returned empty content. Raw response: ${attempt.text.slice(0, 300)}`, {
            providerTitle: cfg.title,
            rawResponsePreview: attempt.text.slice(0, 300),
        });
    }
    return content;
}

async function sendViaSillyTavernRaw(cfg, systemPrompt, userPrompt, options = {}) {
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const ctx = getSillyTavernContext();

    let lastResult = '';
    let reasoningPreview = '';
    const responseLength = options.maxTokens || cfg.maxTokens;
    emitLoreRequestProgress(options, {
        type: 'phase',
        phase: 'waiting',
        message: 'Waiting for SillyTavern generation response...',
        streamSupported: false,
    });

    async function tryGenerateRaw(sp, up, lengthMultiplier = 1) {
        if (typeof ctx?.generateRaw !== 'function') return '';
        if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        const result = await ctx.generateRaw({
            systemPrompt: sp,
            prompt: up,
            prefill: options.prefill || '',
            responseLength: Math.max(128, Math.min(8192, Math.ceil(Number(responseLength || 8192) * lengthMultiplier))),
            bypassAll: true,
        });
        throwIfLoreRequestAborted(options.signal);
        assertLoreOutputSize(typeof result === 'string' ? result : JSON.stringify(result), options);
        if (result && typeof result === 'object') {
            assertNotTokenLimitedResponse(cfg, result, { ...options, maxTokens: Math.max(128, Math.min(8192, Math.ceil(Number(responseLength || 8192) * lengthMultiplier))) });
        }
        const content = typeof result === 'string' ? result : extractChatCompletionText(result);
        assertLoreOutputSize(content, options);
        if (content && content.trim()) {
            emitLoreRequestProgress(options, {
                type: 'complete',
                phase: 'complete',
                message: `Received ${content.length} visible character${content.length === 1 ? '' : 's'}.`,
                accumulated: content,
                receivedChars: content.length,
                streamSupported: false,
            });
            return content;
        }
        const reasoning = result && typeof result === 'object' ? extractChatCompletionReasoning(result) : '';
        if (reasoning) {
            reasoningPreview = reasoning;
            emitLoreRequestProgress(options, {
                type: 'reasoning',
                phase: 'reasoning',
                message: 'Provider returned reasoning without visible output; retrying final-only response.',
                streamSupported: false,
            });
        }
        return '';
    }

    lastResult = await tryGenerateRaw(systemPrompt, userPrompt, 1);
    if (lastResult && lastResult.trim()) return lastResult;

    if (reasoningPreview) {
        const retryPrompts = makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options);
        lastResult = await tryGenerateRaw(retryPrompts.system, retryPrompts.user, 2);
        if (lastResult && lastResult.trim()) return lastResult;
    }

    if (typeof ctx?.generateQuietPrompt === 'function') {
        const prompts = reasoningPreview ? makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options) : { system: systemPrompt, user: userPrompt };
        const quietPrompt = `${prompts.system}\n\n${prompts.user}`;
        emitLoreRequestProgress(options, {
            type: 'phase',
            phase: 'fallback',
            message: 'Trying SillyTavern quiet prompt fallback...',
            streamSupported: false,
        });
        let result = await ctx.generateQuietPrompt({ quietPrompt });
        throwIfLoreRequestAborted(options.signal);
        assertLoreOutputSize(typeof result === 'string' ? result : JSON.stringify(result), options);
        if (result && typeof result === 'object') assertNotTokenLimitedResponse(cfg, result, options);
        lastResult = typeof result === 'string' ? result : extractChatCompletionText(result);
        assertLoreOutputSize(lastResult, options);
        if (lastResult && lastResult.trim()) {
            emitLoreRequestProgress(options, {
                type: 'complete',
                phase: 'complete',
                message: `Received ${lastResult.length} visible character${lastResult.length === 1 ? '' : 's'}.`,
                accumulated: lastResult,
                receivedChars: lastResult.length,
                streamSupported: false,
            });
            return lastResult;
        }

        // Older SillyTavern builds accept a raw string instead of an object.
        result = await ctx.generateQuietPrompt(quietPrompt);
        throwIfLoreRequestAborted(options.signal);
        assertLoreOutputSize(typeof result === 'string' ? result : JSON.stringify(result), options);
        if (result && typeof result === 'object') assertNotTokenLimitedResponse(cfg, result, options);
        lastResult = typeof result === 'string' ? result : extractChatCompletionText(result);
        assertLoreOutputSize(lastResult, options);
        if (lastResult && lastResult.trim()) {
            emitLoreRequestProgress(options, {
                type: 'complete',
                phase: 'complete',
                message: `Received ${lastResult.length} visible character${lastResult.length === 1 ? '' : 's'}.`,
                accumulated: lastResult,
                receivedChars: lastResult.length,
                streamSupported: false,
            });
            return lastResult;
        }
    }

    if (reasoningPreview) {
        throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.REASONING_ONLY, `${cfg.title} provider returned reasoning-only output with empty visible content. Retried with final-only visible-output instructions but still received no visible content. Increase max tokens, reduce reasoning effort, or use a non-thinking model. Reasoning preview: ${reasoningPreview.slice(0, 300)}`, {
            providerTitle: cfg.title,
            reasoningPreview: reasoningPreview.slice(0, 300),
            retried: true,
        });
    }

    if (typeof ctx?.generateRaw === 'function' || typeof ctx?.generateQuietPrompt === 'function') {
        throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT, `${cfg.title} provider returned empty visible content.`, {
            providerTitle: cfg.title,
        });
    }

    throw new Error('No SillyTavern raw generation API available.');
}

async function sendViaConnectionProfile(cfg, systemPrompt, userPrompt, options = {}) {
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const ctx = getSillyTavernContext();
    const service = ctx?.ConnectionManagerRequestService;
    if (!cfg.profileId) throw new Error(`${cfg.title} profile is not selected.`);
    if (!service || typeof service.sendRequest !== 'function') throw new Error('ConnectionManagerRequestService unavailable.');
    emitLoreRequestProgress(options, {
        type: 'phase',
        phase: 'waiting',
        message: `Waiting for ${cfg.title} connection profile response...`,
        streamSupported: false,
    });

    async function send(messages, lengthMultiplier = 1) {
        options.onRequest?.();
        return await service.sendRequest(
            cfg.profileId,
            messages,
            Math.max(128, Math.min(8192, Math.ceil(Number(options.maxTokens || cfg.maxTokens || 8192) * lengthMultiplier))),
            {
                signal: options.signal,
                stream: false,
                extractData: true,
                includePreset: true,
                includeInstruct: true,
                // Do not force reasoning_effort here. Some providers/profiles, especially DeepSeek-compatible
                // endpoints, reject unsupported values. If a SillyTavern connection profile itself sends
                // reasoning_effort:'auto', fix that profile/preset or use Saga's direct OpenAI-compatible provider.
            },
        );
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];

    let raw = await send(messages, 1);
    options.onUsage?.(raw?.usage || null);
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    assertLoreOutputSize(typeof raw === 'string' ? raw : JSON.stringify(raw), options);
    if (raw && typeof raw === 'object') assertNotTokenLimitedResponse(cfg, raw, options);
    let content = typeof raw === 'string' ? raw : extractChatCompletionText(raw);
    assertLoreOutputSize(content, options);
    if (content && content.trim()) {
        emitLoreRequestProgress(options, {
            type: 'complete',
            phase: 'complete',
            message: `Received ${content.length} visible character${content.length === 1 ? '' : 's'}.`,
            accumulated: content,
            receivedChars: content.length,
            streamSupported: false,
        });
        return content;
    }

    const reasoning = raw && typeof raw === 'object' ? extractChatCompletionReasoning(raw) : '';
    if (reasoning && options.maxRetries !== 0) {
        emitLoreRequestProgress(options, {
            type: 'reasoning',
            phase: 'reasoning',
            message: 'Connection profile returned reasoning without visible output; retrying final-only response.',
            streamSupported: false,
        });
        const retryPrompts = makeFinalOnlyRetryPrompts(systemPrompt, userPrompt, options);
        raw = await send([
            { role: 'system', content: retryPrompts.system },
            { role: 'user', content: retryPrompts.user },
        ], 2);
        if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        assertLoreOutputSize(typeof raw === 'string' ? raw : JSON.stringify(raw), options);
        if (raw && typeof raw === 'object') assertNotTokenLimitedResponse(cfg, raw, { ...options, maxTokens: Math.max(128, Math.min(8192, Math.ceil(Number(options.maxTokens || cfg.maxTokens || 8192) * 2))) });
        content = typeof raw === 'string' ? raw : extractChatCompletionText(raw);
        if (content && content.trim()) {
            emitLoreRequestProgress(options, {
                type: 'complete',
                phase: 'complete',
                message: `Received ${content.length} visible character${content.length === 1 ? '' : 's'}.`,
                accumulated: content,
                receivedChars: content.length,
                streamSupported: false,
            });
            return content;
        }
        throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.REASONING_ONLY, `${cfg.title} connection profile returned reasoning-only output with empty visible content. Retried with final-only visible-output instructions but still received no visible content. Increase max tokens, reduce reasoning effort in the profile/preset, or use a non-thinking model. Reasoning preview: ${reasoning.slice(0, 300)}`, {
            providerTitle: cfg.title,
            reasoningPreview: reasoning.slice(0, 300),
            retried: true,
        });
    }
    throw createLoreResponseError(LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT, `${cfg.title} connection profile returned empty visible content.`, {
        providerTitle: cfg.title,
    });
}

export async function fetchLoreModels(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    if (cfg.provider === 'openai_compatible') {
        const validation = await validateLoreProviderConfigurationAsync(cfg.kind);
        if (!validation.ok) throw new Error(validation.message);
        return await fetchOpenAICompatibleModels(cfg);
    }
    if (cfg.provider === 'profile') return fetchProfileModels(cfg);
    return fetchSTModel();
}

async function fetchOpenAICompatibleModels(cfg) {
    const baseUrl = normalizeOpenAIBaseUrl(cfg.openAIBaseUrl);
    let modelsUrl = `${baseUrl}/models`;
    const headers = await buildOpenAIHeaders(cfg);

    const response = await fetch(modelsUrl, { method: 'GET', headers, credentials: 'omit' });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to fetch ${cfg.title.toLowerCase()} models (${response.status}): ${text.slice(0, 300)}`);
    }

    const json = await response.json();
    const models = json?.data || json?.models || [];
    return models.map(m => ({ id: m.id || m.name || '', name: m.name || m.id || '' })).filter(m => m.id);
}

function fetchProfileModels(cfg) {
    const profile = getConnectionProfileById(cfg.profileId);
    const model = getConnectionProfileModelName(profile || {});
    const profileLabel = getConnectionProfileLabel(profile || {}, cfg.profileId || 'Unknown profile');
    return [{ id: model || profileLabel || 'unknown', name: model ? profileLabel || model : `Profile: ${profileLabel || 'unknown'}` }];
}

function fetchSTModel() {
    const modelName = getCurrentSillyTavernModelName() || 'Current ST model';
    return [{ id: modelName, name: modelName }];
}

export function getLoreProviderCapabilities(kind = 'lore') {
    const cfg = getProviderSettings(kind);
    // Verified release host contract: generateRaw/QuietPrompt have no signal
    // parameter; ConnectionManagerRequestService forwards custom.signal.
    if (cfg.provider === 'openai_compatible') return { provider: cfg.provider, cancellation: 'signal', maxConcurrency: 2, routeKey: `openai:${cfg.openAIBaseUrl ? normalizeOpenAIChatEndpoint(cfg.openAIBaseUrl) : 'unconfigured'}:${cfg.openAIModel}` };
    if (cfg.provider === 'profile') return { provider: cfg.provider, cancellation: 'signal', maxConcurrency: 1, routeKey: `st:profile:${cfg.profileId}` };
    return { provider: 'st', cancellation: 'unsupported', maxConcurrency: 1, routeKey: 'st:raw-quiet' };
}

export async function sendLoreRequest(systemPrompt, userPrompt, options = {}) {
    const cfg = getProviderSettings(options.providerKind || 'lore');
    if (options.profileId) Object.assign(cfg, { provider: 'profile', profileId: options.profileId });
    const capabilities = options.profileId
        ? { provider: 'profile', cancellation: 'signal', maxConcurrency: 1, routeKey: `st:profile:${cfg.profileId}` }
        : getLoreProviderCapabilities(cfg.kind);
    return runBoundedLoreRequest(capabilities.routeKey, async requestOptions => {
        const validation = options.profileId ? validateProviderShape(cfg) : await validateLoreProviderConfigurationAsync(cfg.kind);
        if (!validation.ok) throw createProviderResourceError('provider_missing_config', validation.message);
        throwIfLoreRequestAborted(requestOptions.signal);
        const prompts = prepareLoreRequestPrompts(systemPrompt, userPrompt, requestOptions);
        emitLoreRequestProgress(requestOptions, {
            type: 'start', phase: 'starting', message: `Contacting ${cfg.title} Provider...`,
            provider: cfg.provider, providerKind: cfg.kind, cancellation: capabilities.cancellation,
            streamRequested: requestOptions.stream === true,
            streamSupported: cfg.provider === 'openai_compatible' && wantsStreamingResponse(requestOptions),
        });
        let content;
        if (cfg.provider === 'openai_compatible') content = await sendViaOpenAICompatible(cfg, prompts.system, prompts.user, requestOptions);
        else if (cfg.provider === 'profile') content = await sendViaConnectionProfile(cfg, prompts.system, prompts.user, requestOptions);
        else content = await sendViaSillyTavernRaw(cfg, prompts.system, prompts.user, requestOptions);
        throwIfLoreRequestAborted(requestOptions.signal); assertLoreOutputSize(content, requestOptions);
        return content;
    }, {
        ...options,
        maxConcurrency: Math.min(capabilities.maxConcurrency, Math.max(1, Number(options.maxConcurrency) || capabilities.maxConcurrency)),
    });
}
