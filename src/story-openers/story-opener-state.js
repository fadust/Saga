/**
 * Story Maker state model.
 */

export const STORY_OPENER_SCHEMA_VERSION = 1;
export const STORY_OPENER_SESSION_KIND = 'story_opener_session';
export const STORY_OPENER_INDEX_KIND = 'story_opener_index';

export const STORY_OPENER_STAGE_ORDER = Object.freeze([
    'inputs',
    'context_packet',
    'opener_brief',
    'draft_variants',
    'review_copy',
]);

export const STORY_OPENER_STAGES = Object.freeze([
    Object.freeze({
        id: 'inputs',
        label: 'Inputs',
        detail: 'Prompt, Context, style, shape, focus, PoV, tense, and length.',
        anchor: 'inputs',
    }),
    Object.freeze({
        id: 'context_packet',
        label: 'Context Packet',
        detail: 'Resolve latest sources and rank allowed, fresh, and blocked facts.',
        anchor: 'context-packet',
    }),
    Object.freeze({
        id: 'opener_brief',
        label: 'Opener Brief',
        detail: 'Reasoner turns the packet into writing instructions.',
        anchor: 'opener-brief',
    }),
    Object.freeze({
        id: 'draft_variants',
        label: 'Draft Variants',
        detail: 'Reasoner writes the requested 1-5 opener variants.',
        anchor: 'draft-variants',
    }),
    Object.freeze({
        id: 'review_copy',
        label: 'Review & Copy',
        detail: 'Browse, revise, and copy the selected opener.',
        anchor: 'review-copy',
    }),
]);

export const STORY_OPENER_TARGET_LENGTHS = Object.freeze([
    Object.freeze({ id: 'hook', label: 'Hook', description: 'Compact scene entry with one focused beat.' }),
    Object.freeze({ id: 'scene', label: 'Scene', description: 'Balanced setup, character grounding, and momentum.' }),
    Object.freeze({ id: 'chapter', label: 'Chapter', description: 'Longer opening with room for atmosphere and layered setup.' }),
]);

export const STORY_OPENER_OPENING_SHAPES = Object.freeze([
    'Scene Setting',
    'Dialogue first',
    'Action first',
    'Introspective',
    'Cold open',
    'Mystery hook',
]);

export const STORY_OPENER_POV_OPTIONS = Object.freeze([
    Object.freeze({ id: 'first', label: '1st', value: '1st person' }),
    Object.freeze({ id: 'second', label: '2nd', value: '2nd person' }),
    Object.freeze({ id: 'third', label: '3rd', value: '3rd person limited' }),
]);

export const STORY_OPENER_TENSE_OPTIONS = Object.freeze([
    Object.freeze({ id: 'past', label: 'Past', value: 'past tense' }),
    Object.freeze({ id: 'present', label: 'Present', value: 'present tense' }),
    Object.freeze({ id: 'future', label: 'Future', value: 'future tense' }),
]);

export const STORY_OPENER_SOURCE_STATUSES = Object.freeze(['current', 'changed', 'partial', 'missing']);
export const STORY_OPENER_ACTIVE_RUN_STATUSES = Object.freeze(['queued', 'running', 'retrying']);
export const STORY_OPENER_VARIANT_COUNT_MIN = 1;
export const STORY_OPENER_VARIANT_COUNT_MAX = 5;
export const STORY_OPENER_DEFAULT_OPENING_SHAPE = STORY_OPENER_OPENING_SHAPES[0];

const DEFAULT_CONTROLS = Object.freeze({
    userPrompt: '',
    context: '',
    proseStyle: '',
    openingShape: STORY_OPENER_DEFAULT_OPENING_SHAPE,
    characterFocus: '',
    pov: STORY_OPENER_POV_OPTIONS[2].value,
    tense: STORY_OPENER_TENSE_OPTIONS[0].value,
    targetLength: 'scene',
    variantCount: STORY_OPENER_VARIANT_COUNT_MIN,
});

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, Number(fallback) || 0);
    return Math.floor(numeric);
}

function normalizeRevision(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return Math.max(1, Number(fallback) || 1);
    return Math.floor(numeric);
}

export function normalizeStoryOpenerString(value = '', maxLength = 2000) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 2000));
}

export function normalizeStoryOpenerId(value = '', fallback = '') {
    const clean = normalizeStoryOpenerString(value, 180)
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return clean || fallback;
}

export function createStoryOpenerSessionId(seed = '') {
    const stem = normalizeStoryOpenerString(seed, 100)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'opener';
    return `opener-${stem}-${Date.now().toString(36)}`;
}

export function getStoryOpenerTargetLength(id = 'scene') {
    const clean = normalizeStoryOpenerString(id, 40).toLowerCase();
    return STORY_OPENER_TARGET_LENGTHS.find(item => item.id === clean) || STORY_OPENER_TARGET_LENGTHS[1];
}

function normalizeOptionValue(value = '', options = [], fallback = '') {
    const clean = normalizeStoryOpenerString(value, 160).toLowerCase();
    const exact = options.find(option => option.value.toLowerCase() === clean || option.id.toLowerCase() === clean);
    if (exact) return exact.value;
    const acceptsPov = options.some(option => option.id === 'first');
    const acceptsTense = options.some(option => option.id === 'past');
    if (acceptsPov && (clean.startsWith('1st') || clean.startsWith('first'))) return STORY_OPENER_POV_OPTIONS[0].value;
    if (acceptsPov && (clean.startsWith('2nd') || clean.startsWith('second'))) return STORY_OPENER_POV_OPTIONS[1].value;
    if (acceptsPov && (clean.startsWith('3rd') || clean.startsWith('third'))) return STORY_OPENER_POV_OPTIONS[2].value;
    if (acceptsTense && clean.startsWith('past')) return STORY_OPENER_TENSE_OPTIONS[0].value;
    if (acceptsTense && clean.startsWith('present')) return STORY_OPENER_TENSE_OPTIONS[1].value;
    if (acceptsTense && clean.startsWith('future')) return STORY_OPENER_TENSE_OPTIONS[2].value;
    return fallback;
}

function normalizeStoryOpenerOpeningShape(value = '') {
    const clean = normalizeStoryOpenerString(value, 180);
    if (!clean) return STORY_OPENER_DEFAULT_OPENING_SHAPE;
    const comparable = clean.toLowerCase().replace(/[-_]+/g, ' ');
    const preset = STORY_OPENER_OPENING_SHAPES.find(shape => shape.toLowerCase() === comparable);
    return preset || clean;
}

export function normalizeStoryOpenerVariantCount(value, fallback = DEFAULT_CONTROLS.variantCount) {
    const numeric = Number(value);
    const fallbackNumeric = Number(fallback);
    const raw = Number.isFinite(numeric) ? numeric : fallbackNumeric;
    return Math.max(
        STORY_OPENER_VARIANT_COUNT_MIN,
        Math.min(STORY_OPENER_VARIANT_COUNT_MAX, Math.floor(Number.isFinite(raw) ? raw : DEFAULT_CONTROLS.variantCount)),
    );
}

export function normalizeStoryOpenerControls(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const targetLength = getStoryOpenerTargetLength(raw.targetLength || DEFAULT_CONTROLS.targetLength).id;
    const legacyVariantCount = raw.variantsEnabled === true ? 3 : DEFAULT_CONTROLS.variantCount;
    return {
        userPrompt: normalizeStoryOpenerString(raw.userPrompt || raw.prompt, 5000),
        context: normalizeStoryOpenerString(raw.context || raw.storyPosition || raw.storyContext, 2000),
        proseStyle: normalizeStoryOpenerString(raw.proseStyle, 1200),
        openingShape: normalizeStoryOpenerOpeningShape(raw.openingShape),
        characterFocus: normalizeStoryOpenerString(raw.characterFocus, 800),
        pov: normalizeOptionValue(raw.pov || DEFAULT_CONTROLS.pov, STORY_OPENER_POV_OPTIONS, DEFAULT_CONTROLS.pov),
        tense: normalizeOptionValue(raw.tense || DEFAULT_CONTROLS.tense, STORY_OPENER_TENSE_OPTIONS, DEFAULT_CONTROLS.tense),
        targetLength,
        variantCount: normalizeStoryOpenerVariantCount(raw.variantCount, legacyVariantCount),
    };
}

export function normalizeStoryOpenerSourceIntent(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const stackItems = Array.isArray(raw.stackItems) ? raw.stackItems : [];
    return {
        capturedAt: normalizeTimestamp(raw.capturedAt, 0),
        sourceMode: ['loredeck_only', 'chat_enriched'].includes(raw.sourceMode) ? raw.sourceMode : 'loredeck_only',
        context: normalizeStoryOpenerString(raw.context, 2000),
        contextFingerprint: normalizeStoryOpenerString(raw.contextFingerprint, 160),
        stackItems: stackItems
            .map((item, index) => {
                if (!isPlainObject(item)) return null;
                const type = item.type === 'folder' ? 'folder' : 'deck';
                const packId = normalizeStoryOpenerString(item.packId || item.deckId, 180);
                const folderId = normalizeStoryOpenerString(item.folderId, 180);
                if (type === 'folder' && !folderId) return null;
                if (type === 'deck' && !packId) return null;
                return {
                    type,
                    enabled: item.enabled !== false,
                    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
                    ...(packId ? { packId } : {}),
                    ...(folderId ? { folderId } : {}),
                    ...(item.includeNested === false ? { includeNested: false } : {}),
                    label: normalizeStoryOpenerString(item.label, 240),
                };
            })
            .filter(Boolean)
            .slice(0, 80),
        packIds: Array.isArray(raw.packIds)
            ? [...new Set(raw.packIds.map(id => normalizeStoryOpenerString(id, 180)).filter(Boolean))].slice(0, 80)
            : [],
        fandoms: Array.isArray(raw.fandoms)
            ? [...new Set(raw.fandoms.map(id => normalizeStoryOpenerString(id, 180)).filter(Boolean))].slice(0, 24)
            : [],
        chatLorecardIds: Array.isArray(raw.chatLorecardIds)
            ? [...new Set(raw.chatLorecardIds.map(id => normalizeStoryOpenerString(id, 180)).filter(Boolean))].slice(0, 120)
            : [],
    };
}

export function normalizeStoryOpenerSourceResolution(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const status = STORY_OPENER_SOURCE_STATUSES.includes(raw.status) ? raw.status : 'missing';
    return {
        status,
        resolvedAt: normalizeTimestamp(raw.resolvedAt, 0),
        sourceMode: ['loredeck_only', 'chat_enriched'].includes(raw.sourceMode) ? raw.sourceMode : 'loredeck_only',
        packCount: Math.max(0, Math.floor(Number(raw.packCount) || 0)),
        eligibleFactCount: Math.max(0, Math.floor(Number(raw.eligibleFactCount) || 0)),
        blockedFactCount: Math.max(0, Math.floor(Number(raw.blockedFactCount) || 0)),
        freshFactCount: Math.max(0, Math.floor(Number(raw.freshFactCount) || 0)),
        diagnostics: Array.isArray(raw.diagnostics)
            ? raw.diagnostics.map(item => normalizeStoryOpenerDiagnostic(item)).filter(Boolean).slice(0, 40)
            : [],
        fingerprint: normalizeStoryOpenerString(raw.fingerprint, 240),
    };
}

export function normalizeStoryOpenerDiagnostic(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const severity = ['info', 'warning', 'error'].includes(raw.severity) ? raw.severity : 'info';
    const code = normalizeStoryOpenerString(raw.code, 120);
    const message = normalizeStoryOpenerString(raw.message, 1000);
    if (!code && !message) return null;
    return {
        severity,
        code,
        message,
        ...(isPlainObject(raw.detail) ? { detail: cloneJson(raw.detail) } : {}),
    };
}

export function normalizeStoryOpenerVariant(value = {}, fallbackIndex = 0) {
    const raw = isPlainObject(value) ? value : {};
    const id = normalizeStoryOpenerString(raw.id || raw.variantId, 120) || `variant-${fallbackIndex + 1}`;
    const label = normalizeStoryOpenerString(raw.label, 80) || `Variant ${String.fromCharCode(65 + fallbackIndex)}`;
    const rawVariantIndex = Number(raw.variantIndex);
    return {
        id,
        label,
        variantIndex: Number.isFinite(rawVariantIndex) && rawVariantIndex >= 0 ? Math.floor(rawVariantIndex) : fallbackIndex,
        text: normalizeStoryOpenerString(raw.text || raw.opener, 30000),
        prompt: normalizeStoryOpenerString(raw.prompt, 5000),
        createdAt: normalizeTimestamp(raw.createdAt, 0),
        sourceRunId: normalizeStoryOpenerString(raw.sourceRunId || raw.runId, 160),
        generationKey: normalizeStoryOpenerString(raw.generationKey, 512),
        inputHash: normalizeStoryOpenerString(raw.inputHash, 128),
        unitId: normalizeStoryOpenerString(raw.unitId, 160),
        checkpointPending: raw.checkpointPending === true,
        status: ['draft', 'selected', 'error'].includes(raw.status) ? raw.status : 'draft',
        attemptCount: Math.max(0, Math.floor(Number(raw.attemptCount) || 0)),
        ...(raw.failure ? { failure: normalizeStoryOpenerFailure(raw.failure) } : {}),
    };
}

export function normalizeStoryOpenerFailure(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    return {
        code: normalizeStoryOpenerString(raw.code || raw.errorCode, 160),
        stage: normalizeStoryOpenerString(raw.stage, 80),
        message: normalizeStoryOpenerString(raw.message || raw.error, 1400),
        recovery: normalizeStoryOpenerString(raw.recovery, 1000),
        providerTitle: normalizeStoryOpenerString(raw.providerTitle, 160),
        finishReason: normalizeStoryOpenerString(raw.finishReason, 160),
        maxTokens: Math.max(0, Math.floor(Number(raw.maxTokens) || 0)),
        ...(isPlainObject(raw.details) ? { details: cloneJson(raw.details) } : {}),
    };
}

export function normalizeStoryOpenerAttempt(value = {}, fallbackIndex = 0) {
    const raw = isPlainObject(value) ? value : {};
    const status = ['queued', 'running', 'retrying', 'complete', 'error', 'interrupted'].includes(raw.status)
        ? raw.status
        : (raw.errorCode || raw.code ? 'error' : 'complete');
    return {
        attemptId: normalizeStoryOpenerString(raw.attemptId || raw.id, 180) || `attempt-${fallbackIndex + 1}`,
        stage: normalizeStoryOpenerString(raw.stage, 80),
        unitId: normalizeStoryOpenerString(raw.unitId, 160),
        variantIndex: Number.isFinite(Number(raw.variantIndex)) ? Math.floor(Number(raw.variantIndex)) : null,
        variantLabel: normalizeStoryOpenerString(raw.variantLabel, 80),
        attempt: Math.max(1, Math.floor(Number(raw.attempt) || fallbackIndex + 1)),
        maxAttempts: Math.max(1, Math.floor(Number(raw.maxAttempts) || 1)),
        status,
        strategy: normalizeStoryOpenerString(raw.strategy, 120),
        providerTitle: normalizeStoryOpenerString(raw.providerTitle, 160),
        errorCode: normalizeStoryOpenerString(raw.errorCode || raw.code, 160),
        message: normalizeStoryOpenerString(raw.message, 1000),
        recovery: normalizeStoryOpenerString(raw.recovery, 1000),
        finishReason: normalizeStoryOpenerString(raw.finishReason, 160),
        maxTokens: Math.max(0, Math.floor(Number(raw.maxTokens) || 0)),
        visibleContentLength: Math.max(0, Math.floor(Number(raw.visibleContentLength) || 0)),
        repairAttempted: raw.repairAttempted === true,
        startedAt: normalizeTimestamp(raw.startedAt, 0),
        completedAt: normalizeTimestamp(raw.completedAt, 0),
    };
}

export function normalizeStoryOpenerRun(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const id = normalizeStoryOpenerString(raw.id || raw.runId, 160);
    if (!id) return null;
    const attempts = Array.isArray(raw.attempts)
        ? raw.attempts.map((attempt, index) => normalizeStoryOpenerAttempt(attempt, index)).filter(Boolean).slice(-40)
        : [];
    return {
        id,
        runId: id,
        stage: normalizeStoryOpenerString(raw.stage, 80),
        status: ['queued', 'running', 'retrying', 'complete', 'error', 'interrupted', 'cancelled'].includes(raw.status) ? raw.status : 'complete',
        label: normalizeStoryOpenerString(raw.label, 180),
        message: normalizeStoryOpenerString(raw.message, 1200),
        startedAt: normalizeTimestamp(raw.startedAt, 0),
        updatedAt: normalizeTimestamp(raw.updatedAt, 0),
        completedAt: normalizeTimestamp(raw.completedAt, 0),
        attemptCount: Math.max(attempts.length, Math.floor(Number(raw.attemptCount) || 0)),
        maxAttempts: Math.max(0, Math.floor(Number(raw.maxAttempts) || 0)),
        failedUnitCount: Math.max(0, Math.floor(Number(raw.failedUnitCount) || 0)),
        succeededUnitCount: Math.max(0, Math.floor(Number(raw.succeededUnitCount) || 0)),
        partial: raw.partial === true,
        ...(attempts.length ? { attempts } : {}),
        ...(raw.failure ? { failure: normalizeStoryOpenerFailure(raw.failure) } : {}),
    };
}

export function normalizeStoryOpenerSession(value = {}, options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const now = normalizeTimestamp(options.now, Date.now());
    const sessionId = normalizeStoryOpenerId(raw.sessionId || raw.id, '') || createStoryOpenerSessionId(raw.title || raw.controls?.userPrompt || '');
    const variants = Array.isArray(raw.variants)
        ? raw.variants.map((variant, index) => normalizeStoryOpenerVariant(variant, index)).filter(variant => variant.id)
        : [];
    const selectedVariantId = normalizeStoryOpenerString(raw.selectedVariantId || raw.activeVariantId, 120);
    const runs = {};
    for (const [runId, run] of Object.entries(isPlainObject(raw.generationRuns) ? raw.generationRuns : {})) {
        const normalized = normalizeStoryOpenerRun({ ...run, id: run.id || run.runId || runId });
        if (normalized) runs[normalized.id] = normalized;
    }
    const rawActiveGeneration = raw.activeGeneration ? normalizeStoryOpenerRun(raw.activeGeneration) : null;
    const lastGenerationResult = raw.lastGenerationResult ? normalizeStoryOpenerRun(raw.lastGenerationResult) : null;
    const activeGenerationSource = rawActiveGeneration?.id && runs[rawActiveGeneration.id]
        ? runs[rawActiveGeneration.id]
        : rawActiveGeneration;
    const activeGeneration = activeGenerationSource && STORY_OPENER_ACTIVE_RUN_STATUSES.includes(activeGenerationSource.status)
        ? activeGenerationSource
        : null;
    const currentStage = STORY_OPENER_STAGE_ORDER.includes(raw.currentStage) ? raw.currentStage : inferStoryOpenerCurrentStage({
        ...raw,
        controls: normalizeStoryOpenerControls(raw.controls || raw),
        variants,
    });
    const controls = normalizeStoryOpenerControls(raw.controls || raw);
    const title = normalizeStoryOpenerString(
        raw.title
        || controls.context
        || controls.userPrompt
        || 'Untitled opener',
        240,
    ) || 'Untitled opener';
    return {
        schemaVersion: STORY_OPENER_SCHEMA_VERSION,
        kind: STORY_OPENER_SESSION_KIND,
        sessionId,
        title,
        status: ['draft', 'running', 'blocked', 'complete', 'archived'].includes(raw.status) ? raw.status : 'draft',
        currentStage,
        revision: normalizeRevision(raw.revision, 1),
        createdAt: normalizeTimestamp(raw.createdAt, now),
        updatedAt: normalizeTimestamp(raw.updatedAt, now),
        controls,
        sourceIntent: normalizeStoryOpenerSourceIntent(raw.sourceIntent),
        lastSourceResolution: raw.lastSourceResolution ? normalizeStoryOpenerSourceResolution(raw.lastSourceResolution) : null,
        snapshots: isPlainObject(raw.snapshots) ? cloneJson(raw.snapshots) : {},
        openerBrief: isPlainObject(raw.openerBrief) ? cloneJson(raw.openerBrief) : null,
        variants,
        selectedVariantId: variants.some(variant => variant.id === selectedVariantId)
            ? selectedVariantId
            : (variants[0]?.id || ''),
        revisionHistory: Array.isArray(raw.revisionHistory)
            ? raw.revisionHistory.map((entry, index) => normalizeStoryOpenerHistoryEntry(entry, index)).filter(Boolean).slice(-80)
            : [],
        generationRuns: Object.fromEntries(Object.entries(runs).sort(([left], [right]) => left.localeCompare(right))),
        ...(activeGeneration ? { activeGeneration } : {}),
        ...(lastGenerationResult ? { lastGenerationResult } : {}),
    };
}

export function normalizeStoryOpenerHistoryEntry(value = {}, index = 0) {
    const raw = isPlainObject(value) ? rawClone(value) : {};
    const id = normalizeStoryOpenerString(raw.id || raw.revisionId, 120) || `revision-${index + 1}`;
    const text = normalizeStoryOpenerString(raw.text || raw.opener, 30000);
    const instruction = normalizeStoryOpenerString(raw.instruction || raw.prompt || raw.revisionPrompt, 5000);
    if (!text && !instruction) return null;
    return {
        id,
        text,
        instruction,
        createdAt: normalizeTimestamp(raw.createdAt, 0),
        variantId: normalizeStoryOpenerString(raw.variantId, 120),
        sourceRunId: normalizeStoryOpenerString(raw.sourceRunId || raw.runId, 160),
    };
}

function rawClone(value) {
    return cloneJson(value);
}

function inferStoryOpenerCurrentStage(raw = {}) {
    const controls = normalizeStoryOpenerControls(raw.controls || raw);
    if (!controls.userPrompt || !controls.context) return 'inputs';
    if (!isPlainObject(raw.snapshots?.contextPacket)) return 'context_packet';
    if (!isPlainObject(raw.openerBrief)) return 'opener_brief';
    if (!Array.isArray(raw.variants) || !raw.variants.length) return 'draft_variants';
    return 'review_copy';
}

export function getStoryOpenerSelectedVariant(session = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    return normalized.variants.find(variant => variant.id === normalized.selectedVariantId) || normalized.variants[0] || null;
}

export function getStoryOpenerReadiness(session = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const sourceIntent = normalizeStoryOpenerSourceIntent(options.sourceIntent || normalized.sourceIntent);
    const missing = [];
    if (!normalized.controls.userPrompt) missing.push('User Prompt');
    if (!normalized.controls.context) missing.push('Context');
    if (!globalThis.Saga?.bridge?.canonStatus?.().enabled && !sourceIntent.stackItems.length && !sourceIntent.packIds.length) missing.push('Loredeck stack');
    return {
        ready: missing.length === 0,
        missing,
        missingText: missing.length ? `Missing ${missing.join(', ')}.` : '',
    };
}

export function getStoryOpenerStageDescriptors(session = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const activeIndex = STORY_OPENER_STAGE_ORDER.indexOf(normalized.currentStage);
    const readiness = getStoryOpenerReadiness(normalized, options);
    const missingLoredeckStack = readiness.missing.includes('Loredeck stack');
    return STORY_OPENER_STAGES.map((stage, index) => {
        let status = 'locked';
        let dependency = '';
        let action = '';
        let actionLabel = '';
        let actionTooltip = '';
        let detailOverride = '';
        if (stage.id === 'inputs') {
            status = readiness.ready ? 'approved' : 'active';
            dependency = readiness.missingText;
        } else if (stage.id === 'context_packet') {
            if (!readiness.ready) {
                status = 'locked';
                if (missingLoredeckStack) {
                    action = 'add_loredecks';
                    actionLabel = 'Add Loredecks';
                    actionTooltip = 'No active Loredecks. Add one to fully use Context.';
                    detailOverride = 'No active Loredecks.';
                    dependency = actionTooltip;
                } else {
                    dependency = readiness.missingText;
                }
            } else if (normalized.snapshots?.contextPacket) status = 'approved';
            else status = activeIndex === index ? 'active' : 'ready';
        } else if (stage.id === 'opener_brief') {
            if (!normalized.snapshots?.contextPacket) dependency = 'Build Context Packet first.';
            else if (normalized.openerBrief) status = 'approved';
            else status = activeIndex === index ? 'active' : 'ready';
        } else if (stage.id === 'draft_variants') {
            if (!normalized.openerBrief) dependency = 'Build Opener Brief first.';
            else if (normalized.variants.length) status = 'approved';
            else status = activeIndex === index ? 'active' : 'ready';
        } else if (stage.id === 'review_copy') {
            if (!normalized.variants.length) dependency = 'Draft an opener first.';
            else status = activeIndex === index ? 'active' : 'approved';
        }
        if (STORY_OPENER_ACTIVE_RUN_STATUSES.includes(normalized.activeGeneration?.status) && normalized.activeGeneration.stage === stage.id) {
            status = 'generating';
        }
        if (normalized.lastGenerationResult?.status === 'error' && normalized.lastGenerationResult.stage === stage.id) {
            status = 'error';
        }
        if (status === 'locked' && !dependency) dependency = 'Complete the previous stage first.';
        const isCurrentStage = normalized.currentStage === stage.id && status !== 'locked';
        return {
            ...stage,
            index,
            number: index + 1,
            status,
            dependency,
            action,
            actionLabel,
            actionTooltip,
            detail: detailOverride || stage.detail,
            isComplete: status === 'approved',
            isActive: isCurrentStage || status === 'active' || status === 'generating',
            resettable: index > 0 && index < STORY_OPENER_STAGE_ORDER.length - 1 && status !== 'locked',
        };
    });
}

export function resetStoryOpenerToStage(session = {}, stageId = '') {
    const normalized = normalizeStoryOpenerSession(session);
    const target = STORY_OPENER_STAGE_ORDER.includes(stageId) ? stageId : 'inputs';
    const next = normalizeStoryOpenerSession({
        ...normalized,
        activeGeneration: null,
        lastGenerationResult: null,
        currentStage: target,
        updatedAt: Date.now(),
    });
    if (target === 'inputs') {
        next.snapshots = {};
        next.openerBrief = null;
        next.variants = [];
        next.selectedVariantId = '';
    } else if (target === 'context_packet') {
        delete next.snapshots.openerPrompt;
        next.openerBrief = null;
        next.variants = [];
        next.selectedVariantId = '';
    } else if (target === 'opener_brief') {
        next.variants = [];
        next.selectedVariantId = '';
    } else if (target === 'draft_variants') {
        next.selectedVariantId = next.variants[0]?.id || '';
    }
    return normalizeStoryOpenerSession(next);
}

export function createStoryOpenerRun(stage = '', options = {}) {
    const now = normalizeTimestamp(options.now, Date.now());
    const id = normalizeStoryOpenerString(options.id, 160) || `${stage || 'run'}-${now.toString(36)}`;
    return normalizeStoryOpenerRun({
        id,
        stage,
        status: options.status || 'running',
        label: options.label || '',
        message: options.message || '',
        startedAt: now,
        updatedAt: now,
    });
}

export function recordStoryOpenerRun(session = {}, run = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const normalizedRun = normalizeStoryOpenerRun(run);
    if (!normalizedRun) return normalized;
    normalized.generationRuns[normalizedRun.id] = normalizedRun;
    normalized.lastGenerationResult = normalizedRun;
    if (STORY_OPENER_ACTIVE_RUN_STATUSES.includes(normalizedRun.status)) normalized.activeGeneration = normalizedRun;
    else delete normalized.activeGeneration;
    normalized.updatedAt = Date.now();
    return normalizeStoryOpenerSession(normalized);
}
