/**
 * Lore context, bulk generation, pending review, and timeline restore state operations.
 */

import { buildLoreGenerationKey, mergeLoreEntries, normalizeLoreContext, normalizeLoreEntry, normalizeLoreMatrix } from '../lorecards/lore-matrix.js';
import { getLoreAutomationState, setLoreAutomationEnabled } from '../lorecards/lore-automation.js';
import { ensureLoreSelectionShape, getLoreEntryBaseRelevance } from '../lorecards/lore-selection.js';
import { preprocessPendingLoreEntries } from '../lorecards/pending-lore-preprocessor.js';
import { captureLoreTimelineState, recordLoreTimelineEvent, restoreTimelineEntriesToPending } from '../lorecards/lore-timeline.js';
import { getDefaultState as createDefaultState } from './constants.js';
import { appendStateBackupRecord } from './state-backup.js';
import { getSettings as readSettings } from './settings-store.js';
import {
    cleanContextString,
    normalizeContextBrief,
    normalizeLoredeckContext,
    normalizeLoredeckContexts,
} from './lore-state-normalizers.js';

let storeDeps = {};

export function configureLoreGenerationStateStore(deps = {}) {
    storeDeps = { ...deps };
}

function getState() {
    if (typeof storeDeps.getState === 'function') return storeDeps.getState();
    throw new Error('Lore generation state store is not configured.');
}

function saveState(state, options) {
    if (typeof storeDeps.saveState === 'function') return storeDeps.saveState(state, options);
    throw new Error('Lore generation state store is not configured.');
}

function getSettings() {
    return typeof storeDeps.getSettings === 'function' ? storeDeps.getSettings() : readSettings();
}

function getDefaultState() {
    return typeof storeDeps.getDefaultState === 'function' ? storeDeps.getDefaultState() : createDefaultState();
}

function truncateText(value, limit = 1000) {
    return String(value || '').slice(0, limit);
}

// ── Lore-specific state operations ──────────────────────────────────────────────

/**
 * Updates loreContext on the live state object and persists.
 * Used after lore context detection completes.
 * @param {Object} contextUpdate - Partial lore context to merge
 * @returns {Object} Updated state (the live object, not a clone)
 */
/**
 * If the candidate is a non-blank string, return it; otherwise keep the fallback.
 * Prevents an empty detection result from overwriting a known context value.
 * @param {*} candidate - The detected value (may be empty string, null, undefined)
 * @param {string} fallback - The previous known value
 * @returns {string}
 */
function keepIfBlank(candidate, fallback) {
    return typeof candidate === 'string' && candidate.trim()
        ? candidate.trim()
        : (fallback || '');
}

/**
 * Updates loreContext on the live state object and persists.
 * Used after lore context detection completes.
 *
 * Empty-string detector results are treated as "unknown" and do NOT overwrite
 * previously known context. Only non-blank values replace existing fields.
 *
 * @param {Object} contextUpdate - Partial lore context to merge
 * @returns {Object} Updated state (the live object, not a clone)
 */
export function setLoreContext(contextUpdate) {
    const state = getState();
    const previous = state.loreContext || {};

    // Only allow detection to update actual context fields, never metadata.
    // normalizeLoreContext fills missing fields with empty strings,
    // so spreading it unconditionally would clear lastGeneratedFor/lastGenerationSummary.
    state.loreContext = normalizeLoreContext({
        ...previous,
        sceneDate: keepIfBlank(contextUpdate?.sceneDate, previous.sceneDate),
        subjectiveDate: keepIfBlank(contextUpdate?.subjectiveDate, previous.subjectiveDate),
        canonBoundary: keepIfBlank(contextUpdate?.canonBoundary, previous.canonBoundary),
        branchId: keepIfBlank(contextUpdate?.branchId, previous.branchId || 'main'),
        timeTravelMode: keepIfBlank(contextUpdate?.timeTravelMode, previous.timeTravelMode || 'none'),
        lastDetectedAt: Date.now(),
        lastGeneratedFor: previous.lastGeneratedFor || '',
        lastGenerationSummary: previous.lastGenerationSummary || '',
    });

    saveState(state);
    return state;
}

// ── Lore generation lifecycle ledger ────────────────────────────────────────────

/**
 * Records a lore generation attempt in the ledger.
 * Does NOT mark the context as proposed — just logs the attempt.
 * Safe to call even if loreGeneration doesn't exist yet (initializes on demand).
 *
 * The attemptCount only increments when options.increment is true (default).
 * Pass { increment: false } for status updates that follow an already-counted
 * attempt (e.g. recording a failure for an attempt that was already started),
 * so a single real generation attempt is not counted multiple times.
 *
 * When the patched status is a failure ('failed_*') or 'empty', the top-level
 * loreGeneration.lastFailedFor is updated to this context key.
 *
 * @param {string} contextKey - The current lore generation key
 * @param {Object} [patch={}] - Additional fields to merge into the attempt record
 * @param {Object} [options={}] - { increment?: boolean } — whether to bump attemptCount
 * @returns {Object} Updated state
 */
export function setContextBrief(briefUpdate, options = {}) {
    const state = getState();
    state.contextBrief = normalizeContextBrief(briefUpdate || {}, state.loreContext || {});
    if (options.save !== false) saveState(state);
    return state;
}

export function getLoredeckContext(state = getState(), packId = '') {
    const id = cleanContextString(packId, 120);
    if (!id) return normalizeLoredeckContext(null, '', state?.loreContext || {});
    const contexts = normalizeLoredeckContexts(state?.loredeckContexts || {}, state || {});
    return contexts[id] || normalizeLoredeckContext(null, id, state?.loreContext || {});
}

export function setLoredeckContext(packId, patch = {}) {
    const id = cleanContextString(packId, 120);
    if (!id) return getState();
    const state = getState();
    state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
    const previous = state.loredeckContexts[id] || normalizeLoredeckContext(null, id, state.loreContext || {});
    state.loredeckContexts[id] = normalizeLoredeckContext({
        ...previous,
        ...(patch || {}),
        packId: id,
        updatedAt: Number.isFinite(Number(patch?.updatedAt)) ? Number(patch.updatedAt) : Date.now(),
    }, id, state.loreContext || {});
    saveState(state);
    return state;
}

export function resetLoredeckContext(packId) {
    const id = cleanContextString(packId, 120);
    if (!id) return getState();
    const state = getState();
    state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
    state.loredeckContexts[id] = normalizeLoredeckContext(null, id, {});
    state.loredeckContexts[id].updatedAt = Date.now();
    saveState(state);
    return state;
}

export function recordLoreAttempt(contextKey, patch = {}, options = {}) {
    const { increment = true, syncPrompt = true } = options;
    const state = getState();

    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }

    const previous = state.loreGeneration.attempts[contextKey] || {
        attemptCount: 0,
    };

    state.loreGeneration.attempts[contextKey] = {
        ...previous,
        ...patch,
        attemptCount: previous.attemptCount + (increment ? 1 : 0),
        lastAttemptAt: increment ? Date.now() : previous.lastAttemptAt,
        lastUpdatedAt: Date.now(),
    };

    if (increment) {
        state.loreGeneration.lastAttemptedFor = contextKey;
    }

    // Track the most recent failed/empty context at the top level
    const status = String(patch.status || '');
    if (status.startsWith('failed') || status === 'empty') {
        state.loreGeneration.lastFailedFor = contextKey;
    }

    saveState(state, { syncPrompt });
    return state;
}

function ensureLoreBulkGenerationLedger(state = getState()) {
    if (!state.loreBulkGeneration || typeof state.loreBulkGeneration !== 'object' || Array.isArray(state.loreBulkGeneration)) {
        state.loreBulkGeneration = getDefaultState().loreBulkGeneration;
    }
    for (const key of ['batches', 'chunks', 'candidates']) {
        if (!state.loreBulkGeneration[key] || typeof state.loreBulkGeneration[key] !== 'object' || Array.isArray(state.loreBulkGeneration[key])) {
            state.loreBulkGeneration[key] = {};
        }
    }
    state.loreBulkGeneration.activeBatchId = String(state.loreBulkGeneration.activeBatchId || '');
    state.loreBulkGeneration.lastBatchId = String(state.loreBulkGeneration.lastBatchId || '');
    return state.loreBulkGeneration;
}

function compactBulkCandidateFact(raw = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const messageRefs = Array.isArray(raw.messageRefs) ? raw.messageRefs : [];
    return {
        category: truncateText(raw.category || 'knowledge', 60),
        subject: truncateText(raw.subject || 'Story fact', 160),
        fact: truncateText(raw.fact || raw.text || raw.description || '', 900),
        priorityHint: truncateText(raw.priorityHint || raw.priority || 'medium', 40),
        confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0.75,
        messageRefs: messageRefs.map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0).slice(0, 20),
        scope: raw.scope && typeof raw.scope === 'object' ? raw.scope : {},
        evidence: truncateText(raw.evidence || '', 400),
        chunkId: truncateText(raw.chunkId || '', 180),
        startIndex: Number.isFinite(Number(raw.startIndex)) ? Number(raw.startIndex) : 0,
        endIndex: Number.isFinite(Number(raw.endIndex)) ? Number(raw.endIndex) : 0,
    };
}

function compactBulkCandidates(candidates = [], limit = 80) {
    const raw = Array.isArray(candidates) ? candidates : [];
    return raw.slice(0, Math.max(0, Number(limit) || 80)).map(compactBulkCandidateFact).filter(Boolean);
}

function compactBulkLedger(state, options = {}) {
    const ledger = ensureLoreBulkGenerationLedger(state);
    const retainCompletedBatches = Math.max(1, Number(options.retainCompletedBatches) || Number(getSettings().loreBulkRetainCompletedBatches) || 3);
    const batchEntries = Object.entries(ledger.batches || {}).sort((a, b) => Number(b[1]?.updatedAt || b[1]?.createdAt || 0) - Number(a[1]?.updatedAt || a[1]?.createdAt || 0));
    const keepBatchIds = new Set();
    let completedKept = 0;
    for (const [id, batch] of batchEntries) {
        const status = String(batch?.status || '');
        if (id === ledger.activeBatchId || status === 'running' || status === 'queued' || status === 'partial' || status === 'failed') {
            keepBatchIds.add(id);
        } else if (completedKept < retainCompletedBatches) {
            keepBatchIds.add(id);
            completedKept++;
        }
    }
    if (ledger.lastBatchId) keepBatchIds.add(ledger.lastBatchId);

    for (const id of Object.keys(ledger.batches || {})) {
        if (!keepBatchIds.has(id)) delete ledger.batches[id];
    }
    for (const [chunkId, chunk] of Object.entries(ledger.chunks || {})) {
        if (chunk?.batchId && !keepBatchIds.has(chunk.batchId)) delete ledger.chunks[chunkId];
    }
    for (const [chunkId, record] of Object.entries(ledger.candidates || {})) {
        if (record?.batchId && !keepBatchIds.has(record.batchId)) delete ledger.candidates[chunkId];
    }
    return ledger;
}

function saveBulkLedgerState(state, options = {}) {
    const { full = false, syncPrompt = false } = options || {};
    if (full) {
        compactBulkLedger(state, options);
    }
    saveState(state, { syncPrompt, sanitize: full });
}

/**
 * Creates or updates a resumable bulk lore scan batch.
 * Batch creation is an immediate durable checkpoint, but it deliberately does
 * not queue prompt-injection sync because Pending Review/Accepted Lorecards state has not changed.
 * @param {Object} batch - Batch metadata. Must include id.
 * @returns {Object} Updated state
 */
export function startLoreBulkBatch(batch = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batch.id || `lore_bulk_${Date.now()}`);
    const previous = ledger.batches[id] || {};
    ledger.batches[id] = {
        ...previous,
        ...batch,
        id,
        status: batch.status || 'running',
        createdAt: previous.createdAt || Date.now(),
        updatedAt: Date.now(),
        startedAt: batch.startedAt || previous.startedAt || Date.now(),
        lastFullCheckpointAt: previous.lastFullCheckpointAt || 0,
        lastFullCheckpointChunkCount: previous.lastFullCheckpointChunkCount || 0,
    };
    ledger.activeBatchId = id;
    ledger.lastBatchId = id;
    saveBulkLedgerState(state, { full: true, syncPrompt: false });
    return state;
}

/**
 * Patches a bulk lore scan batch.
 * @param {string} batchId - Batch id
 * @param {Object} patch - Fields to merge
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function updateLoreBulkBatch(batchId, patch = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batchId || ledger.activeBatchId || ledger.lastBatchId || '');
    if (!id) return state;
    const previous = ledger.batches[id] || { id, createdAt: Date.now() };
    ledger.batches[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
    };
    if (patch.status && !['running', 'queued'].includes(String(patch.status))) {
        if (ledger.activeBatchId === id) ledger.activeBatchId = '';
    }
    saveBulkLedgerState(state, { full: options.full !== false, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Patches a single chunk in the bulk lore scan ledger.
 * @param {string} chunkId - Stable chunk id
 * @param {Object} patch - Fields to merge
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function updateLoreBulkChunk(chunkId, patch = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || '');
    if (!id) return state;
    const previous = ledger.chunks[id] || { id, attempts: 0, createdAt: Date.now() };
    ledger.chunks[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
    };
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Stores compact candidate facts for a completed bulk lore chunk.
 * @param {string} batchId - Batch id
 * @param {string} chunkId - Chunk id
 * @param {Object[]} candidates - Candidate fact objects
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function storeLoreBulkCandidates(batchId, chunkId, candidates = [], options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || '');
    if (!id) return state;
    ledger.candidates[id] = {
        batchId: String(batchId || ''),
        chunkId: id,
        candidates: compactBulkCandidates(candidates, options.maxCandidates || 80),
        updatedAt: Date.now(),
    };
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Writes a single durable bulk-scan checkpoint. This is the primary write-ahead
 * log primitive for large scans: one small, prompt-sync-free save records chunk
 * status, optional candidates, and optional batch counters.
 * @param {string} chunkId - Stable chunk id
 * @param {Object} payload - { batchId, chunkPatch, candidates, batchPatch, rawResponse }
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function checkpointLoreBulkChunk(chunkId, payload = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || payload.chunkId || '');
    if (!id) return state;
    const batchId = String(payload.batchId || payload.chunkPatch?.batchId || payload.batchPatch?.id || ledger.activeBatchId || ledger.lastBatchId || '');
    const previous = ledger.chunks[id] || { id, attempts: 0, createdAt: Date.now() };
    const rawResponse = payload.rawResponse && getSettings().loreBulkRetainRawResponses ? truncateText(payload.rawResponse, 20000) : '';
    ledger.chunks[id] = {
        ...previous,
        ...(payload.chunkPatch || {}),
        id,
        batchId: batchId || previous.batchId || '',
        rawResponse,
        updatedAt: Date.now(),
    };
    if (Array.isArray(payload.candidates)) {
        ledger.candidates[id] = {
            batchId,
            chunkId: id,
            candidates: compactBulkCandidates(payload.candidates, payload.maxCandidates || 80),
            updatedAt: Date.now(),
        };
    }
    if (batchId && payload.batchPatch && typeof payload.batchPatch === 'object') {
        const batchPrevious = ledger.batches[batchId] || { id: batchId, createdAt: Date.now() };
        ledger.batches[batchId] = {
            ...batchPrevious,
            ...payload.batchPatch,
            id: batchId,
            updatedAt: Date.now(),
        };
        if (payload.batchPatch.status && !['running', 'queued'].includes(String(payload.batchPatch.status))) {
            if (ledger.activeBatchId === batchId) ledger.activeBatchId = '';
        }
    }
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Marks stale in-flight chunks as interrupted so resuming scans can distinguish
 * abandoned work from currently running work.
 * @param {number} [staleMs] - Running/retrying chunks older than this are interrupted
 * @returns {Object} Updated state
 */
export function markInterruptedLoreBulkChunks(staleMs = 10 * 60 * 1000) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const cutoff = Date.now() - Math.max(1000, Number(staleMs) || 600000);
    let changed = false;
    for (const [id, chunk] of Object.entries(ledger.chunks || {})) {
        const status = String(chunk?.status || '');
        const updatedAt = Number(chunk?.updatedAt || chunk?.startedAt || chunk?.lastScannedAt || 0);
        if ((status === 'running' || status === 'retrying') && (!updatedAt || updatedAt < cutoff)) {
            ledger.chunks[id] = {
                ...chunk,
                status: 'interrupted',
                error: chunk?.error || 'Previous scan was interrupted before this chunk completed.',
                updatedAt: Date.now(),
            };
            changed = true;
        }
    }
    if (changed) saveBulkLedgerState(state, { full: false, syncPrompt: false });
    return state;
}

/**
 * Forces a full bulk ledger checkpoint after a batch of lightweight chunk writes.
 * @param {string} batchId - Batch id
 * @param {Object} [patch] - Optional batch patch
 * @returns {Object} Updated state
 */
export function flushLoreBulkFullCheckpoint(batchId, patch = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batchId || ledger.activeBatchId || ledger.lastBatchId || '');
    if (!id) return state;
    const previous = ledger.batches[id] || { id, createdAt: Date.now() };
    ledger.batches[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
        lastFullCheckpointAt: Date.now(),
        lastFullCheckpointChunkCount: Number(patch.completedChunks ?? previous.completedChunks ?? 0) + Number(patch.failedChunks ?? previous.failedChunks ?? 0),
    };
    if (patch.status && !['running', 'queued'].includes(String(patch.status))) {
        if (ledger.activeBatchId === id) ledger.activeBatchId = '';
    }
    saveBulkLedgerState(state, { full: true, syncPrompt: false });
    return state;
}

/**
 * Appends generated lore into Pending Review without replacing existing Pending Review entries.
 * Used by bulk lore scans so successful chunks commit partial progress immediately.
 * @param {Object[]} entries - Raw lore entries to append/merge
 * @param {Object} meta - Pending/batch metadata
 * @param {Object} options - { syncPrompt?: boolean, full?: boolean }
 * @returns {{ state: Object, changed: boolean, appendedCount: number, pendingCount: number }}
 */
export function appendPendingLoreEntries(entries, meta = {}, options = {}) {
    const { syncPrompt = true, full = true } = options;
    const state = getState();
    const settings = getSettings();
    const incoming = preprocessPendingLoreEntries(entries || [], state, settings);
    if (incoming.length === 0) {
        return { state, changed: false, appendedCount: 0, pendingCount: (state.pendingLoreEntries || []).length };
    }

    const before = normalizeLoreMatrix(state.pendingLoreEntries || []);
    const merged = mergeLoreEntries(before, incoming);
    state.pendingLoreEntries = merged;

    const contextKey = meta.contextKey || state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const oldMeta = state.pendingLoreMeta && typeof state.pendingLoreMeta === 'object' ? state.pendingLoreMeta : {};
    const rawEntryCount = Math.max(0, Number(oldMeta.rawEntryCount) || 0) + Math.max(0, Number(meta.rawEntryCount ?? incoming.length) || incoming.length);
    const normalizedEntryCount = Math.max(0, Number(oldMeta.normalizedEntryCount) || 0) + Math.max(0, Number(meta.normalizedEntryCount ?? incoming.length) || incoming.length);
    const duplicateCount = Math.max(0, Number(oldMeta.droppedDuplicateCount) || 0) + Math.max(0, Number(meta.droppedDuplicateCount) || 0);
    const qualityCount = Math.max(0, Number(oldMeta.droppedQualityCount) || 0) + Math.max(0, Number(meta.droppedQualityCount) || 0);
    const routedSimilarCount = Math.max(0, Number(oldMeta.routedSimilarCount) || 0) + Math.max(0, Number(meta.routedSimilarCount) || 0);
    const failedChunkCount = Math.max(0, Number(meta.failedChunkCount ?? oldMeta.failedChunkCount) || 0);
    const completedChunkCount = Math.max(0, Number(meta.completedChunkCount ?? oldMeta.completedChunkCount) || 0);
    const chunkCount = Math.max(0, Number(meta.chunkCount ?? oldMeta.chunkCount) || 0);

    state.pendingLoreMeta = {
        ...oldMeta,
        id: oldMeta.id || meta.id || `lore_batch_${Date.now()}`,
        contextKey,
        source: meta.source || oldMeta.source || 'manual_bulk',
        status: 'pending',
        createdAt: oldMeta.createdAt || Date.now(),
        updatedAt: Date.now(),
        summary: meta.summary || oldMeta.summary || '',
        rawEntryCount,
        normalizedEntryCount,
        validEntryCount: merged.length,
        droppedEntryCount: Math.max(0, rawEntryCount - merged.length),
        droppedDuplicateCount: duplicateCount,
        droppedQualityCount: qualityCount,
        routedSimilarCount,
        failedChunkCount,
        emptyChunkCount: Math.max(0, Number(meta.emptyChunkCount ?? oldMeta.emptyChunkCount) || 0),
        chunkCount,
        completedChunkCount,
        sourceMessageCount: Math.max(0, Number(meta.sourceMessageCount ?? oldMeta.sourceMessageCount) || 0),
        chunkSize: Math.max(0, Number(meta.chunkSize ?? oldMeta.chunkSize) || 0),
        generationMode: meta.generationMode || oldMeta.generationMode || '',
        generationConfiguredMode: meta.generationConfiguredMode || oldMeta.generationConfiguredMode || '',
        targetEntryCount: Math.max(0, Number(meta.targetEntryCount ?? oldMeta.targetEntryCount) || 0),
        storyLoreCountBefore: Math.max(0, Number(meta.storyLoreCountBefore ?? oldMeta.storyLoreCountBefore) || 0),
        bulkBatchId: meta.bulkBatchId || oldMeta.bulkBatchId || '',
        bulkChunkId: meta.bulkChunkId || oldMeta.bulkChunkId || '',
        bulk: meta.bulk === undefined ? (oldMeta.bulk) : !!meta.bulk,
    };

    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastProposedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'pending',
        lastProposedAt: Date.now(),
        validEntryCount: merged.length,
        rawEntryCount,
        normalizedEntryCount,
        droppedDuplicateCount: duplicateCount,
        droppedQualityCount: qualityCount,
        routedSimilarCount,
        generationMode: state.pendingLoreMeta.generationMode,
        targetEntryCount: state.pendingLoreMeta.targetEntryCount,
        lastSource: state.pendingLoreMeta.source,
    };

    saveState(state, { syncPrompt, sanitize: full });
    return { state, changed: true, appendedCount: Math.max(0, merged.length - before.length), pendingCount: merged.length };
}

/**
 * Patches pending lore metadata without changing pending entries.
 * Used by bulk scans to update final chunk/duplicate diagnostics even when later chunks add no new entries.
 * @param {Object} patch - Metadata fields to merge
 * @returns {Object} Updated state
 */
export function patchPendingLoreMeta(patch = {}, options = {}) {
    const state = getState();
    if (!state.pendingLoreMeta || typeof state.pendingLoreMeta !== 'object') {
        return state;
    }
    state.pendingLoreMeta = {
        ...state.pendingLoreMeta,
        ...patch,
        updatedAt: Date.now(),
        validEntryCount: Array.isArray(state.pendingLoreEntries) ? state.pendingLoreEntries.length : 0,
    };
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: options.full !== false });
    return state;
}

/**
 * Marks the current pending lore batch as stale because the context changed.
 * Updates pendingLoreMeta.status to 'stale' and persists.
 *
 * @param {string} [reason=''] - Why the pending lore is stale
 * @returns {Object} Updated state
 */
export function markPendingLoreStale(reason = '') {
    const state = getState();

    if (state.pendingLoreMeta && state.pendingLoreEntries?.length > 0) {
        state.pendingLoreMeta.status = 'stale';
        state.pendingLoreMeta.staleAt = Date.now();
        state.pendingLoreMeta.staleReason = reason || 'Context changed';
        saveState(state);
    }

    return state;
}

/**
 * Marks the old pending lore batch's ledger entry as 'replaced' when a new
 * generation overwrites it for a different context. Keeps the ledger truthful
 * so an abandoned 'pending' entry is not left dangling.
 *
 * No-op when there is no old pending context, or when the old context equals
 * the incoming one (a re-generation for the same context).
 *
 * @param {string} newContextKey - The context key of the incoming proposal
 * @returns {Object} Updated state
 */
export function markPendingLoreReplaced(newContextKey) {
    const state = getState();

    const oldMeta = state.pendingLoreMeta;
    const oldKey = oldMeta?.contextKey || '';
    const oldBatchId = oldMeta?.id || '';

    if (!oldKey || !state.loreGeneration?.attempts) {
        return state;
    }

    const previousAttempt = state.loreGeneration.attempts[oldKey] || {};

    state.loreGeneration.attempts[oldKey] = {
        ...previousAttempt,
        status: 'replaced',
        replacedAt: Date.now(),
        replacedBy: newContextKey || '',
        replacedBatchId: oldBatchId,
    };

    saveState(state);
    return state;
}

function uniqueMergedStrings(...arrays) {
    const seen = new Set();
    const out = [];
    for (const array of arrays) {
        for (const raw of Array.isArray(array) ? array : []) {
            const text = String(raw || '').trim();
            if (!text) continue;
            const key = text.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(text);
        }
    }
    return out;
}

function preparePendingLoreEntryForAcceptance(pendingEntry, existingEntries = []) {
    const pending = normalizeLoreEntry(pendingEntry);
    const generation = pending.extensions?.sagaGeneration || {};
    const review = pending.extensions?.sagaPendingReview || {};
    const operation = String(generation.operation || review.reviewRoute || '').toLowerCase();
    const targetId = String(generation.targetEntryId || review.targetEntryId || '').trim();
    if (!targetId || !['update', 'merge', 'supersede', 'conflict', 'possible_update', 'possible_merge'].includes(operation)) return pending;

    const current = normalizeLoreMatrix(existingEntries).find(entry => entry.id === targetId);
    if (!current || current.locked) return pending;

    const mergeMode = operation === 'merge' || operation === 'possible_merge';
    const currentContent = current.content || {};
    const pendingContent = pending.content || {};
    const mergedFact = mergeMode && current.fact && pending.fact && !String(current.fact).includes(pending.fact)
        ? `${current.fact} ${pending.fact}`.trim()
        : (pending.fact || current.fact);
    const mergedInjection = mergeMode && currentContent.injection && pendingContent.injection && !String(currentContent.injection).includes(pendingContent.injection)
        ? `${currentContent.injection} ${pendingContent.injection}`.trim()
        : (pendingContent.injection || currentContent.injection || mergedFact);

    return normalizeLoreEntry({
        ...current,
        ...pending,
        id: current.id,
        title: mergeMode ? current.title : (pending.title || current.title),
        locked: current.locked,
        userEdited: current.userEdited || pending.userEdited,
        protected: current.protected || pending.protected,
        tags: uniqueMergedStrings(current.tags, pending.tags),
        scope: {
            ...(current.scope || {}),
            ...(pending.scope || {}),
            characters: uniqueMergedStrings(current.scope?.characters, pending.scope?.characters),
            locations: uniqueMergedStrings(current.scope?.locations, pending.scope?.locations),
            factions: uniqueMergedStrings(current.scope?.factions, pending.scope?.factions),
            topics: uniqueMergedStrings(current.scope?.topics, pending.scope?.topics),
            objects: uniqueMergedStrings(current.scope?.objects, pending.scope?.objects),
            spells: uniqueMergedStrings(current.scope?.spells, pending.scope?.spells),
            schoolYears: uniqueMergedStrings(current.scope?.schoolYears, pending.scope?.schoolYears),
            books: uniqueMergedStrings(current.scope?.books, pending.scope?.books),
            eras: uniqueMergedStrings(current.scope?.eras, pending.scope?.eras),
        },
        content: {
            ...currentContent,
            ...pendingContent,
            fact: mergedFact,
            injection: mergedInjection,
            constraints: uniqueMergedStrings(currentContent.constraints, pendingContent.constraints),
            antiLore: uniqueMergedStrings(currentContent.antiLore, pendingContent.antiLore),
            notes: [currentContent.notes, pendingContent.notes].filter(Boolean).join(' '),
        },
        extensions: {
            ...(current.extensions || {}),
            ...(pending.extensions || {}),
            sagaGeneration: {
                ...(pending.extensions?.sagaGeneration || {}),
                acceptedAsOperation: operation,
                acceptedTargetEntryId: current.id,
                acceptedAt: Date.now(),
            },
        },
    });
}

function applyAcceptedLoreSelectionRecommendations(state, entries = []) {
    const selection = ensureLoreSelectionShape(state);
    const pinSet = new Set(Array.isArray(selection.pinnedIds) ? selection.pinnedIds : []);
    const muteSet = new Set(Array.isArray(selection.suppressedIds) ? selection.suppressedIds : []);
    const elevatedRecords = selection.elevated || {};
    const now = Date.now();
    for (const entry of normalizeLoreMatrix(entries)) {
        const generation = entry.extensions?.sagaGeneration || {};
        if (generation.recommendedMute) {
            muteSet.add(entry.id);
            pinSet.delete(entry.id);
            delete elevatedRecords[entry.id];
        } else if (generation.recommendedPin || entry.protected) {
            elevatedRecords[entry.id] = {
                elevatedAt: now,
                previousRelevance: getLoreEntryBaseRelevance(entry),
                previousIsActive: entry.isActive === true,
                previousMuted: muteSet.has(entry.id),
                previousLoreAutomation: getLoreAutomationState(entry),
            };
            muteSet.delete(entry.id);
            pinSet.delete(entry.id);
        }
    }
    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(muteSet);
    state.loreSelection.elevated = elevatedRecords;
    const elevatedIds = new Set(Object.keys(elevatedRecords));
    if (elevatedIds.size) {
        state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => (
            elevatedIds.has(entry.id)
                ? normalizeLoreEntry(setLoreAutomationEnabled(entry, false, { at: now, by: 'user', reason: 'manual_elevation' }))
                : entry
        ));
    }
}

function getPendingLoreTimelineSource(meta = {}, entries = []) {
    const source = String(meta?.source || entries?.[0]?.source || entries?.[0]?.sourceInfo?.work || '').toLowerCase();
    if (source.includes('canon')) return 'canon_database';
    if (source.includes('timeline')) return 'timeline_recovery';
    if (source.includes('manual') || source.includes('user')) return 'manual';
    if (source.includes('story') || source.includes('generation') || source.includes('bulk')) return 'story_generation';
    return 'pending_review';
}

function recordAcceptedLoreTimelineMutation(state, before, type, source, summary) {
    const after = captureLoreTimelineState(state);
    recordLoreTimelineEvent(state, { before, after, type, source, summary });
}

/**
 * Accepts Pending Review entries by merging them into loreMatrix.
 * Updates the generation ledger so the context is marked as accepted.
 * Locked/user-edited entries in the matrix are preserved.
 * @returns {Object} Updated state
 */
function canAcceptLayer1(state, entry) {
    const layer = entry.extensions?.layer1;
    return !layer || (layer.revision === state.layer1Analysis?.revision && ['ready', 'partial'].includes(state.layer1Analysis?.status));
}

function recordLayer1Rejection(state, entry) {
    if (entry.extensions?.layer1) (state.layer1Decisions ||= {})[entry.id] = { decision: 'rejected', at: Date.now() };
}

export function acceptPendingLoreEntries() {
    const settings = getSettings();
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []).filter(entry =>
        (!state.layer1ReviewRevision || entry.extensions?.layer1?.revision === state.layer1ReviewRevision)
        && canAcceptLayer1(state, entry));
    const existing = normalizeLoreMatrix(state.loreMatrix || []);

    if (pending.length === 0) return state;

    appendStateBackupRecord(state, 'before_accept_pending_lore', {
        label: `Before accepting ${pending.length} Pending Review entr${pending.length === 1 ? 'y' : 'ies'}.`,
    });

    const beforeTimeline = captureLoreTimelineState(state);
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const source = getPendingLoreTimelineSource(state.pendingLoreMeta, pending);

    const prepared = pending.map(entry => preparePendingLoreEntryForAcceptance(entry, existing));
    const merged = mergeLoreEntries(existing, prepared);

    // Accepted Lorecards are intentionally uncapped. The Lore tab uses paged rendering
    // so large matrices stay usable without deleting lower-priority entries.
    state.loreMatrix = merged;
    applyAcceptedLoreSelectionRecommendations(state, prepared);
    state.pendingLoreEntries = state.pendingLoreEntries.filter(entry => !pending.some(p => p.id === entry.id));
    state.pendingLoreMeta = null;

    if (state.loreContext) {
        state.loreContext.lastGenerationSummary = '';
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastAcceptedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'accepted',
        acceptedAt: Date.now(),
        validEntryCount: pending.length,
    };

    recordAcceptedLoreTimelineMutation(state, beforeTimeline, 'accept_pending', source, `Accepted ${pending.length} Pending Review entr${pending.length === 1 ? 'y' : 'ies'}.`);
    saveState(state);
    return state;
}

/**
 * Rejects Pending Review entries by clearing them without merging.
 * Updates the generation ledger so the context is marked as rejected
 * and auto-generation will not repeat it until context changes.
 * @returns {Object} Updated state
 */
export function rejectPendingLoreEntries() {
    const state = getState();
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []).filter(entry => !state.layer1ReviewRevision || entry.extensions?.layer1?.revision === state.layer1ReviewRevision);

    if (pending.length) {
        appendStateBackupRecord(state, 'before_reject_pending_lore', {
            label: `Before rejecting ${pending.length} Pending Review entr${pending.length === 1 ? 'y' : 'ies'}.`,
        });
    }

    for (const entry of pending) recordLayer1Rejection(state, entry);
    state.pendingLoreEntries = state.pendingLoreEntries.filter(entry => !pending.some(p => p.id === entry.id));
    state.pendingLoreMeta = null;

    if (state.loreContext) {
        state.loreContext.lastGenerationSummary = '';
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastRejectedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'rejected',
        rejectedAt: Date.now(),
    };

    saveState(state);
    return state;
}

/**
 * Accepts a single Pending Review entry by index, merging it into the lore matrix.
 * The remaining pending entries stay pending.
 * @param {number} entryIndex - Index into pendingLoreEntries array
 * @returns {{ state: Object, accepted: Object|null }} Updated state and the accepted entry
 */
export function acceptPendingLoreEntry(entryIndex) {
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []);
    const existing = normalizeLoreMatrix(state.loreMatrix || []);

    if (entryIndex < 0 || entryIndex >= pending.length || pending.length === 0) {
        return { state, accepted: null };
    }
    if (!canAcceptLayer1(state, pending[entryIndex])) return { state, accepted: null };

    const beforeTimeline = captureLoreTimelineState(state);
    const acceptedEntry = preparePendingLoreEntryForAcceptance(pending[entryIndex], existing);
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const source = getPendingLoreTimelineSource(state.pendingLoreMeta, [acceptedEntry]);

    // Merge the single entry into the uncapped lore matrix. UI paging handles scale.
    const merged = mergeLoreEntries(existing, [acceptedEntry]);

    state.loreMatrix = merged;
    applyAcceptedLoreSelectionRecommendations(state, [acceptedEntry]);

    // Remove the accepted entry from pending
    state.pendingLoreEntries = pending.filter((_, i) => i !== entryIndex);

    // If no more pending entries, clear the meta
    if (state.pendingLoreEntries.length === 0) {
        state.pendingLoreMeta = null;
        if (state.loreContext) {
            state.loreContext.lastGenerationSummary = '';
        }
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastAcceptedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: state.pendingLoreEntries.length === 0 ? 'accepted' : 'partial_accept',
        acceptedAt: Date.now(),
        acceptedEntryCount: (state.loreGeneration.attempts[contextKey]?.acceptedEntryCount || 0) + 1,
    };

    recordAcceptedLoreTimelineMutation(state, beforeTimeline, 'accept_pending_entry', source, `Accepted Pending Review entry: ${acceptedEntry.title || acceptedEntry.id}.`);
    saveState(state);
    return { state, accepted: acceptedEntry };
}

/**
 * Rejects a single Pending Review entry by index, removing it from pending.
 * The remaining pending entries stay pending.
 * @param {number} entryIndex - Index into pendingLoreEntries array
 * @returns {{ state: Object, rejected: Object|null }} Updated state and the rejected entry
 */
export function rejectPendingLoreEntry(entryIndex) {
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []);

    if (entryIndex < 0 || entryIndex >= pending.length || pending.length === 0) {
        return { state, rejected: null };
    }

    const rejectedEntry = pending[entryIndex];
    recordLayer1Rejection(state, rejectedEntry);
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);

    // Remove the rejected entry from pending
    state.pendingLoreEntries = pending.filter((_, i) => i !== entryIndex);

    // If no more pending entries, clear the meta
    if (state.pendingLoreEntries.length === 0) {
        state.pendingLoreMeta = null;
        if (state.loreContext) {
            state.loreContext.lastGenerationSummary = '';
        }
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastRejectedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: state.pendingLoreEntries.length === 0 ? 'rejected' : 'partial_reject',
        rejectedAt: Date.now(),
        rejectedEntryCount: (state.loreGeneration.attempts[contextKey]?.rejectedEntryCount || 0) + 1,
    };

    saveState(state);
    return { state, rejected: rejectedEntry };
}

// ── Utility: deep-merge defaults ────────────────────────────────────────────────

/**
 * Deep-merges default values into target for missing or invalid keys.
 * Returns target (mutated in place, but safe since these are schema-level objects).
 * @param {*} target - The existing value (may be undefined/null/non-object)
 * @param {Object} defaults - Default object to merge
 * @returns {Object} target with defaults filled in
 */
export function restoreLoreTimelineEntriesToPending(eventId, entryIds = null) {
    const state = getState();
    const result = restoreTimelineEntriesToPending(state, eventId, entryIds);
    if (result.restored > 0) saveState(state);
    return { state, ...result };
}
