/**
 * Settings read/write facade for Saga extension settings.
 */

import {
    MODULE_KEY,
    DEFAULT_SETTINGS,
    AUTOMATION_MODE_VALUES,
    EXPERIENCE_MODE_VALUES,
    BASIC_EXPERIENCE_SETTINGS,
    BASIC_EXPERIENCE_PROFILE_VERSION,
} from './constants.js';
import { normalizeLoredeckCreatorRegistry } from './lore-creator-state.js';
import {
    normalizeLoredeckRegistry,
} from './lore-state-normalizers.js';
import { queuePromptInjectionSync } from './prompt-sync.js';
import {
    normalizeThemeIconSetRegistry,
    normalizeThemePackRegistry,
} from './theme-library-store.js';
import {
    normalizeSagaStorageFallback,
    normalizeSagaStorageSettings,
} from '../storage/saga-storage-index.js';
import { assertSagaStorageWriteAcknowledged } from '../storage/saga-storage-coordinator.js';

const EMPTY_EXTERNALIZED_LOREDECK_LIBRARY = Object.freeze({
    schemaVersion: 1,
    packs: Object.freeze({}),
    folders: Object.freeze([]),
    deckPlacements: Object.freeze([]),
    activeStack: Object.freeze([]),
});
const EMPTY_EXTERNALIZED_CREATOR_PROJECTS = Object.freeze({
    schemaVersion: 1,
    activeJobId: '',
    lastJobId: '',
    jobs: Object.freeze({}),
});
const EMPTY_EXTERNALIZED_THEME_PACK_LIBRARY = Object.freeze({
    schemaVersion: 1,
    packs: Object.freeze({}),
});
const EMPTY_EXTERNALIZED_ICON_SET_LIBRARY = Object.freeze({
    schemaVersion: 1,
    iconSets: Object.freeze({}),
});

function migrateSettingsBucket(container) {
    if (!container || typeof container !== 'object') return {};
    const current = container[MODULE_KEY];
    if (current && typeof current === 'object') return current;
    container[MODULE_KEY] = {};
    return container[MODULE_KEY];
}

function normalizeAutomationModeValue(value, fallback = 'manual') {
    return AUTOMATION_MODE_VALUES.includes(value) ? value : fallback;
}

function normalizeExperienceModeValue(value, fallback = 'basic') {
    return EXPERIENCE_MODE_VALUES.includes(value) ? value : fallback;
}

function normalizeLoreAutomationModeValue(value, fallback = 'off') {
    const normalized = String(value || '').trim().toLowerCase();
    return ['off', 'ar', 'armp', 'armpc'].includes(normalized) ? normalized : fallback;
}

function normalizeLoreAutomationStyleValue(value, fallback = 'balanced') {
    const normalized = String(value || '').trim().toLowerCase();
    return ['careful', 'balanced', 'aggressive'].includes(normalized) ? normalized : fallback;
}

function normalizeLoreAutomationProviderRoutingValue(value, fallback = 'auto') {
    const normalized = String(value || '').trim().toLowerCase();
    return ['auto', 'utility', 'reasoning', 'local'].includes(normalized) ? normalized : fallback;
}

function normalizeLoreAutomationPacingValue(value, fallback = 'normal') {
    const normalized = String(value || '').trim().toLowerCase();
    return ['responsive', 'normal', 'relaxed'].includes(normalized) ? normalized : fallback;
}

function hasStoredSagaSettings(stored = {}) {
    return !!(stored && typeof stored === 'object' && Object.keys(stored).length > 0);
}

function applyBasicExperienceProfile(settings) {
    Object.assign(settings, BASIC_EXPERIENCE_SETTINGS);
    settings.experienceMode = 'basic';
    settings.basicExperienceProfileVersion = BASIC_EXPERIENCE_PROFILE_VERSION;
    return settings;
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function compactExternalizedStorageSettings(settings = {}) {
    // Inline registries remain a recoverable supported input until migration
    // explicitly acknowledges all external files and stores a durable backup.
    settings.loredeckLibrary ??= cloneJson(EMPTY_EXTERNALIZED_LOREDECK_LIBRARY);
    settings.loredeckCreatorProjects ??= cloneJson(EMPTY_EXTERNALIZED_CREATOR_PROJECTS);
    settings.themePackLibrary ??= cloneJson(EMPTY_EXTERNALIZED_THEME_PACK_LIBRARY);
    settings.themeIconSetLibrary ??= cloneJson(EMPTY_EXTERNALIZED_ICON_SET_LIBRARY);
    return settings;
}

/**
 * Reads extensionSettings.saga, deep-merges defaults for any missing keys, and
 * returns the live settings object.
 * @returns {Object} SagaSettings
 */
export function getSettings() {
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.extensionSettings) {
        return { ...DEFAULT_SETTINGS };
    }
    const { extensionSettings } = ctx;
    const stored = migrateSettingsBucket(extensionSettings) || {};
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    if (!stored.sagaInlineRecovery && [
        ['loredeckLibrary', 'packs'], ['loredeckCreatorProjects', 'jobs'], ['themePackLibrary', 'packs'], ['themeIconSetLibrary', 'iconSets'],
    ].some(([key, collection]) => Object.keys(stored[key]?.[collection] || {}).length > 0)) {
        merged.sagaInlineRecovery = {
            schemaVersion: 1, status: 'pending',
            registries: cloneJson(Object.fromEntries(['loredeckLibrary', 'loredeckCreatorProjects', 'themePackLibrary', 'themeIconSetLibrary'].map(key => [key, stored[key] || {}]))),
        };
    }
    merged.collapsedSections = {
        ...(DEFAULT_SETTINGS.collapsedSections || {}),
        ...(stored.collapsedSections || {}),
    };
    merged.continuitySectionPrompts = {
        ...(DEFAULT_SETTINGS.continuitySectionPrompts || {}),
        ...(stored.continuitySectionPrompts || {}),
    };
    merged.sagaStorage = normalizeSagaStorageSettings(stored.sagaStorage || DEFAULT_SETTINGS.sagaStorage);
    merged.sagaStorageFallback = normalizeSagaStorageFallback(stored.sagaStorageFallback || DEFAULT_SETTINGS.sagaStorageFallback);
    merged.loredeckLibrary = normalizeLoredeckRegistry(
        stored.loredeckLibrary || EMPTY_EXTERNALIZED_LOREDECK_LIBRARY,
        EMPTY_EXTERNALIZED_LOREDECK_LIBRARY
    );
    merged.themePackLibrary = normalizeThemePackRegistry(
        stored.themePackLibrary || EMPTY_EXTERNALIZED_THEME_PACK_LIBRARY,
        EMPTY_EXTERNALIZED_THEME_PACK_LIBRARY
    );
    merged.themeIconSetLibrary = normalizeThemeIconSetRegistry(
        stored.themeIconSetLibrary || EMPTY_EXTERNALIZED_ICON_SET_LIBRARY,
        EMPTY_EXTERNALIZED_ICON_SET_LIBRARY
    );
    merged.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(
        stored.loredeckCreatorProjects || EMPTY_EXTERNALIZED_CREATOR_PROJECTS
    );

    const hasStoredSettings = hasStoredSagaSettings(stored);
    const legacyAutomationMode = normalizeAutomationModeValue(stored.workflowMode, '');
    merged.automationMode = normalizeAutomationModeValue(stored.automationMode, legacyAutomationMode || DEFAULT_SETTINGS.automationMode || 'manual');
    merged.workflowMode = merged.automationMode;
    merged.contextDetectionMode = normalizeAutomationModeValue(merged.contextDetectionMode, DEFAULT_SETTINGS.contextDetectionMode || 'manual');
    merged.contextDetectionAutoInterval = Math.max(1, Math.min(100, Number(merged.contextDetectionAutoInterval) || DEFAULT_SETTINGS.contextDetectionAutoInterval || 20));
    merged.contextDetectionAutoMinTurns = Math.max(1, Math.min(100, Number(merged.contextDetectionAutoMinTurns) || DEFAULT_SETTINGS.contextDetectionAutoMinTurns || 8));
    if (merged.contextDetectionAutoMinTurns > merged.contextDetectionAutoInterval) {
        merged.contextDetectionAutoMinTurns = merged.contextDetectionAutoInterval;
    }
    merged.contextDetectionAutoCharacterThreshold = Math.max(0, Math.min(50000, Number(merged.contextDetectionAutoCharacterThreshold) || DEFAULT_SETTINGS.contextDetectionAutoCharacterThreshold || 8000));
    merged.contextModelFallbackMinCharacters = Math.max(0, Math.min(20000, Number(merged.contextModelFallbackMinCharacters) || DEFAULT_SETTINGS.contextModelFallbackMinCharacters || 1200));
    merged.contextReasonerFallbackEnabled = merged.contextReasonerFallbackEnabled !== false;
    merged.contextLocalApplyMinConfidence = Math.max(0, Math.min(1, Number(merged.contextLocalApplyMinConfidence) || DEFAULT_SETTINGS.contextLocalApplyMinConfidence || 0.78));
    merged.contextReasonerProposalMinConfidence = Math.max(0, Math.min(1, Number(merged.contextReasonerProposalMinConfidence) || DEFAULT_SETTINGS.contextReasonerProposalMinConfidence || 0.55));
    if (stored.experienceMode === undefined && hasStoredSettings) {
        merged.experienceMode = 'advanced';
    } else {
        merged.experienceMode = normalizeExperienceModeValue(merged.experienceMode, DEFAULT_SETTINGS.experienceMode || 'basic');
    }
    if (merged.experienceMode === 'basic'
        && Number(stored.basicExperienceProfileVersion || 0) < BASIC_EXPERIENCE_PROFILE_VERSION) {
        applyBasicExperienceProfile(merged);
    }

    if (stored.contextAutomationDefaultsMigrated20260606 !== true) {
        if (stored.contextDetectionAutoInterval === undefined || Number(stored.contextDetectionAutoInterval) === 5) {
            merged.contextDetectionAutoInterval = 20;
        }
        if (stored.contextDetectionAutoMinTurns === undefined) {
            merged.contextDetectionAutoMinTurns = 8;
        }
        if (stored.contextDetectionAutoCharacterThreshold === undefined) {
            merged.contextDetectionAutoCharacterThreshold = 8000;
        }
        if (stored.contextReasonerFallbackEnabled === undefined) {
            merged.contextReasonerFallbackEnabled = true;
        }
        if (stored.contextLocalApplyMinConfidence === undefined) {
            merged.contextLocalApplyMinConfidence = 0.78;
        }
        if (stored.contextReasonerProposalMinConfidence === undefined) {
            merged.contextReasonerProposalMinConfidence = 0.55;
        }
        merged.contextAutomationDefaultsMigrated20260606 = true;
    }

    if (stored.canonLoreAutoProposeDefaultsMigrated20260608 !== true) {
        if (stored.canonLoreAutoPropose === undefined || stored.canonLoreAutoPropose === true) {
            merged.canonLoreAutoPropose = false;
        }
        merged.canonLoreAutoProposeDefaultsMigrated20260608 = true;
    }

    if (stored.loreBootstrapDefaultsMigrated20260531 !== true) {
        if (stored.loreSourceMessageCount === undefined || Number(stored.loreSourceMessageCount) === 10) {
            merged.loreSourceMessageCount = 40;
        }
        if (stored.loreMaxTokens === undefined || Number(stored.loreMaxTokens) === 2048) {
            merged.loreMaxTokens = 8192;
        }
        merged.loreBootstrapDefaultsMigrated20260531 = true;
    }

    if (stored.loreAutomationDefaultsMigrated20260602 !== true) {
        if (stored.loreGenerationAutoInterval === undefined || Number(stored.loreGenerationAutoInterval) === 10) {
            merged.loreGenerationAutoInterval = 50;
        }
        if (stored.loreGenerationAutoMinTurns === undefined) {
            merged.loreGenerationAutoMinTurns = 20;
        }
        if (stored.loreGenerationAutoWordThreshold === undefined) {
            merged.loreGenerationAutoWordThreshold = 2500;
        }
        if (stored.loreBulkFactsPerChunk === undefined || Number(stored.loreBulkFactsPerChunk) === 14) {
            merged.loreBulkFactsPerChunk = 8;
        }
        if (stored.loreIncrementalTargetEntries === undefined || Number(stored.loreIncrementalTargetEntries) === 8) {
            merged.loreIncrementalTargetEntries = 5;
        }
        if (stored.loreSimilarityRouting === undefined) {
            merged.loreSimilarityRouting = true;
        }
        if (stored.loreStrictQualityGate === undefined) {
            merged.loreStrictQualityGate = true;
        }
        merged.loreAutomationDefaultsMigrated20260602 = true;
    }

    if (stored.relevancePromptDepthDefaultsMigrated20260602 !== true) {
        const migrateDepth = (key, oldValue, newValue) => {
            if (stored[key] === undefined || Number(stored[key]) === oldValue) merged[key] = newValue;
        };
        migrateDepth('continuityInjectionDepth', 4, 3);
        migrateDepth('loreInjectionDepth', 4, 3);
        migrateDepth('loreHighInjectionDepth', 3, 2);
        migrateDepth('loreNormalInjectionDepth', 6, 5);
        migrateDepth('loreLowInjectionDepth', 10, 9);
        merged.relevancePromptDepthDefaultsMigrated20260602 = true;
    }

    if (merged.autoRelevanceMode === 'off') {
        merged.autoRelevanceEnabled = false;
        merged.autoRelevanceMode = 'apply_high_confidence';
    }

    if (stored.loreAutomationLevelsMigrated20260615 !== true) {
        if (stored.loreAutomationMode === undefined) {
            merged.loreAutomationMode = stored.autoRelevanceEnabled === true ? 'ar' : 'off';
        }
        if (stored.loreAutomationStyle === undefined) {
            merged.loreAutomationStyle = 'balanced';
        }
        if (stored.loreAutomationProviderRouting === undefined) {
            merged.loreAutomationProviderRouting = 'auto';
        }
        if (stored.loreAutomationCadenceMode === undefined) {
            merged.loreAutomationCadenceMode = 'manual';
        }
        if (stored.loreAutomationPacing === undefined) {
            merged.loreAutomationPacing = 'normal';
        }
        if (stored.loreAutomationRemapWordBudget === undefined) {
            merged.loreAutomationRemapWordBudget = Math.max(250, (Number(stored.loreAutomationRemapEveryTurns || stored.autoRelevanceEveryTurns) || 5) * 180);
        }
        if (stored.loreAutomationCurationWordBudget === undefined) {
            merged.loreAutomationCurationWordBudget = Math.max(500, (Number(stored.loreAutomationCurationEveryTurns || stored.autoRelevanceEveryTurns) || 10) * 180);
        }
        if (stored.loreAutomationRunJournalLimit === undefined) {
            merged.loreAutomationRunJournalLimit = 20;
        }
        merged.loreAutomationLevelsMigrated20260615 = true;
    }
    merged.loreAutomationMode = normalizeLoreAutomationModeValue(merged.loreAutomationMode, DEFAULT_SETTINGS.loreAutomationMode || 'off');
    merged.loreAutomationStyle = normalizeLoreAutomationStyleValue(merged.loreAutomationStyle, DEFAULT_SETTINGS.loreAutomationStyle || 'balanced');
    merged.loreAutomationProviderRouting = normalizeLoreAutomationProviderRoutingValue(merged.loreAutomationProviderRouting, DEFAULT_SETTINGS.loreAutomationProviderRouting || 'auto');
    merged.loreAutomationCadenceMode = ['manual', 'off'].includes(String(merged.loreAutomationCadenceMode || '').toLowerCase()) ? 'manual' : 'auto';
    if (merged.loreAutomationMode === 'off') merged.loreAutomationCadenceMode = 'manual';
    merged.loreAutomationPacing = normalizeLoreAutomationPacingValue(merged.loreAutomationPacing, DEFAULT_SETTINGS.loreAutomationPacing || 'normal');
    merged.loreAutomationPaused = false;
    merged.loreAutomationRemapWordBudget = Math.max(100, Math.min(20000, Number(merged.loreAutomationRemapWordBudget) || DEFAULT_SETTINGS.loreAutomationRemapWordBudget || 900));
    merged.loreAutomationCurationWordBudget = Math.max(200, Math.min(40000, Number(merged.loreAutomationCurationWordBudget) || DEFAULT_SETTINGS.loreAutomationCurationWordBudget || 1800));
    merged.loreAutomationRunJournalLimit = Math.max(1, Math.min(100, Number(merged.loreAutomationRunJournalLimit) || DEFAULT_SETTINGS.loreAutomationRunJournalLimit || 20));
    // Keep legacy AR switches readable while making Lore Automation the canonical visible mode.
    merged.autoRelevanceEnabled = merged.loreAutomationMode !== 'off';
    merged.autoRelevanceMode = 'apply_high_confidence';

    if (stored.compressionLevelDefaultsMigrated20260602 !== true) {
        const migrateLevel = (key, oldValues, newValue = 3) => {
            const current = stored[key];
            if (current === undefined || oldValues.includes(Number(current))) merged[key] = newValue;
        };
        migrateLevel('continuityCompressionLevel', [2]);
        migrateLevel('loreCompressionLevel', [2]);
        migrateLevel('loreHighCompressionLevel', [1]);
        migrateLevel('loreNormalCompressionLevel', [2]);
        migrateLevel('loreLowCompressionLevel', [4]);
        merged.compressionLevelDefaultsMigrated20260602 = true;
    }

    if (stored.providerParameterDefaultsMigrated20260602 !== true) {
        if (stored.continuityTemperature === undefined) merged.continuityTemperature = 0.7;
        if (stored.continuityTopP === undefined) merged.continuityTopP = 0.98;
        if (stored.continuityMaxTokens === undefined || Number(stored.continuityMaxTokens) === 4096) {
            merged.continuityMaxTokens = 8192;
        }
        if (stored.loreTemperature === undefined) merged.loreTemperature = 0.7;
        if (stored.loreTopP === undefined) merged.loreTopP = 0.98;
        if (stored.loreMaxTokens === undefined || Number(stored.loreMaxTokens) === 2048) {
            merged.loreMaxTokens = 8192;
        }
        merged.continuityOpenAIUseJsonMode = false;
        merged.continuityOpenAIUseSTProxy = false;
        merged.loreOpenAIUseJsonMode = false;
        merged.loreOpenAIUseSTProxy = false;
        merged.providerParameterDefaultsMigrated20260602 = true;
    }

    if (stored.continuityPerformanceDefaultsMigrated20260603 !== true) {
        if (stored.continuityAutoInterval === undefined || Number(stored.continuityAutoInterval) === 5) {
            merged.continuityAutoInterval = 10;
        }
        if (stored.continuityScanFastThreshold === undefined || Number(stored.continuityScanFastThreshold) === 20) {
            merged.continuityScanFastThreshold = 4;
        }
        merged.continuityPerformanceDefaultsMigrated20260603 = true;
    }

    // This fork owns canon; interface mode changes must not start competing story writers.
    Object.assign(merged, { automationMode: 'manual', workflowMode: 'manual', continuityTrackingMode: 'manual',
        loreGenerationMode: 'manual', contextDetectionMode: 'manual', autoExtract: false, autoApplyDelta: false, autoGenerateLore: false,
        injectContinuity: false, injectionTransport: 'extension_prompt', autoRelevanceEnabled: false, loreAutomationMode: 'off' });
    extensionSettings[MODULE_KEY] = compactExternalizedStorageSettings(cloneJson(merged));
    return merged;
}

/**
 * Writes settings to extensionSettings.saga and persists through
 * saveSettingsDebounced().
 * @param {Object} settings - SagaSettings to save
 */
export function saveSettings(settings) {
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.extensionSettings) return;
    const { extensionSettings, saveSettingsDebounced } = ctx;
    if (settings && typeof settings === 'object') {
        settings.sagaStorage = normalizeSagaStorageSettings(settings.sagaStorage || DEFAULT_SETTINGS.sagaStorage);
        settings.sagaStorageFallback = normalizeSagaStorageFallback(settings.sagaStorageFallback || DEFAULT_SETTINGS.sagaStorageFallback);
        compactExternalizedStorageSettings(settings);
    }
    const previous = extensionSettings[MODULE_KEY];
    extensionSettings[MODULE_KEY] = settings;
    const restore = error => {
        if (extensionSettings[MODULE_KEY] === settings) extensionSettings[MODULE_KEY] = previous;
        throw error;
    };
    if (typeof saveSettingsDebounced === 'function') {
        try {
            const result = saveSettingsDebounced();
            queuePromptInjectionSync();
            if (result && typeof result.then === 'function') return Promise.resolve(result).then(assertSagaStorageWriteAcknowledged).catch(restore);
            return assertSagaStorageWriteAcknowledged(result);
        } catch (error) { return restore(error); }
    }
    queuePromptInjectionSync();
}
