/**
 * loredeck-assistant.js -- Saga/Saga
 * Prompt and response helpers for Loredeck Assistant proposal drafting.
 */

import { extractLoreResponseText } from '../providers/lore-response-normalizer.js';

export const extractLoredeckAssistantResponseText = extractLoreResponseText;
export const LOREDECK_ASSISTANT_RESPONSE_CODES = Object.freeze({
    JSON_TRUNCATED_SALVAGED: 'json_truncated_salvaged',
});

const ASSISTANT_SUPPORTED_ACTIONS = Object.freeze(new Set([
    'upsert_entry',
    'disable_entry',
    'restore_entry',
    'upsert_tag_definition',
    'upsert_timeline_anchor',
    'upsert_timeline_window',
]));

const ASSISTANT_RUBRIC_LEVELS = Object.freeze(new Set(['high', 'medium', 'low', 'not_applicable']));

const ASSISTANT_RUBRIC_KEYS = Object.freeze([
    'sceneUtility',
    'activationClarity',
    'behavioralImpact',
    'relationshipImpact',
    'conflictStakes',
    'nonRedundancy',
    'injectionQuality',
    'contextFit',
]);

const CREATOR_COVERAGE_STATUSES = Object.freeze(new Set([
    'missing',
    'thin',
    'adequate',
    'rich',
    'not_applicable',
    'intentionally_light',
]));

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = 1000) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value, maxLength = 180) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanPackId(value, maxLength = 140) {
    return cleanId(value, maxLength)
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLength);
}

function cleanStringArray(value = [], limit = 24, maxLength = 240) {
    const input = Array.isArray(value) ? value : [];
    const output = [];
    const seen = new Set();
    for (const raw of input) {
        const item = cleanString(raw, maxLength);
        if (!item || seen.has(item.toLowerCase())) continue;
        seen.add(item.toLowerCase());
        output.push(item);
        if (output.length >= limit) break;
    }
    return output;
}

function cleanInteger(value, fallback = 0, min = 0, max = 100000) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanStringList(value = [], limit = 24, maxLength = 240) {
    if (Array.isArray(value)) return cleanStringArray(value, limit, maxLength);
    const item = cleanString(value, maxLength);
    return item ? [item] : [];
}

function compactCreatorEntryRetryContextForPrompt(value = {}) {
    if (!isPlainObject(value)) return null;
    const previousRejections = Array.isArray(value.previousRejections) ? value.previousRejections : [];
    const retryContext = {
        retryingRejectedTargets: value.retryingRejectedTargets === true,
        previousRejections: previousRejections
            .map(item => {
                if (!isPlainObject(item)) return null;
                return {
                    targetEntryId: cleanId(item.targetEntryId || item.targetTitleId || '', 180),
                    targetTitleId: cleanId(item.targetTitleId || item.targetEntryId || '', 180),
                    title: cleanString(item.title || '', 240),
                    reasonCodes: cleanStringArray(item.reasonCodes, 8, 80),
                    unknownTags: cleanStringArray(item.unknownTags, 12, 140),
                    unknownAnchors: cleanStringArray(item.unknownAnchors, 12, 180),
                    messages: cleanStringArray(item.messages, 4, 240),
                    instruction: cleanString(item.instruction || 'Correct the prior schema rejection using only accepted references.', 300),
                };
            })
            .filter(item => item && (item.targetEntryId || item.targetTitleId || item.reasonCodes.length || item.messages.length))
            .slice(0, 6),
    };
    return retryContext.retryingRejectedTargets || retryContext.previousRejections.length ? retryContext : null;
}

function cleanRubricLevel(value) {
    const raw = cleanString(value, 40)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!raw) return '';
    if (raw === 'n_a' || raw === 'na' || raw === 'none') return 'not_applicable';
    if (raw === 'med' || raw === 'moderate') return 'medium';
    if (raw === 'minor' || raw === 'minimal') return 'low';
    if (raw === 'strong') return 'high';
    return ASSISTANT_RUBRIC_LEVELS.has(raw) ? raw : '';
}

function cleanCreatorCoverageStatus(value = '', fallback = '') {
    const raw = cleanString(value || fallback, 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!raw) return '';
    if (raw === 'n_a' || raw === 'na' || raw === 'none' || raw === 'irrelevant') return 'not_applicable';
    if (raw === 'intentional' || raw === 'light' || raw === 'sparse') return 'intentionally_light';
    if (raw === 'ok' || raw === 'good' || raw === 'covered') return 'adequate';
    if (raw === 'dense' || raw === 'complete') return 'rich';
    if (raw === 'weak' || raw === 'partial') return 'thin';
    if (raw === 'gap' || raw === 'absent') return 'missing';
    return CREATOR_COVERAGE_STATUSES.has(raw) ? raw : '';
}

function normalizeCreatorCoverageDimension(raw = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const label = cleanString(raw.label || raw.title || raw.name || raw.dimension, 180);
    const fallbackId = `coverage-${index + 1}`;
    const id = cleanPackId(raw.id || raw.key || raw.dimensionId || label || fallbackId, 140) || fallbackId;
    const status = cleanCreatorCoverageStatus(raw.status || raw.coverageStatus || raw.state, 'missing');
    const dimension = {
        id,
        label: label || id,
        kind: cleanString(raw.kind || raw.type || raw.category, 80),
        status: status || 'missing',
        priority: cleanInteger(raw.priority ?? raw.weight ?? raw.rank, 50, 0, 100),
        rationale: cleanString(raw.rationale || raw.reason || raw.summary || raw.description, 700),
        evidenceTargets: cleanStringArray(raw.evidenceTargets || raw.expectedEvidence || raw.examples || raw.targets, 8, 180),
        titleBatchIds: cleanStringArray(raw.titleBatchIds || raw.titleBatches || raw.batchIds, 12, 140),
        notApplicableReason: cleanString(raw.notApplicableReason || raw.naReason || raw.exclusionReason, 500),
    };
    if ((dimension.status === 'not_applicable' || dimension.status === 'intentionally_light') && !dimension.notApplicableReason) {
        dimension.notApplicableReason = cleanString(raw.rationale || raw.reason || raw.summary, 500);
    }
    return Object.values(dimension).some(value => Array.isArray(value) ? value.length : !!value) ? dimension : null;
}

function normalizeCreatorCoverage(raw = {}) {
    const source = isPlainObject(raw?.creatorCoverage)
        ? raw.creatorCoverage
        : (isPlainObject(raw?.coveragePlan)
            ? raw.coveragePlan
            : (isPlainObject(raw?.coverageMatrix)
                ? raw.coverageMatrix
                : (isPlainObject(raw?.coverageReview)
                    ? raw.coverageReview
                    : (isPlainObject(raw) ? raw : {}))));
    if (!isPlainObject(source)) return null;
    const dimensions = (Array.isArray(source.dimensions || source.coverageDimensions || source.axes)
        ? (source.dimensions || source.coverageDimensions || source.axes)
        : [])
        .map((row, index) => normalizeCreatorCoverageDimension(row, index))
        .filter(Boolean)
        .slice(0, 20);
    const status = cleanCreatorCoverageStatus(source.status || source.overallStatus || source.coverageStatus);
    const coverage = {
        storyShape: cleanString(source.storyShape || source.shape || source.narrativeShape, 100),
        storyDensity: cleanString(source.storyDensity || source.density || source.loreDensity, 100),
        scopeKind: cleanString(source.scopeKind || source.scopeType || source.kind, 100),
        status,
        rationale: cleanString(source.rationale || source.reason || source.summary, 900),
        expectedCoverage: cleanString(source.expectedCoverage || source.expectation || source.coverageExpectation, 900),
        likelyNotApplicable: cleanStringArray(source.likelyNotApplicable || source.notApplicable || source.exclusions, 8, 180),
        dimensions,
    };
    return Object.values(coverage).some(value => Array.isArray(value) ? value.length : !!value) ? coverage : null;
}

function compactCreatorCoverageForPrompt(raw = {}) {
    const coverage = normalizeCreatorCoverage(raw);
    if (!coverage) return null;
    return {
        storyShape: coverage.storyShape,
        storyDensity: coverage.storyDensity,
        scopeKind: coverage.scopeKind,
        status: coverage.status,
        rationale: coverage.rationale,
        expectedCoverage: coverage.expectedCoverage,
        likelyNotApplicable: coverage.likelyNotApplicable,
        dimensions: coverage.dimensions.slice(0, 16).map(dimension => ({
            id: dimension.id,
            label: dimension.label,
            kind: dimension.kind,
            status: dimension.status,
            priority: dimension.priority,
            rationale: dimension.rationale,
            evidenceTargets: dimension.evidenceTargets,
            titleBatchIds: dimension.titleBatchIds,
            notApplicableReason: dimension.notApplicableReason,
        })),
    };
}

function normalizeAssistantRubric(raw = {}) {
    const source = isPlainObject(raw.rubric)
        ? raw.rubric
        : (isPlainObject(raw.qualityRubric)
            ? raw.qualityRubric
            : (isPlainObject(raw.quality) ? raw.quality : {}));
    if (!isPlainObject(source)) return null;
    const rubric = {};
    for (const key of ASSISTANT_RUBRIC_KEYS) {
        const level = cleanRubricLevel(source[key]);
        if (level) rubric[key] = level;
    }
    const wikiRisk = cleanRubricLevel(source.wikiSummaryRisk || source.wikiRisk || raw.wikiSummaryRisk);
    if (wikiRisk) rubric.wikiSummaryRisk = wikiRisk;
    const notes = cleanStringList(source.notes || source.rationale || raw.qualityNotes, 6, 220);
    if (notes.length) rubric.notes = notes;
    return Object.keys(rubric).length ? rubric : null;
}

function stripJsonFences(text = '') {
    const cleaned = cleanString(text, 100000);
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return fenceMatch ? fenceMatch[1].trim() : cleaned;
}

function removeReasoningBlocks(text = '') {
    return String(text || '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
}

function sanitizeJsonish(text = '') {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\u0000-\u001F]+/g, match =>
            match === '\n' || match === '\r' || match === '\t' ? match : ''
        )
        .trim();
}

function findBalancedJson(text = '', open = '{', close = '}') {
    const s = String(text || '');
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (start === -1) {
            if (ch === open) {
                start = i;
                depth = 1;
            }
            continue;
        }
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === open) depth += 1;
        if (ch === close) depth -= 1;
        if (depth === 0) return s.slice(start, i + 1);
    }
    return start >= 0 ? s.slice(start) : '';
}

function looksLikeTruncatedJson(text = '') {
    const s = String(text || '').trim();
    const start = s.search(/[{\[]/);
    if (start < 0) return false;
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let i = start; i < s.length; i += 1) {
        const ch = s[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') {
            const open = stack.pop();
            if ((ch === '}' && open !== '{') || (ch === ']' && open !== '[')) return false;
        }
    }
    return inString || stack.length > 0;
}

function parseAssistantJson(text = '') {
    const cleaned = sanitizeJsonish(stripJsonFences(removeReasoningBlocks(extractLoredeckAssistantResponseText(text))));
    const candidates = [
        cleaned,
        findBalancedJson(cleaned, '{', '}'),
        findBalancedJson(cleaned, '[', ']'),
    ].filter(Boolean);
    const errors = [];
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (e) {
            errors.push(e?.message || 'Invalid JSON');
        }
    }
    if (looksLikeTruncatedJson(cleaned)) {
        throw new Error('Lore Assistant returned truncated JSON before the response finished. The provider likely hit its output limit; retry with a smaller scope, lower reasoning effort, or a larger output budget.');
    }
    throw new Error(`Lore Assistant returned invalid JSON${errors.length ? `: ${errors[0]}` : ''}.`);
}

function findJsonKeyValueStart(text = '', key = '') {
    const s = String(text || '');
    const escapedKey = String(key || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = s.match(new RegExp(`"${escapedKey}"\\s*:`));
    return match ? (match.index + match[0].length) : -1;
}

function parseJsonObjectAfterKey(text = '', key = '') {
    const start = findJsonKeyValueStart(text, key);
    if (start < 0) return null;
    const value = findBalancedJson(String(text || '').slice(start), '{', '}');
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function parseJsonArrayAfterKey(text = '', key = '') {
    const start = findJsonKeyValueStart(text, key);
    if (start < 0) return [];
    const value = findBalancedJson(String(text || '').slice(start), '[', ']');
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function extractCompleteObjectsFromJsonArray(text = '', key = '') {
    const cleaned = sanitizeJsonish(stripJsonFences(removeReasoningBlocks(text)));
    const start = findJsonKeyValueStart(cleaned, key);
    if (start < 0) return [];
    const arrayStart = cleaned.indexOf('[', start);
    if (arrayStart < 0) return [];
    const rows = [];
    let objectStart = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = arrayStart + 1; i < cleaned.length; i += 1) {
        const ch = cleaned[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === '[' && depth === 0 && objectStart < 0) continue;
        if (ch === ']' && depth === 0) break;
        if (ch === '{') {
            if (depth === 0) objectStart = i;
            depth += 1;
            continue;
        }
        if (ch === '}') {
            depth -= 1;
            if (depth === 0 && objectStart >= 0) {
                const rawObject = cleaned.slice(objectStart, i + 1);
                try {
                    rows.push(JSON.parse(rawObject));
                } catch {
                    // Ignore malformed partial rows; complete rows before the cutoff remain usable.
                }
                objectStart = -1;
            }
        }
    }
    return rows;
}

function extractPartialCreatorTitleResponse(text = '') {
    const cleaned = sanitizeJsonish(stripJsonFences(removeReasoningBlocks(extractLoredeckAssistantResponseText(text))));
    const rows = extractCompleteObjectsFromJsonArray(cleaned, 'titleDrafts')
        .concat(extractCompleteObjectsFromJsonArray(cleaned, 'titles'))
        .concat(extractCompleteObjectsFromJsonArray(cleaned, 'entries'));
    if (!rows.length) return null;
    const batch = parseJsonObjectAfterKey(cleaned, 'batch') || parseJsonObjectAfterKey(cleaned, 'titleBatch') || {};
    const warnings = parseJsonArrayAfterKey(cleaned, 'warnings');
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]{1,1000})"/);
    return {
        summary: summaryMatch ? summaryMatch[1] : '',
        clarifyingQuestions: parseJsonArrayAfterKey(cleaned, 'clarifyingQuestions'),
        warnings,
        batch,
        titleRows: rows,
        salvaged: true,
    };
}

function extractPartialAssistantResponse(text = '') {
    const cleaned = sanitizeJsonish(stripJsonFences(removeReasoningBlocks(extractLoredeckAssistantResponseText(text))));
    const proposalRows = extractCompleteObjectsFromJsonArray(cleaned, 'proposals')
        .concat(extractCompleteObjectsFromJsonArray(cleaned, 'changes'));
    if (!proposalRows.length) return null;
    const warnings = parseJsonArrayAfterKey(cleaned, 'warnings');
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]{1,1000})"/);
    return {
        summary: summaryMatch ? summaryMatch[1] : '',
        clarifyingQuestions: parseJsonArrayAfterKey(cleaned, 'clarifyingQuestions'),
        warnings,
        proposals: proposalRows,
        salvaged: true,
    };
}

function coerceAssistantShape(parsed) {
    if (Array.isArray(parsed)) return { proposals: parsed };
    if (!isPlainObject(parsed)) return { proposals: [] };
    return {
        summary: cleanString(parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(parsed.clarifyingQuestions || parsed.questions, 8, 300),
        proposals: Array.isArray(parsed.proposals)
            ? parsed.proposals
            : (Array.isArray(parsed.changes) ? parsed.changes : []),
    };
}

function normalizeAssistantProposal(raw = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const action = cleanString(raw.action || raw.type || raw.kind, 80);
    if (!ASSISTANT_SUPPORTED_ACTIONS.has(action)) return null;
    const entry = isPlainObject(raw.entry) ? raw.entry : null;
    const tagDefinition = isPlainObject(raw.tagDefinition || raw.tag) ? (raw.tagDefinition || raw.tag) : null;
    const timelineAnchor = isPlainObject(raw.timelineAnchor || raw.anchor) ? (raw.timelineAnchor || raw.anchor) : null;
    const timelineWindow = isPlainObject(raw.timelineWindow || raw.window) ? (raw.timelineWindow || raw.window) : null;
    const entryId = cleanId(raw.entryId || entry?.id);
    const tagId = cleanId(raw.tagId || tagDefinition?.id, 140);
    const timelineId = cleanId(raw.timelineId || timelineAnchor?.id || timelineWindow?.id);
    return {
        action,
        proposalId: cleanId(raw.proposalId || raw.id || `proposal_${index + 1}`, 120),
        title: cleanString(raw.title || raw.label || action, 240),
        reason: cleanString(raw.reason || raw.rationale || raw.description, 1000),
        confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : null,
        risk: cleanString(raw.risk || raw.riskLevel, 80),
        entryId,
        tagId,
        timelineId,
        entry,
        tagDefinition,
        timelineAnchor,
        timelineWindow,
        rubric: normalizeAssistantRubric(raw),
        disable: raw.disable === true,
        restore: raw.restore === true,
        before: isPlainObject(raw.before) ? raw.before : null,
        after: isPlainObject(raw.after) ? raw.after : null,
    };
}

export function parseLoredeckAssistantResponse(text = '') {
    let parsedJson = null;
    let parseError = null;
    try {
        parsedJson = parseAssistantJson(text);
    } catch (error) {
        parseError = error;
    }
    const partial = extractPartialAssistantResponse(text);
    if (parseError && !partial?.proposals?.length) throw parseError;
    const parsed = parsedJson ? coerceAssistantShape(parsedJson) : { proposals: [] };
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const directHasProposalObjects = (parsed.proposals || []).some(row => isPlainObject(row));
    const usedSalvagedRows = partial?.proposals?.length && !directHasProposalObjects;
    const proposalRows = usedSalvagedRows
        ? partial.proposals
        : (parsed.proposals || []);
    const proposals = [];
    const warnings = cleanStringArray(partial?.warnings?.length ? partial.warnings : raw.warnings, 12, 300);
    const warningCodes = [];
    if (usedSalvagedRows) {
        warnings.push('Assistant response was truncated; Saga salvaged complete proposals before the cutoff.');
        warningCodes.push(LOREDECK_ASSISTANT_RESPONSE_CODES.JSON_TRUNCATED_SALVAGED);
    }
    for (const [index, raw] of proposalRows.entries()) {
        const proposal = normalizeAssistantProposal(raw, index);
        if (!proposal) {
            warnings.push(`Skipped unsupported proposal ${index + 1}.`);
            continue;
        }
        proposals.push(proposal);
    }
    return {
        summary: partial?.summary || parsed.summary || '',
        clarifyingQuestions: cleanStringArray(partial?.clarifyingQuestions?.length ? partial.clarifyingQuestions : parsed.clarifyingQuestions, 8, 300),
        proposals,
        warnings,
        warningCodes,
    };
}

function normalizeCreatorBrief(raw = {}) {
    const source = isPlainObject(raw?.brief)
        ? raw.brief
        : (isPlainObject(raw?.packBrief)
            ? raw.packBrief
            : (isPlainObject(raw) ? raw : {}));
    if (!isPlainObject(source)) return null;
    const range = isPlainObject(source.estimatedEntryRange || source.entryRange)
        ? (source.estimatedEntryRange || source.entryRange)
        : {};
    const min = cleanInteger(range.min ?? range.low, 0, 0, 10000);
    const max = cleanInteger(range.max ?? range.high, min, min, 10000);
    const coverageSummary = cleanString(source.coverageSummary || source.coverage || source.summary, 700);
    const creatorCoverage = normalizeCreatorCoverage(
        source.creatorCoverage
        || source.coveragePlan
        || source.coverageMatrix
        || source.coverageReview
        || raw.creatorCoverage
        || raw.coveragePlan
        || raw.coverageMatrix
        || raw.coverageReview
    );
    const brief = {
        title: cleanString(source.title || source.name, 180),
        packId: cleanPackId(source.packId || source.id || source.title || source.name, 140),
        fandom: cleanString(source.fandom, 120),
        scope: cleanString(source.scope || source.coverageRange || source.coverageScope || source.coverage, 240),
        granularity: cleanString(source.granularity || source.density, 80),
        coverageSummary,
        coverage: coverageSummary,
        creatorCoverage,
        contextApproach: cleanString(source.contextApproach || source.timelineApproach, 1000),
        estimatedEntryRange: {
            min,
            max,
            rationale: cleanString(range.rationale || source.entryRangeRationale, 500),
        },
        timelinePlan: cleanStringArray(source.timelinePlan || source.timeline || source.anchors, 8, 180),
        tagPlan: cleanStringArray(source.tagPlan || source.tags || source.entityPlan, 8, 160),
        titlePassPlan: cleanStringArray(source.titlePassPlan || source.entryTitlePassPlan || source.titlePlan, 8, 180),
        assumptions: cleanStringArray(source.assumptions, 5, 160),
        exclusions: cleanStringArray(source.exclusions || source.outOfScope, 5, 160),
        nextStage: cleanString(source.nextStage, 500),
    };
    return Object.values(brief).some(value => {
        if (Array.isArray(value)) return value.length > 0;
        if (isPlainObject(value)) return Object.values(value).some(Boolean);
        return !!value;
    }) ? brief : null;
}

function compactCreatorBriefForPrompt(raw = {}) {
    const brief = normalizeCreatorBrief(raw);
    if (!brief) return null;
    return {
        title: brief.title,
        packId: brief.packId,
        fandom: brief.fandom,
        scope: brief.scope,
        granularity: brief.granularity,
        coverageSummary: brief.coverageSummary || brief.coverage,
        creatorCoverage: compactCreatorCoverageForPrompt(brief.creatorCoverage),
        assumptions: brief.assumptions,
    };
}

function normalizeCreatorTitleDraft(raw = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const title = cleanString(raw.title || raw.name || raw.label, 220);
    if (!title) return null;
    const fallbackId = `title-${index + 1}`;
    const titleId = cleanPackId(raw.titleId || raw.id || raw.entryId || title || fallbackId, 160) || fallbackId;
    const relevance = cleanRubricLevel(raw.relevance || raw.importance || raw.priorityBand);
    const draft = {
        titleId,
        title,
        category: cleanString(raw.category || raw.type || raw.kind, 120),
        priority: cleanInteger(raw.priority ?? raw.weight ?? raw.rank, 50, 0, 100),
        relevance: relevance && relevance !== 'not_applicable' ? relevance : '',
        contextHint: cleanString(raw.contextHint || raw.timelineHint || raw.windowHint, 500),
        contextScope: raw.contextScope === 'global' ? 'global' : '',
        timelineAnchorIds: cleanStringArray([raw.timelineAnchorIds, raw.anchorIds, raw.contextAnchorIds, raw.anchorId, raw.validFromAnchor, raw.validToAnchor].flat().filter(Boolean), 24, 180),
        timelineWindowIds: cleanStringArray([raw.timelineWindowIds, raw.windowIds, raw.contextWindowIds, raw.windowId, raw.validWindowId].flat().filter(Boolean), 24, 180),
        tags: cleanStringArray(raw.tags || raw.tagHints || raw.suggestedTags, 24, 140),
        reason: cleanString(raw.reason || raw.rationale || raw.description, 1000),
        creatorTitleBatchId: cleanPackId(raw.creatorTitleBatchId || raw.batchId || raw.sourceBatchId, 160),
        creatorTitleBatchLabel: cleanString(raw.creatorTitleBatchLabel || raw.batchLabel || raw.sourceBatchLabel, 180),
        coverageDimensionIds: cleanStringArray(raw.coverageDimensionIds || raw.coverageDimensions || raw.coverageIds, 12, 140),
        rubric: normalizeAssistantRubric(raw),
    };
    return draft;
}

export function parseLoredeckCreatorBriefResponse(text = '') {
    const parsedJson = parseAssistantJson(text);
    const parsed = coerceAssistantShape(parsedJson);
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const brief = Object.prototype.hasOwnProperty.call(raw, 'brief')
        ? (isPlainObject(raw.brief)
            ? normalizeCreatorBrief({
                brief: raw.brief,
                creatorCoverage: raw.creatorCoverage || raw.coveragePlan || raw.coverageMatrix || raw.coverageReview,
            })
            : null)
        : normalizeCreatorBrief(raw);
    return {
        summary: cleanString(raw.summary || parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(raw.clarifyingQuestions || raw.questions || parsed.clarifyingQuestions, 8, 300),
        brief,
        warnings: [],
    };
}

function normalizeCreatorOutlineRow(raw = {}, index = 0, kind = 'beat') {
    if (!isPlainObject(raw)) return null;
    const label = cleanString(raw.label || raw.title || raw.name, 180);
    const summary = cleanString(raw.summary || raw.description || raw.reason, 500);
    if (!label && !summary) return null;
    const fallback = `${kind}-${index + 1}`;
    return {
        id: cleanPackId(raw.id || raw.key || label || fallback, 140) || fallback,
        label: label || summary.slice(0, 80) || fallback,
        type: cleanString(raw.type || raw.kind || raw.category || kind, 80),
        order: cleanInteger(raw.order ?? raw.sortKey ?? raw.index, index + 1, 0, 100000),
        summary,
        contextRole: cleanString(raw.contextRole || raw.context || raw.use || raw.role, 300),
        titleTargets: cleanStringArray(raw.titleTargets || raw.titleTargetHints || raw.targets, 8, 120),
        coverageDimensionIds: cleanStringArray(raw.coverageDimensionIds || raw.coverageDimensions || raw.coverageIds, 12, 140),
    };
}

function normalizeCreatorOutline(raw = {}) {
    const source = isPlainObject(raw?.outline)
        ? raw.outline
        : (isPlainObject(raw?.storyOutline)
            ? raw.storyOutline
            : (isPlainObject(raw) ? raw : {}));
    if (!isPlainObject(source)) return null;
    const beats = (Array.isArray(source.beats || source.storyBeats || source.structure)
        ? (source.beats || source.storyBeats || source.structure)
        : [])
        .map((row, index) => normalizeCreatorOutlineRow(row, index, 'beat'))
        .filter(Boolean)
        .slice(0, 24);
    const contextMilestones = (Array.isArray(source.contextMilestones || source.contextPlan || source.contextPoints)
        ? (source.contextMilestones || source.contextPlan || source.contextPoints)
        : [])
        .map((row, index) => normalizeCreatorOutlineRow(row, index, 'context'))
        .filter(Boolean)
        .slice(0, 24);
    const titleBatches = (Array.isArray(source.titleBatches || source.titlePlan || source.titleBatchPlan)
        ? (source.titleBatches || source.titlePlan || source.titleBatchPlan)
        : [])
        .map((row, index) => normalizeCreatorOutlineRow(row, index, 'title_batch'))
        .filter(Boolean)
        .slice(0, 12);
    const creatorCoverage = normalizeCreatorCoverage(
        source.creatorCoverage
        || source.coveragePlan
        || source.coverageMatrix
        || source.coverageReview
        || raw.creatorCoverage
        || raw.coveragePlan
        || raw.coverageMatrix
        || raw.coverageReview
    );
    const outline = {
        label: cleanString(source.label || source.title || source.name, 180),
        coverageSummary: cleanString(source.coverageSummary || source.coverage || source.summary, 700),
        creatorCoverage,
        beats,
        contextMilestones,
        titleBatches,
        assumptions: cleanStringArray(source.assumptions, 5, 160),
    };
    return Object.values(outline).some(value => Array.isArray(value) ? value.length : !!value) ? outline : null;
}

export function parseLoredeckCreatorOutlineResponse(text = '') {
    const parsedJson = parseAssistantJson(text);
    const parsed = coerceAssistantShape(parsedJson);
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    return {
        summary: cleanString(raw.summary || parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(raw.clarifyingQuestions || raw.questions || parsed.clarifyingQuestions, 8, 300),
        outline: normalizeCreatorOutline(raw),
        warnings: [],
    };
}

export function parseLoredeckCreatorTitleResponse(text = '') {
    let parsedJson = null;
    let parseError = null;
    try {
        parsedJson = parseAssistantJson(text);
    } catch (error) {
        parseError = error;
    }
    const parsed = parsedJson ? coerceAssistantShape(parsedJson) : {};
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const partial = extractPartialCreatorTitleResponse(text);
    if (parseError && !partial?.titleRows?.length) throw parseError;
    const directTitleRows = Array.isArray(parsedJson)
        ? parsedJson
        : (Array.isArray(raw.titleDrafts)
            ? raw.titleDrafts
            : (Array.isArray(raw.titles)
                ? raw.titles
                : (Array.isArray(raw.entries) ? raw.entries : [])));
    const directHasTitleObjects = directTitleRows.some(row => isPlainObject(row));
    const usedSalvagedRows = partial?.titleRows?.length && !directHasTitleObjects;
    const titleRows = usedSalvagedRows
        ? partial.titleRows
        : directTitleRows;
    const titleDrafts = [];
    const warnings = [];
    const warningCodes = [];
    if (usedSalvagedRows) {
        warnings.push('Title response was truncated; Saga salvaged complete title drafts before the cutoff.');
        warningCodes.push(LOREDECK_ASSISTANT_RESPONSE_CODES.JSON_TRUNCATED_SALVAGED);
    }
    const seenIds = new Set();
    for (const [index, row] of titleRows.entries()) {
        const draft = normalizeCreatorTitleDraft(row, index);
        if (!draft) {
            warnings.push(`Skipped unsupported title draft ${index + 1}.`);
            continue;
        }
        let id = draft.titleId;
        if (seenIds.has(id)) id = `${id}-${index + 1}`;
        seenIds.add(id);
        titleDrafts.push({ ...draft, titleId: id });
    }
    const batch = isPlainObject(partial?.batch)
        ? partial.batch
        : (isPlainObject(raw.batch || raw.titleBatch) ? (raw.batch || raw.titleBatch) : {});
    return {
        summary: cleanString(partial?.summary || raw.summary || parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(partial?.clarifyingQuestions?.length ? partial.clarifyingQuestions : (raw.clarifyingQuestions || raw.questions || parsed.clarifyingQuestions), 8, 300),
        warnings,
        warningCodes,
        titleDrafts,
        batch: {
            label: cleanString(batch.label || batch.name, 160),
            coverage: cleanString(batch.coverage || batch.scope || raw.batchCoverage, 500),
            nextBatchHint: cleanString(batch.nextBatchHint || raw.nextBatchHint, 500),
            complete: batch.complete === true || raw.complete === true,
        },
    };
}

export function buildLoredeckCreatorBriefSystemPrompt() {
    return `You are Saga's Deck Maker intake assistant.

Return JSON only. Do not include markdown.

Your task is to turn a user's fandom, scope, and granularity into a tiny scope brief for approval. This is intake only.

Deck Maker principles:
- Narrow vague or oversized requests into a practical story scope.
- Do not require spoiler boundary, adaptation, continuity, or approximate entry count from the user.
- Coverage says what the deck may contain; Context later decides what can inject.
- Lorecard count is derived from granularity, coverage size, and story density.
- Build an adaptive creatorCoverage plan with meaningful dimensions for this story shape; do not use a fixed entry-count threshold.
- Mark sparse, toy-like, or low-lore content as intentionally_light or not_applicable instead of padding filler dimensions.
- Prefer high-value roleplay/fanfic scene context over wiki completeness.
- State only practical scope assumptions that need user review.
- If the request is too broad or ambiguous, ask 1-3 clarifying questions and leave brief null.
- Do not generate Lorecards at intake.
- Keep the whole JSON compact. Do not include lore entry titles, wiki facts, timeline plans, tag plans, title-pass plans, entry counts, or generation plans.

Granularity meanings:
- compact: key constraints and major character/state changes only.
- focused: practical arc-level play with enough detail for long-form roleplay.
- dense: many anchors, relationships, and scene-specific constraints.
- scene_dense: intensive coverage for a short span with many moment-level entries.

Field limits:
- summary: 1 sentence.
- coverageSummary: 1-2 sentences, under 60 words.
- assumptions: at most 4 short items.
- creatorCoverage.dimensions: 3-10 meaningful dimensions unless the source genuinely has less lore.
- creatorCoverage statuses: missing, thin, adequate, rich, not_applicable, intentionally_light.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "brief": {
    "title": "Arlong Park Arc",
    "packId": "one-piece-arlong-park",
    "fandom": "One Piece",
    "scope": "Arlong Park Arc",
    "granularity": "focused",
    "coverageSummary": "What this deck should cover at approval time.",
    "creatorCoverage": {
      "storyShape": "single arc",
      "storyDensity": "dense",
      "scopeKind": "arc",
      "status": "thin",
      "rationale": "Why this source needs this much coverage.",
      "expectedCoverage": "Adaptive expectation without a hard Lorecard count.",
      "likelyNotApplicable": ["Sparse dimensions that should not be padded."],
      "dimensions": [
        {
          "id": "character-pressure",
          "label": "Character pressure and secrets",
          "kind": "characters",
          "status": "missing",
          "priority": 90,
          "rationale": "Why this dimension matters for roleplay scenes.",
          "evidenceTargets": ["Kinds of future titles this dimension should produce."]
        }
      ]
    },
    "assumptions": ["Assumption to confirm."]
  }
}`;
}

export function buildLoredeckCreatorBriefUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft a reviewable Deck Maker pack brief only.', 500),
        fandom: cleanString(context.fandom, 200),
        scope: cleanString(context.scope, 1000),
        granularity: cleanString(context.granularity || 'focused', 80),
        notes: cleanString(context.notes, 2000),
        revisionInstruction: cleanString(context.revisionInstruction, 2000),
        previousBrief: isPlainObject(context.previousBrief) ? compactCreatorBriefForPrompt(context.previousBrief) : null,
        constraints: {
            noEntryGenerationYet: true,
            noTimelineGenerationYet: true,
            noOutlineGenerationYet: true,
            noRequiredSpoilerBoundary: true,
            noRequiredAdaptationOrContinuityQuestion: true,
            entryCountMustBeDerived: true,
            adaptiveCoveragePlanRequired: true,
            noHardCoverageThreshold: true,
            sparseSourcesMayBeIntentionallyLight: true,
            coverageIsNotInjectionBoundary: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
            maxVisibleJsonTokens: 1200,
        },
    });
}

export function buildLoredeckCreatorOutlineSystemPrompt() {
    return `You are Saga's Deck Maker story outline assistant.

Return JSON only. Do not include markdown.

Your task is to turn an approved compact Scope Brief into a reviewable story outline and Context plan. This stage helps the user confirm the deck shape before any Lorecard title generation.

Hard limits:
- Do not generate Lorecards, Lorecard titles, tag registries, timeline registry records, anchors, windows, facts, or injection text.
- Do not ask for adaptation, continuity, spoiler boundary, or approximate entry count.
- Keep the outline compact and useful for long-form fanfic/roleplay planning.
- If the scope is still too broad or unclear, ask 1-3 clarifying questions and leave outline null.

Outline quality:
- Beats should be major story phases, scene clusters, reveals, state changes, or relationship/power shifts.
- Context milestones should be the high-value browse/select points a user might choose before/after when starting a story.
- Title batches should describe future title-pass slices, not actual titles.
- Preserve and refine creatorCoverage from the Scope Brief; title batches should point to coverageDimensionIds they are meant to serve.
- Missing/thin coverage dimensions should become title batches unless they are not_applicable or intentionally_light for this source.
- Prefer playable pressure, secrets, relationship changes, faction consequences, locations, powers, obligations, and canon timing over wiki completeness.

Field limits:
- summary: 1 sentence.
- coverageSummary: under 70 words.
- beats: 4-12 items unless the scope is tiny.
- contextMilestones: 4-16 items.
- titleBatches: 2-8 items.
- assumptions: at most 4 short items.
- Each row summary/contextRole: one short sentence.
- titleTargets: at most 4 short strings.
- creatorCoverage.dimensions: keep meaningful dimensions only; do not invent filler for sparse content.
- Aim for under 1600 visible JSON tokens.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "outline": {
    "label": "Arlong Park Arc outline",
    "coverageSummary": "Reviewable story shape for the approved scope.",
    "creatorCoverage": {
      "storyShape": "single arc",
      "storyDensity": "dense",
      "scopeKind": "arc",
      "status": "thin",
      "rationale": "Refined coverage expectation for this outline.",
      "expectedCoverage": "Adaptive expectation without a hard Lorecard count.",
      "likelyNotApplicable": [],
      "dimensions": [
        {
          "id": "character-pressure",
          "label": "Character pressure and secrets",
          "kind": "characters",
          "status": "thin",
          "priority": 90,
          "rationale": "Needs title batches for playable secrets and coercion.",
          "evidenceTargets": ["Nami secrecy", "Arlong coercion"],
          "titleBatchIds": ["characters-pressure"]
        }
      ]
    },
    "beats": [
      {
        "id": "cocoyasi-arrival",
        "label": "Straw Hats reach Cocoyasi",
        "type": "arrival",
        "order": 10,
        "summary": "Early arc pressure before Nami's full bargain is exposed.",
        "contextRole": "Useful starting point for scenes before the reveal.",
        "titleTargets": ["Nami secrecy", "village tension"]
      }
    ],
    "contextMilestones": [
      {
        "id": "before-nami-asks-for-help",
        "label": "Before Nami asks for help",
        "type": "before_after",
        "order": 40,
        "summary": "Boundary before the emotional pivot and crew commitment.",
        "contextRole": "A user can start just before this reveal."
      }
    ],
    "titleBatches": [
      {
        "id": "characters-pressure",
        "label": "Characters and pressure",
        "type": "title_batch",
        "order": 10,
        "summary": "Future titles for character secrets, coercion, loyalties, and obligations.",
        "coverageDimensionIds": ["character-pressure"]
      }
    ],
    "assumptions": ["Assumption to confirm."]
  }
}`;
}

export function buildLoredeckCreatorOutlineUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft a reviewable Deck Maker story outline and Context plan only.', 500),
        approvedBrief: isPlainObject(context.brief) ? compactCreatorBriefForPrompt(context.brief) : null,
        notes: cleanString(context.notes, 2000),
        revisionInstruction: cleanString(context.revisionInstruction, 2000),
        previousOutline: isPlainObject(context.previousOutline) ? normalizeCreatorOutline(context.previousOutline) : null,
        constraints: {
            approvedBriefRequired: true,
            outlineOnly: true,
            noEntryGenerationYet: true,
            noLorecardTitleGenerationYet: true,
            noTimelineRegistryGenerationYet: true,
            noTagRegistryGenerationYet: true,
            entryCountMustBeDerivedLater: true,
            preserveCreatorCoverage: true,
            titleBatchesMustReferenceCoverageDimensions: true,
            noHardCoverageThreshold: true,
            sparseSourcesMayBeIntentionallyLight: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
            compactJson: true,
            maxVisibleJsonTokens: 1600,
        },
    });
}

export function buildLoredeckCreatorTitleSystemPrompt() {
    return `You are Saga's Deck Maker title-pass assistant.

Return JSON only. Do not include markdown.

Your task is to turn one approved Story Outline title batch into reviewable future Lorecard titles. Generate titles only.

Hard limits:
- Do not generate full Lorecards, facts, injection text, timeline anchors, timeline windows, or tag registries yet.
- Do not ask the user for an approximate Lorecard count. Derive title count from granularity, coverage size, story density, and the approved outline.
- Generate only the supplied targetTitleBatch. Do not continue into other outline batches.
- Generate no more than titlePassLimit titles. Prefer fewer strong titles over many thin ones.
- When selectedTitleDrafts are supplied, revise only those selected title drafts and return replacements for them.
- Keep the whole JSON compact. Do not use markdown, commentary, long explanations, or verbose per-title rubrics.

Title quality rules:
- Prefer high-value roleplay/fanfic scene context over wiki completeness.
- Each title should imply playable pressure, constraints, relationships, secrets, powers, obligations, setting response, or context consequences.
- Every title should include coverageDimensionIds from the target title batch or approved creatorCoverage dimensions it directly serves.
- If a dimension is intentionally_light or not_applicable, do not generate filler titles for it.
- Include broad/wide titles only when they are genuinely useful across a large window; mark that in contextHint.
- Avoid duplicate titles and avoid generic biography titles.
- Use category, priority, relevance, contextHint, tags, and reason so the user can review before Lorecard generation.
- Rubric is optional and should be tiny. Include only wikiSummaryRisk plus one or two useful rubric keys when needed.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "batch": {
    "label": "Characters and pressure",
    "coverage": "What this title batch covers.",
    "nextBatchHint": "What should be generated next, if anything.",
    "complete": false
  },
  "titleDrafts": [
    {
      "titleId": "nami-hides-her-bargain",
      "title": "Nami hides her bargain with Arlong",
      "category": "character_pressure",
      "priority": 85,
      "relevance": "high",
      "contextHint": "From the crew's Cocoyasi arrival until Nami asks for help.",
      "tags": ["character:nami", "faction:arlong-pirates"],
      "reason": "Creates secrecy, pressure, and timing for scenes.",
      "coverageDimensionIds": ["character-pressure"],
      "rubric": {
        "sceneUtility": "high",
        "contextFit": "high",
        "wikiSummaryRisk": "low"
      }
    }
  ]
}`;
}

export function buildLoredeckCreatorTitleUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft a reviewable Deck Maker title pass only.', 500),
        approvedBrief: isPlainObject(context.brief) ? compactCreatorBriefForPrompt(context.brief) : null,
        approvedOutline: isPlainObject(context.outline) ? normalizeCreatorOutline(context.outline) : null,
        targetTitleBatch: isPlainObject(context.targetTitleBatch) ? context.targetTitleBatch : null,
        notes: cleanString(context.notes, 2000),
        revisionInstruction: cleanString(context.revisionInstruction, 2000),
        previousTitleDrafts: Array.isArray(context.previousTitleDrafts) ? context.previousTitleDrafts : [],
        selectedTitleDrafts: Array.isArray(context.selectedTitleDrafts) ? context.selectedTitleDrafts : [],
        draftedTitleBatchIds: cleanStringArray(context.draftedTitleBatchIds, 120, 160),
        titlePassLimit: cleanInteger(context.titlePassLimit, 80, 10, 120),
        constraints: {
            approvedBriefRequired: true,
            titlesOnly: true,
            approvedOutlineRequired: true,
            targetTitleBatchRequired: true,
            currentTitleBatchOnly: true,
            noEntryGenerationYet: true,
            noTimelineGenerationYet: true,
            noTagRegistryGenerationYet: true,
            entryCountMustBeDerived: true,
            coverageDimensionIdsRequired: true,
            noHardCoverageThreshold: true,
            sparseSourcesMayBeIntentionallyLight: true,
            preserveTitleIdsWhenRevising: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
            compactJson: true,
            noMarkdown: true,
            minimalRubric: true,
        },
    }, null, 2);
}

export const LOREDECK_CREATOR_PLANNING_CONTEXT_RULES = `For every time-dependent approved title, cover its contextHint with semantically matching anchors/windows; compactness must not remove required timing coverage. Stable, spoiler-safe facts may remain global and need no invented event anchor. If fitting planning cannot be supported within this response, ask 1-3 clarifyingQuestions naming the uncovered titles and missing timing, and return an empty proposals array. Never relocate a character or event to make an unrelated anchor fit.`;

export function buildLoredeckCreatorPlanningSystemPrompt() {
    return `You are Saga's Deck Maker timeline and tag planning assistant.

Return JSON only. Do not include markdown.

Your task is to turn one approved title batch into reviewable timeline/tag planning proposals for Pending Review.

Hard limits:
- Do not generate full Lorecards, facts, injection text, Lorecard bodies, or entry overrides yet.
- Return only supported planning proposal actions: upsert_timeline_anchor, upsert_timeline_window, and upsert_tag_definition.
- Do not claim proposals are applied. They are drafts for Pending Review.
- Preserve stable IDs and namespaced tags.
- Timeline anchors/windows should be useful for Context gating and should prevent future canon leakage.
- Tags should support retrieval, filtering, Pack Health, and future Lorecard generation. Avoid tag spam and avoid vague unnamespaced tags when a namespace is natural.
- Use approvedTitleDrafts from the supplied targetPlanningBatch only. Do not continue into other title batches or attempt full deck completeness in one pass.
- Return no more than proposalLimit proposals. Prefer fewer high-value planning records over noisy coverage.
- Prefer 6-10 strong proposals when that is enough for the current title batch; do not pad to proposalLimit.
- Keep visible output short enough for reasoning profiles: final answer first, compact JSON only, no hidden-plan dependency.
- Keep the whole JSON compact. Do not use markdown, commentary, long explanations, or verbose per-proposal rubrics.
- If the target batch shape is insufficient, ask 1-3 clarifying questions and return an empty proposals array.

Planning guidance:
${LOREDECK_CREATOR_PLANNING_CONTEXT_RULES}
- Use anchors for meaningful story moments, reveals, arrivals, battles, state changes, relationship pivots, or date/arc boundaries.
- Use windows for spans where entries should be eligible between two anchors.
- Use tag definitions for characters, factions, locations, arcs, concepts, powers, secrets, and relationship/state clusters that the approved titles imply.
- Use targetPlanningBatch.coverageDimensionIds and approvedTitleDrafts.coverageDimensionIds to keep planning focused on the coverage surface this batch serves.
- Prefer a compact but robust registry foundation over exhaustive wiki coverage.
- Include confidence, risk, and reason on every proposal.
- Rubric is optional and should be tiny. Include only wikiSummaryRisk plus one or two useful rubric keys when needed.

Supported proposal actions:
- upsert_timeline_anchor with {timelineAnchor}
- upsert_timeline_window with {timelineWindow}
- upsert_tag_definition with {tagDefinition}

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "proposals": [
    {
      "action": "upsert_timeline_anchor",
      "title": "Create anchor: crew reaches Cocoyasi",
      "timelineId": "one-piece.arlong.cocoyasi-arrival",
      "timelineAnchor": {
        "id": "one-piece.arlong.cocoyasi-arrival",
        "label": "Straw Hats reach Cocoyasi Village",
        "contextType": "arc_event",
        "sortKey": 120,
        "arc": "Arlong Park",
        "aliases": ["Cocoyasi arrival", "crew reaches Nami's village"],
        "tags": ["arc:arlong-park", "location:cocoyasi-village"],
        "notes": "Anchor for early Cocoyasi scenes before the full Nami reveal."
      },
      "reason": "Gives Context a clear early-arc boundary.",
      "confidence": 0.82,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "injectionQuality": "not_applicable",
        "contextFit": "high",
        "wikiSummaryRisk": "low"
      }
    }
  ]
}`;
}

export function buildLoredeckCreatorPlanningUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft reviewable Deck Maker timeline anchors/windows and tag definitions only.', 500),
        generatedPackId: cleanPackId(context.generatedPackId || '', 140),
        approvedBrief: isPlainObject(context.brief) ? compactCreatorBriefForPrompt(context.brief) : null,
        approvedOutline: isPlainObject(context.outline) ? normalizeCreatorOutline(context.outline) : null,
        targetPlanningBatch: isPlainObject(context.targetPlanningBatch) ? context.targetPlanningBatch : null,
        approvedTitleDrafts: Array.isArray(context.approvedTitleDrafts) ? context.approvedTitleDrafts : [],
        notes: cleanString(context.notes, 2000),
        existingTimelineIds: cleanStringArray(context.existingTimelineIds, 160, 180),
        existingTagIds: cleanStringArray(context.existingTagIds, 240, 140),
        queuedPlanningBatchIds: cleanStringArray(context.queuedPlanningBatchIds, 120, 160),
        proposalLimit: cleanInteger(context.proposalLimit, 24, 6, 40),
        constraints: {
            approvedBriefRequired: true,
            approvedOutlineRequired: true,
            approvedTitlesRequired: true,
            targetPlanningBatchRequired: true,
            currentPlanningBatchOnly: true,
            timelineAndTagsOnly: true,
            noEntryGenerationYet: true,
            noEntryFactsOrInjectionYet: true,
            pendingReviewOnly: true,
            preserveStableIds: true,
            preserveCoverageDimensionIds: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
            compactJson: true,
            noMarkdown: true,
            minimalRubric: true,
        },
    }, null, 2);
}

export const LOREDECK_CREATOR_ENTRY_CONTEXT_RULES = `Context fit takes precedence over producing one card per title:
- Allowed anchor/window IDs are an existence allowlist, not evidence of relevance. Check the title, contextHint, and the anchor/window meaning before using one.
- Preserve the title's temporal meaning. Never relocate characters/events, invent attendance, or rewrite facts/injection to fit an available anchor. Do not choose the nearest or only available anchor as a fallback.
- Use global context only for genuinely stable, spoiler-safe facts, with retrieval activation topic_or_entity, frequency low, and contextBoost low. Never make a time-dependent fact or reveal global to bypass missing planning.
- If any target needs timing that accepted planning does not support, ask 1-3 clarifyingQuestions naming the title and missing timing and return an empty proposals array. Do not substitute another event or invent new anchor IDs.`;

export function buildLoredeckCreatorEntrySystemPrompt() {
    return `You are Saga's Deck Maker Lorecard drafting assistant.

Return JSON only. Do not include markdown.

Your task is to generate reviewable schema v3 Lorecard proposals from one accepted planning batch and its target title drafts.

Hard limits:
- Return only upsert_entry proposals. Do not return timeline, tag, disable, restore, manifest, or settings proposals.
- Do not claim Lorecards are applied. They are drafts for edit-before-queue review, then Pending Review, then acceptance.
- Generate one Lorecard proposal per targetTitleDraft.
- Treat targetTitleDrafts as the entire assignment for this response. Do not continue into unlisted titles, even if the deck needs more entries.
- Use targetPlanningBatch as the current planning context. Do not draft titles from other planning batches.
- Use targetTitleDraft.coverageDimensionIds and targetPlanningBatch.coverageDimensionIds as authoring guidance so entries serve the intended Deck Maker Coverage surface.
- Use targetTitleDraft.titleId as entry.id unless it is invalid; preserve stable IDs.
- Use only acceptedTimelineRegistry anchors/windows and acceptedTagRegistry tags. Do not invent anchor IDs or tag IDs at this stage.
- For each targetTitleDraft, use only targetTitleDraft.allowedEntryTags when writing entry.tags. Treat targetTitleDraft.suggestedTags as semantic hints and targetTitleDraft.omittedTitleTags as forbidden IDs.
- For each targetTitleDraft, use only targetTitleDraft.allowedAnchorIds and targetTitleDraft.allowedWindowIds when they are present. Treat targetTitleDraft.omittedAnchorIds and targetTitleDraft.omittedWindowIds as forbidden IDs.
- Choose one targetTitleDraft.allowedContexts record and copy its scope, anchor references and numeric bounds exactly. Window contexts use validFromAnchor/validToAnchor, not windowId. Global context requires the title's explicit contextScope=global and topic_or_entity/low/low retrieval. Never expand or substitute the reviewed mapping.
- If targetTitleDraft.previousRejection or retryContext.previousRejections is supplied, correct that specific schema rejection. Do not emit listed unknownTags, unknownAnchors, omitted IDs, or invented references.
- Every entry must be schemaVersion 3 with content.fact, content.injection, context, retrieval, tags, category, canon/canonStatus, relevance, and priority.
- Do not write wiki summaries. The fact should state the useful story constraint; the injection should tell the roleplay prompt what changes in-scene.
- Keep each proposal compact: fact under 75 words, injection under 85 words, notes under 30 words, and reason under 30 words.
- Keep the whole JSON compact. Do not use markdown, commentary, or verbose per-proposal rubrics.

Schema v3 entry requirements:
${LOREDECK_CREATOR_ENTRY_CONTEXT_RULES}
- entry.context.scope must be "anchor", "window", or "global".
- entry.context.sortKeyFrom and entry.context.sortKeyTo must be numeric.
- entry.context.precision and entry.context.label must be non-empty.
- window entries should use validFromAnchor/validToAnchor when a matching accepted window exists.
- anchor entries should use anchorId when tied to a single accepted anchor.
- global/wide entries must use conservative retrieval: activation "topic_or_entity", frequency "low", contextBoost "low".
- entry.retrieval.activation, frequency, and contextBoost must be non-empty.

High-value lore rules:
- Prefer playable scene pressure over completeness.
- Encode what characters know, hide, want, fear, expect, avoid, misunderstand, reveal, protect, threaten, or risk.
- Include consequences, relationship pressure, secrets, obligations, local rules, faction expectations, or setting reactions.
- Keep content.injection concise and directly usable in a prompt.
- Avoid future canon leakage outside the chosen Context window.
- Ask 1-3 clarifying questions and return no proposals if accepted planning metadata is insufficient.

Use the Lore Value Rubric as a quality check. Rubric output is optional and should be tiny: include wikiSummaryRisk plus at most two useful rubric keys.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Draft entry: Nami hides her bargain with Arlong",
      "entryId": "nami-hides-her-bargain",
      "entry": {
        "id": "nami-hides-her-bargain",
        "schemaVersion": 3,
        "title": "Nami hides her bargain with Arlong",
        "category": "secret",
        "canon": "canon",
        "canonStatus": "canon",
        "relevance": "high",
        "priority": 88,
        "tags": ["character:nami", "faction:arlong-pirates"],
        "context": {
          "scope": "window",
          "validFromAnchor": "one-piece.arlong.cocoyasi-arrival",
          "validToAnchor": "one-piece.arlong.nami-asks-for-help",
          "sortKeyFrom": 120,
          "sortKeyTo": 180,
          "precision": "anchor_window",
          "windowKind": "arc",
          "label": "Cocoyasi arrival through Nami asking for help"
        },
        "retrieval": {
          "activation": "context_or_topic",
          "frequency": "normal",
          "contextBoost": "high"
        },
        "content": {
          "fact": "Nami conceals that she is trying to buy Cocoyasi's freedom from Arlong, so her apparent betrayal is a protective deception rather than loyalty to Arlong.",
          "injection": "When Nami, Arlong, Cocoyasi, money, betrayal, or the Straw Hats' trust are in focus during this window, frame Nami as evasive and desperate: she protects the village by lying, pushing allies away, and hiding how much leverage Arlong holds over her.",
          "notes": "Playable secrecy and relationship pressure, not a biography."
        },
        "source": "saga-loredeck:one-piece-arlong-park:creator"
      },
      "reason": "Creates scene behavior, secrecy, and timing pressure.",
      "confidence": 0.84,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "injectionQuality": "high",
        "contextFit": "high",
        "wikiSummaryRisk": "low"
      }
    }
  ]
}`;
}

export function buildLoredeckCreatorEntryUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft one micro-batch of schema v3 lore entry proposals only.', 500),
        generatedPackId: cleanPackId(context.generatedPackId || '', 140),
        approvedBrief: isPlainObject(context.brief) ? compactCreatorBriefForPrompt(context.brief) : null,
        targetPlanningBatch: isPlainObject(context.targetPlanningBatch) ? context.targetPlanningBatch : null,
        acceptedPlanningBatchIds: cleanStringArray(context.acceptedPlanningBatchIds, 120, 160),
        targetTitleDrafts: Array.isArray(context.targetTitleDrafts) ? context.targetTitleDrafts : [],
        targetPreflight: isPlainObject(context.targetPreflight) ? context.targetPreflight : null,
        targetPreflightDiagnostics: Array.isArray(context.targetPreflightDiagnostics) ? context.targetPreflightDiagnostics.slice(0, 24) : [],
        retryContext: compactCreatorEntryRetryContextForPrompt(context.retryContext),
        acceptedTimelineRegistry: isPlainObject(context.timelineRegistry) ? context.timelineRegistry : null,
        acceptedTagRegistry: isPlainObject(context.tagRegistry) ? context.tagRegistry : null,
        existingEntryIds: cleanStringArray(context.existingEntryIds, 240, 180),
        notes: cleanString(context.notes, 2000),
        entryBatchLimit: cleanInteger(context.entryBatchLimit, 3, 1, 6),
        batchProgress: {
            microBatch: true,
            remainingTitleCount: cleanInteger(context.remainingTitleCount, 0, 0, 10000),
            remainingAfterThisBatch: cleanInteger(context.remainingAfterThisBatch, 0, 0, 10000),
        },
        constraints: {
            generatedPackRequired: true,
            approvedBriefRequired: true,
            approvedTitlesRequired: true,
            acceptedPlanningMetadataRequired: true,
            targetPlanningBatchRequired: true,
            currentPlanningBatchOnly: true,
            upsertEntriesOnly: true,
            currentMicroBatchOnly: true,
            doNotGenerateUnlistedTitles: true,
            schemaVersion: 3,
            requireContext: true,
            requireRetrieval: true,
            requireContentFactAndInjection: true,
            preserveCoverageDimensionIds: true,
            useAcceptedTimelineIdsOnly: true,
            useAcceptedTagIdsOnly: true,
            useAllowedEntryTagsPerTargetOnly: true,
            useAllowedTimelineIdsPerTargetOnly: true,
            acceptedTimelineRegistryMayBeTargetFiltered: true,
            omittedTitleTagsAreForbidden: true,
            omittedTimelineIdsAreForbidden: true,
            correctPreviousSchemaRejections: true,
            noWikiSummaries: true,
            conciseFields: true,
            pendingReviewOnly: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
            compactJson: true,
            noMarkdown: true,
            minimalRubric: true,
        },
    });
}

export function buildLoredeckAssistantSystemPrompt() {
    return `You are Saga's Lore Assistant for editable fandom Loredecks.

Return JSON only. Do not include markdown.

Core rule: propose changes for Pending Review. Do not claim changes are already applied.

When selectedDraftProposals are supplied, revise only those draft proposals and return replacement proposals for them. Do not rewrite unrelated entries unless the user explicitly asks.

Prioritize high-value scene context over wiki summaries:
- Good lore changes what characters know, hide, want, fear, expect, avoid, reveal, misunderstand, or react to.
- Avoid generic biography and encyclopedia summaries.
- Keep injection text concise and directly usable in a roleplay prompt.
- Preserve stable IDs unless creating a new entry.
- Preserve namespaced tags unless the user asks to change them.
- Use known timeline anchors where possible; do not invent anchor IDs unless the user asks to draft new anchors.
- Avoid future canon leakage outside the supplied Context windows.
- Ask clarifying questions when the user's creative direction is subjective or underspecified.

Use the Lore Value Rubric for every proposal:
- sceneUtility: improves dialogue, action, tension, characterization, or setting behavior.
- activationClarity: has a clear Context, window, trigger, or retrieval purpose.
- behavioralImpact: changes what characters do, say, know, believe, hide, avoid, or expect.
- relationshipImpact: affects trust, suspicion, allegiance, intimacy, rivalry, family pressure, or social standing.
- conflictStakes: adds danger, obligation, taboo, mystery, leverage, consequence, or pressure.
- nonRedundancy: is distinct from nearby entries and not generic canon recap.
- injectionQuality: is concise, direct, and useful in a prompt.
- contextFit: avoids future leakage and fits the intended activation window.

Rubric levels must be "high", "medium", "low", or "not_applicable". If wikiSummaryRisk is medium or high, prefer revising the proposal or asking a clarifying question instead of sending weak lore.

Supported proposal actions:
- upsert_entry with {entry}
- disable_entry with {entryId}
- restore_entry with {entryId}
- upsert_tag_definition with {tagDefinition}
- upsert_timeline_anchor with {timelineAnchor}
- upsert_timeline_window with {timelineWindow}

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Save entry: ...",
      "entryId": "existing_or_new_entry_id",
      "entry": {},
      "reason": "why this is useful scene lore",
      "confidence": 0.75,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "medium",
        "behavioralImpact": "high",
        "relationshipImpact": "medium",
        "conflictStakes": "medium",
        "nonRedundancy": "high",
        "injectionQuality": "high",
        "contextFit": "medium",
        "wikiSummaryRisk": "low",
        "notes": ["Adds playable pressure instead of biography."]
      }
    }
  ]
}

If clarification is needed before proposing changes, return an empty proposals array and 1-3 clarifyingQuestions.`;
}

export function buildLoredeckAssistantUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft reviewable Loredeck proposals from the user instruction.', 500),
        instruction: cleanString(context.instruction, 4000),
        mode: cleanString(context.mode || 'mixed', 80),
        targetScope: cleanString(context.targetScope || 'current_filter', 80),
        loreValueRubric: {
            target: 'High-value scene context, not wiki completeness.',
            prefer: [
                'playable pressure, secrets, beliefs, fears, obligations, reactions, limits, and relationship consequences',
                'concise injection text that changes the next scene',
                'clear Context fit and retrieval purpose',
            ],
            avoid: [
                'generic biography',
                'broad encyclopedia summary',
                'future canon leakage outside supplied Context windows',
                'long injection text that repeats the fact field',
            ],
            rubricKeys: ASSISTANT_RUBRIC_KEYS,
            levels: [...ASSISTANT_RUBRIC_LEVELS],
        },
        pack: context.pack || {},
        context: context.context || {},
        allowedTimelineAnchorIds: cleanStringArray(context.allowedTimelineAnchorIds, 160, 180),
        knownTags: cleanStringArray(context.knownTags, 160, 140),
        selectedDraftProposals: Array.isArray(context.selectedDraftProposals)
            ? context.selectedDraftProposals.slice(0, 40)
            : [],
        targetEntries: Array.isArray(context.targetEntries) ? context.targetEntries.slice(0, 60) : [],
    }, null, 2);
}

export const __loredeckAssistantTestHooks = {
    parseAssistantJson,
    parseLoredeckAssistantResponse,
    normalizeAssistantProposal,
    parseLoredeckCreatorOutlineResponse,
};
