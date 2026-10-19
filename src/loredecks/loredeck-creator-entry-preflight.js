/**
 * Pure preflight helpers for Deck Maker schema v3 entry drafting.
 */

import {
    normalizeSchemaV3RepairEntryTagList,
} from './loredeck-schema-v3-entry-repair.js';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanStringArray(value = [], limit = 24, maxLength = 180) {
    const source = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const item of source) {
        const clean = cleanString(item, maxLength);
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean);
        if (out.length >= limit) break;
    }
    return out;
}

function compactIdentity(value = '') {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeTagId(value = '') {
    return normalizeSchemaV3RepairEntryTagList([value], 1)[0] || '';
}

function collectRegistryTagIds(tagRegistry = {}) {
    const registry = isPlainObject(tagRegistry) ? tagRegistry : {};
    const source = isPlainObject(registry.tags) ? registry.tags : registry;
    const out = [];
    const seen = new Set();
    for (const rawId of Object.keys(source || {})) {
        const id = normalizeTagId(rawId);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function buildCompactResolutionMap(ids = []) {
    const grouped = new Map();
    for (const id of ids) {
        const compact = compactIdentity(id);
        if (!compact) continue;
        if (!grouped.has(compact)) grouped.set(compact, new Set());
        grouped.get(compact).add(id);
    }
    const unique = new Map();
    const ambiguous = new Map();
    for (const [compact, values] of grouped.entries()) {
        const list = [...values].sort();
        if (list.length === 1) unique.set(compact, list[0]);
        else ambiguous.set(compact, list);
    }
    return { unique, ambiguous };
}

function resolveAcceptedTag(rawTag = '', acceptedTagSet = new Set(), compactMaps = {}) {
    const normalized = normalizeTagId(rawTag);
    if (!normalized) {
        return { status: 'empty', rawTag, normalized: '' };
    }
    if (!acceptedTagSet.size) {
        return { status: 'accepted', rawTag, normalized, tagId: normalized, reason: 'no_registry' };
    }
    if (acceptedTagSet.has(normalized)) {
        return { status: 'accepted', rawTag, normalized, tagId: normalized, reason: 'exact' };
    }
    const compact = compactIdentity(normalized);
    const mapped = compactMaps.unique?.get(compact);
    if (mapped) {
        return { status: 'accepted', rawTag, normalized, tagId: mapped, reason: 'compact_match' };
    }
    const candidates = compactMaps.ambiguous?.get(compact) || [];
    if (candidates.length) {
        return { status: 'ambiguous', rawTag, normalized, candidates };
    }
    return { status: 'omitted', rawTag, normalized };
}

function collectTimelineItems(timelineRegistry = {}, key = 'anchors') {
    const registry = isPlainObject(timelineRegistry) ? timelineRegistry : {};
    const source = Array.isArray(registry[key]) ? registry[key] : [];
    const out = [];
    const seen = new Set();
    for (const item of source) {
        const id = cleanString(item?.id, 180);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ ...item, id });
        if (out.length >= 160) break;
    }
    return out;
}

function collectTimelineIds(timelineRegistry = {}, key = 'anchors') {
    return collectTimelineItems(timelineRegistry, key).map(item => item.id);
}

function collectTimelineHintIds(draft = {}, keys = []) {
    const source = [];
    for (const key of keys) {
        const value = draft?.[key];
        if (Array.isArray(value)) source.push(...value);
        else if (value) source.push(value);
    }
    const context = isPlainObject(draft.context) ? draft.context : {};
    for (const key of keys) {
        const value = context?.[key];
        if (Array.isArray(value)) source.push(...value);
        else if (value) source.push(value);
    }
    return cleanStringArray(source, 24, 180);
}

function collectTargetAnchorHintIds(draft = {}) {
    return collectTimelineHintIds(draft, [
        'anchorId',
        'anchorIds',
        'anchorFrom',
        'anchorTo',
        'contextAnchorId',
        'contextAnchorIds',
        'timelineAnchorId',
        'timelineAnchorIds',
        'validFromAnchor',
        'validToAnchor',
    ]);
}

function collectTargetWindowHintIds(draft = {}) {
    return collectTimelineHintIds(draft, [
        'contextWindowId',
        'contextWindowIds',
        'timelineWindowId',
        'timelineWindowIds',
        'validWindowId',
        'validWindowIds',
        'windowId',
        'windowIds',
    ]);
}

function orderTimelineIds(ids = [], registryOrder = []) {
    const idSet = new Set(ids.filter(Boolean));
    const out = [];
    for (const id of registryOrder) {
        if (idSet.has(id)) out.push(id);
    }
    for (const id of ids) {
        if (id && !out.includes(id)) out.push(id);
    }
    return out;
}

export function buildTargetTimelineReferences(draft = {}, timelineRegistry = {}) {
    const anchorItems = collectTimelineItems(timelineRegistry, 'anchors');
    const windowItems = collectTimelineItems(timelineRegistry, 'windows');
    const anchorIds = anchorItems.map(item => item.id);
    const windowIds = windowItems.map(item => item.id);
    const acceptedAnchorSet = new Set(anchorIds);
    const acceptedWindowSet = new Set(windowIds);
    const explicitAnchorIds = collectTargetAnchorHintIds(draft);
    const explicitWindowIds = collectTargetWindowHintIds(draft);
    const hasExplicitTimelineReferences = !!(explicitAnchorIds.length || explicitWindowIds.length);
    if (!hasExplicitTimelineReferences) {
        return {
            timelineReferenceMode: draft.contextScope === 'global' ? 'global' : 'unmapped',
            contextMappingError: draft.contextScope === 'global' ? '' : 'Review a timeline anchor/window mapping or explicitly designate this title as global.',
            allowedContexts: draft.contextScope === 'global' ? [{ scope: 'global' }] : [],
            explicitAnchorIds: [],
            explicitWindowIds: [],
            allowedAnchorIds: [],
            allowedWindowIds: [],
            omittedAnchorIds: [],
            omittedWindowIds: [],
        };
    }
    const allowedAnchorSet = new Set();
    const allowedWindowSet = new Set();
    const omittedAnchorIds = [];
    const omittedWindowIds = [];
    for (const id of explicitAnchorIds) {
        if (acceptedAnchorSet.has(id)) allowedAnchorSet.add(id);
        else omittedAnchorIds.push(id);
    }
    for (const id of explicitWindowIds) {
        if (acceptedWindowSet.has(id)) {
            allowedWindowSet.add(id);
            const windowDef = windowItems.find(item => item.id === id);
            if (windowDef?.anchorFrom && acceptedAnchorSet.has(windowDef.anchorFrom)) allowedAnchorSet.add(windowDef.anchorFrom);
            if (windowDef?.anchorTo && acceptedAnchorSet.has(windowDef.anchorTo)) allowedAnchorSet.add(windowDef.anchorTo);
        } else {
            omittedWindowIds.push(id);
        }
    }
    const allowedContexts = [
        ...anchorItems.filter(anchor => explicitAnchorIds.includes(anchor.id)).map(anchor => ({
            scope: 'anchor', anchorId: anchor.id, sortKeyFrom: anchor.sortKey, sortKeyTo: anchor.sortKey,
        })),
        ...windowItems.filter(window => explicitWindowIds.includes(window.id)).map(window => ({
            scope: 'window', validFromAnchor: window.anchorFrom, validToAnchor: window.anchorTo,
            sortKeyFrom: window.sortKeyFrom ?? anchorItems.find(anchor => anchor.id === window.anchorFrom)?.sortKey,
            sortKeyTo: window.sortKeyTo ?? anchorItems.find(anchor => anchor.id === window.anchorTo)?.sortKey,
        })),
    ];
    const invalidBounds = allowedContexts.some(context =>
        !Number.isFinite(context.sortKeyFrom) || !Number.isFinite(context.sortKeyTo)
        || context.sortKeyFrom > context.sortKeyTo
        || (context.scope === 'window' && (!acceptedAnchorSet.has(context.validFromAnchor) || !acceptedAnchorSet.has(context.validToAnchor))));
    const contextMappingError = draft.contextScope === 'global' || omittedAnchorIds.length || omittedWindowIds.length || invalidBounds || !allowedContexts.length
        ? 'Review this title mapping: it contains conflicting scope, missing references, or invalid registry bounds.' : '';
    return {
        timelineReferenceMode: 'explicit',
        contextMappingError,
        allowedContexts,
        explicitAnchorIds,
        explicitWindowIds,
        allowedAnchorIds: orderTimelineIds([...allowedAnchorSet], anchorIds),
        allowedWindowIds: orderTimelineIds([...allowedWindowSet], windowIds),
        omittedAnchorIds,
        omittedWindowIds,
    };
}

function normalizeTargetTitleId(draft = {}, fallback = '') {
    return cleanString(draft.titleId || draft.id || draft.targetEntryId || fallback, 180);
}

function normalizeTargetEntryId(draft = {}, fallback = '') {
    return cleanString(draft.targetEntryId || draft.titleId || draft.id || fallback, 180);
}

export function preflightLoredeckCreatorEntryTargets(input = {}) {
    const targetTitles = Array.isArray(input.targetTitles) ? input.targetTitles : [];
    const acceptedTagIds = collectRegistryTagIds(input.tagRegistry);
    const acceptedTagSet = new Set(acceptedTagIds);
    const compactMaps = buildCompactResolutionMap(acceptedTagIds);
    const diagnostics = [];
    const targets = targetTitles.map((draft, index) => {
        const titleId = normalizeTargetTitleId(draft, `title-${index + 1}`);
        const targetEntryId = normalizeTargetEntryId(draft, titleId);
        const timelineReferences = buildTargetTimelineReferences(draft, input.timelineRegistry);
        const suggestedTags = normalizeSchemaV3RepairEntryTagList(draft?.suggestedTags || draft?.tags || draft?.tagHints || [], 24);
        const allowedEntryTags = [];
        const omittedTitleTags = [];
        const ambiguousTitleTags = [];
        const seenAllowed = new Set();
        for (const rawTag of suggestedTags) {
            const resolved = resolveAcceptedTag(rawTag, acceptedTagSet, compactMaps);
            if (resolved.status === 'accepted') {
                if (resolved.tagId && !seenAllowed.has(resolved.tagId)) {
                    seenAllowed.add(resolved.tagId);
                    allowedEntryTags.push(resolved.tagId);
                }
                continue;
            }
            if (resolved.status === 'ambiguous') {
                ambiguousTitleTags.push(resolved.normalized);
                diagnostics.push({
                    targetTitleId: titleId,
                    targetEntryId,
                    phase: 'target_preflight',
                    reasonCode: 'ambiguous_tag_reference',
                    message: `Ambiguous title tag ${resolved.normalized}.`,
                    ambiguousTag: resolved.normalized,
                    candidates: resolved.candidates,
                    retryable: false,
                    safeLocalRepairAvailable: false,
                });
                continue;
            }
            if (resolved.status === 'omitted') {
                omittedTitleTags.push(resolved.normalized);
                diagnostics.push({
                    targetTitleId: titleId,
                    targetEntryId,
                    phase: 'target_preflight',
                    reasonCode: 'unknown_tag',
                    message: `Title tag ${resolved.normalized} is not in the accepted tag registry.`,
                    unknownTags: [resolved.normalized],
                    retryable: true,
                    safeLocalRepairAvailable: true,
                });
            }
        }
        for (const id of timelineReferences.omittedAnchorIds) {
            diagnostics.push({
                targetTitleId: titleId,
                targetEntryId,
                phase: 'target_preflight',
                reasonCode: 'unknown_anchor',
                message: `Title timeline anchor ${id} is not in the accepted timeline registry.`,
                unknownAnchors: [id],
                retryable: true,
                safeLocalRepairAvailable: false,
            });
        }
        for (const id of timelineReferences.omittedWindowIds) {
            diagnostics.push({
                targetTitleId: titleId,
                targetEntryId,
                phase: 'target_preflight',
                reasonCode: 'unknown_timeline_window',
                message: `Title timeline window ${id} is not in the accepted timeline registry.`,
                unknownAnchors: [id],
                retryable: true,
                safeLocalRepairAvailable: false,
            });
        }
        const planningGaps = [
            ...omittedTitleTags.map(tag => ({
                kind: 'tag',
                id: tag,
                reasonCode: 'unknown_tag',
                message: `Accepted tag registry is missing ${tag}.`,
            })),
            ...ambiguousTitleTags.map(tag => ({
                kind: 'tag',
                id: tag,
                reasonCode: 'ambiguous_tag_reference',
                message: `Accepted tag registry has multiple compact matches for ${tag}.`,
            })),
            ...timelineReferences.omittedAnchorIds.map(id => ({
                kind: 'timeline_anchor',
                id,
                reasonCode: 'unknown_anchor',
                message: `Accepted timeline registry is missing anchor ${id}.`,
            })),
            ...timelineReferences.omittedWindowIds.map(id => ({
                kind: 'timeline_window',
                id,
                reasonCode: 'unknown_timeline_window',
                message: `Accepted timeline registry is missing window ${id}.`,
            })),
            ...(timelineReferences.contextMappingError ? [{
                kind: 'context_mapping', id: titleId, reasonCode: 'context_mapping_required',
                message: timelineReferences.contextMappingError,
            }] : []),
        ];
        return {
            ...draft,
            titleId,
            targetEntryId,
            suggestedTags,
            tags: allowedEntryTags,
            allowedEntryTags,
            omittedTitleTags,
            allowedAnchorIds: timelineReferences.allowedAnchorIds,
            allowedWindowIds: timelineReferences.allowedWindowIds,
            omittedAnchorIds: timelineReferences.omittedAnchorIds,
            omittedWindowIds: timelineReferences.omittedWindowIds,
            explicitAnchorIds: timelineReferences.explicitAnchorIds,
            explicitWindowIds: timelineReferences.explicitWindowIds,
            timelineReferenceMode: timelineReferences.timelineReferenceMode,
            planningGaps,
            preflightStatus: planningGaps.length ? 'gaps' : 'ready',
            contextMappingError: timelineReferences.contextMappingError,
            allowedContexts: timelineReferences.allowedContexts,
        };
    });
    const omittedTagCount = targets.reduce((sum, target) => sum + target.omittedTitleTags.length, 0);
    const ambiguousTagCount = targets.reduce((sum, target) => sum + target.planningGaps.filter(gap => gap.reasonCode === 'ambiguous_tag_reference').length, 0);
    const omittedAnchorCount = targets.reduce((sum, target) => sum + target.omittedAnchorIds.length, 0);
    const omittedWindowCount = targets.reduce((sum, target) => sum + target.omittedWindowIds.length, 0);
    return {
        targetTitleDrafts: targets,
        diagnostics,
        summary: {
            targetCount: targets.length,
            acceptedTagCount: acceptedTagIds.length,
            omittedTagCount,
            ambiguousTagCount,
            omittedAnchorCount,
            omittedWindowCount,
            planningGapCount: targets.reduce((sum, target) => sum + target.planningGaps.length, 0),
        },
    };
}
