import {
    sendLoreRequest,
} from '../providers/lore-llm-client.js';
import {
    LOREDECK_CREATOR_ENTRY_CONTEXT_RULES,
    LOREDECK_CREATOR_PLANNING_CONTEXT_RULES,
    buildLoredeckCreatorBriefSystemPrompt,
    buildLoredeckCreatorBriefUserPrompt,
    buildLoredeckCreatorEntrySystemPrompt,
    buildLoredeckCreatorEntryUserPrompt,
    buildLoredeckCreatorOutlineSystemPrompt,
    buildLoredeckCreatorOutlineUserPrompt,
    buildLoredeckCreatorPlanningSystemPrompt,
    buildLoredeckCreatorPlanningUserPrompt,
    buildLoredeckCreatorTitleSystemPrompt,
    buildLoredeckCreatorTitleUserPrompt,
} from './loredeck-assistant.js';

function truncateText(text = '', maxLen = 1000) {
    const value = String(text || '');
    if (value.length <= maxLen) return value;
    return `${value.slice(0, maxLen).replace(/\s+\S*$/, '')}...`;
}

function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function emitProgress(requestOptions = {}, event = {}) {
    if (typeof requestOptions.onProgress === 'function') {
        requestOptions.onProgress({
            ...event,
            streamSupported: requestOptions.stream === true,
        });
    }
}

export function isLoredeckCreatorBriefRetryableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return /response token limit|hit the response token limit|max[_ -]?token|length|truncated|reasoning-only|empty visible content/.test(message);
}

export function createLoredeckCreatorGenerationRequestHandlers(deps = {}) {
    const sendRequest = typeof deps.sendLoreRequest === 'function' ? deps.sendLoreRequest : sendLoreRequest;

    async function requestLoredeckCreatorBriefResponse(context = {}, requestOptionsOverride = {}) {
        const systemPrompt = buildLoredeckCreatorBriefSystemPrompt();
        const userPrompt = buildLoredeckCreatorBriefUserPrompt(context);
        const requestOptions = { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride };
        try {
            return await sendRequest(systemPrompt, userPrompt, requestOptions);
        } catch (error) {
            if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
            emitProgress(requestOptions, {
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact scope brief after empty or oversized response...',
            });
            const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before a usable visible JSON object was returned.
- Return only the compact scope-brief JSON object from the schema, including creatorCoverage.
- Do not include generation plans, outline details, timeline anchors, tags, Lorecard titles, entry counts, or prose.`;
            const retryUserPrompt = `${userPrompt}

Return the compact scope brief now. If the request is too broad, return clarifyingQuestions with "brief": null.`;
            return await sendRequest(retrySystemPrompt, retryUserPrompt, requestOptions);
        }
    }

    async function repairLoredeckCreatorBriefResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
        const systemPrompt = `You repair Saga Deck Maker intake output.

Return JSON only. Do not include markdown.

Convert the malformed or overlong response into the compact scope-brief contract. Preserve adaptive creatorCoverage when possible. Do not preserve timeline plans, tag plans, title plans, entry counts, or Lorecard facts. If there is not enough usable information, ask 1-3 clarifyingQuestions and set brief null.`;
        const userPrompt = JSON.stringify({
            sourceInputs: {
                fandom: context.fandom || '',
                scope: context.scope || '',
                granularity: context.granularity || 'focused',
                notes: truncateText(context.notes || '', 700),
                revisionInstruction: truncateText(context.revisionInstruction || '', 700),
            },
            expectedShape: {
                summary: 'one sentence',
                clarifyingQuestions: [],
                brief: {
                    title: 'string',
                    packId: 'machine-safe-id',
                    fandom: 'string',
                    scope: 'string',
                    granularity: 'compact|focused|dense|scene_dense',
                    coverageSummary: 'under 60 words',
                    creatorCoverage: {
                        storyShape: 'single arc|chapter|book|episode|game slice|sparse premise',
                        storyDensity: 'sparse|moderate|dense',
                        scopeKind: 'arc|book|chapter|scenario|mechanic',
                        status: 'missing|thin|adequate|rich|not_applicable|intentionally_light',
                        rationale: 'short adaptive coverage rationale',
                        expectedCoverage: 'short expectation without a hard count',
                        likelyNotApplicable: [],
                        dimensions: [{
                            id: 'machine-safe-id',
                            label: 'string',
                            kind: 'characters|factions|locations|plot|mechanics|relationships|other',
                            status: 'missing|thin|adequate|rich|not_applicable|intentionally_light',
                            priority: 80,
                            rationale: 'short reason',
                            evidenceTargets: [],
                        }],
                    },
                    assumptions: [],
                },
            },
            malformedResponse: truncateText(responseText, 5000),
        });
        emitProgress(requestOptionsOverride, {
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed response into compact Deck Maker JSON...',
        });
        return await sendRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 1536, expectedOutput: 'json', ...requestOptionsOverride });
    }

    async function requestLoredeckCreatorOutlineResponse(context = {}, requestOptionsOverride = {}) {
        const systemPrompt = buildLoredeckCreatorOutlineSystemPrompt();
        const userPrompt = buildLoredeckCreatorOutlineUserPrompt(context);
        const requestOptions = { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride };
        try {
            return await sendRequest(systemPrompt, userPrompt, requestOptions);
        } catch (error) {
            if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
            emitProgress(requestOptions, {
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Story Outline after oversized or empty response...',
            });
            const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before a usable visible JSON object was returned.
- Return only the compact Story Outline JSON object from the schema.
- Use at most 8 beats, 8 Context milestones, and 5 titleBatches.
- Keep each summary/contextRole under 18 words.
- Do not include prose outside JSON.`;
            const retryUserPrompt = `${userPrompt}

Return the compact Story Outline now. If the approved Scope Brief is still too broad, return clarifyingQuestions with "outline": null.`;
            return await sendRequest(retrySystemPrompt, retryUserPrompt, requestOptions);
        }
    }

    async function repairLoredeckCreatorOutlineResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
        const systemPrompt = `You repair Saga Deck Maker Story Outline output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, or overlong response into the compact Story Outline contract. Preserve only reviewable story beats, Context milestones, title-batch slices, creatorCoverage, and assumptions. Do not generate Lorecards, Lorecard titles, tag registries, timeline registry records, facts, or injection text. If there is not enough usable information, ask 1-3 clarifyingQuestions and set outline null.`;
        const userPrompt = JSON.stringify({
            sourceInputs: {
                approvedBrief: context.brief || null,
                notes: truncateText(context.notes || '', 700),
                revisionInstruction: truncateText(context.revisionInstruction || '', 700),
                previousOutline: context.previousOutline || null,
            },
            expectedShape: {
                summary: 'one sentence',
                clarifyingQuestions: [],
                outline: {
                    label: 'string',
                    coverageSummary: 'under 70 words',
                    creatorCoverage: {
                        storyShape: 'string',
                        storyDensity: 'sparse|moderate|dense',
                        scopeKind: 'string',
                        status: 'missing|thin|adequate|rich|not_applicable|intentionally_light',
                        rationale: 'short reason',
                        expectedCoverage: 'short expectation without a hard count',
                        likelyNotApplicable: [],
                        dimensions: [{
                            id: 'machine-safe-id',
                            label: 'string',
                            kind: 'string',
                            status: 'missing|thin|adequate|rich|not_applicable|intentionally_light',
                            priority: 80,
                            rationale: 'short reason',
                            evidenceTargets: [],
                            titleBatchIds: [],
                        }],
                    },
                    beats: [{ id: 'machine-safe-id', label: 'string', type: 'beat', order: 10, summary: 'short sentence', contextRole: 'short sentence', titleTargets: [], coverageDimensionIds: [] }],
                    contextMilestones: [{ id: 'machine-safe-id', label: 'string', type: 'before_after', order: 10, summary: 'short sentence', contextRole: 'short sentence', coverageDimensionIds: [] }],
                    titleBatches: [{ id: 'machine-safe-id', label: 'string', type: 'title_batch', order: 10, summary: 'short sentence', coverageDimensionIds: [] }],
                    assumptions: [],
                },
            },
            limits: {
                beats: 8,
                contextMilestones: 8,
                titleBatches: 5,
                maxVisibleJsonTokens: 1600,
            },
            malformedResponse: truncateText(responseText, 7000),
        });
        emitProgress(requestOptionsOverride, {
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Story Outline into compact Deck Maker JSON...',
        });
        return await sendRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
    }

    async function requestLoredeckCreatorTitleResponse(context = {}, requestOptionsOverride = {}) {
        const systemPrompt = buildLoredeckCreatorTitleSystemPrompt();
        const userPrompt = buildLoredeckCreatorTitleUserPrompt(context);
        const requestOptions = {
            providerKind: 'lore',
            maxTokens: context.revisionInstruction ? 4096 : 4096,
            expectedOutput: 'json',
            ...requestOptionsOverride,
        };
        try {
            return await sendRequest(systemPrompt, userPrompt, requestOptions);
        } catch (error) {
            if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
            emitProgress(requestOptions, {
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact title set after oversized or empty response...',
            });
            const titlePassLimit = clampInteger(context.titlePassLimit, 1, 12, 8);
            const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact Title Pass JSON object from the schema.
- Generate at most ${titlePassLimit} titles for the supplied targetTitleBatch.
- Omit rubric unless a compact quality score adds useful review context; if included, use only wikiSummaryRisk and one useful key.
- Keep each reason under 18 words and each contextHint under 18 words.
- Do not include prose outside JSON.`;
            return await sendRequest(retrySystemPrompt, userPrompt, requestOptions);
        }
    }

    async function repairLoredeckCreatorTitleResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
        const systemPrompt = `You repair Saga Deck Maker Title Pass output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact Title Pass contract. Preserve usable title drafts and coverageDimensionIds from the source. Do not generate Lorecards, facts, injection text, timeline anchors, timeline windows, or tag registries. If there is not enough usable title information, ask 1-3 clarifyingQuestions and return an empty titleDrafts array.`;
        const titlePassLimit = clampInteger(context.titlePassLimit, 1, 12, 8);
        const userPrompt = JSON.stringify({
            sourceInputs: {
                approvedBrief: context.brief || null,
                targetTitleBatch: context.targetTitleBatch || null,
                revisionInstruction: truncateText(context.revisionInstruction || '', 700),
                selectedTitleDrafts: Array.isArray(context.selectedTitleDrafts) ? context.selectedTitleDrafts.slice(0, 20) : [],
                titlePassLimit,
            },
            expectedShape: {
                summary: 'one sentence',
                clarifyingQuestions: [],
                batch: {
                    label: 'string',
                    coverage: 'under 40 words',
                    nextBatchHint: 'optional string',
                    complete: false,
                },
                titleDrafts: [{
                    titleId: 'machine-safe-id',
                    title: 'string',
                    category: 'string',
                    priority: 80,
                    relevance: 'high|medium|low',
                    contextHint: 'short timing or activation hint',
                    tags: ['namespaced:tag'],
                    reason: 'short review rationale',
                    coverageDimensionIds: [],
                    rubric: { wikiSummaryRisk: 'low' },
                }],
            },
            limits: {
                titleDrafts: titlePassLimit,
                maxReasonWords: 18,
                maxContextHintWords: 18,
                compactJson: true,
            },
            malformedResponse: truncateText(responseText, 9000),
        });
        emitProgress(requestOptionsOverride, {
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Title Pass into compact Deck Maker JSON...',
        });
        return await sendRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
    }

    async function requestLoredeckCreatorPlanningResponse(context = {}, requestOptionsOverride = {}) {
        const systemPrompt = buildLoredeckCreatorPlanningSystemPrompt();
        const userPrompt = buildLoredeckCreatorPlanningUserPrompt(context);
        const requestOptions = { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride };
        try {
            return await sendRequest(systemPrompt, userPrompt, requestOptions);
        } catch (error) {
            if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
            emitProgress(requestOptions, {
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Context and Tag plan after oversized or empty response...',
            });
            const proposalLimit = clampInteger(context.proposalLimit, 1, 24, 16);
            const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact proposal JSON object from the schema.
- Return at most ${proposalLimit} planning proposals.
- Supported actions only: upsert_timeline_anchor, upsert_timeline_window, upsert_tag_definition.
- Omit rubric unless a compact quality score adds useful review context; if included, use only wikiSummaryRisk and one useful key.
- Keep each reason under 18 words.
- Do not include prose outside JSON.`;
            return await sendRequest(retrySystemPrompt, userPrompt, requestOptions);
        }
    }

    async function repairLoredeckCreatorPlanningResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
        const systemPrompt = `You repair Saga Deck Maker Context and Tag planning output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact proposal contract. Preserve usable planning proposals from the source. Return only upsert_timeline_anchor, upsert_timeline_window, and upsert_tag_definition proposals. Do not generate Lorecards, facts, injection text, or entry overrides. If there is not enough usable planning information, ask 1-3 clarifyingQuestions and return an empty proposals array.

${LOREDECK_CREATOR_PLANNING_CONTEXT_RULES}`;
        const proposalLimit = clampInteger(context.proposalLimit, 1, 24, 16);
        const userPrompt = JSON.stringify({
            sourceInputs: {
                generatedPackId: context.generatedPackId || '',
                approvedBrief: context.brief || null,
                targetPlanningBatch: context.targetPlanningBatch || null,
                approvedTitleDrafts: Array.isArray(context.approvedTitleDrafts) ? context.approvedTitleDrafts.slice(0, 24) : [],
                existingTimelineIds: Array.isArray(context.existingTimelineIds) ? context.existingTimelineIds.slice(0, 120) : [],
                existingTagIds: Array.isArray(context.existingTagIds) ? context.existingTagIds.slice(0, 160) : [],
                proposalLimit,
            },
            expectedShape: {
                summary: 'one sentence',
                clarifyingQuestions: [],
                proposals: [{
                    action: 'upsert_timeline_anchor|upsert_timeline_window|upsert_tag_definition',
                    title: 'string',
                    timelineId: 'optional-id',
                    tagId: 'optional-id',
                    timelineAnchor: 'object when action is upsert_timeline_anchor',
                    timelineWindow: 'object when action is upsert_timeline_window',
                    tagDefinition: 'object when action is upsert_tag_definition',
                    reason: 'short review rationale',
                    confidence: 0.8,
                    risk: 'low|medium|high',
                    rubric: { wikiSummaryRisk: 'low' },
                }],
            },
            limits: {
                proposals: proposalLimit,
                supportedActionsOnly: true,
                compactJson: true,
            },
            malformedResponse: truncateText(responseText, 9000),
        });
        emitProgress(requestOptionsOverride, {
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Context and Tag plan into compact Deck Maker JSON...',
        });
        return await sendRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
    }

    async function requestLoredeckCreatorEntryResponse(context = {}, requestOptionsOverride = {}) {
        const systemPrompt = buildLoredeckCreatorEntrySystemPrompt();
        const userPrompt = buildLoredeckCreatorEntryUserPrompt(context);
        const requestOptions = { providerKind: 'lore', maxTokens: 8192, expectedOutput: 'json', ...requestOptionsOverride };
        try {
            return await sendRequest(systemPrompt, userPrompt, requestOptions);
        } catch (error) {
            if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
            emitProgress(requestOptions, {
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Lorecard micro-batch after oversized or empty response...',
            });
            const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact proposal JSON object from the schema.
- Return only upsert_entry proposals for the supplied targetTitleDrafts.
- Keep fact under 60 words, injection under 75 words, notes under 24 words, and reason under 20 words.
- Omit rubric unless needed; if included, use only wikiSummaryRisk and one useful key.
- Do not include prose outside JSON.`;
            return await sendRequest(retrySystemPrompt, userPrompt, requestOptions);
        }
    }

    async function repairLoredeckCreatorEntryResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
        const systemPrompt = `You repair Saga Deck Maker Lorecard drafting output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact proposal contract. Preserve usable upsert_entry proposals from the source. Return only upsert_entry proposals for the supplied targetTitleDrafts. Do not generate timeline, tag, disable, restore, manifest, or settings proposals. If there is not enough usable entry information, ask 1-3 clarifyingQuestions and return an empty proposals array.

${LOREDECK_CREATOR_ENTRY_CONTEXT_RULES}`;
        const entryBatchLimit = clampInteger(context.entryBatchLimit, 1, 6, 3);
        const userPrompt = JSON.stringify({
            sourceInputs: {
                generatedPackId: context.generatedPackId || '',
                approvedBrief: context.brief || null,
                targetPlanningBatch: context.targetPlanningBatch || null,
                targetTitleDrafts: Array.isArray(context.targetTitleDrafts) ? context.targetTitleDrafts.slice(0, 6) : [],
                acceptedTimelineRegistry: context.timelineRegistry || null,
                acceptedTagRegistry: context.tagRegistry || null,
                existingEntryIds: Array.isArray(context.existingEntryIds) ? context.existingEntryIds.slice(0, 160) : [],
            },
            expectedShape: {
                summary: 'one sentence',
                clarifyingQuestions: [],
                proposals: [{
                    action: 'upsert_entry',
                    title: 'Draft entry: title',
                    entryId: 'target-entry-id',
                    entry: {
                        id: 'target-entry-id',
                        schemaVersion: 3,
                        title: 'string',
                        category: 'string',
                        canon: 'canon',
                        canonStatus: 'canon',
                        relevance: 'high|medium|low',
                        priority: 80,
                        tags: [],
                        context: {},
                        retrieval: {},
                        content: { fact: 'short useful constraint', injection: 'short scene instruction', notes: 'optional' },
                    },
                    reason: 'short review rationale',
                    confidence: 0.8,
                    risk: 'low|medium|high',
                    rubric: { wikiSummaryRisk: 'low' },
                }],
            },
            limits: {
                proposals: entryBatchLimit,
                upsertEntriesOnly: true,
                compactJson: true,
            },
            malformedResponse: truncateText(responseText, 12000),
        });
        emitProgress(requestOptionsOverride, {
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Lorecard batch into compact Deck Maker JSON...',
        });
        return await sendRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride });
    }

    return {
        requestLoredeckCreatorBriefResponse,
        repairLoredeckCreatorBriefResponse,
        requestLoredeckCreatorOutlineResponse,
        repairLoredeckCreatorOutlineResponse,
        requestLoredeckCreatorTitleResponse,
        repairLoredeckCreatorTitleResponse,
        requestLoredeckCreatorPlanningResponse,
        repairLoredeckCreatorPlanningResponse,
        requestLoredeckCreatorEntryResponse,
        repairLoredeckCreatorEntryResponse,
    };
}

const defaultHandlers = createLoredeckCreatorGenerationRequestHandlers();

export const requestLoredeckCreatorBriefResponse = defaultHandlers.requestLoredeckCreatorBriefResponse;
export const repairLoredeckCreatorBriefResponse = defaultHandlers.repairLoredeckCreatorBriefResponse;
export const requestLoredeckCreatorOutlineResponse = defaultHandlers.requestLoredeckCreatorOutlineResponse;
export const repairLoredeckCreatorOutlineResponse = defaultHandlers.repairLoredeckCreatorOutlineResponse;
export const requestLoredeckCreatorTitleResponse = defaultHandlers.requestLoredeckCreatorTitleResponse;
export const repairLoredeckCreatorTitleResponse = defaultHandlers.repairLoredeckCreatorTitleResponse;
export const requestLoredeckCreatorPlanningResponse = defaultHandlers.requestLoredeckCreatorPlanningResponse;
export const repairLoredeckCreatorPlanningResponse = defaultHandlers.repairLoredeckCreatorPlanningResponse;
export const requestLoredeckCreatorEntryResponse = defaultHandlers.requestLoredeckCreatorEntryResponse;
export const repairLoredeckCreatorEntryResponse = defaultHandlers.repairLoredeckCreatorEntryResponse;
