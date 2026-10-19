/**
 * loredeck-virtual-data.js - Saga
 * Helpers for Custom/Generated Loredecks backed by embedded runtime data.
 */

import {
    buildEmbeddedCustomManifest,
    buildLoredeckStatsFromEntries,
    cloneLoredeckJson,
} from './loredeck-package-helpers.js';

export function isVirtualLoredeckPack(pack) {
    return !!(pack?.manifestData && typeof pack.manifestData === 'object' && !Array.isArray(pack.manifestData));
}

export function isGeneratedLoredeckPack(pack) {
    return String(pack?.type || pack?.manifestData?.type || '').trim() === 'generated';
}

export function getAcceptedVirtualLoredeckEntries(pack = {}) {
    if (!isVirtualLoredeckPack(pack)) return [];
    const overrides = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? pack.entryOverrides
        : {};
    const disabled = new Set(Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : []);
    const schemaVersion = Math.max(3, Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 0);
    const entries = [];
    for (const [key, raw] of Object.entries(overrides)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id || disabled.has(id)) continue;
        const entry = cloneLoredeckJson(raw) || { ...raw };
        entry.id = id;
        entry.schemaVersion = Number(entry.schemaVersion) || schemaVersion;
        entries.push(entry);
    }
    return entries;
}

export function canUseVirtualLoredeckData(pack = {}) {
    return isVirtualLoredeckPack(pack) && !String(pack?.manifest || '').trim()
        && (isGeneratedLoredeckPack(pack) || getAcceptedVirtualLoredeckEntries(pack).length > 0);
}

export function canUseGeneratedVirtualLoredeckData(pack = {}) {
    return isGeneratedLoredeckPack(pack) && canUseVirtualLoredeckData(pack);
}

export function canValidateLoredeckInEditor(pack = {}) {
    return !!String(pack?.manifest || '').trim()
        || !!String(pack?.payloadFile || '').trim()
        || canUseVirtualLoredeckData(pack);
}

export function getAcceptedGeneratedLoredeckEntries(pack = {}) {
    if (!isGeneratedLoredeckPack(pack)) return [];
    return getAcceptedVirtualLoredeckEntries(pack);
}

export function buildLoredeckStatsFromHealth(health = null) {
    const summary = health?.summary || {};
    return {
        entryCount: Math.max(0, Number(summary.entryCount) || 0),
        categoryCounts: summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
            ? { ...summary.categoryCounts }
            : {},
    };
}

export function refreshGeneratedLoredeckDerivedMetadata(record = {}) {
    if (!isGeneratedLoredeckPack(record)) return record;
    const entries = getAcceptedGeneratedLoredeckEntries(record);
    const stats = buildLoredeckStatsFromEntries(entries);
    const entrySchemaVersion = Math.max(3, Number(record.entrySchemaVersion || record.manifestData?.entrySchemaVersion) || 0);
    record.entrySchemaVersion = entrySchemaVersion;
    record.stats = stats;
    const baseManifest = cloneLoredeckJson(record.manifestData) || {};
    if (!String(record.manifest || '').trim()) baseManifest.files = [];
    baseManifest.entrySchemaVersion = entrySchemaVersion;
    baseManifest.stats = stats;
    record.manifestData = buildEmbeddedCustomManifest(baseManifest, record);
    return record;
}

export function buildGeneratedLoredeckEntryCache(pack = {}, manifest = {}) {
    const entries = getAcceptedVirtualLoredeckEntries(pack);
    const schemaVersion = Math.max(3, Number(manifest.entrySchemaVersion || pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 0);
    const entryFiles = entries.length
        ? [{
            file: isGeneratedLoredeckPack(pack) ? '__saga_generated_entries__' : '__saga_embedded_entries__',
            url: null,
            ok: true,
            json: {
                schemaVersion,
                entries,
            },
            entries,
            schemaVersion,
        }]
        : [];
    return {
        manifest,
        baseUrl: null,
        entries,
        entryFiles,
    };
}
