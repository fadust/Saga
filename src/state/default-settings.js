/**
 * Default extension settings for Saga.
 */

import {
    DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
    DEFAULT_HP_LOREDECK_STACK,
} from '../loredecks/loredeck-defaults.js';
import {
    createDefaultSagaStorageFallback,
    createDefaultSagaStorageSettings,
} from '../storage/saga-storage-index.js';
import { BASIC_EXPERIENCE_PROFILE_VERSION } from './basic-profile.js';

export const DEFAULT_SETTINGS = {
    enabled: true,
    runtimeWindowOpen: false,
    injectMemo: true,
    injectContinuity: false,
    autoExtract: false,
    autoApplyDelta: false,
    extractionInterval: 1,
    debugMode: false,
    experienceMode: 'basic',
    advancedExperienceSettingsBackup: null,
    basicExperienceProfileVersion: BASIC_EXPERIENCE_PROFILE_VERSION,
    themePackId: 'saga-default',
    themeIconSetId: 'saga-hero',
    sagaStorage: createDefaultSagaStorageSettings(),
    sagaStorageFallback: createDefaultSagaStorageFallback(),
    themeCustomEnabled: false,
    themeBackgroundColor: '#120c12',
    themeBackgroundAltColor: '#241018',
    themeSurfaceColor: '#2b1c1c',
    themeSurfaceAltColor: '#121218',
    themeGradientStartColor: '#120c12',
    themeGradientEndColor: '#090c12',
    themeBorderColor: '#b98b36',
    themeBorderStrongColor: '#d7b56d',
    themeAccentColor: '#d7b56d',
    themeDangerColor: '#5c1724',
    themeSuccessColor: '#1f4a38',
    themeActivateColor: '#ffcb5c',
    themeWarningColor: '#b9903c',
    themeFocusColor: '#ffeaa7',
    themeButtonColor: '#18121a',
    themeButtonHoverColor: '#5c1724',
    themeButtonTextColor: '#f1ead8',
    themeInputColor: '#121218',
    themeInputBorderColor: '#b98b36',
    themeTextColor: '#f1ead8',
    themeMutedTextColor: '#cfc5ad',
    themeChipNeutralColor: '#c8cbd2',
    themeChipSourceColor: '#cbb98a',
    themeChipInfoColor: '#c7cfdd',
    themeChipReviewColor: '#d8b66d',
    themeChipSuccessColor: '#b9d8b8',
    themeChipWarningColor: '#e0c184',
    themeChipDangerColor: '#e1a0a0',
    themeChipMutedColor: '#aeb3bd',
    themePackLibrary: {
        schemaVersion: 1,
        packs: {},
    },
    themeIconSetLibrary: {
        schemaVersion: 1,
        iconSets: {},
    },
    emptyLoredeckStackDefaultsMigrated20260605: true,
    loredeckLibrary: {
        schemaVersion: 1,
        packs: DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
        activeStack: DEFAULT_HP_LOREDECK_STACK,
    },
    loredeckCreatorProjects: {
        schemaVersion: 1,
        activeJobId: '',
        lastJobId: '',
        jobs: {},
    },

    // Runtime automation modes. These replace the old single workflow preset for new behavior.
    automationMode: 'manual',
    continuityTrackingMode: 'manual', // 'manual' | 'automatic'
    continuityAutoInterval: 10, // turns between automatic continuity scans
    contextDetectionMode: 'manual', // 'manual' | 'assisted' | 'automatic'
    contextDetectionAutoInterval: 20,
    contextDetectionAutoMinTurns: 8,
    contextDetectionAutoCharacterThreshold: 8000,
    contextModelFallbackMinCharacters: 1200,
    contextReasonerFallbackEnabled: true,
    contextLocalApplyMinConfidence: 0.78,
    contextReasonerProposalMinConfidence: 0.55,
    loreGenerationMode: 'manual', // 'manual' | 'automatic'
    loreGenerationAutoInterval: 50,
    loreGenerationAutoMinTurns: 20,
    loreGenerationAutoWordThreshold: 2500,
    contextSourceMessageCount: 20,
    continuitySourceMessageCount: 10,

    // Checkpointed continuity scan behavior
    continuityScanMode: 'recent', // 'recent' | 'range' | 'entire'
    continuityScanRangeStart: 1,
    continuityScanRangeEnd: 0, // 0 = latest message
    continuityScanChunkSize: 8,
    continuityScanOverlap: 1,
    continuityScanConcurrency: 3,
    continuityScanReducerConcurrency: 3,
    continuityScanRescanMode: 'skip_unchanged', // 'skip_unchanged' | 'retry_failed' | 'stale_only' | 'rescan_all'
    continuityScanRetryAttempts: 2,
    continuityScanObservationsPerChunk: 12,
    continuityScanFullCheckpointEveryChunks: 5,
    continuityScanRunningCheckpointStaleMs: 10 * 60 * 1000,
    continuityScanRetainRawResponses: false,
    continuityScanRetainCompletedBatches: 3,
    continuityScanStrategy: 'adaptive', // 'adaptive' | 'fast' | 'hybrid' | 'bulk'
    continuityScanFastThreshold: 4,
    continuityScanHybridThreshold: 80,
    continuityFastMaxTokens: 2048,
    continuityHybridMaxTokens: 3072,
    continuityObservationMaxTokens: 1536,
    continuityReducerMaxTokens: 1536,

    // Lore matrix
    injectLore: true,
    semanticCanonEnabled: false,
    semanticCanonApiUrl: 'http://127.0.0.1:1234',
    semanticCanonModel: 'text-embedding-embeddinggemma-2',
    semanticCanonTokenBudget: 1000,
    layer1Sources: {},
    maxLoreEntriesInMemo: 0, // 0 = unlimited; users control injection by muting entries
    // Accepted Lore Matrix is intentionally uncapped. UI uses paging so hundreds of entries remain usable.
    maxLoreEntriesInMatrix: 0,
    autoGenerateLore: false,
    workflowMode: 'manual', // deprecated legacy alias for automationMode

    // Lore generation behavior
    loreSourceMessageCount: 40,
    loreGenerationChunkSize: 10,
    loreGenerationBreadthMode: 'auto', // 'auto' | 'bootstrap' | 'incremental'
    loreBootstrapTargetEntries: 40,
    loreIncrementalTargetEntries: 5,
    loreBootstrapStoryLoreThreshold: 12,
    loreBootstrapDefaultsMigrated20260531: true,
    loreAutomationDefaultsMigrated20260602: true,
    continuityPerformanceDefaultsMigrated20260603: true,
    contextAutomationDefaultsMigrated20260606: true,
    loreReplacementGuard: true,
    loreDuplicateGuard: true,
    loreSimilarityRouting: true,
    loreStrictQualityGate: true,
    loreTagCount: 4,

    // Bulk story lore scan/backfill behavior
    loreBulkScanMode: 'recent', // 'recent' | 'range' | 'entire'
    loreBulkRangeStart: 1,
    loreBulkRangeEnd: 0, // 0 = latest message
    loreBulkChunkSize: 10,
    loreBulkOverlap: 1,
    loreBulkConcurrency: 3,
    loreBulkRescanMode: 'skip_unchanged', // 'skip_unchanged' | 'retry_failed' | 'stale_only' | 'rescan_all'
    loreBulkRetryAttempts: 2,
    loreBulkFactsPerChunk: 8,
    loreBulkConsolidateAsPending: true,
    loreBulkConsolidationChunkWindow: 5,
    loreBulkConsolidationFactWindow: 80,
    loreBulkFullCheckpointEveryChunks: 5,
    loreBulkFullCheckpointEveryMs: 12000,
    loreBulkRunningCheckpointStaleMs: 10 * 60 * 1000,
    loreBulkRetainRawResponses: false,
    loreBulkRetainCompletedBatches: 3,

    // Local canon lore database
    canonLoreDatabaseEnabled: true,
    canonLoreAutoPropose: false,
    canonLoreMaxEntries: 10,

    // Lore relevance / canon timing
    canonTimelineStrictness: 'balanced', // 'loose' | 'balanced' | 'strict'
    autoReevaluateLoreLifecycle: false, // Deprecated by relevance-tiered lore. Kept for old settings compatibility.
    autoMuteExpiredLore: false,
    includeCanonOverdueLore: false,
    autoRelevanceEnabled: false,
    autoRelevanceMode: 'apply_high_confidence', // Legacy 'suggest' is normalized to direct high-confidence action.
    autoRelevanceEveryTurns: 5,
    autoRelevanceRecentMessages: 20,
    autoRelevanceCandidateCap: 40,
    autoRelevanceMinConfidence: 0.7,
    autoRelevanceNearFutureDays: 30,
    autoRelevanceRecentPastDays: 45,
    autoRelevanceProtectPinned: true,
    autoRelevanceEvaluateMuted: false,
    autoRelevanceModelCandidateCap: 20,
    autoRelevanceModelMaxTokens: 2048,
    autoRelevanceModelRecentChars: 5000,

    // Lore Automation Levels. These supersede the visible Auto-Relevance controls.
    loreAutomationMode: 'off', // 'off' | 'ar' | 'armp' | 'armpc'
    loreAutomationStyle: 'balanced', // 'careful' | 'balanced' | 'aggressive'
    loreAutomationPaused: false,
    loreAutomationProviderRouting: 'auto', // 'auto' | 'utility' | 'reasoning' | 'local'
    loreAutomationCadenceMode: 'manual',
    loreAutomationPacing: 'normal', // 'responsive' | 'normal' | 'relaxed'
    loreAutomationRemapWordBudget: 900,
    loreAutomationCurationWordBudget: 1800,
    loreAutomationRunJournalLimit: 20,
    loreAutomationLevelsMigrated20260615: true,

    // Prompt injection transport / placement
    // 'extension_prompt' uses SillyTavern setExtensionPrompt with role/depth.
    // 'interceptor' preserves the legacy behavior: prepend combined memo to the last user message.
    injectionTransport: 'extension_prompt',
    continuityInjectionPosition: 1, // SillyTavern extension_prompt_types.IN_CHAT
    continuityInjectionDepth: 3,
    continuityInjectionRole: 0, // SillyTavern extension_prompt_roles.SYSTEM
    loreInjectionPosition: 1,
    loreInjectionDepth: 3,
    loreInjectionRole: 0,
    loreHighInjectionPosition: 1,
    loreHighInjectionDepth: 2,
    loreHighInjectionRole: 0,
    loreNormalInjectionPosition: 1,
    loreNormalInjectionDepth: 5,
    loreNormalInjectionRole: 0,
    loreLowInjectionPosition: 1,
    loreLowInjectionDepth: 9,
    loreLowInjectionRole: 0,
    injectionPromptScan: false,

    // Lore injection / compression
    loreInjectionMode: 'direct', // legacy aggregate compatibility
    loreHighInjectionEnabled: true,
    loreNormalInjectionEnabled: true,
    loreLowInjectionEnabled: true,
    loreHighInjectionMode: 'direct', // 'direct' | 'compressed'
    loreNormalInjectionMode: 'compressed',
    loreLowInjectionMode: 'compressed',
    loreHighCompressionLevel: 3,
    loreNormalCompressionLevel: 3,
    loreLowCompressionLevel: 3,
    loreHighCompressionTurnInterval: 4,
    loreNormalCompressionTurnInterval: 8,
    loreLowCompressionTurnInterval: 16,
    loreHighMaxEntries: 30,
    loreNormalMaxEntries: 60,
    loreLowMaxEntries: 120,
    loreCompressionLevel: 3, // legacy aggregate compatibility
    loreCompressionTurnInterval: 8,
    continuityInjectionMode: 'direct', // 'direct' | 'compressed'
    continuityCompressionLevel: 3,
    continuityEmotionRecencyEnabled: true,
    continuityEmotionCurrentMessageWindow: 8,
    continuityEmotionRecentMessageWindow: 20,
    continuityEmotionStaleBehavior: 'omit', // 'omit' | 'keep_as_recent' | 'keep'

    // Advanced compression prompt templates. Variables: {{kind}}, {{compressionLevel}},
    // {{compressionLabel}}, {{compressionPolicy}}, {{directTokens}},
    // {{minimumTokens}}, {{targetTokens}}, {{maximumTokens}}, {{hardTokenLimit}},
    // {{directCharacters}}, {{minimumCharacters}}, {{targetCharacters}},
    // {{maximumCharacters}}, {{hardCharacterLimit}}, {{storyContext}}, {{directText}}.
    continuityCompressionPromptTemplate: `Compress the following Saga {{kind}} injection block for a fandom roleplay.

Context:
{{storyContext}}

Compression level {{compressionLevel}} - {{compressionLabel}}.
Policy: {{compressionPolicy}}.
Source length: about {{directTokens}} tokens / {{directCharacters}} characters.
Target length: about {{targetTokens}} tokens / {{targetCharacters}} characters.
Preferred range: {{minimumTokens}}-{{maximumTokens}} tokens / {{minimumCharacters}}-{{maximumCharacters}} characters.
Try not to compress below the preferred range; restore useful details if the output is too short.
Try not to exceed the preferred range; remove lower-value wording if the output is too long.

Rules:
- Preserve current scene/timeline state, active character state, key items, and active goals/threads.
- Keep emotional state only when it currently affects character behavior.
- Merge redundant details and rewrite for density; do not simply restate the source.
- At compression level 3 or higher, prefer compact bullets and phrase fragments over prose.
- Do not invent facts.
- Output only the compressed injection text. No markdown fences or commentary.

Direct injection block:
{{directText}}`,
    loreCompressionPromptTemplate: `Compress the following Saga {{kind}} injection block for a fandom roleplay.

Context:
{{storyContext}}

Compression level {{compressionLevel}} - {{compressionLabel}}.
Policy: {{compressionPolicy}}.
Source length: about {{directTokens}} tokens / {{directCharacters}} characters.
Target length: about {{targetTokens}} tokens / {{targetCharacters}} characters.
Preferred range: {{minimumTokens}}-{{maximumTokens}} tokens / {{minimumCharacters}}-{{maximumCharacters}} characters.
Try not to compress below the preferred range; restore useful details if the output is too short.
Try not to exceed the preferred range; remove lower-value wording if the output is too long.

Rules:
- Preserve secrets, knowledge boundaries, canon or story-established constraints, current-scene relevant facts, and active hazards.
- Preserve Elevated/protected lore more fully than ordinary lore.
- Merge redundant entries where possible and drop low-value wording. Drop generic reference/glossary facts if they appear; preserve only specific constraints, dates, knowledge boundaries, status changes, and story-established facts.
- At compression level 3 or higher, prefer compact bullets and phrase fragments over prose.
- Do not invent facts.
- Output only the compressed injection text. No markdown fences or commentary.

Direct injection block:
{{directText}}`,

    // Runtime-window collapsible sections. true = collapsed.
    collapsedSections: {
        'session.instructions.basic': true,
        'session.instructions.advanced': true,
        'session.instructions': true,
        'session.automationMode.section': true,
        'session.storyMaker': true,
        'context.commandCenter': false,
        'context.loadedLoredecks': false,
        'context.advancedBrief': true,
        'loredecks.activeStack': false,
        'loredecks.health': true,
        'loredecks.importExport': true,
        'loredecks.creator': false,
        'loredecks.loaded': false,
        'loredecks.context': true,
        'loredecks.library': false,
        'loredecks.libraryLaunch': false,
        'loredecks.creatorProjects': true,
        'loredecks.details': false,
        'lore.generation': false,
        'lore.autoRelevance': true,
        'lore.acceptedEntries': false,
        'lore.canonSuggestionSettings': true,
        'lore.generationSettings': true,
        'lore.storyGenerationSettings': true,
        'lore.story.scanScope': false,
        'lore.story.performance': true,
        'lore.story.quality': true,
        'lore.story.automation': true,
        'settings.identity': false,
        'settings.providers': false,
        'settings.qualityOfLife': false,
        'settings.themePack': true,
        'settings.stateSafety': true,
        'injection.promptPlacement': true,
        'continuity.scan': false,
        'continuity.pendingChanges': false,
        'injection.preview.continuity': false,
        'injection.preview.loreHigh': false,
        'injection.preview.loreNormal': true,
        'injection.preview.loreLow': true,
        'injection.preview.loreCombined': true,
        'injection.continuityHandling': true,
        'injection.loreHighHandling': true,
        'injection.loreNormalHandling': true,
        'injection.loreLowHandling': true,
        'injection.compressionPrompts': true,
        'continuity.scanScope': true,
        'continuity.scanPerformance': true,
        'continuity.scanResults': true,
        'continuity.trackedSections': true,
        'continuity.canonScene': false,
        'continuity.characters': false,
        'continuity.threads': true,
        'continuity.inventory': true,
        'continuity.activeGoalsThreads': true,
        'continuity.prompt.canonScene': true,
        'continuity.prompt.characters': true,
        'continuity.prompt.threads': true,
        'continuity.prompt.inventory': true,
        'continuity.prompt.objectives': true,
    },

    // Continuity scan prompt overrides. These are appended to the extractor prompt only
    // when the corresponding section is enabled/tracked for the current chat.
    continuitySectionPrompts: {
        canonScene: 'Extract only explicitly established scene and timeline details: era, in-universe date, canon boundary, location, time of day, weather, ambience, present/nearby characters, and current activity. Do not invent missing fields. Durable story-established canon changes belong in Story Lore, not Continuity.',
        characters: 'Track active character state when clearly supported: role, current location, clothing, posture, physical condition, currently observed emotional state, carried key items, and immediate goals. For emotionalState, include confidence from 0 to 1 when uncertain, and only update it when the latest messages show or explicitly state the emotion. Do not summarize relationship history or durable knowledge here; Story Lore owns that memory.',
        threads: 'Track only active immediate threads that affect the next scene or next few replies. Durable plot history, milestones, secrets, and relationship history belong in Story Lore.',
        inventory: 'Track only consequential currently relevant items: carried key items, ownership, location, and immediate object status. Item history belongs in Story Lore.',
        objectives: 'Track current goals, plans, blockers, stakes, and whether objectives are active, blocked, completed, or abandoned. Long-term plot facts belong in Story Lore.'
    },

    // Utility provider: used by compression and Scan Continuity State / automatic continuity tracking. Internal key retained for backward compatibility.
    continuityProvider: 'st', // 'st' | 'profile' | 'openai_compatible'
    continuityProfileId: '',
    // Deprecated: Connection Profiles now own their settings preset.
    continuityCompletionPresetId: '',
    continuityOpenAIBaseUrl: '',
    continuityOpenAIModel: '',
    continuityOpenAIKeyEncrypted: null,
    continuityOpenAIKeySalt: '',
    continuityOpenAIKeyIv: '',
    continuityOpenAIKeySet: false,
    // Deprecated compatibility flags. Saga now uses plain direct
    // OpenAI-compatible calls for this provider path.
    continuityOpenAIUseJsonMode: false,
    continuityOpenAIUseSTProxy: false,
    continuityTemperature: 0.7,
    continuityTopP: 0.98,
    continuityMaxTokens: 8192,

    // Reasoning provider: used by Detect Context / Generate Pending Lore. Internal key retained for backward compatibility.
    loreProvider: 'st', // 'st' | 'profile' | 'openai_compatible'
    loreProfileId: '',
    // Deprecated: Connection Profiles now own their settings preset.
    loreCompletionPresetId: '',

    // Lore OpenAI-compatible endpoint
    loreOpenAIBaseUrl: '',
    loreOpenAIModel: '',
    loreOpenAIKeyEncrypted: null,
    loreOpenAIKeySalt: '',
    loreOpenAIKeyIv: '',
    loreOpenAIKeySet: false,
    // Deprecated compatibility flags. Saga now relies on JSON-focused
    // prompts and repair rather than forcing provider-specific JSON mode.
    loreOpenAIUseJsonMode: false,
    loreOpenAIUseSTProxy: false,

    // Reasoning generation parameters (separate from main RP model settings)
    loreTemperature: 0.7,
    loreTopP: 0.98,
    loreMaxTokens: 8192,
    loreRepairOnParseFail: true,
};
