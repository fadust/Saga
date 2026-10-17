/**
 * Story Maker source intent and Context Packet builder.
 */

import { evaluateLoreEntryLifecycle, normalizeLoreEntry, normalizeLoreMatrix } from '../lorecards/lore-matrix.js';
import { computeLocalLoreRelevance } from '../lorecards/lore-relevance.js';
import { loadLoredeckStackSources } from '../loredecks/loredeck-loader.js';
import { getLoredeckStack, getLoredeckStackItemLabel } from '../runtime/active-stack-panel.js';
import { getLoredeckLibraryRegistry } from '../state/state-manager.js';
import {
    normalizeStoryOpenerControls,
    normalizeStoryOpenerSourceIntent,
    normalizeStoryOpenerString,
} from './story-opener-state.js';

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value = [], limit = 80) {
    const input = Array.isArray(value) ? value : [value];
    const out = [];
    const seen = new Set();
    for (const raw of input.flat(Infinity)) {
        if (raw && typeof raw === 'object') continue;
        const text = String(raw || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

function hashString(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function stringifyStable(value) {
    if (Array.isArray(value)) return `[${value.map(stringifyStable).join(',')}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stringifyStable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value ?? null);
}

export function buildStoryOpenerContextLabel(state = {}, controls = {}) {
    const normalized = normalizeStoryOpenerControls(controls);
    return normalizeStoryOpenerString(
        normalized.context
        || state?.contextBrief?.summary
        || state?.contextBrief?.signals?.canonBoundary
        || state?.loreContext?.canonBoundary
        || state?.loreContext?.sceneDate
        || state?.canon?.canonBoundary
        || state?.canon?.inUniverseDate
        || '',
        2000,
    );
}

export function detectStoryOpenerFandomsFromSources(sources = [], registry = {}) {
    const values = [];
    for (const source of Array.isArray(sources) ? sources : []) {
        const packId = String(source?.pack?.id || source?.manifest?.id || '').trim();
        const record = registry?.packs?.[packId] || {};
        values.push(
            source?.manifest?.fandom,
            source?.pack?.fandom,
            record.fandom,
            source?.manifest?.title,
            source?.pack?.title,
            record.title,
        );
    }
    return uniqueStrings(values
        .map(value => {
            const text = String(value || '').trim();
            if (!text) return '';
            if (/harry\s*potter/i.test(text)) return 'Harry Potter';
            if (/one\s*piece/i.test(text)) return 'One Piece';
            if (/star\s*trek/i.test(text)) return 'Star Trek';
            if (/star\s*wars/i.test(text)) return 'Star Wars';
            const beforeColon = text.split(':')[0]?.trim();
            return beforeColon || text;
        })
        .filter(Boolean), 12);
}

export function buildStoryOpenerSourceIntentFromState(state = {}, controls = {}) {
    const stack = getLoredeckStack(state);
    const registry = getLoredeckLibraryRegistry(state);
    const normalizedControls = normalizeStoryOpenerControls(controls);
    const context = buildStoryOpenerContextLabel(state, normalizedControls);
    const loreMatrix = normalizeLoreMatrix(state?.loreMatrix || []);
    const chatLorecardIds = loreMatrix
        .filter(entry => entry.status !== 'disabled' && entry.status !== 'archived')
        .map(entry => entry.id)
        .filter(Boolean)
        .slice(0, 120);
    const stackItems = stack.map(item => ({
        ...item,
        label: getLoredeckStackItemLabel(item),
    }));
    const packIds = stackItems.map(item => item.packId || '').filter(Boolean);
    const packFandoms = packIds.map(packId => registry?.packs?.[packId]?.fandom || registry?.packs?.[packId]?.title || '').filter(Boolean);
    return normalizeStoryOpenerSourceIntent({
        capturedAt: Date.now(),
        sourceMode: chatLorecardIds.length ? 'chat_enriched' : 'loredeck_only',
        context,
        contextFingerprint: hashString(context),
        stackItems,
        packIds,
        fandoms: uniqueStrings(packFandoms.map(value => /harry\s*potter/i.test(value) ? 'Harry Potter' : String(value).split(':')[0]), 12),
        chatLorecardIds,
    });
}

function buildContextStateForOpener(state = {}, session = {}) {
    const controls = normalizeStoryOpenerControls(session.controls || session);
    const contextText = controls.context || session.sourceIntent?.context || buildStoryOpenerContextLabel(state, controls);
    const base = isPlainObject(state) ? cloneJson(state) : {};
    const loreContext = isPlainObject(base.loreContext) ? base.loreContext : {};
    const contextBriefSignals = isPlainObject(base.contextBrief?.signals) ? base.contextBrief.signals : {};
    const canon = isPlainObject(base.canon) ? base.canon : {};
    base.loreContext = {
        ...loreContext,
        sceneDate: loreContext.sceneDate || contextBriefSignals.sceneDate || contextText,
        subjectiveDate: loreContext.subjectiveDate || contextBriefSignals.subjectiveDate || '',
        canonBoundary: loreContext.canonBoundary || contextBriefSignals.canonBoundary || canon.canonBoundary || contextText,
        branchId: loreContext.branchId || base.contextBrief?.branchId || 'main',
        timeTravelMode: loreContext.timeTravelMode || base.contextBrief?.timeTravelMode || 'none',
    };
    base.canon = {
        ...canon,
        inUniverseDate: canon.inUniverseDate || base.loreContext.sceneDate || contextText,
        canonBoundary: canon.canonBoundary || base.loreContext.canonBoundary || contextText,
    };
    base.scene = {
        ...(isPlainObject(base.scene) ? base.scene : {}),
        currentActivity: uniqueStrings([base.scene?.currentActivity, contextText], 2).join(' | '),
    };
    return base;
}

function entryFactText(entry = {}) {
    return normalizeStoryOpenerString(
        entry.content?.injection
        || entry.content?.fact
        || entry.fact
        || entry.content?.summary
        || entry.title
        || '',
        900,
    );
}

function compactEntry(entry = {}, context = {}) {
    const relevance = context.relevance || {};
    const lifecycle = context.lifecycle || {};
    return {
        id: normalizeStoryOpenerString(entry.id, 160),
        title: normalizeStoryOpenerString(entry.title, 240),
        fact: entryFactText(entry),
        sourceType: context.sourceType || 'loredeck',
        packId: normalizeStoryOpenerString(context.packId, 160),
        packTitle: normalizeStoryOpenerString(context.packTitle, 240),
        file: normalizeStoryOpenerString(context.file, 240),
        lifecycleStatus: normalizeStoryOpenerString(lifecycle.status, 80),
        lifecycleReason: normalizeStoryOpenerString(lifecycle.reason, 300),
        relevance: normalizeStoryOpenerString(relevance.relevance, 40),
        score: Math.max(0, Math.round(Number(relevance.score) || 0)),
        temporalRole: normalizeStoryOpenerString(relevance.temporalRole, 80),
        lorePurpose: normalizeStoryOpenerString(relevance.lorePurpose || entry.lorePurpose, 80),
        priority: Math.max(0, Math.round(Number(entry.priority) || 0)),
        characters: uniqueStrings([entry.scope?.characters, entry.activeWhen?.charactersPresentAny], 12),
        topics: uniqueStrings([entry.scope?.topics, entry.scope?.objects, entry.scope?.spells, entry.activeWhen?.tagsAny], 16),
        tags: uniqueStrings(entry.tags, 16),
    };
}

function factRank(fact = {}) {
    let score = Number(fact.score) || 0;
    if (fact.sourceType === 'chat') score += 40;
    if (fact.lifecycleStatus === 'canon_overdue') score += 20;
    if (fact.temporalRole === 'current_window') score += 28;
    if (fact.temporalRole === 'recent_past') score += 16;
    if (fact.relevance === 'high') score += 24;
    if (fact.lorePurpose === 'knowledge_gate') score += 8;
    score += Math.min(12, Number(fact.priority) / 10);
    return score;
}

function compareFacts(left = {}, right = {}) {
    return factRank(right) - factRank(left)
        || String(left.title || '').localeCompare(String(right.title || ''));
}

function buildAllowedBuckets(facts = []) {
    const sorted = [...facts].sort(compareFacts);
    const fresh = sorted.filter(fact => ['current_window', 'recent_past'].includes(fact.temporalRole) || fact.lifecycleStatus === 'canon_overdue').slice(0, 12);
    const freshIds = new Set(fresh.map(fact => fact.id));
    const mustUse = sorted
        .filter(fact => fact.relevance === 'high' || fact.sourceType === 'chat' || freshIds.has(fact.id))
        .slice(0, 18);
    const mustUseIds = new Set(mustUse.map(fact => fact.id));
    const supporting = sorted.filter(fact => !mustUseIds.has(fact.id)).slice(0, 36);
    return { mustUse, supporting, fresh };
}

function compactBlockedFact(fact = {}) {
    return {
        id: fact.id,
        title: fact.title,
        fact: fact.fact,
        sourceType: fact.sourceType,
        packId: fact.packId,
        lifecycleStatus: fact.lifecycleStatus,
        lifecycleReason: fact.lifecycleReason,
        temporalRole: fact.temporalRole,
        score: fact.score,
    };
}

function collectSourceEntries(sources = []) {
    const out = [];
    for (const source of Array.isArray(sources) ? sources : []) {
        const packId = String(source?.pack?.id || source?.manifest?.id || '').trim();
        const packTitle = String(source?.pack?.title || source?.manifest?.title || packId || '').trim();
        const disabled = new Set([
            ...(Array.isArray(source?.pack?.disabledEntryIds) ? source.pack.disabledEntryIds : []),
            ...(Array.isArray(source?.manifest?.disabledEntryIds) ? source.manifest.disabledEntryIds : []),
        ].map(id => String(id || '').trim()).filter(Boolean));
        for (const file of source?.entryFiles || []) {
            for (const rawEntry of file?.entries || []) {
                const entry = normalizeLoreEntry(rawEntry);
                if (!entry?.id || disabled.has(entry.id)) continue;
                out.push({
                    entry,
                    sourceType: 'loredeck',
                    packId,
                    packTitle,
                    file: String(file.file || '').trim(),
                });
            }
        }
    }
    return out;
}

function collectChatEntries(state = {}) {
    return normalizeLoreMatrix(state?.loreMatrix || [])
        .filter(entry => entry.status !== 'archived' && entry.status !== 'disabled')
        .map(entry => ({
            entry,
            sourceType: 'chat',
            packId: '',
            packTitle: 'Active chat Lorecards',
            file: '',
        }));
}

export async function buildStoryOpenerContextPacket(session = {}, state = {}, options = {}) {
    const bridge = globalThis.Saga?.bridge;
    if (bridge?.canonStatus?.().enabled) {
        const controls = session.controls || {};
        const result = await bridge.queryCanon([controls.characterFocus, controls.context, controls.userPrompt].filter(Boolean).join('\n'), { signal: options.signal });
        const facts = (result.entries || []).map(e => ({ id: e.id, title: e.title, fact: e.text, sourceType: e.kind, lifecycleStatus: 'active', score: 100 }));
        const context = buildStoryOpenerContextLabel(state, controls);
        const fingerprint = hashString(stringifyStable([result.revision, context, facts]));
        const diagnostics = result.status === 'matched' ? [] : [{ severity: 'warning', code: 'canon_incomplete', message: 'Applicable canon retrieval is incomplete; do not fill gaps from original versions.' }];
        return {
            sourceIntent: { context, packIds: [], fandoms: [], sourceMode: 'loredeck_only' },
            packet: { schemaVersion: 1, builtAt: Date.now(), sourceMode: 'loredeck_only', context, contextState: state.loreContext || {},
                fandoms: [], packIds: [], fingerprint, mustUse: facts, supporting: [], fresh: [], mustAvoid: [], diagnostics,
                counts: { sourceCount: new Set((result.entries || []).flatMap(e => e.basis.map(b => b.source))).size, entryCount: facts.length, allowedFactCount: facts.length, blockedFactCount: 0, mustUseCount: facts.length, supportingCount: 0, freshFactCount: 0, mustAvoidCount: 0 } },
            sourceResolution: { status: result.status === 'matched' ? 'current' : facts.length ? 'partial' : 'missing', resolvedAt: Date.now(), sourceMode: 'loredeck_only', packCount: 0, eligibleFactCount: facts.length, blockedFactCount: 0, freshFactCount: 0, diagnostics, fingerprint },
        };
    }
    const registry = options.registry || getLoredeckLibraryRegistry(state);
    const sourceIntent = normalizeStoryOpenerSourceIntent(session.sourceIntent?.stackItems?.length || session.sourceIntent?.packIds?.length
        ? session.sourceIntent
        : buildStoryOpenerSourceIntentFromState(state, session.controls || session));
    const diagnostics = [];
    const stackItems = sourceIntent.stackItems || [];
    let sources = [];
    if (stackItems.length) {
        try {
            sources = await loadLoredeckStackSources(stackItems, { registry });
        } catch (error) {
            diagnostics.push({
                severity: 'error',
                code: 'loredeck_stack_load_failed',
                message: error?.message || String(error || 'Loredeck stack failed to load.'),
            });
        }
    }
    const missingSources = sources.filter(source => !source?.entryFiles?.some(file => file.ok && (file.entries || []).length));
    for (const source of missingSources) {
        diagnostics.push({
            severity: 'warning',
            code: 'loredeck_source_empty_or_missing',
            message: `${source?.pack?.title || source?.pack?.id || 'Loredeck'} has no loaded Lorecards for this opener packet.`,
        });
    }

    const contextState = buildContextStateForOpener(state, { ...session, sourceIntent });
    const entries = [
        ...collectChatEntries(state),
        ...collectSourceEntries(sources),
    ];
    const allowed = [];
    const blocked = [];
    for (const item of entries) {
        const lifecycle = evaluateLoreEntryLifecycle(item.entry, contextState);
        const relevance = computeLocalLoreRelevance(item.entry, contextState, {
            recentText: [
                session.controls?.userPrompt,
                session.controls?.characterFocus,
                session.controls?.context,
                sourceIntent.context,
            ].filter(Boolean).join('\n'),
        });
        const compact = compactEntry(lifecycle.entry || item.entry, {
            ...item,
            lifecycle,
            relevance,
        });
        if (!compact.fact) continue;
        if (lifecycle.shouldInject) allowed.push(compact);
        else if (['future', 'blocked', 'divergent', 'expired', 'canon_overdue'].includes(lifecycle.status)) blocked.push(compact);
    }
    const buckets = buildAllowedBuckets(allowed);
    const mustAvoid = blocked.sort(compareFacts).slice(0, 40).map(compactBlockedFact);
    const fandoms = detectStoryOpenerFandomsFromSources(sources, registry);
    const packIds = uniqueStrings(sources.map(source => source?.pack?.id || source?.manifest?.id), 80);
    const packet = {
        schemaVersion: 1,
        builtAt: Date.now(),
        sourceMode: sourceIntent.sourceMode,
        context: sourceIntent.context || buildStoryOpenerContextLabel(state, session.controls || {}),
        contextState: {
            sceneDate: contextState.loreContext?.sceneDate || '',
            canonBoundary: contextState.loreContext?.canonBoundary || '',
            branchId: contextState.loreContext?.branchId || 'main',
            timeTravelMode: contextState.loreContext?.timeTravelMode || 'none',
        },
        fandoms,
        packIds,
        counts: {
            sourceCount: sources.length,
            entryCount: entries.length,
            allowedFactCount: allowed.length,
            blockedFactCount: blocked.length,
            mustUseCount: buckets.mustUse.length,
            supportingCount: buckets.supporting.length,
            freshFactCount: buckets.fresh.length,
            mustAvoidCount: mustAvoid.length,
        },
        mustUse: buckets.mustUse,
        supporting: buckets.supporting,
        fresh: buckets.fresh,
        mustAvoid,
        diagnostics,
    };
    const fingerprint = hashString(stringifyStable({
        context: packet.context,
        contextState: packet.contextState,
        packIds: packet.packIds,
        mustUse: packet.mustUse.map(fact => [fact.id, fact.lifecycleStatus, fact.score]),
        mustAvoid: packet.mustAvoid.map(fact => [fact.id, fact.lifecycleStatus]),
    }));
    const sourceStatus = !sources.length && !allowed.length
        ? 'missing'
        : diagnostics.some(item => item.severity === 'error')
            ? 'partial'
            : 'current';
    return {
        sourceIntent: {
            ...sourceIntent,
            fandoms: fandoms.length ? fandoms : sourceIntent.fandoms,
            packIds,
        },
        packet: {
            ...packet,
            fingerprint,
        },
        sourceResolution: {
            status: sourceStatus,
            resolvedAt: Date.now(),
            sourceMode: sourceIntent.sourceMode,
            packCount: packIds.length,
            eligibleFactCount: allowed.length,
            blockedFactCount: blocked.length,
            freshFactCount: buckets.fresh.length,
            diagnostics,
            fingerprint,
        },
    };
}
