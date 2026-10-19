/**
 * Deck Maker schema v3 entry draft guardrails.
 */

import {
    normalizeSchemaV3EntryOverrideForPack,
    normalizeSchemaV3RepairEntryTagList,
    repairSchemaV3EntryForPack,
} from './loredeck-schema-v3-entry-repair.js';
import { buildTargetTimelineReferences } from './loredeck-creator-entry-preflight.js';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCreatorSchemaV3EntryOverride(pack = {}, rawEntry = {}, id = '') {
    return normalizeSchemaV3EntryOverrideForPack(pack, rawEntry, id);
}

function getTargetTitleMeta(options = {}, entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return null;
    const source = options.targetTitleByEntryId;
    if (source instanceof Map) return source.get(id) || null;
    if (isPlainObject(source)) return source[id] || null;
    return null;
}

function getSafeOmittedTitleTagSet(options = {}, entryId = '') {
    const meta = getTargetTitleMeta(options, entryId) || {};
    return new Set(normalizeSchemaV3RepairEntryTagList(meta.omittedTitleTags || [], 64));
}

function getUnknownTagFromGuardError(error = '') {
    const match = String(error || '').trim().match(/^Unknown tag\s+(.+?)\.?$/i);
    return match ? (normalizeSchemaV3RepairEntryTagList([match[1]], 1)[0] || '') : '';
}

function splitSafeOmittedTitleTagErrors(errors = [], omittedTitleTags = new Set()) {
    const unsafeErrors = [];
    const droppedTags = [];
    for (const error of errors || []) {
        const unknownTag = getUnknownTagFromGuardError(error);
        if (unknownTag && omittedTitleTags.has(unknownTag)) {
            droppedTags.push(unknownTag);
            continue;
        }
        unsafeErrors.push(error);
    }
    return {
        unsafeErrors,
        droppedTags: [...new Set(droppedTags)],
    };
}

export function guardLoredeckCreatorEntryDraftChange(pack = {}, change = {}, options = {}) {
    const payload = isPlainObject(change.payload) ? { ...change.payload } : {};
    const entryOverrides = isPlainObject(payload.entryOverrides) ? payload.entryOverrides : {};
    const targetIds = new Set(Array.from(options.targetEntryIds || []).map(id => String(id || '').trim()).filter(Boolean));
    const nextOverrides = {};
    const warnings = [];
    const errors = [];
    let repaired = false;

    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        if (!rawEntry || !isPlainObject(rawEntry)) continue;
        const id = String(rawEntry.id || rawId || '').trim();
        if (!id) continue;
        if (targetIds.size && !targetIds.has(id)) {
            errors.push(`Entry ${id} is outside this Deck Maker micro-batch.`);
            continue;
        }
        const schemaVersion = Math.max(Number(rawEntry.schemaVersion) || 0, Number(pack.entrySchemaVersion) || Number(pack.manifestData?.entrySchemaVersion) || 0);
        if (schemaVersion < 3) {
            nextOverrides[id] = rawEntry;
            continue;
        }
        const repair = repairSchemaV3EntryForPack(pack, rawEntry, id, {
            rejectUnknownAnchors: true,
            rejectUnknownTags: true,
        });
        const mapping = buildTargetTimelineReferences(getTargetTitleMeta(options, id) || {}, pack.timelineRegistry);
        const context = repair.entry.context || {};
        const matchesMapping = !mapping.contextMappingError && mapping.allowedContexts.some(allowed => {
            if (context.scope !== allowed.scope) return false;
            if (['anchorId', 'validFromAnchor', 'validToAnchor'].some(key => (context[key] || '') !== (allowed[key] || ''))) return false;
            if (context.windowId || context.contextWindowId) return false;
            if (allowed.scope === 'global') {
                const retrieval = repair.entry.retrieval || {};
                return retrieval.activation === 'topic_or_entity' && retrieval.frequency === 'low' && retrieval.contextBoost === 'low';
            }
            return context.sortKeyFrom === allowed.sortKeyFrom && context.sortKeyTo === allowed.sortKeyTo;
        });
        if (!matchesMapping) errors.push(`Entry ${id} does not match its reviewed title context mapping. Review the title mapping before retrying.`);
        const safeOmittedTitleTags = getSafeOmittedTitleTagSet(options, id);
        const { unsafeErrors, droppedTags } = splitSafeOmittedTitleTagErrors(repair.errors, safeOmittedTitleTags);
        if (droppedTags.length) {
            warnings.push(`Dropped omitted title tag${droppedTags.length === 1 ? '' : 's'} ${droppedTags.join(', ')} before Draft Review.`);
        }
        warnings.push(...repair.warnings);
        errors.push(...unsafeErrors);
        if (repair.repaired) repaired = true;
        nextOverrides[id] = repair.entry;
    }

    if (errors.length) {
        return {
            change: null,
            warnings: [...new Set(warnings)].slice(0, 20),
            errors: [...new Set(errors)].slice(0, 20),
            repaired,
        };
    }
    return {
        change: {
            ...change,
            affectedEntryIds: Object.keys(nextOverrides),
            payload: {
                ...payload,
                entryOverrides: nextOverrides,
            },
            preview: warnings.length
                ? {
                    ...(change.preview || {}),
                    qualityWarnings: [
                        ...new Set([
                            ...((Array.isArray(change.preview?.qualityWarnings) ? change.preview.qualityWarnings : [])),
                            ...warnings,
                        ]),
                    ].slice(0, 12),
                }
                : change.preview,
        },
        warnings: [...new Set(warnings)].slice(0, 20),
        errors: [],
        repaired,
    };
}
