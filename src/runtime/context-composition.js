import { configureContextPanel } from '../context/context-panel.js';
import { configureContextWorkbenchPanel } from '../context/context-workbench-panel.js';

export function configureContextComposition(deps = {}) {
    configureContextPanel({
        getContextWorkbenchStack: deps.getContextWorkbenchStack,
        getLoredeckContext: deps.getLoredeckContext,
        getLoredeckDisplayName: deps.getLoredeckDisplayName,
        getContextTypeLabel: deps.getContextTypeLabel,
        formatContextSource: deps.formatContextSource,
        formatContextSummary: deps.formatContextSummary,
        hasSelectedLoredeckContext: deps.hasSelectedLoredeckContext,
        getContextAutomationModeLabel: deps.getContextAutomationModeLabel,
        getContextBriefStatusLabel: deps.getContextBriefStatusLabel,
        getContextBriefStatusTone: deps.getContextBriefStatusTone,
        getContextResolutionProposals: deps.getContextResolutionProposals,
        openContextWorkbenchForPack: deps.openContextWorkbenchForPack,
        toggleLoredeckContextManualLock: deps.toggleLoredeckContextManualLock,
        seedLoredeckContextFromRuntimeContext: deps.seedLoredeckContextFromRuntimeContext,
        applyContextResolutionProposalSet: deps.applyContextResolutionProposalSet,
        dismissContextResolutionProposalSet: deps.dismissContextResolutionProposalSet,
        markTourTarget: deps.markTourTarget,
        handleDetectStoryContext: deps.handleDetectStoryContext,
        handleResolveContextsFromContext: deps.handleResolveContextsFromContext,
        handleModelResolveContexts: deps.handleModelResolveContexts,
        appendContextGenerationStatus: (card, state) => deps.appendGenerationStatus?.(card, state, 'context'),
        createContextBriefStatusCard: deps.createContextBriefStatusCard,
        createCollapsibleSection: deps.createCollapsibleSection,
        createContextEditorCard: deps.createContextEditorCard,
        getState: deps.getState,
        getSettings: deps.getSettings,
        saveSettings: deps.saveSettings,
        refreshContextPanelBody: () => deps.refreshPanelBody?.({ preserveScroll: true }),
        resetContextDetectionSettings: () => deps.resetSettingKeysToDefaults?.(deps.contextDetectionSettingKeys, 'Context detection settings'),
        shouldShowContextAutomationPanel: () => !deps.isBasicExperience?.(deps.getSettings?.()),
        isBasicExperience: () => deps.isBasicExperience?.(deps.getSettings?.()),
        resetLoredeckContextFromPanel: async packId => {
            const ok = await deps.confirmAction?.('Reset Context', `Clear Context for ${deps.getLoredeckDisplayName?.(packId)}?`);
            if (!ok) return;
            deps.resetLoredeckContext?.(packId);
            deps.refreshPanelBody?.({ preserveScroll: true, preserveWindowScroll: true });
            deps.refreshHeader?.();
            deps.toast?.('Context reset.', 'info');
        },
    });

    configureContextWorkbenchPanel({
        getContextWorkbenchTab: deps.getContextWorkbenchTab,
        markTourTarget: deps.markTourTarget,
        setContextWorkbenchTab: deps.setContextWorkbenchTab,
        getContextWorkbenchPackId: deps.getContextWorkbenchPackId,
        setContextWorkbenchPackId: deps.setContextWorkbenchPackId,
        clearContextWorkbenchSelectedKey: deps.clearContextWorkbenchSelectedKey,
        setContextWorkbenchSelectedKey: deps.setContextWorkbenchSelectedKey,
        renderContextWorkbench: deps.renderContextWorkbench,
        closeContextWorkbench: deps.closeContextWorkbench,
        refreshContextHeader: deps.refreshHeader,
        clearContextIndexCache: deps.clearContextIndexCache,
        loadContextIndex: deps.loadContextIndex,
        getRuntimeState: deps.getState,
        getContextWorkbenchStack: deps.getContextWorkbenchStack,
        getContextWorkbenchPack: deps.getContextWorkbenchPack,
        getContextWorkbenchTimelineItems: deps.getContextWorkbenchTimelineItems,
        filterContextWorkbenchTimelineItems: deps.filterContextWorkbenchTimelineItems,
        getContextTimelineItemKey: deps.getContextTimelineItemKey,
        getContextTimelineItemContextText: deps.getContextTimelineItemContextText,
        getContextTimelineItemCoordinateText: deps.getContextTimelineItemCoordinateText,
        getLoredeckContext: deps.getLoredeckContext,
        getLoredeckDisplayName: deps.getLoredeckDisplayName,
        getContextTypeLabel: deps.getContextTypeLabel,
        formatContextSummary: deps.formatContextSummary,
        formatContextSource: deps.formatContextSource,
        getContextWorkbenchQuery: deps.getContextWorkbenchQuery,
        setContextWorkbenchQuery: deps.setContextWorkbenchQuery,
        getContextWorkbenchSelectedKey: deps.getContextWorkbenchSelectedKey,
        getContextWorkbenchStoryPositionQuery: deps.getContextWorkbenchStoryPositionQuery,
        setContextWorkbenchStoryPositionQuery: deps.setContextWorkbenchStoryPositionQuery,
        getContextWorkbenchTypeFilter: deps.getContextWorkbenchTypeFilter,
        setContextWorkbenchTypeFilter: deps.setContextWorkbenchTypeFilter,
        getContextWorkbenchStoryPositionFilter: deps.getContextWorkbenchStoryPositionFilter,
        setContextWorkbenchStoryPositionFilter: deps.setContextWorkbenchStoryPositionFilter,
        getContextWorkbenchResolverQuery: deps.getContextWorkbenchResolverQuery,
        setContextWorkbenchResolverQuery: deps.setContextWorkbenchResolverQuery,
        resolveContextsFromContext: deps.handleResolveContextsFromContext,
        modelResolveContexts: deps.handleModelResolveContexts,
        setLoredeckContextManualLock: (packId, manualLock) => {
            deps.commitLoredeckContextPatch?.(packId, { manualLock: manualLock === true }, { manual: false });
        },
        resetLoredeckContextFromWorkbench: async packId => {
            const ok = await deps.confirmAction?.('Reset Context', `Clear Context for ${deps.getLoredeckDisplayName?.(packId)}?`);
            if (!ok) return;
            deps.resetLoredeckContext?.(packId);
            deps.refreshLoredeckSurfaces?.();
            deps.toast?.('Context reset.', 'info');
        },
        seedLoredeckContextFromRuntimeContext: deps.seedLoredeckContextFromRuntimeContext,
        appendContextManualFields: deps.appendContextManualFields,
        normalizeLoredeckTimelineId: deps.normalizeLoredeckTimelineId,
        normalizeLoredeckTimelineNumber: deps.normalizeLoredeckTimelineNumber,
        applyContextTimelineItem: deps.applyContextTimelineItem,
        applyContextAnchor: deps.applyContextAnchor,
        applyContextEntryCandidate: deps.applyContextEntryCandidate,
        applyContextAnchorBoundary: deps.applyContextAnchorBoundary,
        commitLoredeckContextPatch: deps.commitLoredeckContextPatch,
        validateLoredeckForEditor: deps.validateLoredeckForEditor,
        loadLoredeckEntriesForEditor: deps.loadLoredeckEntriesForEditor,
        canValidateLoredeckInEditor: deps.canValidateLoredeckInEditor,
        getLoredeckEntryPreview: deps.getLoredeckEntryPreview,
        getContextWorkbenchEntryRows: deps.getContextWorkbenchEntryRows,
        buildContextEntryDerivedAnchor: deps.buildContextEntryDerivedAnchor,
        getContextResolverMissReasons: deps.getContextResolverMissReasons,
        getContextEntryResolverMatches: deps.getContextEntryResolverMatches,
        queueContextEntryCandidateTimelineAnchor: deps.queueContextEntryCandidateTimelineAnchor,
        openDuplicateLoredeckDialog: deps.openDuplicateLoredeckDialog,
        openLoredeckTimelineAnchorDialog: deps.openLoredeckTimelineAnchorDialog,
        openLoredeckTimelineWindowDialog: deps.openLoredeckTimelineWindowDialog,
        setLoredeckTimelineItemDisabled: deps.setLoredeckTimelineItemDisabled,
        removeLoredeckTimelineDefinition: deps.removeLoredeckTimelineDefinition,
        openLoredeckEditorForQuery: deps.openLoredeckEditorForQuery,
        exportContextWorkbenchTimelineRegistry: deps.exportContextWorkbenchTimelineRegistry,
    });
}
