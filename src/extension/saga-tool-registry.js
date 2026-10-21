/**
 * saga-tool-registry.js -- Saga/Saga
 * Optional SillyTavern ToolManager integration.
 *
 * These tools expose retrieval/search and review-safe lore proposals to capable
 * models. They never edit bundled Loredecks and never accept lore directly.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { getSettings, getState, appendPendingLoreEntries } from '../state/state-manager.js';
import {
    getLastLoreInjectionAudit,
    getLastLoredeckRetrievalAudit,
    searchAcceptedLorecards,
} from '../lorecards/retrieval-audit.js';
import { normalizeLoreCategory, normalizeLoreRelevance } from '../lorecards/lore-relevance.js';
import { areChatOperationsEnabled } from '../state/chat-operation.js';

const managerOwners = new WeakMap();
let activeToolOwner = null;
const canonOwnedByTunnelVision = () => globalThis.TunnelVision?.bridge?.canonStatus?.().enabled === true;

export function disposeSagaToolManagerTools() {
    const owner = activeToolOwner;
    if (!owner) return;
    owner.active = false;
    const unregister = owner.manager.unregisterFunctionTool || owner.manager.removeFunctionTool;
    if (typeof unregister === 'function') {
        for (const name of owner.names) {
            try { unregister.call(owner.manager, name); owner.names.delete(name); }
            catch (error) { console.warn(`${LOG_PREFIX} Tool disposal failed:`, error); }
        }
    }
}

function getToolManager(ctx = null) {
    return ctx?.ToolManager
        || globalThis.ToolManager
        || globalThis.SillyTavern?.ToolManager
        || null;
}

function safeJson(value) {
    try {
        return JSON.stringify(value);
    } catch (e) {
        return JSON.stringify({ ok: false, error: String(e?.message || e) });
    }
}

function cleanText(value, limit = 1000) {
    return String(value || '').trim().slice(0, limit);
}

function cleanTags(value) {
    if (Array.isArray(value)) return value.map(tag => cleanText(tag, 80)).filter(Boolean).slice(0, 12);
    if (typeof value === 'string') return value.split(',').map(tag => cleanText(tag, 80)).filter(Boolean).slice(0, 12);
    return [];
}

function normalizeToolArgs(args = {}) {
    if (typeof args === 'string') {
        try {
            return JSON.parse(args);
        } catch (_) {
            return { query: args };
        }
    }
    return args && typeof args === 'object' && !Array.isArray(args) ? args : {};
}

function buildToolDefinition(name, description, parameters, handler) {
    const run = async (args = {}) => safeJson(areChatOperationsEnabled() && !canonOwnedByTunnelVision()
        ? await handler(normalizeToolArgs(args)) : { ok: false, error: 'Saga disabled.' });
    return {
        name,
        displayName: name.replace(/^Saga_/, 'Saga '),
        description,
        parameters,
        action: run,
        execute: run,
        handler: run,
    };
}

function registerTool(toolManager, definition) {
    if (!toolManager || typeof toolManager.registerFunctionTool !== 'function') return false;
    const owner = managerOwners.get(toolManager);
    if (owner.names.has(definition.name)) return true;
    const run = definition.execute;
    const guarded = async (...args) => owner.active ? await run(...args) : safeJson({ ok: false, error: 'Saga tool registration was disposed.' });
    definition.action = definition.execute = definition.handler = guarded;
    toolManager.registerFunctionTool(definition);
    owner.names.add(definition.name);
    return true;
}

async function handleSearchLorecards(args = {}) {
    const state = getState();
    return {
        ok: true,
        ...searchAcceptedLorecards(state, cleanText(args.query, 400), {
            limit: Math.max(1, Math.min(24, Number(args.limit) || 8)),
            includeMuted: args.include_muted === true || args.includeMuted === true,
            includeDisabled: args.include_disabled === true || args.includeDisabled === true,
        }),
    };
}

async function handleGetLoreAudit() {
    return {
        ok: true,
        injectionAudit: getLastLoreInjectionAudit(),
        retrievalAudit: getLastLoredeckRetrievalAudit(),
    };
}

async function handleProposeLorecard(args = {}) {
    if (!areChatOperationsEnabled()) return { ok: false, error: 'Saga disabled.' };
    const title = cleanText(args.title, 180);
    const fact = cleanText(args.content || args.fact || args.lore, 1200);
    if (!title || !fact) {
        return { ok: false, error: 'title and content are required.' };
    }

    const id = cleanText(args.id, 140)
        || `tool_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72) || Date.now()}`;
    const entry = {
        schemaVersion: 3,
        id,
        title,
        kind: 'fact',
        gateType: 'fact',
        category: normalizeLoreCategory(args.category || 'other'),
        relevance: normalizeLoreRelevance(args.relevance || 'normal'),
        lorePurpose: cleanText(args.lorePurpose || args.purpose || 'branch_fact', 80),
        canon: cleanText(args.canon || 'au', 40),
        canonStatus: cleanText(args.canonStatus || args.canon || 'au', 40),
        truthStatus: cleanText(args.truthStatus || 'true', 40),
        revealPolicy: cleanText(args.revealPolicy || 'private', 80),
        priority: Number.isFinite(Number(args.priority)) ? Number(args.priority) : 50,
        tags: cleanTags(args.tags),
        content: {
            fact,
            injection: cleanText(args.injection || fact, 1200),
            notes: cleanText(args.reason || args.notes || 'Proposed by Saga tool call for Pending Review.', 500),
        },
        source: 'saga-tool:propose-lorecard',
        userEditable: true,
        userEdited: false,
        extensions: {
            sagaToolProposal: {
                source: 'Saga_ProposeLorecard',
                proposedAt: Date.now(),
                reason: cleanText(args.reason || '', 500),
            },
        },
    };

    const result = appendPendingLoreEntries([entry], {
        source: 'saga_tool_proposal',
        summary: `Tool proposed Lorecard: ${title}`,
        rawEntryCount: 1,
        normalizedEntryCount: 1,
    }, {
        syncPrompt: true,
        full: true,
    });

    return {
        ok: result.changed === true,
        proposedId: entry.id,
        appendedCount: result.appendedCount,
        pendingCount: result.pendingCount,
        status: 'pending_review',
    };
}

export function registerSagaToolManagerTools(ctx = null) {
    if (canonOwnedByTunnelVision()) {
        disposeSagaToolManagerTools();
        return { ok: false, reason: 'TunnelVision owns validated canon retrieval.' };
    }
    const settings = getSettings();
    if (settings.enabled === false) return { ok: false, reason: 'Saga disabled.' };

    const toolManager = getToolManager(ctx);
    if (!toolManager || typeof toolManager.registerFunctionTool !== 'function') {
        if (settings.debugMode) console.info(`${LOG_PREFIX} ToolManager unavailable; Saga tools not registered.`);
        return { ok: false, reason: 'ToolManager unavailable.' };
    }
    if (activeToolOwner && activeToolOwner.manager !== toolManager) disposeSagaToolManagerTools();
    let owner = managerOwners.get(toolManager);
    if (!owner || !owner.names.size) {
        owner = { manager: toolManager, names: new Set(), active: true };
        managerOwners.set(toolManager, owner);
    }
    owner.active = true;
    activeToolOwner = owner;

    const tools = [
        buildToolDefinition(
            'Saga_SearchLorecards',
            'Search accepted Saga Lorecards without changing lore state.',
            {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search phrase, character, place, topic, or Lorecard id.' },
                    limit: { type: 'number', description: 'Maximum results, 1-24.' },
                    include_muted: { type: 'boolean', description: 'Include muted Lorecards.' },
                    include_disabled: { type: 'boolean', description: 'Include archived or disabled Lorecards.' },
                },
                required: ['query'],
            },
            handleSearchLorecards,
        ),
        buildToolDefinition(
            'Saga_GetLoreAudit',
            'Inspect the latest Saga Lorecard retrieval and injection audit.',
            {
                type: 'object',
                properties: {},
            },
            handleGetLoreAudit,
        ),
        buildToolDefinition(
            'Saga_ProposeLorecard',
            'Create a Pending Review Lorecard proposal. This never accepts lore directly.',
            {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Short Lorecard title.' },
                    content: { type: 'string', description: 'Durable lore fact, rule, constraint, or state.' },
                    injection: { type: 'string', description: 'Optional model-facing phrasing.' },
                    category: { type: 'string', description: 'Lore category.' },
                    relevance: { type: 'string', description: 'high, normal, or low.' },
                    tags: { type: 'array', items: { type: 'string' } },
                    reason: { type: 'string', description: 'Why this proposal should exist.' },
                },
                required: ['title', 'content'],
            },
            handleProposeLorecard,
        ),
    ];

    const registered = tools.filter(tool => registerTool(toolManager, tool)).map(tool => tool.name);
    if (settings.debugMode && registered.length) {
        console.info(`${LOG_PREFIX} Saga ToolManager tools registered: ${registered.join(', ')}`);
    }
    return { ok: registered.length === tools.length, registered };
}

export const __sagaToolRegistryTestHooks = {
    handleSearchLorecards,
    handleGetLoreAudit,
    handleProposeLorecard,
    normalizeToolArgs,
};
