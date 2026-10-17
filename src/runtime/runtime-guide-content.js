function guideStep(id, title, body, tab, target, options = {}) {
    const section = options.section || tab || 'session';
    return Object.freeze({
        id,
        title,
        body,
        tab,
        target,
        section,
        actionLabel: 'Show',
        ...options,
    });
}

function freezeGuideSteps(steps) {
    return Object.freeze(steps.map(step => Object.freeze(step)));
}

function freezeGuideSections(sections) {
    return Object.freeze(sections.map(section => Object.freeze(section)));
}

function normalizeGuideMode(mode) {
    return String(mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
}

export function formatGuideStartLabel(mode = 'basic', index = 0) {
    const prefix = normalizeGuideMode(mode) === 'advanced' ? 'A' : 'B';
    const number = Math.max(1, Number(index) + 1);
    return `${prefix}${String(number).padStart(2, '0')}`;
}

function getGuideSectionId(step) {
    return String(step?.section || step?.tab || 'session').trim() || 'session';
}

const ADVANCED_GUIDE_SECTION_BY_PREFIX = Object.freeze({
    'advanced-loredecks-': 'libraryMastery',
    'advanced-library-': 'libraryMastery',
    'advanced-session-': 'sessionControl',
    'advanced-context-': 'contextResolution',
    'advanced-lore-': 'loreReview',
    'advanced-injection-': 'injectionDiagnostics',
    'advanced-continuity-': 'continuityTracking',
    'advanced-creator-': 'creatorAuthoring',
    'advanced-health-': 'packHealth',
    'advanced-package-': 'packHealth',
    'advanced-generated-': 'packHealth',
    'advanced-settings-': 'settingsDiagnostics',
    'advanced-troubleshoot-': 'troubleshooting',
});

const ADVANCED_GUIDE_DEFAULTS = Object.freeze({
    libraryMastery: Object.freeze({
        expected: 'You can manage Library records, package sources, and active-stack eligibility deliberately.',
        when: 'Use this when source packs, stack order, imports, exports, or Library details need inspection.',
    }),
    sessionControl: Object.freeze({
        expected: 'You can control runtime mode, activation, automation, Story Maker, and session-level diagnostics.',
        when: 'Use this before deeper diagnostics, when changing how Saga behaves during play, or when drafting a scene opener.',
    }),
    contextResolution: Object.freeze({
        expected: 'You can explain and correct the Context that gates canon, retrieval, and Lorecard eligibility.',
        when: 'Use this whenever suggestions, retrieval, or injection appear tied to the wrong story position.',
    }),
    loreReview: Object.freeze({
        expected: 'You can generate, review, accept, edit, and audit Lorecards without bypassing review.',
        when: 'Use this after Context is current and the story has durable facts or canon constraints to capture.',
    }),
    injectionDiagnostics: Object.freeze({
        expected: 'You can inspect the exact continuity and lore material Saga plans to send to the model.',
        when: 'Use this when the model ignores lore, sees stale state, or receives too much prompt context.',
    }),
    continuityTracking: Object.freeze({
            expected: 'You can maintain live scene state separately from durable Accepted Lorecards.',
        when: 'Use this for current-scene date, cast, items, emotion, and short-term objectives.',
    }),
    creatorAuthoring: Object.freeze({
        expected: 'You can move a Generated Lorepack project through staged authoring and review gates.',
        when: 'Use this when creating or resuming a generated source pack.',
    }),
    packHealth: Object.freeze({
        expected: 'You can diagnose package readiness, run Attempt Fixing, and export or finalize Lorepacks deliberately.',
        when: 'Use this before sharing, updating, finalizing, or trusting a pack with warnings.',
    }),
    settingsDiagnostics: Object.freeze({
        expected: 'You can configure providers, presets, generation parameters, themes, and diagnostic routes.',
        when: 'Use this when model-backed features, profile routing, or visual/runtime configuration needs tuning.',
    }),
    troubleshooting: Object.freeze({
        expected: 'You can route common failure symptoms to the right Advanced workflow instead of guessing.',
        when: 'Use this when something feels wrong and you need the shortest diagnostic path.',
    }),
});

function getAdvancedGuideSectionId(stepId = '') {
    const id = String(stepId || '').trim();
    for (const [prefix, section] of Object.entries(ADVANCED_GUIDE_SECTION_BY_PREFIX)) {
        if (id.startsWith(prefix)) return section;
    }
    return 'sessionControl';
}

function advancedStep(id, title, body, tab, target, options = {}) {
    const { expected, when, section, ...rest } = options || {};
    const sectionId = section || getAdvancedGuideSectionId(id);
    const defaults = ADVANCED_GUIDE_DEFAULTS[sectionId] || ADVANCED_GUIDE_DEFAULTS.sessionControl;
    return guideStep(id, title, body, tab, target, {
        section: sectionId,
        expected: expected || defaults.expected,
        when: when || defaults.when,
        ...rest,
    });
}

function buildAdvancedGuideSteps() {
    return [
        advancedStep('advanced-loredecks-overview', 'Library Overview', 'Read Library size, active stack count, active Lorecard count, and Pack Health summary.', 'loredecks', 'loredecks.library.launch', { expandSections: Object.freeze(['loredecks.libraryLaunch']) }),
        advancedStep('advanced-loredecks-open-library', 'Open Loredeck Library', 'Open the Library where stack, folders, package management, and details live. Desktop opens a fullscreen workbench.', 'loredecks', 'loredecks.library.open', { fallbackTarget: 'loredecks.library.launch', expandSections: Object.freeze(['loredecks.libraryLaunch']) }),
        advancedStep('advanced-library-empty-selection', 'Empty Selection State', 'The Library intentionally starts with no selected deck so details only appear after an explicit choice.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-special-views', 'Special Views', 'Use All, Bundled, Custom, active, and Unfiled views to inspect Library records without reorganizing folders.', 'loredecks', 'loredecks.library.filters', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-folder-tree', 'Folder Tree', 'Navigate folders and nested folder groups to understand curated pack organization.', 'loredecks', 'loredecks.library.list', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-search-sort', 'Search and Sort', 'Search by title, tag, fandom, source, or manifest data and sort the visible Library list.', 'loredecks', 'loredecks.library.filters', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-pack-select', 'Select a Lorepack', 'Select a Lorepack and inspect its overview details before changing the stack.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-pack-source', 'Pack Source State', 'Identify Bundled Lorepack, Generated Lorepack, Custom Lorepack, imported, duplicated, and finalized source states.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-cover-metadata', 'Cover and Metadata', 'Inspect or update cover and metadata surfaces where the selected pack is editable.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-health-summary', 'Pack Health Summary', 'Read status, issue counts, and last validation time from the selected pack details.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-manifest-preview', 'Manifest Preview', 'Load manifest preview and embedded Lorecard counts before export, repair, or deeper edits.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-entry-overrides', 'Entry Overrides', 'Open per-entry override or editor surfaces for Custom or Generated packs when available.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-stack-pane', 'Active Stack Pane', 'Use the active stack pane as the source of runtime source eligibility.', 'loredecks', 'loredecks.library.stack', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-add-deck-stack', 'Add Deck to Stack', 'Add a selected deck to the active stack so it participates in Context, retrieval, and canon suggestions.', 'loredecks', 'loredecks.library.transfer', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-add-folder-stack', 'Add Folder to Stack', 'Add a folder group when a curated folder represents the intended source set.', 'loredecks', 'loredecks.library.transfer', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-reorder-stack', 'Reorder Stack', 'Reorder stack items so priority and duplicate suppression follow the intended source hierarchy.', 'loredecks', 'loredecks.library.stack', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-enable-stack', 'Enable and Disable Stack Items', 'Enable, disable, collapse, or remove stack items without deleting Library records.', 'loredecks', 'loredecks.library.stack', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-bulk-select', 'Bulk Select', 'Select multiple packs for batch export, duplicate, delete, stack, or folder operations.', 'loredecks', 'loredecks.library.list', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-export-selected', 'Export Selected', 'Export selected packs as one .saga-loredeck.zip package.', 'loredecks', 'loredecks.library.export', { fallbackTarget: 'loredecks.library.header', prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-import-package', 'Import Package', 'Import a .saga-loredeck.zip package into the Library.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-import-preview', 'Import Preview', 'Review package preview, source type, embedded counts, and install choices before accepting an import.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-duplicate-warnings', 'Duplicate Warnings', 'Understand same-hash and possible-duplicate warnings before installing or updating a package.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-duplicate-custom', 'Duplicate as Custom', 'Duplicate an existing Lorepack as a Custom Lorepack before making user-owned edits.', 'loredecks', 'loredecks.library.transfer', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-library-folder-actions', 'Folder Actions', 'Create, rename, move, and remove Library folders without changing pack contents accidentally.', 'loredecks', 'loredecks.library.folderActions', { fallbackTarget: 'loredecks.library.filters', prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-library-open-workbench', 'Open Workbench Routes', 'Launch deeper Loredeck workbench or editor routes from selected Library records.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-session-experience-mode', 'Experience Mode', 'Switch Basic and Advanced while keeping saved story state and understanding which controls are hidden.', 'settings', 'settings.experienceMode'),
        advancedStep('advanced-session-saga-active', 'Saga Active', 'Toggle Saga Active without deleting data or changing saved Lorecards.', 'session', 'session.active'),
        advancedStep('advanced-session-automation-mode', 'Automation Mode', 'Compare Manual, Assisted, and Automatic automation modes before enabling background behavior.', 'session', 'session.automation'),
        advancedStep('advanced-session-runtime-metrics', 'Runtime Metrics', 'Read pending, accepted, selected, continuity, and prompt-size metrics.', 'session', 'session.metrics'),
        advancedStep('advanced-session-guide-modules', 'Guide Modules', 'Use the guide card as a module launcher instead of treating Advanced as one long checklist.', 'session', 'session.instructions.advanced'),
        advancedStep('advanced-session-active-chat', 'Active Chat Target', 'Confirm which chat state Saga is currently reading and updating.', 'session', 'session.metrics'),
        advancedStep('advanced-session-story-maker', 'Story Maker', 'Open Story Maker from Session to create, revise, and copy a lore-aware opener from the active Loredecks, Context, and Accepted Lorecards.', 'session', 'session.storyOpener', { expandSections: Object.freeze(['session.storyMaker']) }),
        advancedStep('advanced-session-story-maker-inputs', 'Story Maker Inputs', 'Fill Context, Prose Style, User Prompt, Character Focus, Opening Shape, PoV, Tense, target length, and Variant Count before generating.', 'session', 'session.storyOpener', { expandSections: Object.freeze(['session.storyMaker']) }),
        advancedStep('advanced-session-story-maker-pipeline', 'Story Maker Pipeline', 'Build the Context Packet, Opener Brief, Draft Variants, and Review & Copy stages instead of treating the opener as a one-shot prompt.', 'session', 'session.storyOpener', { expandSections: Object.freeze(['session.storyMaker']) }),
        advancedStep('advanced-session-story-maker-copy', 'Copy or Revise Opener', 'Select a draft variant, write a revision prompt if needed, then copy Markdown or rich text when the selected opener is ready for the chat.', 'session', 'session.storyOpener', { expandSections: Object.freeze(['session.storyMaker']) }),
        advancedStep('advanced-settings-danger-zone', 'Cleanup Actions', 'Find Active Chat and Global cleanup actions in Settings and understand their risk before using them.', 'settings', 'settings.dangerZone'),
        advancedStep('advanced-session-mode-recovery', 'Mode Recovery', 'Recover when switching modes hides the previously active tab or control.', 'settings', 'settings.experienceMode'),
        advancedStep('advanced-context-command-center', 'Context Command Center', 'Use Runtime Context as the status and action hub for story position.', 'context', 'context.commandCenter', { expandSections: Object.freeze(['context.commandCenter']) }),
        advancedStep('advanced-context-loaded-rows', 'Loaded Context Rows', 'Inspect per-Loredeck Context rows, source, lock state, and update state.', 'context', 'context.loadedLoredecks', { fallbackTarget: 'context.commandCenter', expandSections: Object.freeze(['context.loadedLoredecks']) }),
        advancedStep('advanced-context-browser-open', 'Open Context Workbench', 'Open the Context Workbench for manual timeline, story-position, alias, resolver, and validation workflows.', 'context', 'context.browser', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-workbench-layout', 'Workbench Layout', 'Read the Workbench as one selected loaded Lorepack, one current Context editor, one story-position picker, Phrase Resolver, and full timeline inspection.', 'context', 'context.workbench.shell', { prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-workbench-pack', 'Selected Loaded Lorepack', 'Use the loaded-Lorepack rows or selector to choose which pack receives the next Context change.', 'context', 'context.workbench.loadedLoredeck', { fallbackTarget: 'context.workbench.packSelector', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-anchors-windows', 'Anchors Versus Windows', 'Anchors are exact timeline points. Windows are bounded ranges. Choose Story Position shows both so Context eligibility can match a point or a range.', 'context', 'context.workbench.storyPosition', { fallbackTarget: 'context.workbench.editor', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-start-here', 'Start Here', 'Start Here applies one story position as the exact current starting Anchor and clears the need for a range.', 'context', 'context.workbench.startHere', { fallbackTarget: 'context.workbench.storyPosition', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-use-window', 'Use Window', 'Use Window applies a first-class Window from the Lorepack timeline when the registry already has the correct lower and upper bounds.', 'context', 'context.workbench.useWindow', { fallbackTarget: 'context.workbench.storyPosition', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-use-anchor', 'Use Anchor', 'Use Anchor applies the selected Timeline anchor as the exact current Context. Start Here is the story-position browser shortcut for the same precise-point choice.', 'context', 'context.workbench.useAnchor', { fallbackTarget: 'context.workbench.startHere', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-after-before', 'After and Before Bounds', 'After sets the lower bound and Before sets the upper bound for a custom Window when no existing Window is precise enough.', 'context', 'context.workbench.after', { fallbackTarget: 'context.workbench.windowBuilder', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-timeline-action', 'Timeline Action', 'Timeline opens the selected story position in the Timeline tab so you can inspect IDs, coordinates, aliases, attached Lorecards, and registry state.', 'context', 'context.workbench.timelineAction', { fallbackTarget: 'context.workbench.tab.timeline', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-manual-select', 'Manual Context Select', 'Manually select exact or ranged Context for loaded Lorepacks when detection is not authoritative.', 'context', 'context.workbench.editor', { fallbackTarget: 'context.workbench.storyPosition', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-phrase-resolver', 'Phrase Resolver', 'Phrase Resolver tests casual story phrasing against local Anchor labels, IDs, aliases, dates, arcs, tags, coordinates, and optional Lorecard-derived candidates.', 'context', 'context.workbench.phraseResolverInput', { fallbackTarget: 'context.workbench.phraseResolver', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-phrase-debug', 'Resolver Diagnostics', 'Review cleaned terms, ignored direction words, match reasons, weak matches, missing terms, and use Load Lorecards before applying a phrase result.', 'context', 'context.workbench.resolverLoadLorecards', { fallbackTarget: 'context.workbench.phraseResolver', prepare: 'openContextBrowser' }),
        advancedStep('advanced-context-locks', 'Context Locks', 'Lock or unlock Context rows deliberately so detection does not overwrite trusted manual choices.', 'context', 'context.loadedLoredeck.lock', { fallbackTarget: 'context.loadedLoredecks', expandSections: Object.freeze(['context.loadedLoredecks']) }),
        advancedStep('advanced-context-detect', 'Detect Context', 'Run local detection against recent source messages.', 'context', 'context.detect', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-source-window', 'Source Message Window', 'Tune the number of recent messages used by Context detection and Reasoner fallback.', 'context', 'context.sourceMessages', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-local-resolver', 'Local Resolver', 'Use Resolve Local and understand confidence thresholds before escalating to the Reasoning provider.', 'context', 'context.resolve.local', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-reasoner', 'Reasoner Proposals', 'Ask the Reasoning provider for proposal-based Context resolution when local anchors are ambiguous.', 'context', 'context.resolve.reasoner', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-proposal-review', 'Proposal Review', 'Apply or dismiss Context proposals before relying on them.', 'context', 'context.proposals.review', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-audit', 'Context Audit', 'Read resolver and automation audit summaries to understand why Context changed.', 'context', 'context.briefStatus', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-advanced-brief', 'Advanced Context Brief', 'Inspect or edit the Advanced Context Brief for branch-specific story detail.', 'context', 'context.fields', { expandSections: Object.freeze(['context.advancedBrief']) }),
        advancedStep('advanced-context-seed-from-brief', 'Seed From Brief', 'Seed loaded Loredeck rows from the brief when that is the fastest accurate starting point.', 'context', 'context.loadedLoredeck.seedFromBrief', { fallbackTarget: 'context.fields', expandSections: Object.freeze(['context.loadedLoredecks', 'context.advancedBrief']) }),
        advancedStep('advanced-context-reset', 'Reset Stale Context', 'Reset stale Context safely when the story position is wrong or no longer applicable.', 'context', 'context.loadedLoredeck.reset', { fallbackTarget: 'context.loadedLoredecks', expandSections: Object.freeze(['context.loadedLoredecks']) }),
        advancedStep('advanced-context-index-summary', 'Context Index Summary', 'Use Context index summaries to understand which anchors and windows are available.', 'context', 'context.editor', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-workbench-routes', 'Context Workbench Routes', 'Route to timeline, story-position, alias, and validation workbenches for deeper source maintenance.', 'context', 'context.editor', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-context-eligibility-debug', 'Eligibility Debugging', 'Explain why Context allows or blocks a Lorecard.', 'context', 'context.loadedLoredecks', { fallbackTarget: 'context.commandCenter' }),
        advancedStep('advanced-lore-generation-overview', 'Generate Overview', 'Understand canon preview, story scan, manual note, Draft Review, Pending Review, and Accepted Lorecards.', 'lore', 'lore.generation', { expandSections: Object.freeze(['lore.generation']) }),
        advancedStep('advanced-lore-canon-preview', 'Preview Canon Packs', 'Preview local Context-aware suggestions from active Lorepacks.', 'lore', 'lore.canon.preview', { expandSections: Object.freeze(['lore.generation']) }),
        advancedStep('advanced-lore-canon-selection', 'Canon Selection', 'Select useful canon suggestions for Pending Review rather than accepting them automatically.', 'lore', 'lore.canon.addPending', { fallbackTarget: 'lore.canon.preview' }),
        advancedStep('advanced-lore-story-scan', 'Scan Story Lore', 'Run model-backed story-lore scan for durable chat facts.', 'lore', 'lore.story.scan', { expandSections: Object.freeze(['lore.generation']) }),
        advancedStep('advanced-lore-scan-scope', 'Story Scan Scope', 'Tune scan source scope where recent, range, and entire-chat controls are available.', 'lore', 'lore.story.scope', { expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.scanScope']) }),
        advancedStep('advanced-lore-manual-add', 'Manual Lore Note', 'Draft a known important fact manually and route it through Pending Review.', 'lore', 'lore.manual.add', { fallbackTarget: 'lore.generation' }),
        advancedStep('advanced-lore-assistant-drafts', 'Assistant Drafts', 'Review assistant or Deck Maker draft batches before they reach Pending Review.', 'lore', 'lore.pending', { prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-pending-review', 'Pending Review', 'Inspect Pending Review as the gate before proposals affect prompts.', 'lore', 'lore.pending', { prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-pending-edit', 'Edit Pending Entry', 'Edit Pending Review entries before acceptance so Accepted Lorecards stay precise.', 'lore', 'lore.pending.entry', { fallbackTarget: 'lore.pending', prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-pending-accept-reject', 'Accept or Reject Pending', 'Accept or reject entries based on future usefulness.', 'lore', 'lore.pending.actions', { fallbackTarget: 'lore.pending', prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-pending-bulk', 'Bulk Pending Review', 'Use bulk review controls deliberately when many Pending Review entries share the same decision.', 'lore', 'lore.pending.bulk', { fallbackTarget: 'lore.pending', prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-accepted-list', 'Accepted Lorecards', 'Inspect Accepted Lorecards before they guide prompts.', 'lore', 'lore.accepted', { prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-accepted-search-filter', 'Accepted Lorecards Filters', 'Search and filter Accepted Lorecards by text, status, category, relevance, or suppression state.', 'lore', 'lore.accepted.filters', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-accepted-open-edit', 'Open Accepted Lorecard', 'Open and edit an Accepted Lorecard when stored memory needs correction.', 'lore', 'lore.accepted.entry', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-pin-mute', 'Elevate and Mute', 'Elevate or mute Accepted Lorecards to control protected prominence and suppression without deleting them.', 'lore', 'lore.accepted.pinMuteHelp', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-relevance-tier', 'Relevance Tier', 'Set relevance tier and understand prompt eligibility for High, Normal, and Low lore.', 'lore', 'lore.accepted.entry', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-tags-context', 'Tags and Context Metadata', 'Inspect tags, Context metadata, source metadata, and routing hints on Accepted Lorecards.', 'lore', 'lore.accepted.entry', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-similarity-duplicates', 'Similarity and Duplicates', 'Understand duplicate and similarity guards before accepting overlapping lore.', 'lore', 'lore.pending', { prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-lore-auto-relevance', 'Lore Automation', 'Choose Off, AR, ARMP, or ARMPC and inspect the run activity for large Accepted Lorecards collections.', 'lore', 'lore.autoRelevance', { expandSections: Object.freeze(['lore.autoRelevance']) }),
        advancedStep('advanced-lore-timeline-audit', 'Lore Timeline Audit', 'Use timeline and audit recovery for deleted, restored, Elevated, muted, or changed lore.', 'lore', 'lore.timeline.open', { fallbackTarget: 'lore.workspace' }),
        advancedStep('advanced-lore-workbench', 'Lore Workbench', 'Open deeper Lorecard workbenches for large-list management and detailed editing.', 'lore', 'lore.accepted.entry', { fallbackTarget: 'lore.accepted', prepare: 'openAcceptedLoreDetails' }),
        advancedStep('advanced-lore-review-first-policy', 'Review-First Policy', 'Model-produced proposals must be reviewed before they can affect future responses.', 'lore', 'lore.pending', { prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-injection-overview', 'Injection Overview', 'Injection is the exact prompt and debugging surface for what Saga sends.', 'injection', 'injection.toggles', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-continuity-toggle', 'Continuity Toggle', 'Toggle Continuity injection independently from Lore injection.', 'injection', 'injection.toggles', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-lore-toggle', 'Lore Toggle', 'Toggle Lore injection independently from Continuity injection.', 'injection', 'injection.toggles', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-high-tier', 'High Relevance Tier', 'Inspect High relevance behavior for immediate scene-critical facts.', 'injection', 'injection.preview.high', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-normal-tier', 'Normal Relevance Tier', 'Inspect Normal relevance behavior for broader but still useful facts.', 'injection', 'injection.preview.normal', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-low-tier', 'Low Relevance Tier', 'Inspect Low relevance behavior for distant or optional background facts.', 'injection', 'injection.preview.low', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-direct-compressed', 'Direct Versus Compressed', 'Tune direct versus compressed handling for continuity and lore tiers.', 'injection', 'injection.compression', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-placement', 'Prompt Placement', 'Tune role, position, depth, and placement for injected prompt groups.', 'injection', 'injection.promptPlacement', { prepare: 'openInjectionPreview', expandSections: Object.freeze(['injection.promptPlacement']) }),
        advancedStep('advanced-injection-compression-prompts', 'Compression Prompts', 'Inspect or edit compression prompts used for model-compressed blocks.', 'injection', 'injection.compression', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-preview-lore', 'Lore Injection Preview', 'Preview selected Lorecards by relevance tier before the next prompt.', 'injection', 'injection.preview.high', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-preview-continuity', 'Continuity Injection Preview', 'Preview selected continuity state before the next prompt.', 'injection', 'injection.preview.continuity', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-combined-preview', 'Combined Prompt Block', 'Inspect the combined prompt block by reading the active continuity and lore previews together.', 'injection', 'injection.preview.normal', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-token-estimate', 'Token Estimate', 'Read token and character estimates to understand prompt pressure.', 'injection', 'injection.preview.normal', { fallbackTarget: 'session.metrics', prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-omission-reasons', 'Omission Reasons', 'Diagnose omitted Lorecards: muted, disabled tier, Context blocked, stack disabled, token pressure, or not selected.', 'injection', 'injection.preview.normal', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-injection-sync-diagnostics', 'Sync Diagnostics', 'Debug prompt transport and sync behavior from the injection surface.', 'injection', 'injection.promptPlacement', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-continuity-overview', 'Continuity Overview', 'Continuity is live scene state, distinct from durable Accepted Lorecards.', 'continuity', 'continuity.scan', { prepare: 'openContinuityEditor' }),
        advancedStep('advanced-continuity-scan', 'Scan Continuity State', 'Run a continuity scan to update the current scene state.', 'continuity', 'continuity.scan.button', { fallbackTarget: 'continuity.scan', prepare: 'openContinuityEditor' }),
        advancedStep('advanced-continuity-automation', 'Continuity Automation', 'Configure continuity automation cadence and understand when scans run.', 'continuity', 'continuity.automation', { prepare: 'openContinuityEditor' }),
        advancedStep('advanced-continuity-scope', 'Continuity Scope', 'Choose recent, custom range, or entire-chat continuity scan scope.', 'continuity', 'continuity.scanScope', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.scanScope']) }),
        advancedStep('advanced-continuity-custom-range', 'Custom Range', 'Use custom range for a missed section instead of rescanning the entire chat.', 'continuity', 'continuity.scanScope', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.scanScope']) }),
        advancedStep('advanced-continuity-performance', 'Continuity Performance', 'Tune chunking, overlap, concurrency, retries, and checkpoints.', 'continuity', 'continuity.performance', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.scanPerformance']) }),
        advancedStep('advanced-continuity-tracked-sections', 'Tracked Sections', 'Choose which live-state sections are scanned and injected.', 'continuity', 'continuity.trackedSections', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.trackedSections']) }),
        advancedStep('advanced-continuity-scene-state', 'Scene State', 'Edit scene and timeline state for the immediate prompt context.', 'continuity', 'continuity.scene', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.canonScene']) }),
        advancedStep('advanced-continuity-active-characters', 'Active Characters', 'Edit active characters, current state, appearance, emotion, and immediate goals.', 'continuity', 'continuity.characters', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.characters']) }),
        advancedStep('advanced-continuity-items', 'Key Items', 'Edit key items, owners, locations, and object status.', 'continuity', 'continuity.items', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.inventory']) }),
        advancedStep('advanced-continuity-goals-threads', 'Goals and Threads', 'Edit active goals, threads, and immediate objectives.', 'continuity', 'continuity.threads', { prepare: 'openContinuityEditor', expandSections: Object.freeze(['continuity.activeGoalsThreads']) }),
        advancedStep('advanced-continuity-emotional-freshness', 'Emotional Freshness', 'Inspect or edit emotional freshness where available.', 'continuity', 'continuity.emotionalState', { prepare: 'openContinuityEditor' }),
        advancedStep('advanced-continuity-injection-link', 'Continuity Injection Link', 'Understand how continuity state reaches the Injection tab and prompt preview.', 'continuity', 'continuity.trackedSections', { prepare: 'openContinuityEditor' }),
        advancedStep('advanced-continuity-recovery', 'Continuity Recovery', 'Recover from interrupted or failed long scans by adjusting scope, performance, or retry path.', 'continuity', 'continuity.results', { fallbackTarget: 'continuity.scan', prepare: 'openContinuityEditor' }),
        advancedStep('advanced-creator-create-deck', 'Create Deck', 'Launch Create Deck to begin a Generated Lorepack project.', 'loredecks', 'loredecks.creator.open', { fallbackTarget: 'loredecks.library.open', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-intake', 'Deck Maker Intake', 'Enter fandom, scope, granularity, and notes for the generated project.', 'loredecks', 'loredecks.creator.settings', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-brief', 'Scope Brief', 'Generate and approve the scope brief before outline and title work.', 'loredecks', 'loredecks.creator.brief', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-outline', 'Story Outline', 'Generate and approve the outline that drives title batches and planning.', 'loredecks', 'loredecks.creator.outline', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-title-pass', 'Title Pass', 'Use Generate Next Title Batch or Generate Remaining after the Story Outline defines title sets.', 'loredecks', 'loredecks.creator.titleActions', { fallbackTarget: 'loredecks.creator.titlePass', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-title-review', 'Title Review', 'Select title rows, then use Approve Selected Titles, Revise Selected Titles, or Drop Selected before planning.', 'loredecks', 'loredecks.creator.approveSelectedTitles', { fallbackTarget: 'loredecks.creator.titleActions', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-planning', 'Context and Tag Planning', 'Use Plan Context and Tags to draft timeline and tag proposals for the next approved title set.', 'loredecks', 'loredecks.creator.planContextTags', { fallbackTarget: 'loredecks.creator.planning', prepare: 'openLoredeckCreator' }),
        advancedStep('advanced-creator-planning-review', 'Planning Review', 'Review generated Context and tag proposals in the Deck Maker review queue before they shape Lorecard drafting.', 'loredecks', 'loredecks.creator.review', { fallbackTarget: 'loredecks.creator.planningActions', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-entry-draft', 'Entry Drafting', 'Use Draft Lorecards for one small resumable batch from approved planning and titles.', 'loredecks', 'loredecks.creator.draftLorecards', { fallbackTarget: 'loredecks.creator.entries', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-entry-auto-draft', 'Auto-Draft All', 'Use Auto-Draft All only after confirming the exact remaining Lorecard count and provider-call count.', 'loredecks', 'loredecks.creator.autoDraftAll', { fallbackTarget: 'loredecks.creator.entryActions', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-draft-review', 'Deck Maker Draft Review', 'Review Deck Maker Lorecard drafts in the Draft Review batch before they enter Pending Review.', 'loredecks', 'loredecks.creator.draftReview', { fallbackTarget: 'loredecks.creator.entries', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-send-to-review', 'Send Drafts to Review', 'Use Send Selected to Review or Send All to Review when Deck Maker drafts are ready for normal Pending Review.', 'loredecks', 'loredecks.creator.sendSelectedDrafts', { fallbackTarget: 'loredecks.creator.draftReviewActions', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-pending-review-link', 'Pending Review Link', 'Jump from Deck Maker to the relevant review queue for generated entries.', 'loredecks', 'loredecks.creator.review', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-current-task', 'Current Task Controls', 'Retry, retry smaller, or cancel active generation from the current task card.', 'loredecks', 'loredecks.creator.currentTask', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-generation-settings', 'Deck Maker Generation Settings', 'Tune Deck Maker generation settings per project.', 'loredecks', 'loredecks.creator.settings', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-project-shelf', 'Project Shelf', 'Resume in-progress Deck Maker projects from the In-Progress Deck Maker Projects shelf.', 'loredecks', 'loredecks.creator.projectCard', { fallbackTarget: 'loredecks.creator.projects', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-project-manage', 'Manage Projects', 'Search, filter, select, move, rename, resume, or delete Deck Maker projects deliberately.', 'loredecks', 'loredecks.creator.projectControls', { fallbackTarget: 'loredecks.creator.projects', prepare: 'openCreatorProject' }),
        advancedStep('advanced-creator-inspect-generated-pack', 'Inspect Generated Pack', 'Open the linked Generated Lorepack in Library details.', 'loredecks', 'loredecks.library.details', { prepare: 'openLoredeckDetails' }),
        advancedStep('advanced-creator-readiness-gate', 'Deck Maker Readiness Gate', 'Read accepted coverage, draft blockers, Pack Health, and export readiness before finalization.', 'loredecks', 'loredecks.creator.readiness', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-health-center-open', 'Open Pack Health Center', 'Open Pack Health Center from Library details or a generated pack readiness surface.', 'loredecks', 'loredecks.health.header', { prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-health-status', 'Refresh Scan And Status', 'Use Refresh Scan, then read errors, warnings, notices, entry counts, and manifest health.', 'loredecks', 'loredecks.health.refreshScan', { fallbackTarget: 'loredecks.health.status', prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-health-issue-groups', 'Issue Groups', 'Inspect grouped health issues by severity, code, affected data, and suggested repair path.', 'loredecks', 'loredecks.health.issues', { fallbackTarget: 'loredecks.health.status', prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-health-attempt-fixing', 'Attempt Fixing', 'Run Attempt Fixing for editable packs, then use saved sessions or model batches when the repair is not fully deterministic.', 'loredecks', 'loredecks.health.attemptFixing', { fallbackTarget: 'loredecks.health.repairSessions', prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-health-manual-repair', 'Review And Manual Routes', 'Use per-issue actions such as Accept As-Is, Verify Fixed, Queue Tag ID Review, or manual edits when Attempt Fixing cannot apply one clear fix.', 'loredecks', 'loredecks.health.issueActions', { fallbackTarget: 'loredecks.health.issues', prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-package-update', 'Package Update', 'Update or reinstall packages when a newer or corrected package is available.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-package-local-mod-warning', 'Local Modification Warning', 'Understand local modification warnings before overwriting or updating a package.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-package-export-bundled', 'Export Bundled Reference', 'Export Bundled Lorepack references correctly so imports remain lightweight where possible.', 'loredecks', 'loredecks.library.export', { fallbackTarget: 'loredecks.library.header', prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-package-export-custom', 'Export Custom Lorepack', 'Export Custom Lorepacks with embedded data for sharing or backup.', 'loredecks', 'loredecks.library.export', { fallbackTarget: 'loredecks.library.header', prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-generated-finalize-custom', 'Finalize Generated as Custom', 'Finalize a reviewed Generated Lorepack as a Custom Lorepack only after readiness and coverage blockers are handled.', 'loredecks', 'loredecks.creator.finalizeActions', { fallbackTarget: 'loredecks.creator.readiness', prepare: 'openCreatorProject' }),
        advancedStep('advanced-generated-export-readiness', 'Generated Export Readiness', 'Interpret generated export readiness from the Deck Maker Readiness Gate without treating it as the only quality gate.', 'loredecks', 'loredecks.creator.readiness', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-settings-provider-overview', 'Provider Overview', 'Understand Utility and Reasoning provider roles.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-provider-profile', 'Provider Profiles', 'Select or edit provider profiles for model-backed Saga actions.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-endpoint-model', 'Endpoint and Model', 'Configure endpoint and model details for provider routes.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-provider-test', 'Provider Test', 'Test configured providers before relying on scans, compression, Context Reasoner, or Deck Maker calls.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-current-model', 'Current SillyTavern Model', 'Use the current SillyTavern model where that is the simplest provider route.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-generation', 'Generation Parameters', 'Tune generation parameters for model-backed Saga tasks.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-provider-presets', 'Provider Presets', 'Use provider preset support to install or update bundled profile routing.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-api-compat', 'API Compatibility Flags', 'Inspect compatibility flags only when diagnosing provider behavior.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-theme-pack', 'Theme Pack', 'Choose, import, export, reset, and inspect Theme Packs.', 'settings', 'settings.themePack', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-icon-set', 'Icon Set', 'Choose icon sets from the Theme Pack controls.', 'settings', 'settings.themePack', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-colors', 'Color Controls', 'Tune color controls and raw tokens for runtime visual polish.', 'settings', 'settings.themePack', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-settings-diagnostics', 'Diagnostics', 'Use diagnostics or developer status when provider, runtime, or package behavior needs investigation.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-troubleshoot-no-loredeck', 'No Loredeck Loaded', 'Route empty-stack issues to the Loredeck Library and active stack.', 'session', 'session.instructions.advanced'),
        advancedStep('advanced-troubleshoot-wrong-context', 'Wrong Context', 'Route wrong suggestions to Context Workbench, locks, proposals, or Advanced Brief.', 'context', 'context.commandCenter'),
        advancedStep('advanced-troubleshoot-no-suggestions', 'No Suggestions', 'Check active stack, Context, provider readiness, and canon/story generation paths.', 'lore', 'lore.generation'),
        advancedStep('advanced-troubleshoot-pending-stuck', 'Pending Stuck', 'Clear draft and pending queues through review, accept, reject, or drop actions.', 'lore', 'lore.pending', { prepare: 'openPendingLoreReview' }),
        advancedStep('advanced-troubleshoot-no-injection', 'No Injection', 'Check Injection toggles, tiers, Context eligibility, stack enabled state, mute, and token pressure.', 'injection', 'injection.toggles', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-troubleshoot-prompt-heavy', 'Prompt Too Heavy', 'Tune tiers, compression, Low relevance, continuity sections, and prompt placement.', 'injection', 'injection.promptPlacement', { prepare: 'openInjectionPreview' }),
        advancedStep('advanced-troubleshoot-provider-failure', 'Provider Failure', 'Route provider failures to Settings, request surfaces, and audit output.', 'settings', 'settings.providers', { prepare: 'openAdvancedSettingsSection' }),
        advancedStep('advanced-troubleshoot-continuity-stale', 'Continuity Stale', 'Rescan, adjust scope, inspect tracked sections, or recover interrupted scans.', 'continuity', 'continuity.scan', { prepare: 'openContinuityEditor' }),
        advancedStep('advanced-troubleshoot-package-duplicate', 'Package Duplicate Warning', 'Resolve duplicate package import warnings before installing or updating.', 'loredecks', 'loredecks.library.import', { prepare: 'openLoredeckLibrary' }),
        advancedStep('advanced-troubleshoot-health-warnings', 'Health Warnings', 'Route Pack Health warnings to repair, ignore, duplicate-as-custom, or manual edit paths.', 'loredecks', 'loredecks.health.issues', { prepare: 'openDeckHealthCenter' }),
        advancedStep('advanced-troubleshoot-creator-failure', 'Deck Maker Failure', 'Retry, retry smaller, cancel, or adjust Deck Maker generation settings.', 'loredecks', 'loredecks.creator.currentTask', { fallbackTarget: 'loredecks.creator.workbench', prepare: 'openCreatorProject' }),
        advancedStep('advanced-troubleshoot-return-basic', 'Return to Basic', 'Switch back to Basic when routine roleplay no longer needs advanced controls.', 'settings', 'settings.experienceMode'),
    ];
}

export const GUIDE_SECTIONS = Object.freeze({
    basic: freezeGuideSections([
        { id: 'firstRun', label: 'First Run', tab: 'session', description: 'Get oriented, read readiness, and use the next recommended action.' },
        { id: 'loredecks', label: 'Loredecks', tab: 'loredecks', description: 'Load, import, inspect, and stack Lorepacks from the desktop Library.' },
        { id: 'context', label: 'Context', tab: 'context', description: 'Set story position and keep it current from the Context route, Details subview, or Workbench.' },
        { id: 'lore', label: 'Lorecards', tab: 'lore', description: 'Generate, review, accept, and clean up durable facts.' },
        { id: 'continueRoleplay', label: 'Continue Roleplay', tab: 'session', description: 'Confirm readiness and repeat the update loop from Session.' },
        { id: 'settings', label: 'Settings', tab: 'settings', description: 'Fix providers and Theme Pack basics from the desktop Settings tab.' },
    ]),
    advanced: freezeGuideSections([
        { id: 'libraryMastery', label: 'Loredeck Library Mastery', tab: 'loredecks', description: 'Manage Library records, source types, folders, stack order, imports, exports, and details across desktop panels.' },
        { id: 'sessionControl', label: 'Session, Story Maker, And Runtime Control', tab: 'session', description: 'Control runtime mode, automation, activation, guide modules, Story Maker openers, and diagnostics.' },
        { id: 'contextResolution', label: 'Context Resolution', tab: 'context', description: 'Resolve story position with browser, detection, proposals, locks, audits, and Context workbenches on desktop.' },
        { id: 'loreReview', label: 'Lorecard Generation And Review', tab: 'lore', description: 'Generate canon/story Lorecards, review proposals, manage Accepted Lorecards, and audit changes.' },
        { id: 'injectionDiagnostics', label: 'Injection Diagnostics', tab: 'injection', description: 'Inspect prompt placement, relevance tiers, compression, previews, token pressure, and omissions.' },
        { id: 'continuityTracking', label: 'Continuity Tracking', tab: 'continuity', description: 'Track live scene state, scan scope, performance, tracked sections, and recovery.' },
        { id: 'creatorAuthoring', label: 'Deck Maker And Generated Lorepack Authoring', tab: 'loredecks', description: 'Create and resume Generated Lorepack projects from scope brief through review and readiness.' },
        { id: 'packHealth', label: 'Pack Health And Packages', tab: 'loredecks', description: 'Inspect Pack Health, repair issues, handle package import/export, and finalize generated packs from desktop.' },
        { id: 'settingsDiagnostics', label: 'Settings And Providers', tab: 'settings', description: 'Configure providers, Theme Packs, icons, colors, and diagnostics in desktop Settings.' },
        { id: 'troubleshooting', label: 'Troubleshooting Routes', tab: 'session', description: 'Route common symptoms to the right Advanced workflow without scanning every tab.' },
    ]),
});

export const GUIDE_STEPS = Object.freeze({
    basic: freezeGuideSteps([
        guideStep('basic-session-orientation', 'Basic Workflow Orientation', 'Basic mode is the focused setup and play loop: load Lorepacks, set Context, review useful Lorecards, then continue roleplay. Start from the Session tab.', 'session', 'session.basicReadiness', {
            section: 'firstRun',
            expected: 'You understand that Session Readiness is the main Basic guidepost before roleplay.',
            when: 'Start here the first time you open Saga in a chat.',
        }),
        guideStep('basic-session-saga-active', 'Saga Active', 'Saga Active pauses or resumes Saga behavior without deleting saved data.', 'session', 'session.active', {
            section: 'firstRun',
            expected: 'When Saga is active, Accepted Lorecards and configured runtime behavior can affect the next response.',
            when: 'Turn it off for chats where Saga should not inject or run tools.',
        }),
        guideStep('basic-session-start-checklist', 'Session Readiness', 'Session Readiness turns the Basic workflow into one next action at a time.', 'session', 'session.basicReadiness', {
            section: 'firstRun',
            expected: 'Session Readiness points to the next missing step: load Loredecks, set Context, review Lorecards, enable Saga, or continue roleplay.',
            when: 'Use this as the first Session stop in Basic mode.',
        }),
        guideStep('basic-session-next-action', 'Use the Recommended Action', 'The readiness action button sends you to the right tab.', 'session', 'session.basicReadiness', {
            section: 'firstRun',
            expected: 'You can follow the next recommended action to keep setup moving.',
            when: 'Use it whenever Session Readiness is not ready.',
        }),
        guideStep('basic-loredecks-overview', 'Loredecks as Source Packs', 'Loredecks are source packs for Context, canon suggestions, retrieval, and Accepted Lorecards.', 'loredecks', 'loredecks.library.launch', {
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'You can see how many Loredecks exist, how many are active, and whether Pack Health has warnings.',
            when: 'Start here for a new chat or whenever the story source changes.',
        }),
        guideStep('basic-loredecks-open-library', 'Open Loredeck Library', 'Open the Library to choose a Bundled Lorepack, Generated Lorepack, or Custom Lorepack. Desktop opens a fullscreen manager.', 'loredecks', 'loredecks.library.open', {
            fallbackTarget: 'loredecks.library.launch',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'The Library opens with the active stack manager and available Loredecks.',
            when: 'Use it when the active stack is empty, incomplete, or in the wrong order.',
        }),
        guideStep('basic-library-layout', 'Library Layout', 'The Library is split into available Lorepacks, add/remove controls, active stack, and selected details.', 'loredecks', 'loredecks.library.header', {
            fallbackTarget: 'loredecks.library.open',
            prepare: 'openLoredeckLibrary',
            expected: 'You know where to look for available packs, active stack order, and selected-pack details.',
            when: 'Use this orientation before changing the active stack.',
        }),
        guideStep('basic-library-pack-types', 'Lorepack Types', 'Bundled Lorepacks ship with Saga, Generated Lorepacks come from the Deck Maker workflow, and Custom Lorepacks are user-owned imports or editable copies.', 'loredecks', 'loredecks.library.filters', {
            fallbackTarget: 'loredecks.library.header',
            prepare: 'openLoredeckLibrary',
            expected: 'You can distinguish source type without needing Deck Maker controls in Basic.',
            when: 'Use this when choosing which pack should drive a story.',
        }),
        guideStep('basic-library-search-filter', 'Search and Filter', 'Use Library search, special views, sorting, and folders to find the right Lorepack quickly.', 'loredecks', 'loredecks.library.filters', {
            fallbackTarget: 'loredecks.library.list',
            prepare: 'openLoredeckLibrary',
            expected: 'You can narrow a large Library without changing the active stack.',
            when: 'Use this when the Library has many packs or folders.',
        }),
        guideStep('basic-library-pack-details', 'Pack Details', 'Select a Lorepack to read its summary, type, source, Lorecard count, and basic metadata.', 'loredecks', 'loredecks.library.details', {
            fallbackTarget: 'loredecks.library.list',
            prepare: 'openLoredeckDetails',
            expected: 'The details panel confirms what the selected Lorepack contains before you load it.',
            when: 'Use this before adding an unfamiliar pack to the active stack.',
        }),
        guideStep('basic-library-pack-health', 'Pack Health', 'Pack Health is advisory readiness for the selected Lorepack or active stack. Basic reads status; Advanced handles Health Center repair routes.', 'loredecks', 'loredecks.library.details', {
            fallbackTarget: 'loredecks.library.header',
            prepare: 'openLoredeckDetails',
            expected: 'You can tell whether a pack is ready enough for Basic use or needs Advanced repair.',
            when: 'Check this if a pack looks incomplete, missing entries, or unexpectedly quiet.',
        }),
        guideStep('basic-loredecks-import', 'Import a Loredeck Package', 'Import Deck installs a Saga Loredeck zip package into the Library.', 'loredecks', 'loredecks.library.import', {
            fallbackTarget: 'loredecks.import',
            prepare: 'openLoredeckLibrary',
            expected: 'A shared or exported package can become a Custom Lorepack after preview and install.',
            when: 'Use this when the right Lorepack is not already in the Library.',
        }),
        guideStep('basic-library-import-preview', 'Import Preview', 'Imported packages are previewed before install so you can confirm the package before it enters the Library.', 'loredecks', 'loredecks.library.import', {
            fallbackTarget: 'loredecks.import',
            prepare: 'openLoredeckLibrary',
            expected: 'Import is still available in Basic, but installing a package remains an intentional action.',
            when: 'Use this when someone shares a .saga-loredeck.zip package with you.',
        }),
        guideStep('basic-library-add-deck-stack', 'Add a Lorepack to Stack', 'Add the selected Lorepack to the active stack so it can participate in Context, canon suggestions, retrieval, and Lorecards.', 'loredecks', 'loredecks.library.transfer', {
            fallbackTarget: 'loredecks.library.list',
            prepare: 'openLoredeckLibrary',
            expected: 'At least one enabled Lorepack can participate in the current session.',
            when: 'Do this before setting Context or scanning story lore.',
        }),
        guideStep('basic-library-add-folder-stack', 'Add a Folder Group', 'If the Library is organized into folders, a folder group can load several related Lorepacks together.', 'loredecks', 'loredecks.library.transfer', {
            fallbackTarget: 'loredecks.library.list',
            prepare: 'openLoredeckLibrary',
            expected: 'A folder group can represent a whole story collection without adding every pack one by one.',
            when: 'Use this when a curated folder matches the current story.',
        }),
        guideStep('basic-library-stack-order', 'Stack Order', 'The active stack is top-to-bottom priority; place the main source above supporting packs when order matters.', 'loredecks', 'loredecks.library.stack', {
            fallbackTarget: 'loredecks.library.transfer',
            prepare: 'openLoredeckLibrary',
            expected: 'You can read which packs have priority and adjust the order before play.',
            when: 'Use this when two packs might overlap or one should clearly lead.',
        }),
        guideStep('basic-library-stack-enable', 'Enable or Disable Stack Items', 'Disable an active stack entry to pause it without deleting the Lorepack from the Library.', 'loredecks', 'loredecks.library.stack', {
            fallbackTarget: 'loredecks.library.transfer',
            prepare: 'openLoredeckLibrary',
            expected: 'You can temporarily remove a pack from runtime behavior while preserving Library data.',
            when: 'Use this for side packs, optional sources, or temporary experiments.',
        }),
        guideStep('basic-library-close-confirm', 'Close and Confirm Stack', 'Use Done to close the Library, then confirm the Loredecks tab shows the active count and active Lorecard count you expect.', 'loredecks', 'loredecks.library.done', {
            fallbackTarget: 'loredecks.library.header',
            prepare: 'openLoredeckLibrary',
            expected: 'The Loredecks tab reflects the stack you just built.',
            when: 'Do this before moving to Context setup.',
        }),
        guideStep('basic-context-overview', 'Context Overview', 'Context is the current story position for each loaded Lorepack.', 'context', 'context.commandCenter', {
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Loaded Loredecks can be browsed, detected, reviewed, and manually locked from one place.',
            when: 'Open this after loading Loredecks and whenever the story moves to a new arc, chapter, date, episode, quest, or event.',
        }),
        guideStep('basic-context-loaded-rows', 'Loaded Loredeck Context Rows', 'Each enabled Loredeck has a Context row showing whether its story position is unset, detected, manually selected, or locked.', 'context', 'context.loadedLoredecks', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.loadedLoredecks']),
            expected: 'Every loaded Loredeck exposes its current Context status.',
            when: 'Verify this before canon suggestions or story-lore scans.',
        }),
        guideStep('basic-context-browse', 'Browse Context', 'Browse Context is the trusted manual path for choosing the exact story position on desktop.', 'context', 'context.browser', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Manual choices can set and lock the right Context for each loaded Loredeck.',
            when: 'Use this when you know the correct point or detection is uncertain.',
        }),
        guideStep('basic-context-workbench-loredeck', 'Choose Loaded Loredeck', 'In the Context Workbench, choose which loaded Lorepack you are setting before applying a story position.', 'context', 'context.workbench.loadedLoredeck', {
            fallbackTarget: 'context.workbench.contextTable',
            prepare: 'openContextBrowser',
            expected: 'The Workbench focuses the loaded Lorepack whose Context should change.',
            when: 'Use this when more than one Lorepack is active.',
        }),
        guideStep('basic-context-anchors-windows', 'Anchors and Windows', 'Anchors are exact story points. Windows are ranges between story points. Choose Story Position shows both so you can pick the right shape.', 'context', 'context.workbench.storyPosition', {
            fallbackTarget: 'context.workbench.editor',
            prepare: 'openContextBrowser',
            expected: 'You can tell whether the current story needs one exact point or a bounded range.',
            when: 'Use this before applying manual Context.',
        }),
        guideStep('basic-context-start-window', 'Start Here or Use Window', 'Use Start Here when the chat begins at one Anchor. Use Window when a listed Window already matches the whole active story range.', 'context', 'context.workbench.startHere', {
            fallbackTarget: 'context.workbench.useWindow',
            prepare: 'openContextBrowser',
            expected: 'The chosen Anchor or Window becomes the selected manual Context for that Lorepack.',
            when: 'Use this when the story position is obvious from the timeline list.',
        }),
        guideStep('basic-context-use-anchor', 'Use Anchor', 'Search Choose Story Position and press Start Here for the basic shortcut, or use Use Anchor from Timeline when you inspect the selected exact Anchor.', 'context', 'context.workbench.useAnchor', {
            fallbackTarget: 'context.workbench.startHere',
            prepare: 'openContextBrowser',
            expected: 'A specific timeline Anchor is stored as the current Context.',
            when: 'Use this when search finds the exact event, episode, chapter, quest, date, or arc point.',
        }),
        guideStep('basic-context-after-before', 'After, Before, Timeline', 'Use After on the lower bound and Before on the upper bound to build a custom Window. Use Timeline when you need to inspect the source row.', 'context', 'context.workbench.after', {
            fallbackTarget: 'context.workbench.windowBuilder',
            prepare: 'openContextBrowser',
            expected: 'Selected Range shows the selected lower and upper bounds before you continue.',
            when: 'Use this when no listed Window exactly matches the active story range.',
        }),
        guideStep('basic-context-phrase-resolver', 'Phrase Resolver', 'Phrase Resolver tests loose story phrases against known timeline labels, aliases, dates, tags, and coordinates without calling a model.', 'context', 'context.workbench.phraseResolver', {
            fallbackTarget: 'context.workbench.editor',
            prepare: 'openContextBrowser',
            expected: 'You can check whether wording like "after the tournament" maps to a known Anchor before applying it.',
            when: 'Use this when you remember the story moment but not the exact timeline row name.',
        }),
        guideStep('basic-context-select-position', 'Confirm Story Position', 'Confirm the correct arc, chapter, date, episode, quest, event, Anchor, or Window for the loaded Lorepack.', 'context', 'context.workbench.editor', {
            fallbackTarget: 'context.commandCenter',
            prepare: 'openContextBrowser',
            expected: 'The selected Context tells Saga which canon and timeline material is currently eligible.',
            when: 'Use this when the story position is known or should be locked manually.',
        }),
        guideStep('basic-context-manual-protects', 'Manual Context Protects Accuracy', 'Manual Context choices should be protected from accidental overwrite when they are more trustworthy than detection.', 'context', 'context.loadedLoredecks', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.loadedLoredecks']),
            expected: 'You understand why a manually chosen Context should not be casually replaced.',
            when: 'Use this after selecting a precise story position by hand.',
        }),
        guideStep('basic-context-detect', 'Detect Context', 'Detect Context analyzes recent messages and updates unlocked loaded Loredeck Context rows.', 'context', 'context.detect', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Saga stores a detector status and applies high-confidence story-position matches.',
            when: 'Run this after a scene jump, time skip, new episode/chapter, or major location change.',
        }),
        guideStep('basic-context-proposals', 'Review Context Proposals', 'Uncertain Context output should be reviewed as a proposal before you rely on it.', 'context', 'context.proposals.review', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'You can treat low-confidence or ambiguous detection as guidance instead of truth.',
            when: 'Use this when detection has multiple plausible matches.',
        }),
        guideStep('basic-context-update-loop', 'Context Update Loop', 'Return to Context whenever the story crosses a meaningful boundary.', 'context', 'context.commandCenter', {
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Context stays aligned with the active story instead of drifting behind.',
            when: 'Repeat after time skips, travel, chapter changes, episode changes, or major plot turns.',
        }),
        guideStep('basic-lorecards-overview', 'Lorecards as Reviewed Facts', 'Lorecards are reviewed facts that can affect future responses after they are accepted.', 'lore', 'lore.generation', {
            fallbackTarget: 'lore.generation.section',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'You understand that suggestions do not guide the model until they pass review.',
            when: 'Use this before creating or accepting new memory.',
        }),
        guideStep('basic-lorecards-generation-section', 'Generate', 'The Generate section gathers canon pack preview, story-lore scan, and Manual Lore Note drafting.', 'lore', 'lore.generation.section', {
            fallbackTarget: 'lore.generation.section',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'All new Lorecards still go to Pending Review before they can affect prompts.',
            when: 'Use this when the story has new facts or when canon guardrails are needed for the current Context.',
        }),
        guideStep('basic-lorecards-preview-canon', 'Preview Canon Packs', 'Preview Canon Packs queries local Loredeck data for Context-aware canon suggestions without a provider call.', 'lore', 'lore.canon.preview', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Matching canon entries appear as selectable packs, then selected entries can be sent to Pending Review.',
            when: 'Use this before scenes where canon constraints matter.',
        }),
        guideStep('basic-lorecards-send-canon-review', 'Send Canon to Review', 'Selected canon suggestions go to Pending Review instead of becoming Accepted Lorecards automatically.', 'lore', 'lore.canon.addPending', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Canon suggestions remain reviewable before they can affect prompts.',
            when: 'Use this when previewed canon is useful for the current scene.',
        }),
        guideStep('basic-lorecards-story-scan', 'Scan Story Lore', 'Scan Story Lore asks the configured provider to extract durable story-specific facts from recent chat.', 'lore', 'lore.story.scan', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Potential facts are proposed as Pending Review entries, not accepted automatically.',
            when: 'Run it after substantial new roleplay or when you want to backfill recent story facts.',
        }),
        guideStep('basic-lorecards-manual-add', 'Manual Lore Note', 'Manual notes let you draft a known fact directly, then review it like generated entries.', 'lore', 'lore.manual.add', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Your draft lands in Pending Review for one last edit/accept step.',
            when: 'Use this for important facts you already trust and do not need a model to discover.',
        }),
        guideStep('basic-lorecards-pending-review', 'Pending Review', 'Pending Review is the gate between suggested facts and Accepted Lorecards.', 'lore', 'lore.pending', {
            expandSections: Object.freeze(['lore.pendingReview']),
            prepare: 'openPendingLoreReview',
            expected: 'Accept only useful durable facts. Reject recap, noise, wrong canon, or facts that should stay transient.',
            when: 'Review after canon preview, story scan, or Manual Lore Note drafting.',
        }),
        guideStep('basic-lorecards-edit-pending', 'Edit Pending Review', 'Open or edit a Pending Review entry before accepting it so the durable fact is precise.', 'lore', 'lore.pending.entry', {
            fallbackTarget: 'lore.pending',
            expandSections: Object.freeze(['lore.pendingReview']),
            prepare: 'openPendingLoreReview',
            expected: 'Pending Review entries can be corrected before they become Accepted Lorecards.',
            when: 'Use this when a proposal is useful but too broad, noisy, or slightly wrong.',
        }),
        guideStep('basic-lorecards-accept-dismiss', 'Accept or Reject', 'Accept useful durable facts and reject recap, noise, wrong canon, or facts that should stay transient.', 'lore', 'lore.pending.actions', {
            fallbackTarget: 'lore.pending',
            expandSections: Object.freeze(['lore.pendingReview']),
            prepare: 'openPendingLoreReview',
            expected: 'Only reviewed facts move into Accepted Lorecards.',
            when: 'Use this after reading a pending proposal.',
        }),
        guideStep('basic-lorecards-review-question', 'Review Question', 'Ask: should this fact affect future responses?', 'lore', 'lore.pending', {
            expandSections: Object.freeze(['lore.pendingReview']),
            prepare: 'openPendingLoreReview',
            expected: 'The review decision is based on future usefulness, not whether the fact appeared once.',
            when: 'Use this to keep Accepted Lorecards clean.',
        }),
        guideStep('basic-lorecards-accepted-list', 'Accepted Lorecards', 'Accepted Lorecards are the durable facts Saga can select for future responses.', 'lore', 'lore.accepted', {
            expandSections: Object.freeze(['lore.acceptedEntries']),
            prepare: 'openAcceptedLoreDetails',
            expected: 'Accepted entries can be searched, opened, edited, and selected for injection by relevance rules.',
            when: 'Use this to confirm what Saga remembers and to clean up entries that should no longer guide the model.',
        }),
        guideStep('basic-lorecards-open-accepted', 'Open Accepted Lorecard', 'Open an Accepted Lorecard to verify or correct its details.', 'lore', 'lore.accepted.entry', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            prepare: 'openAcceptedLoreDetails',
            expected: 'Accepted Lorecards remain inspectable and correctable.',
            when: 'Use this when a response suggests Saga remembered something incorrectly.',
        }),
        guideStep('basic-lorecards-pin-mute', 'Elevate or Mute Lorecards', 'Elevate important Accepted Lorecards for protected prominence or mute entries that should stay saved but not guide responses.', 'lore', 'lore.accepted.pinMuteHelp', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            prepare: 'openAcceptedLoreDetails',
            expected: 'You can emphasize critical facts or suppress entries without deleting them.',
            when: 'Use this for secrets, hard constraints, stale entries, or temporarily irrelevant facts.',
        }),
        guideStep('basic-lorecards-search-cleanup', 'Search and Clean Up', 'Search Accepted Lorecards and clean up entries that should no longer guide the model.', 'lore', 'lore.accepted.filters', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            prepare: 'openAcceptedLoreDetails',
            expected: 'Accepted Lorecards can stay focused as the story grows.',
            when: 'Use this after long sessions or when the model starts surfacing stale details.',
        }),
        guideStep('basic-session-metrics', 'Session Metrics', 'Metrics show whether Saga has Pending Review entries, Accepted Lorecards, selected injection, and a token estimate.', 'session', 'session.metrics', {
            section: 'continueRoleplay',
            expected: 'You can tell whether Saga has data and whether Accepted Lorecards are selected for injection.',
            when: 'Check this if the model seems to ignore lore or if the prompt feels too heavy.',
        }),
        guideStep('basic-session-ready', 'Session Ready', 'Session Readiness is ready when the active stack, Context, review state, and Saga Active status are in place.', 'session', 'session.basicReadiness', {
            section: 'continueRoleplay',
            expected: 'You can confirm Saga is ready before continuing roleplay.',
            when: 'Use this before sending the next story message.',
        }),
        guideStep('basic-story-maker-optional', 'Story Maker Optional Opener', 'Open Story Maker when you want Saga to draft a first post from the loaded Loredecks, current Context, and Accepted Lorecards. It is optional and not required for every Basic quickrun.', 'session', 'session.storyOpener', {
            section: 'continueRoleplay',
            expandSections: Object.freeze(['session.storyMaker']),
            expected: 'You know Story Maker is a Session helper for openers, not a required setup gate.',
            when: 'Use this before continuing roleplay when you want a lore-aware opening post.',
        }),
        guideStep('basic-story-maker-copy', 'Copy an Opener', 'If you use Story Maker, review the selected variant, revise it if needed, then copy Markdown or rich text and paste it into chat.', 'session', 'session.storyOpener', {
            section: 'continueRoleplay',
            expandSections: Object.freeze(['session.storyMaker']),
            expected: 'Generated opener text stays under your review before it enters the chat.',
            when: 'Use this after Story Maker drafts variants.',
        }),
        guideStep('basic-session-continue-roleplay', 'Continue Roleplay', 'Once lore is loaded, Context is set, and useful Lorecards are accepted, continue roleplay normally.', 'session', 'session.basicReadiness', {
            section: 'continueRoleplay',
            expected: 'The Basic setup work turns into normal play instead of constant configuration.',
            when: 'Use this after Session Readiness is ready.',
        }),
        guideStep('basic-session-repeat-loop', 'Repeat the Basic Loop', 'After major story movement, update Context and review new Lorecards before continuing again.', 'session', 'session.basicReadiness', {
            section: 'continueRoleplay',
            expected: 'Basic becomes a repeatable loop: play, update story position, review durable facts, continue.',
            when: 'Repeat after major scenes, reveals, travel, time skips, or chapter changes.',
        }),
        guideStep('basic-settings-provider-status', 'Provider Status', 'Provider setup is only needed for model-backed actions like story-lore scans and Context detection fallback.', 'settings', 'settings.providers', {
            expected: 'Utility and Reasoning provider readiness is visible without exposing every Advanced tuning control.',
            when: 'Check this if model-backed actions fail, stall, or are unavailable.',
        }),
        guideStep('basic-settings-provider-test', 'Test Providers', 'Use provider tests to confirm Utility or Reasoning routes are available before relying on model-backed features.', 'settings', 'settings.providers', {
            expected: 'You can separate provider setup problems from Saga workflow problems.',
            when: 'Use this when detection, scans, or model-backed actions fail.',
        }),
        guideStep('basic-settings-current-model', 'Use Current Model', 'For the simplest Basic setup, use the current SillyTavern model when that route is available and sufficient.', 'settings', 'settings.providers', {
            expected: 'Basic users can avoid deeper provider routing until Advanced controls are needed.',
            when: 'Use this when you want the least configuration before play.',
        }),
        guideStep('basic-settings-theme-pack', 'Theme Pack', 'Theme Pack controls the runtime shelf appearance, icons, and colors.', 'settings', 'settings.themePack', {
            expected: 'The active theme and icon set can be changed without affecting story data.',
            when: 'Use this for readability or visual preference before a long session.',
        }),
        guideStep('basic-settings-advanced-handoff', 'When to Switch to Advanced', 'Switch to Advanced for provider internals, Deck Maker, Continuity, Injection, Pack Health repair, or diagnostics.', 'settings', 'settings.providers', {
            expected: 'You know which work belongs outside the Basic walkthrough.',
            when: 'Use Advanced when Basic intentionally hides the control you need.',
        }),
    ]),
    advanced: freezeGuideSteps(buildAdvancedGuideSteps()),
});

export const GUIDE_CONTENT = Object.freeze({
    basic: Object.freeze({
        title: 'Basic Walkthrough',
        subtitle: 'guided basics',
        tooltip: 'Guided Basic walkthroughs for the visible roleplay workflow tabs.',
        lede: 'Use the full Basic walkthrough for a first pass, or start a smaller tab walkthrough for the part of the workflow you are using now. Start from the Session tab.',
        note: 'Basic keeps Continuity and Injection tuning out of the way. Switch to Advanced when you need automation, diagnostics, workbenches, or prompt placement controls.',
        tourLabel: 'Start Basic Walkthrough',
    }),
    advanced: Object.freeze({
        title: 'Advanced Walkthrough',
        subtitle: 'tab workflows',
        tooltip: 'Guided Advanced walkthroughs grouped by Saga tab and workflow area.',
        lede: 'Use the full Advanced walkthrough as a complete map, or start a focused tab walkthrough for faster routing through a specific workflow.',
        note: '',
        tourLabel: 'Start Advanced Walkthrough',
    }),
});

export function getRuntimeGuideSteps(mode) {
    const normalized = normalizeGuideMode(mode);
    return GUIDE_STEPS[normalized] || GUIDE_STEPS.basic;
}

export function getRuntimeGuideSections(mode) {
    const normalized = normalizeGuideMode(mode);
    const steps = getRuntimeGuideSteps(normalized);
    const sections = GUIDE_SECTIONS[normalized] || GUIDE_SECTIONS.basic;
    return sections.map(section => {
        const sectionSteps = steps.filter(step => getGuideSectionId(step) === section.id);
        return Object.freeze({
            ...section,
            stepCount: sectionSteps.length,
            steps: Object.freeze(sectionSteps),
        });
    }).filter(section => section.stepCount > 0);
}

export function getRuntimeGuideContent(mode) {
    const normalized = normalizeGuideMode(mode);
    return GUIDE_CONTENT[normalized] || GUIDE_CONTENT.basic;
}
