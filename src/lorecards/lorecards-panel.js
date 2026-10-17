import {
    getPanelLoreState,
    getLoreRelevanceCounts,
    normalizeLoreMatrix,
    normalizeLoreEntry,
    normalizeLoreTag,
} from './lore-matrix.js';
import {
    LORE_CATEGORY_VALUES,
    LORE_PURPOSE_LABELS,
    LORE_RELEVANCE_LABELS,
    LORE_RELEVANCE_TIERS,
    normalizeLorePurpose,
    normalizeLoreRelevance,
} from './lore-relevance.js';
import {
    LORE_AUTOMATION_MANUAL_DISABLE_REASONS,
    LORE_AUTOMATION_MODE_LABELS,
    LORE_AUTOMATION_MODE_TOOLTIPS,
    LORE_AUTOMATION_MODE_VALUES,
    LORE_AUTOMATION_STYLE_VALUES,
    disableLoreAutomationForManualChange,
    getLoreAutomationState,
    normalizeLoreAutomationMode,
    normalizeLoreAutomationStyle,
    setLoreAutomationEnabled,
} from './lore-automation.js';
import {
    ensureLoreSelectionShape,
    getLoreEntryBaseRelevance,
    getLoreEntryEffectiveRelevance,
    isLoreEntryElevated,
} from './lore-selection.js';
import {
    addTooltip,
    createBadge,
    createButton,
    createChip,
    createEmptyMessage,
    confirmAction,
    createKeyValue,
    createSectionHeader,
    createStatusPill,
    formatLoreScope,
    getLoreScopeSpecificity,
    hasDisplayableScope,
    humanizeScopeKey,
    isPlainObjectValue,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';
import {
    captureTextInputFocus,
    preserveInputFocusAfterRender,
    restoreTextInputFocus,
} from '../ui/input-focus-preservation.js';
import {
    truncateCleanText as truncateText,
} from '../runtime/runtime-formatters.js';
import { getDefaultRuntimeLorecardsStage, getRuntimeLorecardsStage, selectRuntimeLorecardsStage } from "../runtime/runtime-shell.js";
import {
    createLoreTimelineCard,
    openLoreTimeline,
} from './lore-timeline-panel.js';
import {
    acceptPendingLoreEntry as acceptPendingLoreEntryInState,
    rejectPendingLoreEntry as rejectPendingLoreEntryInState,
} from '../state/state-manager.js';

let lorecardsPanelDeps = {};
let acceptedLoreSearchRenderTimer = null;
const LORE_WORKBENCH_ID = 'saga-lore-workbench';
let loreWorkbenchSearchTimer = null;
let loreWorkbenchOpen = false;
let loreWorkbenchMode = 'accepted';
let loreWorkbenchSelectedId = '';
let loreWorkbenchPendingQuery = '';
let loreWorkbenchFocusSelector = '';
let loreWorkbenchFocusSnapshot = null;
const loreWorkbenchScrollState = { accepted: 0, pending: 0 };

const LORE_AUTOMATION_SETTING_KEYS = Object.freeze([
    'loreAutomationMode',
    'loreAutomationStyle',
    'loreAutomationProviderRouting',
    'loreAutomationCadenceMode',
    'loreAutomationPacing',
    'loreAutomationRemapWordBudget',
    'loreAutomationCurationWordBudget',
    'loreAutomationRunJournalLimit',
    'autoRelevanceEnabled',
    'autoRelevanceMode',
    'autoRelevanceEveryTurns',
    'autoRelevanceRecentMessages',
    'autoRelevanceCandidateCap',
    'autoRelevanceMinConfidence',
    'autoRelevanceNearFutureDays',
    'autoRelevanceRecentPastDays',
    'autoRelevanceProtectPinned',
    'autoRelevanceEvaluateMuted',
    'autoRelevanceModelCandidateCap',
    'autoRelevanceModelMaxTokens',
    'autoRelevanceModelRecentChars',
]);

const LORE_AUTOMATION_MODE_BUTTON_VALUES = Object.freeze(['ar', 'armp', 'armpc']);
const LORE_AUTOMATION_MODE_DESCRIPTIONS = Object.freeze({
    ar: 'Auto-Relevance',
    armp: 'Auto-Relevance Muting Prominence',
    armpc: 'Auto-Relevance Muting Prominence Curating',
});
const LORE_AUTOMATION_STYLE_LABELS = Object.freeze({ careful: 'Careful', balanced: 'Balanced', aggressive: 'Aggressive' });
const LORE_AUTOMATION_STYLE_DESCRIPTIONS = Object.freeze({
    careful: 'Conservative changes',
    balanced: 'Balanced changes',
    aggressive: 'Faster cleanup',
});
const LORE_AUTOMATION_PACING_VALUES = Object.freeze(['responsive', 'normal', 'relaxed']);
const LORE_AUTOMATION_PACING_LABELS = Object.freeze({ responsive: 'Responsive', normal: 'Normal', relaxed: 'Relaxed' });
const LORE_AUTOMATION_PACING_DESCRIPTIONS = Object.freeze({
    responsive: 'Checks sooner',
    normal: 'Default cadence',
    relaxed: 'Checks less often',
});

const RELEVANCE_META = Object.freeze({
    high: { label: 'High', color: '#166534', textColor: '#dcfce7', tooltip: 'Current-scene or immediate story relevance. Injects in the High-Relevance lore group.' },
    normal: { label: 'Normal', color: '#1e3a8a', textColor: '#dbeafe', tooltip: 'Recent, branch-defining, or medium-range story relevance. Injects in the Normal-Relevance lore group.' },
    low: { label: 'Low', color: '#4b5563', textColor: '#f9fafb', tooltip: 'Long-term background or distant past/future lore. Injects in the Low-Relevance lore group if enabled.' },
});
const RELEVANCE_SEGMENT_ORDER = Object.freeze(['low', 'normal', 'high']);

const LORE_ENTRY_TYPE_FILTERS = Object.freeze([
    ['all', 'Type: All'],
    ['high', 'High Relevance'],
    ['normal', 'Normal Relevance'],
    ['low', 'Low Relevance'],
    ['character', 'Character'],
    ['event', 'Event'],
    ['faction', 'Faction'],
    ['relationship', 'Relationship'],
    ['knowledge', 'Knowledge'],
    ['future_guard', 'Future Guard'],
    ['item', 'Item / Artifact'],
    ['location', 'Location / Place'],
    ['spell', 'Spell / Ability'],
    ['rule', 'Rule / System'],
    ['canon', 'Canon'],
    ['au', 'AU'],
    ['elevated', 'Elevated'],
    ['muted', 'Muted'],
]);

const LORECARD_LIFECYCLE_STAGES = Object.freeze(['suggested', 'pending', 'accepted', 'active']);

const ACCEPTED_LORE_VISIBLE_BATCH_SIZE = 200;
const LORECARD_LIFECYCLE_STAGE_META = Object.freeze({
    lore: {
        label: 'Lore',
        shortLabel: 'Lore',
        tooltip: 'Review and manage all Lorecards in one object list.',
    },
    generate: {
        label: 'Generate',
        shortLabel: 'Generate',
        tooltip: 'Create or suggest Lorecards from manual notes, recent story, canon sources, or Loredeck context.',
    },
    suggested: {
        label: 'Generation',
        shortLabel: 'Generation',
        tooltip: 'Create or suggest Lorecards from manual notes, recent story, canon sources, or Loredeck context.',
    },
    automation: {
        label: 'Automate',
        shortLabel: 'Automate',
        tooltip: 'Configure Lore Automation, run it now, inspect recent activity, and recover the last run.',
    },
    pending: {
        label: 'Pending',
        shortLabel: 'Pending',
        tooltip: 'Review suggested or drafted Lorecards before accepting them.',
    },
    accepted: {
        label: 'Approved',
        shortLabel: 'Approved',
        tooltip: 'Manage approved durable Lorecards, including high relevance, Elevated, muted, and searchable saved facts.',
    },
    active: {
        label: 'High Relevance',
        shortLabel: 'High',
        tooltip: 'High-relevance Lorecards currently eligible to affect prompt output.',
    },
});
const LORECARD_WORKSPACE_FILTERS = Object.freeze([
    ['all', 'All'],
    ['needs-review', 'Needs Review'],
    ['high', 'High'],
    ['elevated', 'Elevated'],
    ['muted', 'Muted'],
    ['conflicts', 'Conflicts'],
]);
const LORECARD_WORKSPACE_SORTS = Object.freeze([
    ['alphabetical', 'A', 'Alphabetical'],
    ['priority', 'P', 'Priority'],
    ['relevance', 'R', 'Relevance'],
]);
const LORE_SOURCE_FILTER_OPTIONS = Object.freeze([
    ['all', 'Source: All'],
    ['layer1', 'Canon consequences'],
    ['canon-db', 'Canon Database'],
    ['story-generation', 'Story Scan'],
    ['creator', 'Deck Maker Drafts'],
    ['context-suggestion', 'Context Suggestions'],
    ['manual', 'Manual / User'],
]);
const LORE_CONTEXT_FILTER_OPTIONS = Object.freeze([
    ['all', 'Context: All'],
    ['with-context', 'Has Context'],
    ['context-match', 'Matches Context'],
    ['context-blocked', 'Blocked / mismatch'],
    ['context-unresolved', 'Unresolved Context'],
    ['no-context', 'No Context'],
]);

export function configureLorecardsPanel(deps = {}) {
    lorecardsPanelDeps = { ...lorecardsPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = lorecardsPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Lorecards panel dependency is not configured: ${name}`);
}

function isBasicExperience() {
    return dep('isBasicExperience', () => false)();
}

function getSettings() {
    return dep('getSettings', () => ({}))();
}

function saveSettings(settings) {
    return dep('saveSettings', () => null)(settings);
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

function createCollapsibleSection(...args) {
    return dep('createCollapsibleSection')(...args);
}

function getSelectedLoreInjectionCount(state, settings) {
    return dep('getSelectedLoreInjectionCount', () => 0)(state, settings);
}

function getPendingLoreBatchLabel(state) {
    const meta = state?.pendingLoreMeta || {};
    const parts = [];
    if (meta.createdAt) parts.push(`Generated ${new Date(meta.createdAt).toLocaleString()}`);
    if (meta.status) parts.push(`status: ${meta.status}`);
    if (meta.generationMode) parts.push(`${meta.generationMode} mode`);
    if (meta.targetEntryCount) parts.push(`target ${meta.targetEntryCount}`);
    if (meta.validEntryCount !== undefined) parts.push(`${meta.validEntryCount} valid`);
    if (meta.rawEntryCount !== undefined) parts.push(`${meta.rawEntryCount} raw`);
    if (meta.normalizedEntryCount !== undefined) parts.push(`${meta.normalizedEntryCount} normalized`);
    if (meta.droppedDuplicateCount) parts.push(`${meta.droppedDuplicateCount} duplicates filtered`);
    if (meta.droppedEntryCount) parts.push(`${meta.droppedEntryCount} dropped`);
    if (meta.chunkCount) parts.push(`${meta.chunkCount} chunks`);
    if (meta.sourceMessageCount) parts.push(`${meta.sourceMessageCount} source messages`);
    return parts.length ? parts.join(' | ') : 'Pending lore batch awaiting review.';
}

function createLoreWorkbenchLaunchRow(mode, summaryText) {
    const row = document.createElement('div');
    row.className = 'saga-lore-workbench-launch-row';
    markTourTarget(row, mode === 'pending' ? 'lore.pending.workbench' : 'lore.accepted.workbench');

    const text = document.createElement('div');
    text.className = 'saga-lore-workbench-launch-text';
    text.textContent = summaryText || (mode === 'pending' ? 'Review Pending Review entries in a larger surface.' : 'Manage Accepted Lorecards in a larger surface.');
    row.appendChild(text);

    const btn = createButton(
        'Open Workbench',
        mode === 'pending'
            ? 'Open a larger Pending Review workspace with dense rows and a detail pane.'
            : 'Open a larger Accepted Lorecards workspace with filters, bulk actions, dense rows, and a detail pane.',
        () => openLoreWorkbench(mode),
        'saga-small-button saga-lore-workbench-open-button'
    );
    row.appendChild(btn);
    return row;
}

function openAdvancedLoreReview(mode = '') {
    setExperienceMode('advanced');
    setPanelState({ activeTab: 'lore' });
    refreshPanelBody({ preserveScroll: false });
    refreshHeader();
    if (mode) openLoreWorkbench(mode);
}

function openLoreWorkbench(mode = 'accepted') {
    loreWorkbenchOpen = true;
    loreWorkbenchMode = mode === 'pending' ? 'pending' : 'accepted';
    ensureLoreWorkbenchSelection(getState());
    renderLoreWorkbench();
}

export function openLayer1Review(revision) {
    if (revision) { const state = getState(); state.layer1ReviewRevision = revision; saveState(state); }
    loreWorkbenchPendingQuery = '';
    setPendingReviewTypeFilter('all');
    setPendingReviewSourceFilter('all');
    openLoreWorkbench('pending');
}

export function closeLoreWorkbench() {
    flushScheduledStateSave();
    loreWorkbenchOpen = false;
    const existing = document.getElementById(LORE_WORKBENCH_ID);
    if (existing) existing.remove();
}

export function refreshLoreWorkbench() {
    if (!loreWorkbenchOpen) return;
    ensureLoreWorkbenchSelection(getState());
    renderLoreWorkbench();
}

function scheduleLoreWorkbenchRefresh() {
    if (loreWorkbenchSearchTimer) clearTimeout(loreWorkbenchSearchTimer);
    loreWorkbenchSearchTimer = setTimeout(() => {
        loreWorkbenchSearchTimer = null;
        refreshLoreWorkbench();
    }, getSearchRenderDebounceMs());
}

function ensureLoreWorkbenchSelection(state = getState()) {
    if (loreWorkbenchMode === 'pending') {
        const rows = getPendingWorkbenchRows(state);
        if (!rows.some(row => getLoreReviewId(row.entry) === loreWorkbenchSelectedId)) {
            loreWorkbenchSelectedId = rows[0] ? getLoreReviewId(rows[0].entry) : '';
        }
        return;
    }

    const accepted = getFilteredLoreEntries(state);
    if (!accepted.some(entry => entry.id === loreWorkbenchSelectedId)) {
        loreWorkbenchSelectedId = accepted[0]?.id || '';
    }
}

function renderLoreWorkbench() {
    if (!loreWorkbenchOpen) return;
    const state = getState();
    ensureLoreWorkbenchSelection(state);

    let overlay = document.getElementById(LORE_WORKBENCH_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = LORE_WORKBENCH_ID;
        overlay.className = 'saga-lore-workbench-overlay';
        overlay.tabIndex = -1;
        wireOverlayBackdropClose(overlay, closeLoreWorkbench);
        overlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeLoreWorkbench();
        });
        document.body.appendChild(overlay);
    }

    const previousTable = overlay.querySelector?.('.saga-lore-workbench-table');
    if (previousTable) loreWorkbenchScrollState[loreWorkbenchMode] = previousTable.scrollTop || 0;

    const focusSelector = loreWorkbenchFocusSelector;
    const focusSnapshot = loreWorkbenchFocusSnapshot;
    loreWorkbenchFocusSelector = '';
    loreWorkbenchFocusSnapshot = null;
    overlay.replaceChildren(createLoreWorkbenchShell(state));
    requestAnimationFrame(() => {
        const focusTarget = focusSelector ? overlay.querySelector(focusSelector) : overlay;
        const restored = focusSelector && restoreTextInputFocus(focusTarget, focusSnapshot, { requirePreviouslyFocused: false });
        if (!restored) focusTarget?.focus?.();
        if (!restored && focusTarget && typeof focusTarget.setSelectionRange === 'function') {
            const len = String(focusTarget.value || '').length;
            focusTarget.setSelectionRange(len, len);
        }
        const table = overlay.querySelector?.('.saga-lore-workbench-table');
        if (table) table.scrollTop = loreWorkbenchScrollState[loreWorkbenchMode] || 0;
    });
}

function createLoreWorkbenchShell(state) {
    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell';
    shell.addEventListener('click', event => event.stopPropagation());

    shell.appendChild(createLoreWorkbenchHeader(state));

    const body = document.createElement('div');
    body.className = 'saga-lore-workbench-body';
    body.appendChild(loreWorkbenchMode === 'pending'
        ? createPendingLoreWorkbenchView(state)
        : createAcceptedLoreWorkbenchView(state));
    shell.appendChild(body);

    return shell;
}

function createLoreWorkbenchHeader(state) {
    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Lore Workbench';
    titleWrap.appendChild(title);

    const acceptedCount = normalizeLoreMatrix(state?.loreMatrix || []).length;
    const pendingCount = normalizeLoreMatrix(state?.pendingLoreEntries || []).length;
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${acceptedCount} accepted | ${pendingCount} pending`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    const modeTabs = document.createElement('div');
    modeTabs.className = 'saga-lore-workbench-mode-tabs';
    for (const [mode, label, count] of [
        ['accepted', 'Accepted', acceptedCount],
        ['pending', 'Pending', pendingCount],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saga-lore-workbench-mode-tab';
        if (loreWorkbenchMode === mode) btn.classList.add('saga-lore-workbench-mode-tab-active');
        btn.textContent = `${label} (${count})`;
        btn.addEventListener('click', () => {
            loreWorkbenchMode = mode;
            loreWorkbenchSelectedId = '';
            ensureLoreWorkbenchSelection(getState());
            renderLoreWorkbench();
        });
        modeTabs.appendChild(btn);
    }
    header.appendChild(modeTabs);

    const close = createButton('Close', 'Close the Lore Workbench.', () => closeLoreWorkbench(), 'saga-small-button saga-lore-workbench-close');
    header.appendChild(close);
    return header;
}

function createAcceptedLoreWorkbenchView(state) {
    const view = document.createElement('div');
    view.className = 'saga-lore-workbench-view saga-lore-workbench-view-accepted';

    view.appendChild(createAcceptedWorkbenchControls(state));

    const bulk = document.createElement('div');
    bulk.className = 'saga-workbench-bulk-toolbar saga-workbench-accepted-bulk-toolbar';
    bulk.appendChild(createAcceptedLoreBulkControls(state));
    view.appendChild(bulk);

    const main = document.createElement('div');
    main.className = 'saga-lore-workbench-main';

    const filtered = getFilteredLoreEntries(state);
    main.appendChild(createAcceptedWorkbenchTable(filtered, state));
    main.appendChild(createAcceptedWorkbenchDetail(filtered, state));
    view.appendChild(main);

    return view;
}

function createAcceptedWorkbenchControls(state) {
    const controls = document.createElement('div');
    controls.className = 'saga-lore-workbench-controls';
    const panelState = state?.lorePanel || {};
    const loreState = getPanelLoreState(state);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'saga-lore-workbench-search';
    search.dataset.workbenchFocus = 'accepted-search';
    search.placeholder = 'Search Accepted Lorecards...';
    search.value = panelState.search || '';
    search.addEventListener('input', () => {
        setPanelState({ search: search.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        loreWorkbenchFocusSelector = '[data-workbench-focus="accepted-search"]';
        loreWorkbenchFocusSnapshot = captureTextInputFocus(search);
        scheduleAcceptedLoreListRender(getPanelRoot());
        scheduleLoreWorkbenchRefresh();
    });
    controls.appendChild(search);

    const category = document.createElement('select');
    category.className = 'saga-lore-workbench-select';
    for (const cat of loreState.categories || ['all']) {
        if (cat === 'pending') continue;
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${getLoreDisplayLabel('category', cat)} (${getCategoryCount(cat, loreState.entries, loreState.counts)})`;
        if ((panelState.selectedCategory || 'all') === cat) opt.selected = true;
        category.appendChild(opt);
    }
    category.addEventListener('change', () => {
        setPanelState({ selectedCategory: category.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreCategoryTabs(category.value);
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(category);

    const source = document.createElement('select');
    source.className = 'saga-lore-workbench-select';
    for (const [value, label] of LORE_SOURCE_FILTER_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if ((panelState.sourceFilter || 'all') === value) opt.selected = true;
        source.appendChild(opt);
    }
    source.addEventListener('change', () => {
        setPanelState({ sourceFilter: source.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(source);

    const acceptedPool = (loreState.entries || []).filter(entry => !entry.isPending);
    const deck = document.createElement('select');
    deck.className = 'saga-lore-workbench-select saga-lore-deck-filter';
    addTooltip(deck, 'Filter Accepted Lorecards by their source Loredeck or entries without deck metadata.');
    for (const [value, label] of getAcceptedLoreDeckFilterOptions(acceptedPool)) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if ((panelState.acceptedDeckFilter || 'all') === value) opt.selected = true;
        deck.appendChild(opt);
    }
    deck.addEventListener('change', () => {
        setPanelState({ acceptedDeckFilter: deck.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(deck);

    const context = document.createElement('select');
    context.className = 'saga-lore-workbench-select saga-lore-context-filter';
    addTooltip(context, 'Filter Accepted Lorecards by Context metadata or Context gate result.');
    for (const [value, label] of getAcceptedLoreContextFilterOptions(acceptedPool)) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if ((panelState.acceptedContextFilter || 'all') === value) opt.selected = true;
        context.appendChild(opt);
    }
    context.addEventListener('change', () => {
        setPanelState({ acceptedContextFilter: context.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(context);

    controls.appendChild(createLoreTypeFilterSelect(
        acceptedPool,
        panelState.loreTypeFilter || 'all',
        (value) => {
            setPanelState({ loreTypeFilter: value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
            refreshLoreWorkbench();
        },
        { className: 'saga-lore-workbench-select', tooltip: 'Filter Accepted Lorecards by relevance, card type, canon/AU, elevation, or mute state.' }
    ));

    const matchingCount = getFilteredLoreEntries(state).length;
    controls.appendChild(createStatusPill(`${matchingCount} matching`, 'Accepted Lorecards matching the current Workbench filters.', {
        tone: matchingCount ? 'selected' : 'muted',
        kind: 'count',
        className: 'saga-lore-workbench-count',
    }));

    return controls;
}

function createAcceptedWorkbenchTable(entries, state) {
    const table = document.createElement('div');
    table.className = 'saga-lore-workbench-table saga-lore-workbench-accepted-table';

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-row saga-lore-workbench-row-header';
    for (const label of ['', 'Title', 'Relevance', 'Source', 'Category', 'Canon', 'Priority', 'Flags']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const visible = entries.slice(0, getLoreWorkbenchRowLimit());
    if (!visible.length) {
        table.appendChild(createEmptyMessage('No Accepted Lorecards match the current filters.'));
        return table;
    }

    const selected = getAcceptedSelectionSet(state);
    for (const entry of visible) {
        const row = document.createElement('div');
        row.className = 'saga-lore-workbench-row saga-lore-workbench-entry-row';
        if (entry.id === loreWorkbenchSelectedId) row.classList.add('saga-lore-workbench-row-active');
        row.addEventListener('click', () => {
            loreWorkbenchSelectedId = entry.id;
            renderLoreWorkbench();
        });

        const checkCell = document.createElement('div');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = selected.has(entry.id);
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            toggleAcceptedLoreSelection(entry.id, check.checked);
            refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
            refreshLoreWorkbench();
        });
        checkCell.appendChild(check);
        row.appendChild(checkCell);

        row.appendChild(createWorkbenchTextCell(entry.title || '(Untitled lore)', entry.fact || ''));
        row.appendChild(createWorkbenchTextCell(RELEVANCE_META[getLifecycleStatus(entry)]?.label || getLifecycleStatus(entry)));
        row.appendChild(createWorkbenchTextCell(getLoreSourceBucketLabel(getLoreSourceBucket(entry))));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('category', entry.category || 'other')));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('canonStatus', entry.canon || entry.canonStatus || 'canon')));
        row.appendChild(createWorkbenchTextCell(`P${Number(entry.priority || 50)}`));
        row.appendChild(createWorkbenchTextCell([
            entry.isElevated ? 'Elevated' : '',
            entry.isSuppressed ? 'Muted' : '',
        ].filter(Boolean).join(', ') || '-'));

        table.appendChild(row);
    }

    if (entries.length > visible.length) {
        const more = document.createElement('div');
        more.className = 'saga-lore-workbench-row-note';
        more.textContent = `Showing first ${visible.length} of ${entries.length} matching entries. Narrow filters or search to reduce the set.`;
        table.appendChild(more);
    }

    return table;
}

function createAcceptedWorkbenchDetail(entries, state) {
    const detail = document.createElement('div');
    detail.className = 'saga-lore-workbench-detail';

    const entry = entries.find(item => item.id === loreWorkbenchSelectedId) || entries[0];
    if (!entry) {
        detail.appendChild(createEmptyMessage('Select an Accepted Lorecard to review it.'));
        return detail;
    }

    const detailState = {
        ...state,
        lorePanel: {
            ...(state?.lorePanel || {}),
            selectedEntryId: entry.id,
        },
    };
    const card = createEntryCard(entry, detailState);
    card.classList.add('saga-lore-workbench-detail-card');
    detail.appendChild(card);
    return detail;
}

function createPendingLoreWorkbenchView(state) {
    const view = document.createElement('div');
    view.className = 'saga-lore-workbench-view saga-lore-workbench-view-pending';

    view.appendChild(createPendingWorkbenchControls(state));

    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    if (pending.length) {
        const bulk = document.createElement('div');
        bulk.className = 'saga-workbench-bulk-toolbar saga-workbench-pending-bulk-toolbar';
        bulk.appendChild(createPendingLoreBulkControls(pending, state));
        view.appendChild(bulk);
    }

    const main = document.createElement('div');
    main.className = 'saga-lore-workbench-main';
    const rows = getPendingWorkbenchRows(state);
    main.appendChild(createPendingWorkbenchTable(rows, state));
    main.appendChild(createPendingWorkbenchDetail(rows, state));
    view.appendChild(main);

    return view;
}

function createPendingWorkbenchControls(state) {
    const controls = document.createElement('div');
    controls.className = 'saga-lore-workbench-controls';
    if (state.layer1ReviewRevision) controls.appendChild(createButton('Show all pending proposals', 'Clear this analysis filter.', () => {
        const current = getState(); delete current.layer1ReviewRevision; saveState(current); refreshLoreWorkbench();
    }, 'saga-small-button'));

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'saga-lore-workbench-search';
    search.dataset.workbenchFocus = 'pending-search';
    search.placeholder = 'Search Pending Review...';
    search.value = loreWorkbenchPendingQuery || '';
    search.addEventListener('input', () => {
        loreWorkbenchPendingQuery = search.value;
        loreWorkbenchFocusSelector = '[data-workbench-focus="pending-search"]';
        loreWorkbenchFocusSnapshot = captureTextInputFocus(search);
        scheduleLoreWorkbenchRefresh();
    });
    controls.appendChild(search);

    const pendingPool = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    controls.appendChild(createLoreTypeFilterSelect(
        pendingPool,
        getPendingReviewTypeFilter(state),
        (value) => {
            setPendingReviewTypeFilter(value);
            loreWorkbenchSelectedId = '';
            refreshLoreWorkbench();
        },
        { className: 'saga-lore-workbench-select', tooltip: 'Filter Pending Review entries by relevance, card type, canon/AU, or review state.' }
    ));
    controls.appendChild(createLoreSourceFilterSelect(
        pendingPool,
        getPendingReviewSourceFilter(state),
        (value) => {
            setPendingReviewSourceFilter(value);
            loreWorkbenchSelectedId = '';
            refreshLoreWorkbench();
        },
        {
            className: 'saga-lore-workbench-select saga-lore-source-filter',
            tooltip: 'Filter Pending Review entries by source: manual notes, story scans, Deck Maker drafts, or Context suggestions.',
            showCounts: true,
        }
    ));

    const rows = getPendingWorkbenchRows(state);
    controls.appendChild(createStatusPill(`${rows.length} matching pending`, 'Pending Review entries matching the current Workbench filters.', {
        tone: rows.length ? 'selected' : 'muted',
        kind: 'count',
        className: 'saga-lore-workbench-count',
    }));

    const selectFiltered = createButton('Select Filtered', 'Select every pending entry matching the current Workbench search, source, and type filters.', () => {
        setPendingReviewSelection(rows.map(row => getLoreReviewId(row.entry)));
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    }, 'saga-small-button');
    controls.appendChild(selectFiltered);

    const clear = createButton('Clear Selection', 'Clear Pending Review selection.', () => {
        clearPendingReviewSelection();
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    }, 'saga-small-button');
    controls.appendChild(clear);

    return controls;
}

function createPendingWorkbenchTable(rows, state) {
    const table = document.createElement('div');
    table.className = 'saga-lore-workbench-table saga-lore-workbench-pending-table';

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-row saga-lore-workbench-row-header';
    for (const label of ['', 'Title', 'Source', 'Operation', 'Route', 'Category', 'Canon', 'Priority']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const visible = rows.slice(0, getLoreWorkbenchRowLimit());
    if (!visible.length) {
        table.appendChild(createEmptyMessage('No Pending Review entries match the current filters.'));
        return table;
    }

    const selected = getPendingReviewSelectedIds(state);
    for (const rowInfo of visible) {
        const entry = rowInfo.entry;
        const reviewId = getLoreReviewId(entry);
        const generation = entry.extensions?.sagaGeneration || {};
        const reviewMeta = entry.extensions?.sagaPendingReview || {};
        const row = document.createElement('div');
        row.className = 'saga-lore-workbench-row saga-lore-workbench-entry-row';
        if (reviewId === loreWorkbenchSelectedId) row.classList.add('saga-lore-workbench-row-active');
        row.addEventListener('click', () => {
            loreWorkbenchSelectedId = reviewId;
            renderLoreWorkbench();
        });

        const checkCell = document.createElement('div');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = selected.has(reviewId);
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            togglePendingReviewSelection(reviewId, check.checked);
            refreshPanelBody({ preserveScroll: true });
            refreshLoreWorkbench();
        });
        checkCell.appendChild(check);
        row.appendChild(checkCell);

        row.appendChild(createWorkbenchTextCell(entry.title || '(Untitled Pending Review entry)', entry.fact || ''));
        row.appendChild(createWorkbenchTextCell(getLoreSourceBucketLabel(getLoreSourceBucket(entry))));
        row.appendChild(createWorkbenchTextCell(generation.operation || reviewMeta.reviewRoute || 'create'));
        row.appendChild(createWorkbenchTextCell(generation.similarityRoute || reviewMeta.reviewRoute || '-'));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('category', entry.category || 'other')));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('canonStatus', entry.canon || entry.canonStatus || 'canon')));
        row.appendChild(createWorkbenchTextCell(`P${Number(entry.priority || 50)}`));
        table.appendChild(row);
    }

    if (rows.length > visible.length) {
        const more = document.createElement('div');
        more.className = 'saga-lore-workbench-row-note';
        more.textContent = `Showing first ${visible.length} of ${rows.length} matching Pending Review entries. Narrow filters or search to reduce the set.`;
        table.appendChild(more);
    }
    return table;
}

function createPendingWorkbenchDetail(rows, state) {
    const detail = document.createElement('div');
    detail.className = 'saga-lore-workbench-detail';

    const selected = rows.find(row => getLoreReviewId(row.entry) === loreWorkbenchSelectedId) || rows[0];
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select a Pending Review entry to inspect it.'));
        return detail;
    }
    detail.appendChild(createPendingLoreReviewCard(selected.entry, selected.index, isPendingLoreSelected(state, selected.entry)));
    return detail;
}

function getPendingWorkbenchRows(state = getState()) {
    const pending = getFilteredPendingLoreRows(state);
    const query = String(loreWorkbenchPendingQuery || '').trim().toLowerCase();
    const rows = pending;
    if (!query) return rows;
    return rows
        .map(row => ({ ...row, score: scoreSearchEntry(row.entry, query) }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score || String(a.entry.title || '').localeCompare(String(b.entry.title || '')));
}

function getPendingReviewTypeFilter(state = getState()) {
    return String(state?.lorePanel?.pendingReviewTypeFilter || 'all');
}

function setPendingReviewTypeFilter(value = 'all') {
    setPanelState({ pendingReviewTypeFilter: value || 'all', pendingReviewVisibleLimit: 10 }, { deferSave: true });
}

function getPendingReviewSourceFilter(state = getState()) {
    return String(state?.lorePanel?.pendingSourceFilter || 'all');
}

function setPendingReviewSourceFilter(value = 'all') {
    setPanelState({ pendingSourceFilter: value || 'all', pendingReviewVisibleLimit: 10 }, { deferSave: true });
}

function createLoreSourceFilterSelect(entries = [], selectedValue = 'all', onChange = () => {}, options = {}) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const select = document.createElement('select');
    select.className = options.className || 'saga-lore-source-filter';
    if (options.tooltip) addTooltip(select, options.tooltip);
    for (const [value, label] of LORE_SOURCE_FILTER_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = value;
        const count = value === 'all'
            ? safeEntries.length
            : safeEntries.filter(entry => getLoreSourceBucket(entry) === value).length;
        opt.textContent = options.showCounts ? `${label} (${count})` : label;
        if ((selectedValue || 'all') === value) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange(select.value));
    return select;
}

function getFilteredPendingLoreRows(state = getState(), options = {}) {
    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const typeFilter = getPendingReviewTypeFilter(state);
    const sourceFilter = getPendingReviewSourceFilter(state);
    const lifecycleStage = normalizeLorecardLifecycleStage(options.lifecycleStage);
    return pending
        .map((entry, index) => ({ entry, index }))
        .filter(row => !state.layer1ReviewRevision || row.entry.extensions?.layer1?.revision === state.layer1ReviewRevision)
        .filter(row => lifecycleStage !== 'suggested' || isSuggestedPendingLore(row.entry))
        .filter(row => lifecycleStage !== 'pending' || !isSuggestedPendingLore(row.entry))
        .filter(row => sourceFilter === 'all' || getLoreSourceBucket(row.entry) === sourceFilter)
        .filter(row => entryMatchesLoreTypeFilter(row.entry, typeFilter));
}

function createWorkbenchTextCell(primary, secondary = '') {
    const cell = document.createElement('div');
    cell.className = 'saga-lore-workbench-cell';
    const main = document.createElement('span');
    main.className = 'saga-lore-workbench-cell-main';
    main.textContent = primary || '-';
    cell.appendChild(main);
    if (secondary) {
        const sub = document.createElement('span');
        sub.className = 'saga-lore-workbench-cell-sub';
        sub.textContent = truncateText(secondary, 150);
        cell.appendChild(sub);
    }
    return cell;
}

function getLoreSourceBucketLabel(bucket) {
    if (bucket === 'layer1') return 'Canon consequence';
    if (bucket === 'canon-db') return 'Canon DB';
    if (bucket === 'story-generation') return 'Story Scan';
    if (bucket === 'creator') return 'Deck Maker';
    if (bucket === 'context-suggestion') return 'Context';
    if (bucket === 'manual') return 'Manual';
    return 'Other';
}

export function createPendingLoreBulkControls(pendingLore, state) {
    if (state.layer1ReviewRevision) pendingLore = pendingLore.filter(entry => entry.extensions?.layer1?.revision === state.layer1ReviewRevision);
    const selectedIds = getPendingReviewSelectedIds(state);
    const pendingRows = pendingLore.map((entry, index) => ({ entry, index, id: getLoreReviewId(entry) })).filter(row => row.id);
    const pendingIds = pendingRows.map(row => row.id);
    const selectedCount = pendingIds.filter(id => selectedIds.has(id)).length;

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-review-bulk-card';

    const header = document.createElement('label');
    header.className = 'saga-review-select-all';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.checked = selectedCount > 0 && selectedCount === pendingIds.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < pendingIds.length;
    addTooltip(selectAll, 'Select or clear all Pending Review entries in this batch.');
    selectAll.addEventListener('change', () => {
        setPendingReviewSelection(selectAll.checked ? pendingIds : []);
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    });
    header.appendChild(selectAll);
    const label = document.createElement('span');
    label.textContent = selectedCount ? `${selectedCount} of ${pendingIds.length} selected` : `Select all ${pendingIds.length} Pending Review entries`;
    header.appendChild(label);
    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Accept Selected', 'Accepts only the selected Pending Review entries. Use Select All for large batches.', () => {
        applySelectedPendingLore(pendingIds);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reject Selected', 'Rejects only the selected Pending Review entries.', () => {
        dismissSelectedPendingLore(pendingIds);
    }));
    actions.appendChild(createButton('Accept All', 'Accepts every Pending Review entry in the current batch after confirmation.', async () => {
        const proceed = await confirmAction(
            'Accept all Pending Review entries?',
            `Accept all ${pendingIds.length} Pending Review entr${pendingIds.length === 1 ? 'y' : 'ies'} in this batch? Use Accept Selected when you only want chosen items.`
        );
        if (!proceed) return;
        applyPendingLoreEntriesByReviewIds(pendingIds, { preserveScroll: false });
    }));
    actions.appendChild(createButton('Reject All', 'Rejects every Pending Review entry in the current batch after confirmation.', async () => {
        const proceed = await confirmAction(
            'Reject all Pending Review entries?',
            `Reject all ${pendingIds.length} Pending Review entr${pendingIds.length === 1 ? 'y' : 'ies'} in this batch? Use Reject Selected when you only want chosen items.`
        );
        if (!proceed) return;
        dismissPendingLoreEntriesByReviewIds(pendingIds, { preserveScroll: false });
    }));
    card.appendChild(actions);

    return card;
}


function getPendingLoreTargetEntry(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    const targetId = generation.targetEntryId || reviewMeta.targetEntryId || '';
    if (!targetId) return null;
    return normalizeLoreMatrix(getState()?.loreMatrix || []).find(item => item.id === targetId) || null;
}

function getPendingLoreSuggestionReason(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    const reason = generation.qualityReason
        || reviewMeta.qualityReason
        || generation.similarityReason
        || reviewMeta.similarityReason
        || generation.reason
        || reviewMeta.reason
        || entry.notes;
    if (reason) return truncateText(reason, 220);

    const source = getReadableEntrySource(entry);
    if (source?.tooltip) return truncateText(source.tooltip, 220);
    const sourceBucket = getLoreSourceBucket(entry);
    if (sourceBucket === 'manual') return 'Manual note waiting for review before it becomes an Accepted Lorecard.';
    if (sourceBucket === 'canon-db') return 'Canon database suggestion waiting for review.';
    if (sourceBucket === 'creator') return 'Deck Maker Lorecard draft waiting for review before it becomes an Accepted Lorecard.';
    if (sourceBucket === 'context-suggestion') return 'Context-aware suggestion waiting for review before it becomes an Accepted Lorecard.';
    return 'Generated story Lorecard waiting for review.';
}

function getPendingLoreSimilarSummary(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    const target = getPendingLoreTargetEntry(entry);
    if (target) {
        return truncateText(`${target.title || target.id}${target.fact ? ` - ${target.fact}` : ''}`, 220);
    }
    const route = generation.similarityRoute || reviewMeta.reviewRoute || '';
    const reason = generation.similarityReason || reviewMeta.similarityReason || '';
    if (route || reason) {
        return [route ? humanizeScopeKey(route) : '', reason].filter(Boolean).join(' - ');
    }
    return 'No routed duplicate or accepted-card target was attached.';
}

function getPendingLoreReviewStateDescriptors(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    const routeText = [
        generation.operation,
        generation.similarityRoute,
        reviewMeta.reviewRoute,
        generation.similarityReason,
        reviewMeta.similarityReason,
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean).join(' ');
    const targetId = generation.targetEntryId || reviewMeta.targetEntryId || '';
    const contextGate = getEntryContextGateMeta(entry);
    const descriptors = [];

    if (routeText.includes('conflict') || getContextGateTone(contextGate) === 'danger') {
        descriptors.push({
            key: 'conflict',
            label: 'Conflict',
            tone: 'danger',
            tooltip: generation.similarityReason || reviewMeta.similarityReason || contextGate.reason || 'This Pending Review entry may contradict an Accepted Lorecard or current Context gate.',
        });
    }

    if (targetId || /\b(duplicate|similar|update|merge|supersede|overlap)\b/.test(routeText)) {
        descriptors.push({
            key: 'duplicate',
            label: targetId ? 'Duplicate route' : 'Duplicate',
            tone: 'warning',
            tooltip: getPendingLoreSimilarSummary(entry),
        });
    }

    const confidence = Number(entry.confidence);
    if (Number.isFinite(confidence) && confidence < 0.75) {
        descriptors.push({
            key: 'low-confidence',
            label: `Low confidence ${Math.round(confidence * 100)}%`,
            tone: 'warning',
            tooltip: 'Review this lower-confidence Pending Review entry before accepting it.',
        });
    }

    return descriptors;
}

function appendPendingLoreReviewStateChips(meta, entry = {}, onInspect = () => {}) {
    for (const descriptor of getPendingLoreReviewStateDescriptors(entry)) {
        const chip = createChip({
            label: descriptor.label,
            tooltip: `${descriptor.tooltip || 'Open details for this Pending Review entry.'} Tap to inspect details.`,
            kind: 'severity',
            tone: descriptor.tone,
            density: 'compact',
            interactive: true,
            className: 'saga-pending-review-state-chip',
        });
        chip.dataset.pendingReviewState = descriptor.key;
        chip.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onInspect();
        });
        chip.addEventListener('mousedown', event => event.stopPropagation());
        meta.appendChild(chip);
    }
}

function getPendingLoreDestinationSummary(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    const targetId = generation.targetEntryId || reviewMeta.targetEntryId || '';
    const target = getPendingLoreTargetEntry(entry);
    if (target) return `Update Accepted Lorecard: ${target.title || target.id}`;
    if (targetId) return `Update Accepted Lorecard id: ${targetId}`;
    const operation = String(generation.operation || reviewMeta.reviewRoute || '').trim();
    if (operation && !/create|manual_pending/i.test(operation)) return `Accepted Lorecards (${humanizeScopeKey(operation)})`;
    return 'New Accepted Lorecard';
}

function createPendingLoreDetailSummary(entry = {}) {
    const detail = document.createElement('div');
    detail.className = 'saga-pending-lore-detail-summary';
    const contextSummary = formatEntryContextSummary(entry) || 'No Context gate or story-position metadata was attached.';
    const rows = [
        ['Fact', truncateText(entry.fact || '(No fact text)', 260), 'Pending Review fact that will be accepted, edited, or rejected.'],
        ['Why suggested', getPendingLoreSuggestionReason(entry), 'Generator or source reason for why this candidate entered Pending Review.'],
        ['Affected Context', contextSummary, 'Context, scope, or story-position metadata that constrains this Pending Review entry.'],
        ['Similar existing cards', getPendingLoreSimilarSummary(entry), 'Existing Accepted Lorecard target or duplicate-routing result.'],
        ['Destination', getPendingLoreDestinationSummary(entry), 'Where this Pending Review entry will go if accepted.'],
    ];
    for (const [label, value, tooltip] of rows) {
        detail.appendChild(createKeyValue(label, value, tooltip));
    }
    return detail;
}

export function createPendingLoreReviewCard(entry, index, selected = false, options = {}) {
    const basicReview = !!options.basicReview;
    const workspaceRow = options.workspaceRow === true;
    const allowSelection = workspaceRow ? false : (!basicReview || options.allowSelection === true);
    const reviewId = getLoreReviewId(entry);
    const editId = entry.id || reviewId;
    const editing = (!workspaceRow) && getState()?.lorePanel?.selectedEntryId === editId;
    const card = document.createElement('div');
    card.className = 'saga-lore-entry-card saga-lore-entry-pending saga-pending-review-entry-card';
    markTourTarget(card, 'lore.pending.entry');
    if (selected) card.classList.add('saga-review-lore-card-selected');
    if (basicReview) card.classList.add('saga-basic-review-entry-card');

    const inspectPendingEntry = () => {
        loreWorkbenchSelectedId = reviewId;
        if (basicReview) openAdvancedLoreReview('pending');
        else openLoreWorkbench('pending');
    };

    if (workspaceRow) {
        card.addEventListener('click', (event) => {
            if (event.target?.closest?.('button, input, select, textarea, label, a')) return;
            setPanelState({ selectedEntryId: editId }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true });
            refreshLoreWorkbench();
        });
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'saga-lore-entry-header';
    if (allowSelection) headerRow.appendChild(createPendingLoreCheckbox(entry, selected));

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-entry-title-wrap';
    const title = document.createElement('span');
    title.className = 'saga-lore-entry-title';
    title.textContent = entry.title || `Pending lore ${index + 1}`;
    addTooltip(title, 'Generated lore entry title. This entry is pending until accepted.');
    titleWrap.appendChild(title);
    headerRow.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-lore-entry-actions';
    if (!basicReview && !workspaceRow) actions.appendChild(createEditableRelevanceControl(entry, { pending: true }));
    const status = createBadge('pending', 'This lore entry has not been accepted into Accepted Lorecards yet.', { tone: 'review', kind: 'status' });
    actions.appendChild(status);
    headerRow.appendChild(actions);
    card.appendChild(headerRow);

    const meta = document.createElement('div');
    meta.className = 'saga-lore-entry-meta';
    meta.appendChild(createRegistryBadge('category', entry.category || 'other', `Category: ${entry.category || 'other'}. Pending cards use the same compact metadata style as accepted cards.`));
    meta.appendChild(createLorePurposeBadge(entry));
    meta.appendChild(createRegistryBadge('canonStatus', entry.canon || entry.canonStatus || 'canon', `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}.`));
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    if (!basicReview) {
        appendEntrySourceAndContextBadges(meta, entry);
        meta.appendChild(createBadge(`P${Number(entry.priority || 50)}`, 'Priority used for sorting, injection preference, and canon-lore suggestion limits.', { tone: 'relevance', kind: 'metadata' }));
        if (generation.operation) meta.appendChild(createBadge(`Op: ${generation.operation}`, 'Generated lore operation proposed by the story-lore scan.', { tone: 'source', kind: 'source', maxChars: 34 }));
    }
    appendPendingLoreReviewStateChips(meta, entry, inspectPendingEntry);
    if (!basicReview) {
        if (generation.qualityRoute || reviewMeta.qualityRoute) meta.appendChild(createBadge(`Quality: ${generation.qualityRoute || reviewMeta.qualityRoute}`, generation.qualityReason || reviewMeta.qualityReason || 'Generated-lore quality route.', { tone: 'warning', kind: 'severity', maxChars: 34 }));
        if (generation.similarityRoute || reviewMeta.reviewRoute) meta.appendChild(createBadge(`Route: ${generation.similarityRoute || reviewMeta.reviewRoute}`, generation.similarityReason || reviewMeta.similarityReason || 'Similarity/update routing result.', { tone: 'source', kind: 'source', maxChars: 34 }));
    }
    if (generation.recommendedPin) meta.appendChild(createBadge('elevate suggested', 'Generator recommends elevating/protecting this entry after acceptance.', { tone: 'success', kind: 'status' }));
    if (generation.recommendedMute) meta.appendChild(createBadge('mute suggested', 'Generator recommends storing but muting this entry after acceptance.', { tone: 'muted', kind: 'status' }));
    if (!basicReview) {
        meta.appendChild(createSpellMetadataBadges(entry));
    }
    if ((!basicReview) && entry.confidence !== undefined) meta.appendChild(createBadge(`confidence ${entry.confidence}`, 'Model-provided confidence for this entry.', { tone: Number(entry.confidence) >= 0.75 ? 'success' : 'warning', kind: 'metadata' }));
    card.appendChild(meta);

    const targetId = generation.targetEntryId || reviewMeta.targetEntryId || '';
    const target = getPendingLoreTargetEntry(entry);
    const destinationBox = document.createElement('div');
    destinationBox.className = 'saga-runtime-help saga-pending-target-help';
    destinationBox.textContent = `Destination: ${basicReview && targetId
        ? 'Updates an Accepted Lorecard if accepted.'
        : getPendingLoreDestinationSummary(entry)}`;
    addTooltip(destinationBox, basicReview && targetId
        ? 'Advanced Lorecards shows the routed target and similarity details.'
        : target
        ? generation.similarityReason || reviewMeta.similarityReason || 'Accepting this candidate will update or merge into the target if it still exists and is not locked.'
        : 'Accepting this candidate creates a new Accepted Lorecard.');
    card.appendChild(destinationBox);

    if (!workspaceRow && Array.isArray(entry.tags) && entry.tags.length && shouldShowLorecardListTags()) {
        const tags = createReadOnlyTags(entry.tags);
        tags.classList.add('saga-pending-readonly-tags');
        card.appendChild(tags);
    }

    const fact = document.createElement('div');
    fact.className = 'saga-lore-entry-fact';
    fact.textContent = entry.fact || '(No fact text)';
    addTooltip(fact, 'The fact that will be merged into Accepted Lorecards if accepted.');
    card.appendChild(fact);

    if (!basicReview && entry.content?.injection && entry.content.injection !== entry.fact) {
        const injection = document.createElement('div');
        injection.className = 'saga-runtime-help saga-pending-injection-preview';
        injection.textContent = `Injection: ${entry.content.injection}`;
        addTooltip(injection, 'Model-facing lore text that will be injected after acceptance.');
        card.appendChild(injection);
    }
    if (!basicReview && Array.isArray(entry.content?.constraints) && entry.content.constraints.length) {
        const constraints = document.createElement('div');
        constraints.className = 'saga-runtime-help saga-pending-constraints-preview';
        constraints.textContent = `Constraints: ${entry.content.constraints.join(' ')}`;
        addTooltip(constraints, 'Specific constraints captured by generated lore.');
        card.appendChild(constraints);
    }

    {
        const actionsRow = document.createElement('div');
        actionsRow.className = 'saga-primary-actions saga-pending-entry-actions';
        markTourTarget(actionsRow, 'lore.pending.actions');
        actionsRow.appendChild(createButton('Accept', targetId ? 'Accepts this generated update and merges it into the targeted Accepted Lorecard.' : 'Accepts this Pending Review entry and merges it into Accepted Lorecards.', () => {
            acceptPendingLoreEntry(index);
            togglePendingReviewSelection(getLoreReviewId(entry), false);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            refreshLoreWorkbench();
        }, 'saga-primary-button'));
        actionsRow.appendChild(createButton('Reject', 'Rejects this Pending Review entry without changing Accepted Lorecards.', () => {
            rejectPendingLoreEntry(index);
            togglePendingReviewSelection(getLoreReviewId(entry), false);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            refreshLoreWorkbench();
        }));
        card.appendChild(actionsRow);
    }

    if (editing) {
        const details = document.createElement('div');
        details.className = 'saga-lore-entry-details saga-pending-lore-edit-details';
        details.appendChild(createPendingLoreDetailSummary(entry));
        details.appendChild(createEditableLoreEntryEditor(entry, { basicReview, pendingReview: true }));
        card.appendChild(details);
    }

    return card;
}

function createPendingLoreCheckbox(entry, checked) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'saga-review-lore-checkbox saga-lore-entry-select';
    checkbox.checked = checked;
    addTooltip(checkbox, checked ? 'Remove this lore entry from the current bulk selection.' : 'Add this lore entry to the current bulk selection.');
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => {
        togglePendingReviewSelection(getLoreReviewId(entry), checkbox.checked);
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    });
    return checkbox;
}

function createReadOnlyTags(tags) {
    const row = document.createElement('div');
    row.className = 'saga-lore-entry-tags';
    for (const tag of tags) {
        const chip = createChip({
            label: '',
            tooltip: `Lorecard tag: ${tag}`,
            kind: 'tag',
            tone: 'tag',
            density: 'compact',
            className: 'saga-lore-tag-chip',
        });
        const label = document.createElement('span');
        label.className = 'saga-lore-tag-label';
        label.textContent = tag;
        chip.appendChild(label);
        row.appendChild(chip);
    }
    return row;
}

function getLifecycleStatus(entry) {
    return getLoreEntryEffectiveRelevance(entry, getState());
}

function getBaseLorecardRelevance(entry = {}) {
    return entry.baseRelevance ? normalizeLoreRelevance(entry.baseRelevance) : getLoreEntryBaseRelevance(entry);
}

function isElevatedLorecardEntry(entry = {}, state = getState()) {
    return entry.isElevated === true || isLoreEntryElevated(state, entry.id);
}

function getEntryCanonStatus(entry = {}) {
    return String(entry.canon || entry.canonStatus || 'canon').trim().toLowerCase();
}

function getEntryCategoryText(entry = {}) {
    return [
        entry.category,
        entry.kind,
        entry.gateType,
        entry.lorePurpose,
        entry.purpose,
    ].map(value => String(value || '').trim().toLowerCase()).join(' ');
}

function entryMatchesLoreTypeFilter(entry = {}, filter = 'all') {
    const value = String(filter || 'all').trim().toLowerCase();
    if (!value || value === 'all') return true;
    if (value === 'high' || value === 'normal' || value === 'low') return getLifecycleStatus(entry) === value;
    if (value === 'canon' || value === 'au') return getEntryCanonStatus(entry) === value;
    if (value === 'elevated' || value === 'pinned') return !!entry.isElevated || !!entry.isPinned;
    if (value === 'muted') return !!entry.isSuppressed || !!entry.suppressed || !!entry.muted;

    const categoryText = getEntryCategoryText(entry);
    if (value === 'future_guard') {
        return categoryText.includes('future_guard')
            || categoryText.includes('future guard')
            || categoryText.includes('leak')
            || normalizeLorePurpose(entry.lorePurpose || entry.purpose, entry) === 'negative_constraint';
    }
    if (value === 'item') return ['item', 'artifact', 'object'].some(term => categoryText.includes(term));
    if (value === 'location') return ['location', 'place', 'setting'].some(term => categoryText.includes(term));
    if (value === 'spell') return ['spell', 'ability', 'skill'].some(term => categoryText.includes(term));
    if (value === 'rule') return ['rule', 'system', 'constraint'].some(term => categoryText.includes(term));
    return categoryText.split(/\s+/).includes(value) || categoryText.includes(value);
}

function getLoreEntryTypeFilterOptions(entries = []) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return LORE_ENTRY_TYPE_FILTERS.map(([value, label]) => [
        value,
        value === 'all'
            ? `${label} (${safeEntries.length})`
            : `${label} (${safeEntries.filter(entry => entryMatchesLoreTypeFilter(entry, value)).length})`,
    ]);
}

function createLoreTypeFilterSelect(entries, value, onChange, options = {}) {
    const select = document.createElement('select');
    select.className = options.className || 'saga-lore-type-filter';
    addTooltip(select, options.tooltip || 'Filter Lorecards by relevance tier, category, canon/AU status, or injection flag.');
    const active = String(value || 'all');
    for (const [filterValue, label] of getLoreEntryTypeFilterOptions(entries)) {
        const opt = document.createElement('option');
        opt.value = filterValue;
        opt.textContent = label;
        if (active === filterValue) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange?.(select.value));
    return select;
}

function getLoreFieldRegistry(field) {
    if (field === 'category') return 'categories';
    if (field === 'canonStatus') return 'canonStatuses';
    if (field === 'truthStatus') return 'truthStatuses';
    if (field === 'revealPolicy') return 'revealPolicies';
    return '';
}

function getLoreRegistryMeta(registryName, value) {
    return dep('getLoreRegistryMeta', () => null)(registryName, value);
}

function getLoreRegistryChipTone(field, value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (field === 'category') return 'category';
    if (field === 'relevance') return 'relevance';
    if (field === 'canon' || field === 'canonStatus') return normalized === 'canon' ? 'success' : 'warning';
    if (field === 'truthStatus') {
        if (normalized === 'true') return 'success';
        if (normalized === 'false') return 'danger';
        if (normalized === 'hidden' || normalized === 'unknown') return 'muted';
        return 'warning';
    }
    if (field === 'revealPolicy') {
        if (normalized === 'public') return 'success';
        if (normalized === 'do_not_reveal') return 'danger';
        if (normalized === 'private' || normalized === 'hidden') return 'muted';
        return 'warning';
    }
    return 'info';
}

function applyManualChipSchema(el, { tone = 'neutral', kind = 'metadata', density = 'compact' } = {}) {
    if (!el) return el;
    el.classList.add('saga-chip', `saga-chip-kind-${kind}`, `saga-chip-tone-${tone}`, `saga-chip-density-${density}`);
    el.dataset.sagaChipKind = kind;
    el.dataset.sagaChipTone = tone;
    el.dataset.sagaChipDensity = density;
    return el;
}

function updateEntryRelevanceFromSegment(entry, nextValue, options = {}) {
    const nextRelevance = normalizeLoreRelevance(nextValue || 'normal');
    updateLoreEntryById(entry.id, raw => ({
        ...raw,
        relevance: nextRelevance,
        lifecycle: {
            ...(raw.lifecycle || {}),
            status: '',
            computedStatus: '',
            manualOverride: false,
            reason: `Relevance manually set to ${nextRelevance}.`,
            lastEvaluatedAt: Date.now(),
        },
        extensions: {
            ...(raw.extensions || {}),
            autoRelevance: {
                ...(raw.extensions?.autoRelevance || {}),
                mode: 'manual',
                confidence: 1,
                reason: `User manually set relevance to ${nextRelevance}.`,
                updatedAt: Date.now(),
            },
        },
    }), { deferSave: true, loreAutomationDisableReason: LORE_AUTOMATION_MANUAL_DISABLE_REASONS.relevance });
    if (options.pending) refreshPanelBody({ preserveScroll: true });
    else {
        refreshAcceptedLoreSurfaces(entry.id, { sortSensitive: true });
        return;
    }
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function createRelevanceDotIcon(tier) {
    const icon = document.createElement('span');
    icon.className = `saga-lore-relevance-dots saga-lore-relevance-dots-${tier}`;
    icon.setAttribute('aria-hidden', 'true');
    const count = tier === 'high' ? 3 : tier === 'normal' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
        const dot = document.createElement('span');
        dot.className = 'saga-lore-relevance-dot';
        icon.appendChild(dot);
    }
    return icon;
}

function createEditableRelevanceControl(entry, options = {}) {
    const value = getLifecycleStatus(entry);
    const elevated = isElevatedLorecardEntry(entry);
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-relevance-segmented';
    if (elevated) wrap.classList.add('saga-lore-relevance-segmented-elevated');
    wrap.dataset.sagaRelevance = value;
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', 'Lore relevance');
    wrap.addEventListener('click', e => e.stopPropagation());
    wrap.addEventListener('mousedown', e => e.stopPropagation());

    const setTier = (tier, event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (elevated) return;
        const nextRelevance = normalizeLoreRelevance(tier);
        if (nextRelevance === value) return;
        updateEntryRelevanceFromSegment(entry, nextRelevance, options);
    };

    for (const tier of RELEVANCE_SEGMENT_ORDER) {
        const meta = RELEVANCE_META[tier] || RELEVANCE_META.normal;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'saga-lore-relevance-segment';
        button.dataset.relevance = tier;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-label', `${meta.label} Relevance`);
        button.setAttribute('aria-checked', tier === value ? 'true' : 'false');
        button.disabled = elevated;
        button.tabIndex = elevated ? -1 : (tier === value ? 0 : -1);
        addTooltip(button, elevated
            ? 'Elevated temporarily forces High relevance. Remove Elevation to edit the stored relevance tier.'
            : `${meta.label} Relevance: ${meta.tooltip}`);
        button.appendChild(createRelevanceDotIcon(tier));
        button.addEventListener('click', event => setTier(tier, event));
        button.addEventListener('keydown', event => {
            const currentIndex = RELEVANCE_SEGMENT_ORDER.indexOf(value);
            const fallbackIndex = currentIndex >= 0 ? currentIndex : RELEVANCE_SEGMENT_ORDER.indexOf('normal');
            let nextIndex = fallbackIndex;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextIndex = Math.max(0, fallbackIndex - 1);
            else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextIndex = Math.min(RELEVANCE_SEGMENT_ORDER.length - 1, fallbackIndex + 1);
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = RELEVANCE_SEGMENT_ORDER.length - 1;
            else if (event.key === 'Enter' || event.key === ' ') return setTier(tier, event);
            else return;
            setTier(RELEVANCE_SEGMENT_ORDER[nextIndex], event);
        });
        wrap.appendChild(button);
    }

    return wrap;
}

function createRegistryBadge(field, value, tooltip = '') {
    const label = getLoreDisplayLabel(field, value);
    const badge = createBadge(label, tooltip || `${field}: ${label}. Expand the entry to edit.`, {
        tone: getLoreRegistryChipTone(field, value),
        kind: 'metadata',
        maxChars: 32,
    });
    badge.classList.add('saga-lore-registry-badge');
    return badge;
}

function createLorePurposeBadge(entry) {
    const purpose = normalizeLorePurpose(entry?.lorePurpose || entry?.purpose, entry) || 'unspecified';
    const label = LORE_PURPOSE_LABELS[purpose] || String(purpose || 'unspecified').replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    return createBadge(`Purpose: ${label}`, 'Lore purpose explains why this is specific Saga lore rather than a generic reference fact.', { tone: 'info', kind: 'metadata', maxChars: 42 });
}

function getLoredeckDisplayName(packId) {
    return dep('getLoredeckDisplayName', value => String(value || ''))(packId);
}

function cleanLoreChipText(value, maxLength = 160) {
    return truncateText(String(value ?? '').trim(), maxLength);
}

function getEntrySourceSearchText(entry = {}) {
    const sourceInfo = isPlainObjectValue(entry.sourceInfo) ? entry.sourceInfo : {};
    const generation = isPlainObjectValue(entry.extensions?.sagaGeneration) ? entry.extensions.sagaGeneration : {};
    const reviewMeta = isPlainObjectValue(entry.extensions?.sagaPendingReview) ? entry.extensions.sagaPendingReview : {};
    const manualDraft = isPlainObjectValue(entry.extensions?.sagaManualDraft) ? entry.extensions.sagaManualDraft : {};
    return [
        entry.source,
        entry.id,
        sourceInfo.id,
        sourceInfo.source,
        sourceInfo.kind,
        sourceInfo.type,
        sourceInfo.route,
        sourceInfo.notes,
        generation.mode,
        generation.operation,
        generation.batchId,
        generation.chunkId,
        reviewMeta.reviewRoute,
        reviewMeta.source,
        manualDraft.reviewRoute,
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean).join(' | ');
}

function getLoreSourceOriginMeta(entry = {}) {
    if (entry.extensions?.layer1) return { bucket: 'layer1', label: 'Source: Canon consequence', tooltip: 'Unsupported consequence awaiting user approval; its source basis is revision-checked.' };
    const sourceText = getEntrySourceSearchText(entry);
    const userEdited = !!entry?.userEdited;
    if (/loredeck_creator|creator lorecard|creator draft|creator_entry|creator entry/.test(sourceText)) {
        return {
            bucket: 'creator',
            label: 'Source: Deck Maker',
            tooltip: 'Deck Maker Lorecard draft sent into Pending Review.',
        };
    }
    if (/context[_ -]?(suggest|proposal|resolver|resolution)|context suggestion|context proposal/.test(sourceText)) {
        return {
            bucket: 'context-suggestion',
            label: 'Source: Context Suggestion',
            tooltip: 'Context-aware suggestion sent into Pending Review.',
        };
    }
    if (/canon-lore-db|canon database|canon_db_|_canon_/.test(sourceText)) {
        return {
            bucket: 'canon-db',
            label: 'Source: Canon DB',
            tooltip: 'Suggested from Saga canon Loredeck retrieval.',
        };
    }
    if (/manual|manual_pending/.test(sourceText) || userEdited) {
        return {
            bucket: 'manual',
            label: 'Source: Manual Note',
            tooltip: 'Manual Lore note waiting for review.',
        };
    }
    if (/model-generated|story|lore-generator|bulk|scan/.test(sourceText)) {
        return {
            bucket: 'story-generation',
            label: 'Source: Story Scan',
            tooltip: 'Generated by story-lore scan.',
        };
    }
    return {
        bucket: 'story-generation',
        label: '',
        tooltip: '',
    };
}

function getEntrySagaLoredeckMeta(entry = {}) {
    const raw = isPlainObjectValue(entry.extensions?.sagaLoredeck) ? entry.extensions.sagaLoredeck : {};
    const sourceInfo = isPlainObjectValue(entry.sourceInfo) ? entry.sourceInfo : {};
    const packId = cleanLoreChipText(raw.packId || entry.packId || entry.loredeckId || sourceInfo.packId, 120);
    const fallbackTitle = packId ? getLoredeckDisplayName(packId) : '';
    return {
        packId,
        packType: cleanLoreChipText(raw.packType, 40),
        packTitle: cleanLoreChipText(raw.packTitle || fallbackTitle, 180),
        file: cleanLoreChipText(raw.file || entry.sagaLoredeckSourceFile, 240),
        stackPriority: Number.isFinite(Number(raw.stackPriority)) ? Number(raw.stackPriority) : null,
        stackIndex: Number.isFinite(Number(raw.stackIndex)) ? Number(raw.stackIndex) : null,
    };
}

function getReadableEntrySource(entry = {}) {
    const loredeck = getEntrySagaLoredeckMeta(entry);
    const sourceInfo = isPlainObjectValue(entry.sourceInfo) ? entry.sourceInfo : {};
    const source = cleanLoreChipText(entry.source, 180);
    const generation = isPlainObjectValue(entry.extensions?.sagaGeneration) ? entry.extensions.sagaGeneration : {};
    const origin = getLoreSourceOriginMeta(entry);
    const work = cleanLoreChipText(sourceInfo.work, 120);
    const book = cleanLoreChipText(sourceInfo.book, 120);
    const chapter = cleanLoreChipText(sourceInfo.chapter, 120);

    if (loredeck.packTitle || loredeck.packId) {
        const title = loredeck.packTitle || loredeck.packId;
        return {
            label: `Pack: ${truncateText(title, 34)}`,
            tooltip: [
                `Loredeck: ${title}`,
                loredeck.packId ? `Deck ID: ${loredeck.packId}` : '',
                loredeck.packType ? `Type: ${humanizeScopeKey(loredeck.packType)}` : '',
                loredeck.file ? `File: ${loredeck.file}` : '',
                loredeck.stackPriority !== null ? `Stack priority: ${loredeck.stackPriority}` : '',
            ].filter(Boolean).join(' | '),
            detailLabel: [book, chapter].filter(Boolean).join(' / ') || (work && work !== title ? work : ''),
            detailTooltip: [work, book, chapter].filter(Boolean).join(' | '),
        };
    }

    if (origin.label) {
        return {
            label: origin.label,
            tooltip: origin.tooltip,
            detailLabel: '',
            detailTooltip: '',
        };
    }

    if (work || book || chapter) {
        const label = work || book || chapter;
        return {
            label: `Source: ${truncateText(label, 32)}`,
            tooltip: [work, book, chapter].filter(Boolean).join(' | '),
            detailLabel: work && (book || chapter) ? [book, chapter].filter(Boolean).join(' / ') : '',
            detailTooltip: [work, book, chapter].filter(Boolean).join(' | '),
        };
    }

    if (source.includes('canon-lore-db')) {
        return {
            label: 'Source: Canon DB',
            tooltip: 'Suggested from Saga canon Loredeck retrieval.',
            detailLabel: '',
            detailTooltip: '',
        };
    }

    if (generation.mode || generation.batchId || generation.chunkId) {
        return {
            label: 'Source: Story Scan',
            tooltip: generation.batchId ? `Generated by story-lore scan batch ${generation.batchId}.` : 'Generated by story-lore scan.',
            detailLabel: '',
            detailTooltip: '',
        };
    }

    if (source && !['saga', 'model-generated', 'unknown'].includes(source.toLowerCase())) {
        return {
            label: `Source: ${truncateText(source, 32)}`,
            tooltip: source,
            detailLabel: '',
            detailTooltip: '',
        };
    }

    return null;
}

function createSagaMetadataBadge(label, tooltip, options = {}) {
    return createBadge(label, tooltip, {
        tone: options.tone || 'source',
        kind: options.kind || 'source',
        maxChars: options.maxChars || 42,
        className: 'saga-lore-badge-saga-meta',
    });
}

function createEntrySourceBadges(entry = {}) {
    const fragment = document.createDocumentFragment();
    const source = getReadableEntrySource(entry);
    if (!source?.label) return fragment;

    fragment.appendChild(createSagaMetadataBadge(source.label, source.tooltip || 'Lore source metadata.', { tone: 'source', kind: 'source' }));
    if (source.detailLabel) {
        fragment.appendChild(createSagaMetadataBadge(`Ref: ${truncateText(source.detailLabel, 32)}`, source.detailTooltip || source.tooltip, { tone: 'source', kind: 'source' }));
    }
    return fragment;
}

function getEntryContextGateMeta(entry = {}) {
    const gate = isPlainObjectValue(entry.extensions?.sagaContextGate) ? entry.extensions.sagaContextGate : {};
    const preview = isPlainObjectValue(entry.extensions?.canonPreview) ? entry.extensions.canonPreview : {};
    const pack = getEntrySagaLoredeckMeta(entry);
    const status = cleanLoreChipText(gate.status || preview.contextGateStatus, 40);
    const matchedBy = cleanLoreChipText(gate.matchedBy || preview.matchedBy, 60);
    const reason = cleanLoreChipText(gate.reason || preview.contextGateReason, 240);
    return {
        status,
        hasGate: gate.hasGate === true || (!!status && status !== 'no_gate'),
        eligible: gate.eligible === undefined ? null : gate.eligible === true,
        matchedBy,
        reason,
        packId: cleanLoreChipText(gate.packId || pack.packId, 120),
    };
}

function getContextGateChipLabel(gate = {}) {
    const matchedBy = String(gate.matchedBy || '').trim();
    if (matchedBy === 'date_context') return 'Gate: date + Context';
    if (matchedBy === 'context') return 'Gate: Context';
    if (matchedBy === 'date_unresolved_context') return 'Gate: date fallback';
    if (matchedBy === 'date') return 'Gate: date';
    if (matchedBy === 'unresolved_context') return 'Gate: unresolved';
    if (matchedBy === 'context_mismatch' || gate.status === 'mismatch') return 'Gate: blocked';
    if (matchedBy === 'date_contradicts_context') return 'Gate: date conflict';
    if (gate.status === 'match') return 'Gate: Context';
    if (gate.status === 'unresolved') return 'Gate: unresolved';
    if (gate.status === 'no_gate') return '';
    return matchedBy ? `Gate: ${matchedBy.replace(/_/g, ' ')}` : '';
}

function getContextGateTone(gate = {}) {
    const matchedBy = String(gate.matchedBy || '');
    if (gate.status === 'mismatch' || matchedBy.includes('mismatch') || matchedBy.includes('conflict')) return 'danger';
    if (gate.status === 'unresolved' || matchedBy.includes('unresolved')) return 'warning';
    if (gate.status === 'match' || matchedBy.includes('context')) return 'success';
    if (matchedBy === 'date') return 'info';
    return 'source';
}

function hasEntryContextMetadata(entry = {}) {
    const contextGate = isPlainObjectValue(entry.context) ? entry.context : {};
    const contextHasValue = Object.entries(contextGate).some(([key, value]) => {
        if (key === 'approximate') return value === true;
        if (value === null || value === undefined || value === '') return false;
        return Number.isFinite(Number(value)) || String(value || '').trim() !== '';
    });
    const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];
    return contextHasValue || coordinates.some(item => isPlainObjectValue(item)
        && [item.axis, item.id, item.label, item.from, item.to].some(value => String(value || '').trim()));
}

function formatEntryContextSummary(entry = {}) {
    if (!hasEntryContextMetadata(entry)) return '';
    const contextGate = isPlainObjectValue(entry.context) ? entry.context : {};
    const parts = [];
    if (contextGate.scope) parts.push(`Scope: ${contextGate.scope}`);
    if (contextGate.label) parts.push(contextGate.label);
    if (contextGate.anchorId) parts.push(`Anchor: ${contextGate.anchorId}`);
    if (contextGate.validFromAnchor || contextGate.validToAnchor) parts.push(`Window: ${contextGate.validFromAnchor || 'start'} -> ${contextGate.validToAnchor || 'open'}`);
    if (contextGate.arc) parts.push(`Arc: ${contextGate.arc}`);
    if (contextGate.phase) parts.push(`Phase: ${contextGate.phase}`);
    if (contextGate.season || contextGate.episode) parts.push(`S${contextGate.season || '?'} E${contextGate.episode || '?'}`);
    if (contextGate.chapter) parts.push(`Chapter: ${contextGate.chapter}`);
    if (contextGate.issue) parts.push(`Issue: ${contextGate.issue}`);
    if (contextGate.quest) parts.push(`Quest: ${contextGate.quest}`);
    if (contextGate.gameStage) parts.push(`Game: ${contextGate.gameStage}`);
    if (contextGate.stardateFrom || contextGate.stardateTo) parts.push(`Stardate: ${contextGate.stardateFrom || 'start'} -> ${contextGate.stardateTo || 'open'}`);
    if (contextGate.windowKind) parts.push(`Kind: ${contextGate.windowKind}`);
    if ((Number.isFinite(Number(contextGate.sortKeyFrom)) || Number.isFinite(Number(contextGate.sortKeyTo))) && !parts.some(part => part.startsWith('Window:'))) {
        parts.push(`Sort: ${contextGate.sortKeyFrom ?? 'start'} -> ${contextGate.sortKeyTo ?? 'open'}`);
    }
    const coordinates = (Array.isArray(entry.coordinates) ? entry.coordinates : [])
        .filter(isPlainObjectValue)
        .map(coordinate => coordinate.label || [coordinate.axis, coordinate.id || coordinate.from || coordinate.to].filter(Boolean).join(': '))
        .filter(Boolean)
        .slice(0, 2);
    if (coordinates.length) parts.push(`Axis: ${coordinates.join(', ')}`);
    return parts.join(' | ');
}

function createEntryContextBadges(entry = {}) {
    const fragment = document.createDocumentFragment();
    const gate = getEntryContextGateMeta(entry);
    const gateLabel = getContextGateChipLabel(gate);
    if (gateLabel) {
        const tooltip = [
            `Context retrieval: ${gate.matchedBy || gate.status || 'unknown'}`,
            gate.packId ? `Deck ID: ${gate.packId}` : '',
            gate.reason,
        ].filter(Boolean).join(' | ');
        fragment.appendChild(createSagaMetadataBadge(gateLabel, tooltip, { tone: getContextGateTone(gate), kind: 'source' }));
    }

    const summary = formatEntryContextSummary(entry);
    if (summary) {
        fragment.appendChild(createSagaMetadataBadge(`Ctx: ${truncateText(summary, 36)}`, summary, { tone: 'source', kind: 'source' }));
    }
    return fragment;
}

function getAcceptedLoreDeckFilterOptions(entries = []) {
    const counts = new Map();
    const labels = new Map();
    const accepted = (Array.isArray(entries) ? entries : []).filter(entry => !entry.isPending);
    for (const entry of accepted) {
        const loredeck = getEntrySagaLoredeckMeta(entry);
        const packId = loredeck.packId || '';
        const value = packId || 'none';
        counts.set(value, (counts.get(value) || 0) + 1);
        if (!labels.has(value)) labels.set(value, loredeck.packTitle || packId || 'No deck metadata');
    }
    const options = [['all', `Deck: All (${accepted.length})`]];
    for (const [value, label] of [...labels.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])))) {
        options.push([value, `${truncateText(label, 28)} (${counts.get(value) || 0})`]);
    }
    return options;
}

function getAcceptedLoreContextFilterOptions(entries = []) {
    const accepted = (Array.isArray(entries) ? entries : []).filter(entry => !entry.isPending);
    return LORE_CONTEXT_FILTER_OPTIONS.map(([value, label]) => {
        const count = value === 'all'
            ? accepted.length
            : accepted.filter(entry => entryMatchesAcceptedContextFilter(entry, value)).length;
        return [value, `${label} (${count})`];
    });
}

function entryMatchesAcceptedDeckFilter(entry = {}, filter = 'all') {
    const value = String(filter || 'all').trim();
    if (!value || value === 'all') return true;
    const packId = getEntrySagaLoredeckMeta(entry).packId || '';
    if (value === 'none') return !packId;
    return packId === value;
}

function entryMatchesAcceptedContextFilter(entry = {}, filter = 'all') {
    const value = String(filter || 'all').trim();
    if (!value || value === 'all') return true;
    const gate = getEntryContextGateMeta(entry);
    const gateTone = getContextGateTone(gate);
    const hasContext = hasEntryContextMetadata(entry) || gate.hasGate;
    if (value === 'with-context') return hasContext;
    if (value === 'context-match') return gateTone === 'success';
    if (value === 'context-blocked') return gateTone === 'danger';
    if (value === 'context-unresolved') return gateTone === 'warning';
    if (value === 'no-context') return !hasContext;
    return true;
}

export function appendEntrySourceAndContextBadges(meta, entry = {}) {
    if (!meta) return;
    meta.appendChild(createEntrySourceBadges(entry));
    meta.appendChild(createEntryContextBadges(entry));
}

function createSpellMetadataBadges(entry) {
    const row = document.createDocumentFragment();
    const spells = Array.from(new Set([
        ...((entry?.scope?.spells || []).map(v => String(v || '').trim()).filter(Boolean)),
        ...((entry?.tags || []).filter(tag => /spell|patronus|expelliarmus|sectumsempra|occlumency|legilimency|apparition/i.test(String(tag || '')))),
    ])).slice(0, 4);

    if (!spells.length && (entry?.kind === 'spell_gate' || entry?.category === 'spell')) {
        spells.push(entry?.title || 'Spell gate');
    }

    for (const spell of spells) {
        row.appendChild(createBadge(`Spell: ${spell}`, 'Spell metadata. This identifies spell knowledge, spell-learning gates, or magic-ability constraints attached to this lore entry.', { tone: 'tag', kind: 'tag', maxChars: 36 }));
    }

    return row;
}

function getLoreReviewId(entry) {
    return entry?.id || `${entry?.title || 'pending'}:${entry?.fact || ''}`;
}

function getPendingReviewSelectedIds(state = getState()) {
    return new Set(Array.isArray(state?.lorePanel?.reviewSelectedIds) ? state.lorePanel.reviewSelectedIds : []);
}

function isPendingLoreSelected(state, entry) {
    return getPendingReviewSelectedIds(state).has(getLoreReviewId(entry));
}

function countPendingReviewSelections(state, entries = []) {
    const selectedIds = getPendingReviewSelectedIds(state);
    return (Array.isArray(entries) ? entries : [])
        .map(getLoreReviewId)
        .filter(id => id && selectedIds.has(id))
        .length;
}

function setPendingReviewSelection(ids) {
    const state = getState();
    if (!state?.lorePanel) return;
    state.lorePanel.reviewSelectedIds = Array.from(new Set((ids || []).filter(Boolean)));
    saveState(state);
}

function togglePendingReviewSelection(id, selected) {
    if (!id) return;
    const current = getPendingReviewSelectedIds();
    if (selected) current.add(id);
    else current.delete(id);
    setPendingReviewSelection(Array.from(current));
}

function clearPendingReviewSelection() {
    setPendingReviewSelection([]);
}

function getSelectedPendingIndexes(scopeIds = null) {
    const state = getState();
    const selected = getPendingReviewSelectedIds(state);
    const scoped = Array.isArray(scopeIds) ? new Set(scopeIds.filter(Boolean)) : null;
    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    return pending
        .map((entry, index) => ({ entry, index }))
        .filter(item => {
            const reviewId = getLoreReviewId(item.entry);
            return selected.has(reviewId) && (!scoped || scoped.has(reviewId));
        })
        .map(item => item.index);
}

function getPendingIndexesByReviewIds(ids = []) {
    const targets = new Set((ids || []).filter(Boolean));
    const pending = normalizeLoreMatrix(getState()?.pendingLoreEntries || []);
    return pending
        .map((entry, index) => ({ entry, index }))
        .filter(item => targets.has(getLoreReviewId(item.entry)))
        .map(item => item.index);
}

function refreshPendingLoreAfterBatch({ preserveScroll = true } = {}) {
    clearPendingReviewSelection();
    refreshPanelBody({ preserveScroll });
    refreshHeader();
    refreshLoreWorkbench();
}

function applyPendingLoreIndexes(indexes, { preserveScroll = true } = {}) {
    if (!indexes.length) {
        toast('No Pending Review entries selected.', 'warning');
        return;
    }
    for (const idx of indexes.sort((a, b) => b - a)) acceptPendingLoreEntry(idx);
    refreshPendingLoreAfterBatch({ preserveScroll });
}

function dismissPendingLoreIndexes(indexes, { preserveScroll = true } = {}) {
    if (!indexes.length) {
        toast('No Pending Review entries selected.', 'warning');
        return;
    }
    for (const idx of indexes.sort((a, b) => b - a)) rejectPendingLoreEntry(idx);
    refreshPendingLoreAfterBatch({ preserveScroll });
}

function applySelectedPendingLore(scopeIds = null) {
    const indexes = getSelectedPendingIndexes(scopeIds);
    applyPendingLoreIndexes(indexes);
}

function dismissSelectedPendingLore(scopeIds = null) {
    const indexes = getSelectedPendingIndexes(scopeIds);
    dismissPendingLoreIndexes(indexes);
}

function applyPendingLoreEntriesByReviewIds(ids = [], options = {}) {
    const indexes = getPendingIndexesByReviewIds(ids);
    applyPendingLoreIndexes(indexes, options);
}

function dismissPendingLoreEntriesByReviewIds(ids = [], options = {}) {
    const indexes = getPendingIndexesByReviewIds(ids);
    dismissPendingLoreIndexes(indexes, options);
}

function acceptPendingLoreEntry(index) {
    return acceptPendingLoreEntryInState(index);
}

function rejectPendingLoreEntry(index) {
    return rejectPendingLoreEntryInState(index);
}

function refreshHeader() {
    return dep('refreshHeader', () => null)();
}

function toast(message, type) {
    return dep('toast', () => null)(message, type);
}

function getState() {
    return dep('getState', () => ({}))();
}

function saveState(state, options) {
    return dep('saveState', () => null)(state, options);
}

function refreshPanelBody(options = {}) {
    return dep('refreshPanelBody', () => null)(options);
}

function getLoreDisplayLabel(field, value) {
    return dep('getLoreDisplayLabel', (fieldName, rawValue) => String(rawValue || fieldName || ''))(field, value);
}

function getCategoryCount(category, entries, counts) {
    const safeCounts = counts || {};
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (category === 'all') return safeCounts.all || 0;
    if (category === 'active' || category === 'high') return safeCounts.high || safeCounts.active || 0;
    if (category === 'normal') return safeCounts.normal || 0;
    if (category === 'low') return safeCounts.low || 0;
    if (category === 'elevated' || category === 'pinned') return safeCounts.elevated || safeCounts.pinned || 0;
    if (category === 'suppressed') return safeCounts.suppressed || 0;
    if (category === 'pending') return safeCounts.pending || 0;
    return safeEntries.filter(entry => entry.category === category).length;
}

function getCategoryTooltip(category) {
    const registryMeta = getLoreRegistryMeta('categories', category);
    if (registryMeta?.description) return registryMeta.description;
    const map = {
        all: 'Shows every Accepted Lorecard and Pending Review entry.',
        active: 'Legacy alias for High Relevance.',
        high: 'Shows Accepted Lorecards in the High-Relevance injection tier.',
        normal: 'Shows Accepted Lorecards in the Normal-Relevance injection tier.',
        low: 'Shows Accepted Lorecards in the Low-Relevance injection tier.',
        elevated: 'Shows Elevated entries forced to High relevance, protected from Lore Automation, and injected directly.',
        pinned: 'Legacy alias for Elevated entries.',
        suppressed: 'Shows muted entries excluded from injection.',
        pending: 'Shows generated entries that still need review.',
    };
    return map[category] || `Shows lore entries in category: ${category}.`;
}

function setPanelState(patch, options = {}) {
    return dep('setPanelState', () => null)(patch, options);
}

function setExperienceMode(mode) {
    return dep('setExperienceMode', () => {
        const settings = getSettings();
        settings.experienceMode = mode;
        saveSettings(settings);
    })(mode);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function scheduleAcceptedLoreLayoutUpdate() {
    return dep('scheduleAcceptedLoreLayoutUpdate', () => null)();
}

function getSearchRenderDebounceMs() {
    return Math.max(0, Number(dep('getSearchRenderDebounceMs', () => 160)()) || 0);
}

function getLoreWorkbenchRowLimit() {
    return Math.max(25, Number(dep('getLoreWorkbenchRowLimit', () => 500)()) || 500);
}

function flushScheduledStateSave() {
    return dep('flushScheduledStateSave', () => null)();
}

export function refreshAcceptedLoreCategoryTabs(activeCategory) {
    const root = getPanelRoot();
    if (!root) return;
    root.querySelectorAll('.saga-lore-tabs .saga-lore-tab').forEach(tab => {
        tab.classList.toggle('saga-lore-tab-active', tab.dataset.category === activeCategory);
    });
}

export function refreshAcceptedLoreFilterResults(options = {}) {
    const root = getPanelRoot();
    if (!root) return;
    const section = root.querySelector('.saga-accepted-lore-section');
    const list = section?.querySelector?.('.saga-lore-entry-list');
    if (!list) return;
    renderAcceptedLoreEntryList(list, getState());
    if (options.resetListScroll !== false) list.scrollTop = 0;
    refreshAcceptedLoreBulkToolbar();
    scheduleAcceptedLoreLayoutUpdate();
    refreshLoreWorkbench();
}

export function scheduleAcceptedLoreListRender(container) {
    if (acceptedLoreSearchRenderTimer) clearTimeout(acceptedLoreSearchRenderTimer);
    acceptedLoreSearchRenderTimer = setTimeout(() => {
        acceptedLoreSearchRenderTimer = null;
        const root = container || getPanelRoot();
        const list = root?.querySelector?.('.saga-lore-entry-list');
        if (list) renderAcceptedLoreEntryList(list, getState());
        refreshAcceptedLoreBulkToolbar();
        scheduleAcceptedLoreLayoutUpdate();
    }, getSearchRenderDebounceMs());
}

export function getAcceptedSelectionSet(state = getState()) {
    const ids = Array.isArray(state?.lorePanel?.acceptedSelectedIds) ? state.lorePanel.acceptedSelectedIds : [];
    const acceptedIds = new Set(normalizeLoreMatrix(state?.loreMatrix || []).map(entry => entry.id));
    return new Set(ids.filter(id => acceptedIds.has(id)));
}

export function getFilteredAcceptedLoreIds(state = getState()) {
    return getFilteredLoreEntries(state).map(entry => entry.id);
}

export function setAcceptedLoreSelection(ids = [], options = {}) {
    const state = getState();
    if (!state.lorePanel) state.lorePanel = {};
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    state.lorePanel.acceptedSelectedIds = Array.from(new Set((ids || []).filter(id => acceptedIds.has(id))));
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
}

export function toggleAcceptedLoreSelection(entryId, selected) {
    const state = getState();
    if (!state.lorePanel) state.lorePanel = {};
    const selection = getAcceptedSelectionSet(state);
    if (selected) selection.add(entryId);
    else selection.delete(entryId);
    state.lorePanel.acceptedSelectedIds = Array.from(selection);
    scheduleStateSave(state);
}

function markLoreAutomationDisabledForEntryIds(state, ids, reason, meta = {}) {
    if (!state || !ids?.length) return 0;
    const idSet = new Set(ids);
    let count = 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id)) return entry;
        count += 1;
        return normalizeLoreEntry(disableLoreAutomationForManualChange(entry, reason, meta));
    });
    return count;
}

function bulkUpdateAcceptedLore(ids, updater, options = {}) {
    if (!ids?.length || typeof updater !== 'function') return false;
    const state = getState();
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    let count = 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id)) return entry;
        count += 1;
        let updated = normalizeLoreEntry({ ...updater(entry), userEdited: true });
        if (options.preserveLoreAutomation !== true) {
            updated = normalizeLoreEntry(disableLoreAutomationForManualChange(
                updated,
                options.loreAutomationDisableReason || LORE_AUTOMATION_MANUAL_DISABLE_REASONS.bulk,
                { at: Date.now(), by: 'user' },
            ));
        }
        return updated;
    });
    if (count) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'bulk_edit',
            source: 'manual',
            summary: `Bulk edited ${count} Accepted Lorecard${count === 1 ? '' : 's'}.`,
        });
    }
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
    return count > 0;
}

function bulkSetAcceptedElevated(ids, elevated) {
    const state = getState();
    if (!state) return false;
    const selection = ensureLoreSelectionShape(state);
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const suppressedSet = new Set((selection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    const elevatedRecords = selection.elevated || {};
    let count = 0;
    const now = Date.now();
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id) || !acceptedIds.has(entry.id)) return entry;
        const id = entry.id;
        const isElevated = Object.prototype.hasOwnProperty.call(elevatedRecords, id);
        if (elevated && !isElevated) {
            count += 1;
            elevatedRecords[id] = {
                elevatedAt: now,
                previousRelevance: getBaseLorecardRelevance(entry),
                previousIsActive: entry.isActive === true,
                previousMuted: suppressedSet.has(id),
                previousLoreAutomation: getLoreAutomationState(entry),
            };
            suppressedSet.delete(id);
            return normalizeLoreEntry(setLoreAutomationEnabled(entry, false, {
                at: now,
                by: 'user',
                reason: LORE_AUTOMATION_MANUAL_DISABLE_REASONS.elevation,
            }));
        }
        if (!elevated && isElevated) {
            count += 1;
            const record = elevatedRecords[id] || {};
            delete elevatedRecords[id];
            if (record.previousMuted === true) suppressedSet.add(id);
            else suppressedSet.delete(id);
            return normalizeLoreEntry(restoreLoreAutomationSnapshot({
                ...entry,
                isActive: record.previousIsActive === true,
                relevance: normalizeLoreRelevance(record.previousRelevance || entry.relevance || 'normal'),
            }, record.previousLoreAutomation || {}));
        }
        return entry;
    });
    selection.elevated = elevatedRecords;
    selection.pinnedIds = (selection.pinnedIds || []).filter(id => acceptedIds.has(id) && !idSet.has(id));
    selection.suppressedIds = Array.from(suppressedSet);
    if (!count) return false;
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: elevated ? 'elevate' : 'unelevate',
        source: 'manual',
        summary: `${elevated ? 'Elevated' : 'Removed Elevation from'} ${count} Accepted Lorecard${count === 1 ? '' : 's'}.`,
    });
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
    return true;
}

function bulkSetAcceptedMuted(ids, muted) {
    const state = getState();
    if (!state) return false;
    const selection = ensureLoreSelectionShape(state);
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const pinSet = new Set((selection.pinnedIds || []).filter(id => acceptedIds.has(id)));
    const suppressedSet = new Set((selection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    const elevatedRecords = selection.elevated || {};
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id) || !acceptedIds.has(entry.id)) return entry;
        const id = entry.id;
        if (!muted) {
            suppressedSet.delete(id);
            return entry;
        }
        suppressedSet.add(id);
        pinSet.delete(id);
        const elevationRecord = elevatedRecords[id] || null;
        if (!elevationRecord) return entry;
        delete elevatedRecords[id];
        return normalizeLoreEntry(restoreLoreAutomationSnapshot({
            ...entry,
            isActive: elevationRecord.previousIsActive === true,
            relevance: normalizeLoreRelevance(elevationRecord.previousRelevance || entry.relevance || 'normal'),
        }, elevationRecord.previousLoreAutomation || {}));
    });
    selection.elevated = elevatedRecords;
    selection.pinnedIds = Array.from(pinSet);
    selection.suppressedIds = Array.from(suppressedSet);
    markLoreAutomationDisabledForEntryIds(
        state,
        Array.from(idSet),
        LORE_AUTOMATION_MANUAL_DISABLE_REASONS.mute,
        { at: Date.now(), by: 'user' },
    );
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: muted ? 'mute' : 'unmute',
        source: 'manual',
        summary: `${muted ? 'Muted' : 'Unmuted'} ${idSet.size} Accepted Lorecard${idSet.size === 1 ? '' : 's'}.`,
    });
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function bulkSetAcceptedLoreAutomation(ids, enabled) {
    if (!ids?.length) return false;
    const state = getState();
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    let count = 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id)) return entry;
        count += 1;
        return normalizeLoreEntry(setLoreAutomationEnabled(entry, enabled, {
            at: Date.now(),
            by: 'manual',
            reason: enabled ? '' : 'manual_bulk_change',
        }));
    });
    if (count) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: enabled ? 'lore_automation_enable' : 'lore_automation_disable',
            source: 'manual',
            summary: `${enabled ? 'Enabled' : 'Disabled'} Lore Automation for ${count} Accepted Lorecard${count === 1 ? '' : 's'}.`,
        });
    }
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
    return count > 0;
}

function bulkAddTagToAcceptedLore(ids, tag) {
    const clean = normalizeLoreTag(tag);
    if (!clean) return false;
    return bulkUpdateAcceptedLore(ids, entry => {
        const tags = Array.isArray(entry.tags) ? entry.tags.map(normalizeLoreTag).filter(Boolean) : [];
        const exists = tags.some(t => t.toLowerCase() === clean.toLowerCase());
        return { ...entry, tags: exists ? tags : [...tags, clean] };
    });
}

function bulkDeleteAcceptedLore(ids) {
    const state = getState();
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const before = Array.isArray(state.loreMatrix) ? state.loreMatrix.length : 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).filter(entry => !idSet.has(entry.id));
    const acceptedIds = new Set(state.loreMatrix.map(entry => entry.id));
    if (state.loreSelection) {
        state.loreSelection.pinnedIds = (state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id));
        state.loreSelection.suppressedIds = (state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id));
        if (state.loreSelection.elevated && typeof state.loreSelection.elevated === 'object' && !Array.isArray(state.loreSelection.elevated)) {
            for (const id of Object.keys(state.loreSelection.elevated)) {
                if (!acceptedIds.has(id)) delete state.loreSelection.elevated[id];
            }
        }
    }
    if (state.lorePanel) {
        state.lorePanel.acceptedSelectedIds = (state.lorePanel.acceptedSelectedIds || []).filter(id => acceptedIds.has(id));
        if (idSet.has(state.lorePanel.selectedEntryId)) state.lorePanel.selectedEntryId = '';
    }
    const deleted = before - state.loreMatrix.length;
    if (deleted > 0) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'delete',
            source: 'manual',
            summary: `Deleted ${deleted} Accepted Lorecard${deleted === 1 ? '' : 's'}.`,
        });
    }
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function getLoreRegistryValues(registryName, fallback = []) {
    return dep('getLoreRegistryValues', (_registryName, values = []) => values)(registryName, fallback);
}

function getLorePriorityValues() {
    return dep('getLorePriorityValues', () => [10, 25, 50, 75, 90, 100])();
}

function appendPendingLoreEntries(entries, batch, options = {}) {
    return dep('appendPendingLoreEntries')(entries, batch, options);
}

function recordLoreTimelineEvent(state, event) {
    return dep('recordLoreTimelineEvent', () => null)(state, event);
}

function captureLoreTimelineState(state) {
    return dep('captureLoreTimelineState', () => null)(state);
}

function scheduleStateSave(state, delay) {
    return dep('scheduleStateSave', saveState)(state, delay);
}

function refreshLoreTimeline() {
    return dep('refreshLoreTimeline', () => null)();
}

function appendSettingsResetButton(container, settingKeys, label = 'Settings') {
    return dep('appendSettingsResetButton', () => null)(container, settingKeys, label);
}

function runAutoRelevance(options = {}) {
    return dep('runAutoRelevance')(options);
}

function applyAutoRelevanceSuggestions(ids = null) {
    return dep('applyAutoRelevanceSuggestions', () => ({ applied: 0 }))(ids);
}

function rejectAutoRelevanceSuggestions(ids = null) {
    return dep('rejectAutoRelevanceSuggestions', () => ({ rejected: 0 }))(ids);
}

function clearAutoRelevanceSuggestions() {
    return dep('clearAutoRelevanceSuggestions', () => null)();
}

function applyLoreAutomationSuggestions(ids = null) {
    return dep('applyLoreAutomationSuggestions', () => ({ applied: 0 }))(ids);
}

function rejectLoreAutomationSuggestions(ids = null) {
    return dep('rejectLoreAutomationSuggestions', () => ({ rejected: 0 }))(ids);
}

function clearLoreAutomationSuggestions() {
    return dep('clearLoreAutomationSuggestions', () => null)();
}

function undoLastLoreAutomationRun() {
    return dep('undoLastLoreAutomationRun', () => ({ undone: 0 }))();
}

function normalizeLoreAutomationCadenceModeValue(value = 'auto') {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'manual' || normalized === 'off' ? 'manual' : 'auto';
}

function refreshAutoRelevanceCardInPlace(source = null) {
    const card = source?.closest?.('.saga-auto-relevance-card') || document.querySelector('.saga-auto-relevance-card');
    if (!card) {
        refreshPanelBody({ preserveScroll: true });
        return false;
    }
    const next = createAutoRelevanceCard(getState());
    if (card.classList.contains('saga-lorecard-workspace-tool-card')) next.classList.add('saga-lorecard-workspace-tool-card');
    card.replaceWith(next);
    refreshHeader();
    return true;
}

function createLoreAutomationCadenceSwitch(settings = getSettings()) {
    const cadenceMode = normalizeLoreAutomationCadenceModeValue(settings.loreAutomationCadenceMode || 'auto');
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-automation-cadence-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Lore Automation cadence');
    addTooltip(wrap, 'Manual keeps automatic Lore Automation off. Auto lets Saga run Lore Automation from story movement and stack changes.');

    const setCadence = (value, button) => {
        const nextMode = normalizeLoreAutomationCadenceModeValue(value);
        if (nextMode === cadenceMode) return;
        const next = getSettings();
        next.loreAutomationCadenceMode = nextMode;
        next.loreAutomationPaused = false;
        if (nextMode === 'auto' && normalizeLoreAutomationMode(next.loreAutomationMode || 'off') === 'off') {
            next.loreAutomationMode = 'ar';
        }
        next.autoRelevanceEnabled = normalizeLoreAutomationMode(next.loreAutomationMode || 'off') !== 'off';
        next.autoRelevanceMode = 'apply_high_confidence';
        saveSettings(next);
        refreshAutoRelevanceCardInPlace(button || wrap);
    };

    for (const [value, label, tooltip] of [
        ['manual', 'Manual', 'Disable automatic Lore Automation cadence. Run Now remains available.'],
        ['auto', 'Auto', 'Enable automatic Lore Automation cadence.'],
    ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'saga-lore-automation-cadence-option';
        button.textContent = label;
        button.dataset.value = value;
        const active = cadenceMode === value;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) button.classList.add('saga-lore-automation-cadence-option-active');
        addTooltip(button, tooltip);
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setCadence(value, button);
        });
        wrap.appendChild(button);
    }
    return wrap;
}

function createLoreAutomationHeader(titleText = 'Lore Automation', settings = getSettings()) {
    const header = document.createElement('div');
    header.className = 'saga-lore-automation-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-lore-automation-title';
    title.textContent = titleText;
    addTooltip(title, 'Select how much authority Saga has over Accepted Lorecards.');
    header.appendChild(title);
    const actions = document.createElement('div');
    actions.className = 'saga-lore-automation-header-actions';
    actions.appendChild(createLoreAutomationCadenceSwitch(settings));
    appendSettingsResetButton(actions, LORE_AUTOMATION_SETTING_KEYS, 'Lore Automation settings');
    header.appendChild(actions);
    return header;
}

function getLoreAutomationGroupSummary(title, selectedValue, labels = {}, descriptions = {}, options = {}) {
    const value = String(selectedValue || '').trim();
    if (options.blankWhen?.(value)) return title;
    const label = labels[value] || humanizeScopeKey(value);
    const description = descriptions[value] || '';
    return description ? `${title} - ${label}: ${description}` : `${title} - ${label}`;
}

function createLoreAutomationChoiceGroup(config = {}) {
    const {
        title = '',
        selectedValue = '',
        labels = {},
        descriptions = {},
        values = [],
        tooltip = '',
        blankWhen = null,
        disabled = false,
        onSelect = () => {},
    } = config;
    const group = document.createElement('div');
    group.className = 'saga-lore-automation-choice-group';
    if (disabled) {
        group.classList.add('saga-lore-automation-choice-group-disabled');
        group.setAttribute('aria-disabled', 'true');
    }
    group.dataset.choiceGroup = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const header = document.createElement('div');
    header.className = 'saga-lore-automation-choice-header';
    const summary = document.createElement('div');
    summary.className = 'saga-lore-automation-choice-title';
    summary.textContent = getLoreAutomationGroupSummary(title, selectedValue, labels, descriptions, { blankWhen });
    if (tooltip) addTooltip(summary, tooltip);
    header.appendChild(summary);
    group.appendChild(header);

    const buttons = document.createElement('div');
    buttons.className = 'saga-lore-automation-choice-buttons';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', title);
    for (const value of values) {
        const normalized = String(value || '').trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'saga-lore-automation-choice-button';
        button.dataset.value = normalized;
        button.textContent = labels[normalized] || humanizeScopeKey(normalized);
        button.disabled = !!disabled;
        const active = normalized === selectedValue;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) button.classList.add('saga-lore-automation-choice-button-active');
        const description = descriptions[normalized] || tooltip || '';
        addTooltip(button, active && config.allowToggleOff
            ? `${description} Tap again to turn ${title.toLowerCase()} off.`
            : description);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(normalized, { active });
        });
        buttons.appendChild(button);
    }
    group.appendChild(buttons);
    return group;
}

export function createAutoRelevanceCard(state) {
    const settings = getSettings();
    const loreAutomationMode = normalizeLoreAutomationMode(settings.loreAutomationMode || (settings.autoRelevanceEnabled ? 'ar' : 'off'));
    const loreAutomationStyle = normalizeLoreAutomationStyle(settings.loreAutomationStyle || 'balanced');
    const loreAutomationCadenceMode = normalizeLoreAutomationCadenceModeValue(settings.loreAutomationCadenceMode || 'auto');
    const automationConfigEnabled = loreAutomationCadenceMode === 'auto';
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-auto-relevance-card';

    markTourTarget(card, 'lore.autoRelevance');
    card.appendChild(createLoreAutomationHeader('Lore Automation', settings));

    const modeRow = document.createElement('div');
    modeRow.className = 'saga-lore-automation-choice-row';
    if (!automationConfigEnabled) modeRow.classList.add('saga-lore-automation-config-disabled');
    markTourTarget(modeRow, 'lore.autoRelevance.mode');
    modeRow.appendChild(createLoreAutomationChoiceGroup({
        title: 'Mode',
        selectedValue: loreAutomationMode === 'off' ? '' : loreAutomationMode,
        values: LORE_AUTOMATION_MODE_BUTTON_VALUES,
        labels: LORE_AUTOMATION_MODE_LABELS,
        descriptions: LORE_AUTOMATION_MODE_DESCRIPTIONS,
        tooltip: 'Lore Automation authority level.',
        blankWhen: value => !value,
        disabled: !automationConfigEnabled,
        allowToggleOff: true,
        onSelect: (value, meta = {}) => {
            const next = getSettings();
            const mode = meta.active ? 'off' : normalizeLoreAutomationMode(value);
            next.loreAutomationMode = mode;
            next.loreAutomationCadenceMode = mode === 'off' ? 'manual' : 'auto';
            next.loreAutomationPaused = false;
            next.autoRelevanceEnabled = mode !== 'off';
            next.autoRelevanceMode = mode === 'off' ? 'off' : 'apply_high_confidence';
            saveSettings(next);
            refreshAutoRelevanceCardInPlace(card);
        },
    }));
    modeRow.appendChild(createLoreAutomationChoiceGroup({
        title: 'Style',
        selectedValue: loreAutomationStyle,
        values: LORE_AUTOMATION_STYLE_VALUES,
        labels: LORE_AUTOMATION_STYLE_LABELS,
        descriptions: LORE_AUTOMATION_STYLE_DESCRIPTIONS,
        tooltip: 'Controls how conservative Lore Automation is when applying eligible changes.',
        disabled: !automationConfigEnabled,
        onSelect: (value) => {
            const next = getSettings();
            next.loreAutomationStyle = normalizeLoreAutomationStyle(value);
            if (normalizeLoreAutomationMode(next.loreAutomationMode) !== 'off') {
                next.autoRelevanceEnabled = true;
                next.autoRelevanceMode = 'apply_high_confidence';
            }
            saveSettings(next);
            refreshAutoRelevanceCardInPlace(card);
        },
    }));
    card.appendChild(modeRow);

    const row = document.createElement('div');
    row.className = 'saga-lore-automation-tuning-row';
    if (!automationConfigEnabled) row.classList.add('saga-lore-automation-config-disabled');
    markTourTarget(row, 'lore.autoRelevance.tuning');
    row.appendChild(createLoreAutomationChoiceGroup({
        title: 'Pacing',
        selectedValue: settings.loreAutomationPacing || 'normal',
        values: LORE_AUTOMATION_PACING_VALUES,
        labels: LORE_AUTOMATION_PACING_LABELS,
        descriptions: LORE_AUTOMATION_PACING_DESCRIPTIONS,
        tooltip: 'Advanced cadence preset. It changes story-budget sensitivity, not automation authority.',
        disabled: !automationConfigEnabled,
        onSelect: (value) => {
            const next = getSettings();
            next.loreAutomationPacing = value;
            saveSettings(next);
            refreshAutoRelevanceCardInPlace(card);
        },
    }));
    row.appendChild(createKeyValue('Cadence', loreAutomationCadenceMode === 'auto' ? 'Auto' : 'Manual', loreAutomationCadenceMode === 'auto'
        ? 'Runs from narrative movement, structured Context/stack changes, and local stack pressure.'
        : 'Automatic cadence is off. Run Now remains available for manual Lore Automation runs.'));
    row.appendChild(createNumberSettingMini('Recent messages', 'autoRelevanceRecentMessages', settings.autoRelevanceRecentMessages || 20, 1, 200));
    card.appendChild(row);

    const advanced = document.createElement('details');
    advanced.className = 'saga-lore-automation-advanced';
    const advancedSummary = document.createElement('summary');
    advancedSummary.textContent = 'Advanced';
    addTooltip(advancedSummary, 'Advanced Lore Automation diagnostics and caps.');
    advanced.appendChild(advancedSummary);
    const advancedRow = document.createElement('div');
    advancedRow.className = 'saga-runtime-grid';
    advancedRow.appendChild(createNumberSettingMini('Candidate cap', 'autoRelevanceCandidateCap', settings.autoRelevanceCandidateCap || 40, 1, 500));
    advancedRow.appendChild(createNumberSettingMini('Min confidence %', 'autoRelevanceMinConfidence', Math.round((settings.autoRelevanceMinConfidence || 0.7) * 100), 1, 100, value => Number(value) / 100));
    advancedRow.appendChild(createNumberSettingMini('Remap word budget', 'loreAutomationRemapWordBudget', settings.loreAutomationRemapWordBudget || 900, 100, 20000));
    advancedRow.appendChild(createNumberSettingMini('Curate word budget', 'loreAutomationCurationWordBudget', settings.loreAutomationCurationWordBudget || 1800, 200, 40000));
    advanced.appendChild(advancedRow);

    const modelRow = document.createElement('div');
    modelRow.className = 'saga-runtime-grid';
    markTourTarget(modelRow, 'lore.autoRelevance.model');
    modelRow.appendChild(createNumberSettingMini('Relevance provider cap', 'autoRelevanceModelCandidateCap', settings.autoRelevanceModelCandidateCap || 30, 1, 80));
    modelRow.appendChild(createNumberSettingMini('Provider max tokens', 'autoRelevanceModelMaxTokens', settings.autoRelevanceModelMaxTokens || 2048, 512, 4096));
    advanced.appendChild(modelRow);
    card.appendChild(advanced);
    const counts = getLoreRelevanceCounts(state);
    const eligibility = getLoreAutomationEligibilityCounts(state);
    const lastRun = state?.loreAutomationLastRun || state?.autoRelevanceLastRun || null;
    const statusText = getLoreAutomationStatusText(loreAutomationMode, settings, lastRun);
    card.appendChild(createKeyValue('Status', statusText, 'Current Lore Automation mode and last run result.'));
    card.appendChild(createKeyValue('Current tiers', `High ${counts.high} | Normal ${counts.normal} | Low ${counts.low} | Muted ${counts.muted}`, 'Current Accepted Lorecards counts by relevance.'));
    card.appendChild(createKeyValue('Card control', `${eligibility.enabled} managed | ${eligibility.disabled} protected`, 'Per-card Lore Automation ownership. Protected cards are skipped until re-enabled from the card details.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    markTourTarget(actions, 'lore.autoRelevance.actions');
    actions.appendChild(createButton('Run Now', 'Runs Lore Automation immediately.', async (btn) => {
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Running...';
        try {
            const current = getSettings();
            if (normalizeLoreAutomationMode(current.loreAutomationMode || 'off') === 'off') {
                current.loreAutomationMode = 'ar';
                current.autoRelevanceEnabled = true;
                current.autoRelevanceMode = 'apply_high_confidence';
                saveSettings(current);
            }
            const result = await runAutoRelevance({ force: true, forceProvider: true });
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            if (result.status === 'no_accepted_lore') {
                toast('Lore Automation runs on Accepted Lorecards. Preview Loredeck packs, add entries to Pending Review, then accept the cards you want before running it.', 'warning');
            } else if (result.status === 'pending_only') {
                const pendingCount = result.pendingCount || 0;
                toast(`Lore Automation found ${pendingCount} Pending Review entr${pendingCount === 1 ? 'y' : 'ies'}. Accept or reject Pending Review entries before relevance scanning.`, 'warning');
            } else if (result.status === 'no_lore') {
                toast('Lore Automation needs Accepted Lorecards before it can run.', 'warning');
            } else {
                toast(`Lore Automation: ${formatLoreAutomationRunSummary(result)}.`, 'info');
            }
        } catch (e) {
            console.error(e);
            toast(`Lore Automation failed: ${e?.message || e}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Undo Last Run', 'Reverts the latest Lore Automation timeline event when it is still reversible.', () => {
        const result = undoLastLoreAutomationRun();
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        toast(result.undone ? 'Lore Automation run undone.' : 'No reversible Lore Automation run found.', result.undone ? 'success' : 'info');
    }, 'saga-small-button'));
    card.appendChild(actions);
    card.appendChild(createLoreAutomationActivityList(state));
    return card;
}

function getLoreAutomationStatusText(loreAutomationMode = 'off', settings = {}, lastRun = null) {
    if (normalizeLoreAutomationCadenceModeValue(settings.loreAutomationCadenceMode || 'auto') === 'manual') {
        return lastRun?.status ? `Manual - ${formatLoreAutomationRunSummary(lastRun)}` : 'Manual';
    }
    if (loreAutomationMode === 'off') return 'Off';
    if (!lastRun?.status) return 'Ready';
    return formatLoreAutomationRunSummary(lastRun);
}

function getLoreAutomationEligibilityCounts(state = getState()) {
    const loreState = getPanelLoreState(state);
    const accepted = (loreState.entries || []).filter(entry => !entry?.isPending);
    const disabled = accepted.filter(entry => getLoreAutomationState(entry).enabled === false).length;
    return {
        total: accepted.length,
        disabled,
        enabled: Math.max(0, accepted.length - disabled),
    };
}

function formatLoreAutomationRunSummary(run = {}) {
    const parts = [formatLoreAutomationStatusLabel(run.status || 'unknown')];
    const changed = Number(run.changed || 0);
    const curated = Number(run.curated || run.pendingCurated || 0);
    const retired = Number(run.retired || 0);
    const pinned = Number(run.pinned || 0) + Number(run.unpinned || 0);
    const muted = Number(run.muted || 0) + Number(run.unmuted || 0);
    if (changed) parts.push(`${changed} changed`);
    if (pinned) parts.push(`${pinned} prominence updates`);
    if (muted) parts.push(`${muted} mute updates`);
    if (curated) parts.push(`${curated} accepted`);
    if (retired) parts.push(`${retired} retired`);
    const relevanceProvider = formatLoreAutomationProviderLabel(run.modelStatus || '');
    const automationProvider = formatLoreAutomationProviderSummary(run.providerStatus || '');
    if (relevanceProvider) parts.push(`Relevance: ${relevanceProvider}`);
    if (automationProvider) parts.push(`Provider: ${automationProvider}`);
    if (run.modelError) parts.push(String(run.modelError).slice(0, 120));
    return parts.join(' | ');
}

function formatLoreAutomationRunTimestamp(value = 0) {
    const time = Number(value || 0);
    if (!time) return 'No timestamp';
    try {
        return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return 'Recent';
    }
}

function formatLoreAutomationStatusLabel(status = '') {
    const key = String(status || '').trim().toLowerCase();
    const labels = {
        changed: 'Changed',
        unchanged: 'Unchanged',
        curated: 'Curated',
        retired: 'Retired',
        duplicates_only: 'No new cards',
        needs_context: 'Needs Context',
        no_accepted_lore: 'No accepted Lorecards',
        pending_only: 'Pending review blocked',
        no_lore: 'No Lorecards',
        disabled: 'Disabled',
        skipped_running: 'Already running',
        manual_mode: 'Manual',
        waiting: 'Waiting',
        model_failed: 'Provider failed',
        failed_parse: 'Provider parse failed',
        unavailable: 'Provider unavailable',
    };
    return labels[key] || humanizeScopeKey(key || 'unknown');
}

function formatLoreAutomationProviderLabel(status = '') {
    const key = String(status || '').trim().toLowerCase();
    const labels = {
        model: 'Utility',
        utility: 'Utility',
        reasoning: 'Reasoning',
        utility_fallback: 'Reasoning -> Utility fallback',
        model_failed: 'Provider failed',
        failed_parse: 'Provider parse failed',
        unavailable: 'Provider unavailable',
    };
    if (!key || ['skipped', 'local', 'local_only', 'no_candidates', 'duplicates_only'].includes(key)) return '';
    return labels[key] || humanizeScopeKey(key);
}

function formatLoreAutomationProviderSummary(rawStatus = '') {
    const labels = String(rawStatus || '')
        .split('/')
        .map(formatLoreAutomationProviderLabel)
        .filter(Boolean);
    const unique = Array.from(new Set(labels));
    return unique.join(' + ');
}

function createLoreAutomationActivityList(state = getState()) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-automation-activity';
    const title = document.createElement('div');
    title.className = 'saga-runtime-help saga-lore-automation-activity-title';
    title.textContent = 'Recent Activity';
    wrap.appendChild(title);

    const runs = Array.isArray(state?.loreAutomationRuns) ? state.loreAutomationRuns.slice(-4).reverse() : [];
    if (!runs.length) {
        wrap.appendChild(createEmptyMessage('No Lore Automation runs recorded yet.'));
        return wrap;
    }

    for (const run of runs) {
        const row = document.createElement('div');
        row.className = 'saga-lore-automation-run-row';
        const summary = document.createElement('div');
        summary.className = 'saga-lore-automation-run-summary';
        summary.textContent = formatLoreAutomationRunSummary(run);
        row.appendChild(summary);
        const meta = document.createElement('div');
        meta.className = 'saga-lore-automation-run-meta';
        meta.textContent = `${LORE_AUTOMATION_MODE_LABELS[normalizeLoreAutomationMode(run.mode || 'off')] || 'Off'} | ${humanizeScopeKey(run.style || 'balanced')} | ${formatLoreAutomationRunTimestamp(run.ranAt)}`;
        row.appendChild(meta);
        wrap.appendChild(row);
    }
    return wrap;
}

function createNumberSettingMini(labelText, settingKey, value, min, max, transform = null) {
    const label = document.createElement('label');
    label.className = 'saga-inline-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('change', () => {
        const next = getSettings();
        const raw = Math.max(min, Math.min(max, Number(input.value) || Number(value) || min));
        next[settingKey] = transform ? transform(raw) : raw;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    label.appendChild(span);
    label.appendChild(input);
    return label;
}

export function openNewLoreDialog(options = {}) {
    const basicReview = !!options.basicReview || isBasicExperience();
    const existing = document.querySelector('.saga-new-lore-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Manual Lore Note';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = basicReview
        ? 'Creates a pending draft for review and acceptance.'
        : 'Creates a pending draft for review, editing, and acceptance.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without creating lore.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form';
    shell.appendChild(form);

    const titleInput = createNewLoreInput(form, 'Title', 'Short descriptive title', '', false, 'Conundrum Confidicus opening hazard');
    const factInput = createNewLoreInput(form, 'Lore Text', 'The durable fact, rule, constraint, or state to remember', '', true, 'The Conundrum Confidicus is an ancient book that whispers whenever it is opened and chills the room around it.');
    const injectionInput = basicReview ? null : createNewLoreInput(form, 'Injection Override', 'Optional model-facing phrasing; blank uses Lore Text', '', true, 'When this book opens, describe faint whispers and an unnatural chill before any spell effect is revealed.');
    const notesInput = createNewLoreInput(form, 'Notes', 'Optional private notes for the user', '', true, 'Introduced during the Restricted Section scene. Keep as AU unless later tied to canon.');

    const metaGrid = document.createElement('div');
    metaGrid.className = 'saga-new-lore-meta-grid';
    form.appendChild(metaGrid);
    const categorySelect = createNewLoreSelect(metaGrid, 'Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), 'knowledge');
    const canonSelect = createNewLoreSelect(metaGrid, 'Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), 'au');
    const relevanceSelect = createNewLoreSelect(metaGrid, 'Relevance', LORE_RELEVANCE_TIERS, 'normal', value => LORE_RELEVANCE_LABELS[value] || value);
    const prioritySelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Priority', getLorePriorityValues().map(String), '50');
    const truthSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Truth', getLoreRegistryValues('truthStatuses', ['true', 'rumor', 'contested', 'hidden']), 'true');
    const revealSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Reveal', getLoreRegistryValues('revealPolicies', ['private', 'public', 'do_not_reveal']), 'private');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated tags', '', false, 'restricted-section, cursed-book, whispers');

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Add to Pending Review', 'Adds this draft to Pending Review.', () => {
        const title = titleInput.value.trim();
        const fact = factInput.value.trim();
        if (!title || !fact) {
            toast('New lore needs both a title and lore text.', 'warning');
            return;
        }

        const entry = normalizeLoreEntry({
            title,
            fact,
            category: categorySelect.value,
            canon: canonSelect.value,
            canonStatus: canonSelect.value,
            relevance: relevanceSelect.value,
            priority: prioritySelect ? Number(prioritySelect.value) || 50 : 50,
            truthStatus: truthSelect ? truthSelect.value : 'true',
            revealPolicy: revealSelect ? revealSelect.value : 'private',
            tags: tagsInput.value,
            source: 'manual',
            sourceInfo: {
                work: 'Manual Lore',
                notes: 'Created manually by the user.',
                confidence: 1,
            },
            content: {
                fact,
                injection: injectionInput ? injectionInput.value.trim() || fact : fact,
                notes: notesInput.value.trim(),
            },
            userEditable: true,
            userEdited: true,
            extensions: {
                sagaManualDraft: {
                    createdAt: Date.now(),
                    reviewRoute: 'manual_pending',
                },
            },
        });

        const result = appendPendingLoreEntries([entry], {
            source: 'manual',
            status: 'pending',
            summary: `Manual Lore Note draft: ${entry.title}`,
            normalizedEntryCount: 1,
            rawEntryCount: 1,
        });
        recordLoreTimelineEvent(result.state, {
            type: 'manual_create_pending',
            source: 'manual',
            summary: `Created Manual Lore Note draft: ${entry.title}`,
            counts: { pending: 1 },
            refs: [{ id: entry.id, title: entry.title, category: entry.category, relevance: entry.relevance, canon: entry.canon }],
            patch: { pendingEntries: [entry] },
            reversible: false,
            force: true,
        });
        saveState(result.state);
        overlay.remove();
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreTimeline();
        refreshLoreWorkbench();
        toast('Manual Lore Note draft added to Pending Review.', 'success');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without creating lore.', () => overlay.remove()));
    form.appendChild(actions);

    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : callback => setTimeout(callback, 0);
    schedule(() => titleInput.focus());
}

export function createNewLoreInput(container, labelText, tooltip, value = '', multiline = false, placeholder = '') {
    const label = document.createElement('label');
    label.className = 'saga-new-lore-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip);
    label.appendChild(span);
    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
    if (!multiline) input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

export function createNewLoreSelect(container, labelText, values, selected, display = null) {
    const label = document.createElement('label');
    label.className = 'saga-new-lore-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    const select = document.createElement('select');
    select.className = 'saga-lore-editor-input';
    for (const value of values) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = display ? display(value) : getLoreDisplayLabel(labelToField(labelText), value);
        if (String(value) === String(selected)) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());
    select.addEventListener('pointerdown', e => e.stopPropagation());
    select.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    label.appendChild(select);
    container.appendChild(label);
    return select;
}

export function createAcceptedLoreBulkControls(state) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-bulk-controls-card';

    const selected = getAcceptedSelectionSet(state);
    const filteredIds = getFilteredAcceptedLoreIds(state);
    const selectedCount = selected.size;
    const disabled = selectedCount === 0;

    const summary = document.createElement('div');
    summary.className = 'saga-lore-bulk-summary';
    summary.textContent = `${selectedCount} selected | ${filteredIds.length} matching current filters`;
    addTooltip(summary, 'Bulk actions apply to selected Accepted Lorecards. Use Select Filtered to select every Accepted Lorecard matching the current search and filters, not just the rendered page.');
    wrap.appendChild(summary);

    const selectRow = document.createElement('div');
    selectRow.className = 'saga-lore-bulk-row';
    const selectFiltered = createButton('Select Filtered', 'Selects every Accepted Lorecard matching the current search and filters, including entries not currently rendered by paging.', () => {
        setAcceptedLoreSelection(filteredIds, { deferSave: true });
        refreshAcceptedLoreList({ preserveScroll: true });
        refreshAcceptedLoreBulkToolbar();
        refreshLoreWorkbench();
    }, 'saga-small-button');
    selectRow.appendChild(selectFiltered);

    const clearSelection = createButton('Clear Selection', 'Clears the Accepted Lorecards selection.', () => {
        setAcceptedLoreSelection([], { deferSave: true });
        refreshAcceptedLoreList({ preserveScroll: true });
        refreshAcceptedLoreBulkToolbar();
        refreshLoreWorkbench();
    }, 'saga-small-button');
    clearSelection.disabled = disabled;
    selectRow.appendChild(clearSelection);
    wrap.appendChild(selectRow);

    const actionRow = document.createElement('div');
    actionRow.className = 'saga-lore-bulk-row';

    const addAction = (label, tooltip, fn, className = 'saga-small-button', detail = '') => {
        const btn = createButton(label, tooltip, async () => {
            const ids = Array.from(getAcceptedSelectionSet(getState()));
            if (!ids.length) {
                toast('Select one or more Accepted Lorecards first.', 'warning');
                return;
            }
            const proceed = await confirmBulkAcceptedAction(label, ids, detail || tooltip);
            if (!proceed) return;
            await fn(ids);
        }, className);
        btn.disabled = disabled;
        actionRow.appendChild(btn);
        return btn;
    };

    addAction('Elevate', 'Elevates selected Accepted Lorecards.', ids => bulkSetAcceptedElevated(ids, true), 'saga-small-button', 'Selected entries will be forced to High relevance, protected from Lore Automation, and injected directly when needed.');
    addAction('Remove Elevation', 'Removes Elevation from selected Accepted Lorecards.', ids => bulkSetAcceptedElevated(ids, false), 'saga-small-button', 'Selected entries will restore their previous relevance, mute, and Lore Automation state.');
    addAction('Mute', 'Mutes selected Accepted Lorecards so they are excluded from injection.', ids => bulkSetAcceptedMuted(ids, true), 'saga-small-button', 'Selected entries will be muted and excluded from injection.');
    addAction('Unmute', 'Unmutes selected Accepted Lorecards.', ids => bulkSetAcceptedMuted(ids, false), 'saga-small-button', 'Selected entries will be unmuted and may be injected again.');
    addAction('Delete', 'Deletes selected Accepted Lorecards from this chat after confirmation.', ids => bulkDeleteAcceptedLore(ids), 'saga-small-button saga-danger-button', 'Deleted Accepted Lorecards can be restored to Pending Review from Lore Timeline while the recovery payload is retained.');
    wrap.appendChild(actionRow);

    const editRow = document.createElement('div');
    editRow.className = 'saga-lore-bulk-row saga-lore-bulk-edit-row';
    const selectedIdsNow = () => Array.from(getAcceptedSelectionSet(getState()));
    editRow.appendChild(createBulkSelect('Relevance', LORE_RELEVANCE_TIERS, 'Set relevance tier for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Relevance', ids, `Selected entries will have relevance set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({
            ...raw,
            relevance: normalizeLoreRelevance(value),
            lifecycle: { ...(raw.lifecycle || {}), status: '', computedStatus: '', manualOverride: false, reason: 'Relevance replaced lifecycle state.' },
            extensions: { ...(raw.extensions || {}), autoRelevance: { ...(raw.extensions?.autoRelevance || {}), mode: 'manual', confidence: 1, reason: `Bulk relevance set to ${value}.`, updatedAt: Date.now() } },
        }), { loreAutomationDisableReason: LORE_AUTOMATION_MANUAL_DISABLE_REASONS.relevance });
    }, disabled, value => LORE_RELEVANCE_LABELS[value] || value));
    editRow.appendChild(createBulkSelect('Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), 'Set category for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Category', ids, `Selected entries will have category set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, category: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), 'Set canon status for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Canon Status', ids, `Selected entries will have canon status set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, canon: value, canonStatus: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Truth', getLoreRegistryValues('truthStatuses', ['true', 'false', 'public_belief', 'rumor', 'contested', 'hidden']), 'Set truth status for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Truth Status', ids, `Selected entries will have truth status set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, truthStatus: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Reveal', getLoreRegistryValues('revealPolicies', ['public', 'private', 'do_not_reveal', 'only_if_knower_present', 'only_if_user_reveals']), 'Set reveal policy for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Reveal Policy', ids, `Selected entries will have reveal policy set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, revealPolicy: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Priority', getLorePriorityValues().map(String), 'Set priority for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Priority', ids, `Selected entries will have priority set to P${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, priority: Number(value) || 50 }));
    }, disabled, value => `P${value}`));
    wrap.appendChild(editRow);

    const tagRow = document.createElement('div');
    tagRow.className = 'saga-lore-bulk-row saga-lore-bulk-tag-row';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'saga-lore-bulk-tag-input';
    tagInput.placeholder = 'Add tag to selected...';
    tagInput.disabled = disabled;
    addTooltip(tagInput, 'Adds one searchable tag to all selected Accepted Lorecards.');
    tagInput.addEventListener('click', e => e.stopPropagation());
    tagRow.appendChild(tagInput);
    const addTagBtn = createButton('Add Tag', 'Adds the typed tag to selected entries.', () => {
        const ids = Array.from(getAcceptedSelectionSet(getState()));
        const tag = normalizeLoreTag(tagInput.value);
        if (!ids.length || !tag) {
            toast(ids.length ? 'Enter a tag first.' : 'Select entries first.', 'warning');
            return;
        }
        confirmBulkAcceptedAction('Add Tag', ids, `The tag "${tag}" will be added to selected Accepted Lorecards.`).then(proceed => {
            if (!proceed) return;
            bulkAddTagToAcceptedLore(ids, tag);
            tagInput.value = '';
        });
    }, 'saga-small-button');
    addTagBtn.disabled = disabled;
    tagRow.appendChild(addTagBtn);
    wrap.appendChild(tagRow);

    return wrap;
}

async function confirmBulkAcceptedAction(actionLabel, ids, detail = '') {
    const safeIds = Array.isArray(ids) ? ids : [];
    if (!safeIds.length) {
        toast('Select one or more Accepted Lorecards first.', 'warning');
        return false;
    }
    const state = getState();
    const byId = new Map(normalizeLoreMatrix(state?.loreMatrix || []).map(entry => [entry.id, entry]));
    const names = safeIds
        .map(id => byId.get(id)?.title || id)
        .filter(Boolean)
        .slice(0, 6);
    const extra = safeIds.length > names.length ? `\n...and ${safeIds.length - names.length} more.` : '';
    const message = [
        `You are about to perform this bulk action on ${safeIds.length} Accepted Lorecard${safeIds.length === 1 ? '' : 's'}:`,
        '',
        actionLabel,
        detail ? `\n${detail}` : '',
        names.length ? `\nSelected entries:\n- ${names.join('\n- ')}${extra}` : '',
        '',
        'Continue?'
    ].join('\n');
    return await confirmAction(`Confirm bulk lore action: ${actionLabel}`, message);
}

function createBulkSelect(label, values, tooltip, onChange, disabled = false, display = null) {
    const select = document.createElement('select');
    select.className = 'saga-lore-bulk-select';
    select.disabled = disabled;
    addTooltip(select, tooltip);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `Set ${label}...`;
    placeholder.selected = true;
    select.appendChild(placeholder);
    for (const value of values) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = display ? display(value) : getLoreDisplayLabel(labelToField(label), value);
        select.appendChild(option);
    }
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('change', async () => {
        if (!select.value) return;
        const value = select.value;
        select.value = '';
        await onChange(value);
    });
    return select;
}

function labelToField(label) {
    if (label === 'Category') return 'category';
    if (label === 'Canon') return 'canonStatus';
    if (label === 'Relevance') return 'relevance';
    if (label === 'Priority') return 'priority';
    if (label === 'Truth') return 'truthStatus';
    if (label === 'Reveal') return 'revealPolicy';
    return 'category';
}

function getAcceptedLoreInitialVisibleLimit() {
    return dep('getAcceptedLoreInitialVisibleLimit', () => ACCEPTED_LORE_VISIBLE_BATCH_SIZE)();
}

function getAcceptedLorePageIncrement() {
    return dep('getAcceptedLorePageIncrement', () => ACCEPTED_LORE_VISIBLE_BATCH_SIZE)();
}

export function getFilteredLoreEntries(state) {
    const panelState = state?.lorePanel || {
        selectedCategory: 'all',
        search: '',
        selectedEntryId: '',
    };

    const { entries } = getPanelLoreState(state);
    let filtered = entries.filter(entry => !entry.isPending);

    if (panelState.selectedCategory === 'pending') {
        filtered = [];
    } else if (panelState.selectedCategory === 'active' || panelState.selectedCategory === 'high') {
        filtered = filtered.filter(e => e.relevance === 'high');
    } else if (panelState.selectedCategory === 'normal') {
        filtered = filtered.filter(e => e.relevance === 'normal');
    } else if (panelState.selectedCategory === 'low') {
        filtered = filtered.filter(e => e.relevance === 'low');
    } else if (panelState.selectedCategory === 'elevated' || panelState.selectedCategory === 'pinned') {
        filtered = filtered.filter(e => e.isElevated);
    } else if (panelState.selectedCategory === 'suppressed') {
        filtered = filtered.filter(e => e.isSuppressed);
    } else if (panelState.selectedCategory && panelState.selectedCategory !== 'all') {
        filtered = filtered.filter(e => e.category === panelState.selectedCategory);
    }

    const sourceFilter = panelState.sourceFilter || 'all';
    if (sourceFilter && sourceFilter !== 'all') {
        filtered = filtered.filter(entry => getLoreSourceBucket(entry) === sourceFilter);
    }

    const deckFilter = panelState.acceptedDeckFilter || 'all';
    if (deckFilter && deckFilter !== 'all') {
        filtered = filtered.filter(entry => entryMatchesAcceptedDeckFilter(entry, deckFilter));
    }

    const contextFilter = panelState.acceptedContextFilter || 'all';
    if (contextFilter && contextFilter !== 'all') {
        filtered = filtered.filter(entry => entryMatchesAcceptedContextFilter(entry, contextFilter));
    }

    const typeFilter = panelState.loreTypeFilter || 'all';
    if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(entry => entryMatchesLoreTypeFilter(entry, typeFilter));
    }

    filtered = [...filtered].sort(sortLoreEntriesForPanel);

    const query = String(panelState.search || '').trim().toLowerCase();
    if (!query) return filtered;

    return filtered
        .map(entry => ({ entry, score: scoreSearchEntry(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score
            || Number(b.entry.priority || 50) - Number(a.entry.priority || 50)
            || String(a.entry.title || '').localeCompare(String(b.entry.title || ''))
        )
        .map(item => item.entry);
}

function getBasicAcceptedLoreEntries(state) {
    const panelState = state?.lorePanel || { search: '' };
    const { entries } = getPanelLoreState(state);
    const filtered = entries
        .filter(entry => !entry.isPending)
        .sort(sortLoreEntriesForPanel);
    const query = String(panelState.search || '').trim().toLowerCase();
    if (!query) return filtered;

    return filtered
        .map(entry => ({ entry, score: scoreSearchEntry(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score
            || Number(b.entry.priority || 50) - Number(a.entry.priority || 50)
            || String(a.entry.title || '').localeCompare(String(b.entry.title || ''))
        )
        .map(item => item.entry);
}

export function getLoreSourceBucket(entry) {
    return getLoreSourceOriginMeta(entry).bucket || 'story-generation';
}

function sortLoreEntriesForPanel(a, b) {
    const elevatedScore = Number(!!b.isElevated) - Number(!!a.isElevated);
    if (elevatedScore) return elevatedScore;
    const pendingScore = Number(!!b.isPending) - Number(!!a.isPending);
    if (pendingScore) return pendingScore;
    const categoryScore = getLoreCategoryRank(a.category) - getLoreCategoryRank(b.category);
    if (categoryScore) return categoryScore;
    const priorityScore = Number(b.priority || 50) - Number(a.priority || 50);
    if (priorityScore) return priorityScore;
    const scopeScore = getLoreScopeSpecificity(b) - getLoreScopeSpecificity(a);
    if (scopeScore) return scopeScore;
    return String(a.title || '').localeCompare(String(b.title || ''));
}

function getLoreCategoryRank(category) {
    const order = ['event', 'timeline', 'character', 'relationship', 'location', 'faction', 'knowledge', 'secret', 'item', 'spell', 'rule', 'other'];
    const idx = order.indexOf(category || '');
    return idx >= 0 ? idx : 99;
}

export function scoreSearchEntry(entry, query) {
    const title = String(entry.title || '').toLowerCase();
    const tags = Array.isArray(entry.tags) ? entry.tags.map(t => String(t).toLowerCase()) : [];
    const scope = formatLoreScope(entry.scope).toLowerCase();
    const fact = String(entry.fact || '').toLowerCase();
    const id = String(entry.id || '').toLowerCase();
    const notes = String(entry.notes || '').toLowerCase();

    if (title === query) return 100;
    if (tags.some(t => t === query)) return 90;
    if (title.includes(query)) return 80;
    if (tags.some(t => t.includes(query))) return 70;
    if (scope.includes(query)) return 55;
    if (fact.includes(query)) return 40;
    if (notes.includes(query)) return 30;
    if (id.includes(query)) return 20;
    return 0;
}

export function refreshAcceptedLoreRow(entryId) {
    const root = getPanelRoot();
    if (!root || !entryId) return false;
    const list = root.querySelector('.saga-lore-entry-list');
    const existing = list?.querySelector?.(`[data-entry-id="${cssEscape(entryId)}"]`);
    if (!existing) return false;
    const state = getState();
    const basicReview = isBasicExperience();
    if (existing.closest?.('.saga-lorecard-workspace-list')) {
        const row = getFilteredLorecardWorkspaceRows(state).find(item => item.entry?.id === entryId || item.id === entryId);
        if (!row) {
            existing.remove();
            scheduleAcceptedLoreLayoutUpdate();
            return true;
        }
        existing.replaceWith(createLorecardWorkspaceRow(row, state, { basic: basicReview }));
        scheduleAcceptedLoreLayoutUpdate();
        return true;
    }
    const lifecycleStage = getLorecardLifecycleStage(state);
    const baseEntries = basicReview ? getBasicAcceptedLoreEntries(state) : getFilteredLoreEntries(state);
    const entry = (lifecycleStage === 'active' ? baseEntries.filter(isActiveLorecardEntry) : baseEntries).find(item => item.id === entryId);
    if (!entry) {
        existing.remove();
        return true;
    }
    existing.replaceWith(createEntryCard(entry, state, { basicReview }));
    scheduleAcceptedLoreLayoutUpdate();
    return true;
}

function restoreLoreAutomationSnapshot(entry = {}, snapshot = {}) {
    const cleanSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
    const extensions = { ...(entry.extensions || {}) };
    if (cleanSnapshot && Object.keys(cleanSnapshot).length) {
        extensions.loreAutomation = { ...cleanSnapshot };
    } else {
        delete extensions.loreAutomation;
    }
    return { ...entry, extensions };
}

function toggleElevateEntry(entryId, options = {}) {
    const state = getState();
    if (!state) return false;
    const beforeTimeline = captureLoreTimelineState(state);
    const id = String(entryId || '').trim();
    if (!id) return false;
    const selection = ensureLoreSelectionShape(state);
    const suppressedSet = new Set(selection.suppressedIds || []);
    const elevatedRecords = selection.elevated || {};
    const currentlyElevated = Object.prototype.hasOwnProperty.call(elevatedRecords, id);
    const nextElevated = options.elevated === undefined ? !currentlyElevated : options.elevated === true;
    if (currentlyElevated === nextElevated) return false;
    let changed = false;
    const now = Date.now();
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (entry.id !== id) return entry;
        changed = true;
        if (nextElevated) {
            elevatedRecords[id] = {
                elevatedAt: now,
                previousRelevance: getBaseLorecardRelevance(entry),
                previousIsActive: entry.isActive === true,
                previousMuted: suppressedSet.has(id),
                previousLoreAutomation: getLoreAutomationState(entry),
            };
            suppressedSet.delete(id);
            return normalizeLoreEntry(setLoreAutomationEnabled(entry, false, {
                at: now,
                by: 'user',
                reason: LORE_AUTOMATION_MANUAL_DISABLE_REASONS.elevation,
            }));
        }

        const record = elevatedRecords[id] || {};
        delete elevatedRecords[id];
        if (options.restoreMuted === false) suppressedSet.delete(id);
        else if (record.previousMuted === true) suppressedSet.add(id);
        else suppressedSet.delete(id);
        const restored = restoreLoreAutomationSnapshot({
            ...entry,
            isActive: record.previousIsActive === true,
            relevance: normalizeLoreRelevance(record.previousRelevance || entry.relevance || 'normal'),
        }, record.previousLoreAutomation || {});
        return normalizeLoreEntry(restored);
    });
    if (!changed) return false;
    selection.elevated = elevatedRecords;
    selection.suppressedIds = Array.from(suppressedSet);
    selection.pinnedIds = (selection.pinnedIds || []).filter(value => value !== id);
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: nextElevated ? 'elevate' : 'unelevate',
        source: 'manual',
        summary: `${nextElevated ? 'Elevated' : 'Removed Elevation from'} Lorecard.`,
    });
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
    return true;
}

function toggleSuppressEntry(entryId, options = {}) {
    const state = getState();
    if (!state) return false;
    const id = String(entryId || '').trim();
    if (!id) return false;
    const beforeTimeline = captureLoreTimelineState(state);
    const sel = ensureLoreSelectionShape(state);
    sel.pinnedIds = Array.isArray(sel.pinnedIds) ? sel.pinnedIds : [];
    sel.suppressedIds = Array.isArray(sel.suppressedIds) ? sel.suppressedIds : [];
    const idx = sel.suppressedIds.indexOf(id);
    if (idx >= 0) {
        sel.suppressedIds.splice(idx, 1);
    } else {
        const elevationRecord = sel.elevated?.[id] || null;
        if (elevationRecord) {
            delete sel.elevated[id];
            state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
                if (entry.id !== id) return entry;
                const restored = restoreLoreAutomationSnapshot({
                    ...entry,
                    isActive: elevationRecord.previousIsActive === true,
                    relevance: normalizeLoreRelevance(elevationRecord.previousRelevance || entry.relevance || 'normal'),
                }, elevationRecord.previousLoreAutomation || {});
                return normalizeLoreEntry(restored);
            });
        }
        sel.suppressedIds.push(id);
        const pinIdx = sel.pinnedIds.indexOf(id);
        if (pinIdx >= 0) sel.pinnedIds.splice(pinIdx, 1);
    }
    markLoreAutomationDisabledForEntryIds(
        state,
        [id],
        LORE_AUTOMATION_MANUAL_DISABLE_REASONS.mute,
        { at: Date.now(), by: 'user' },
    );
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: idx >= 0 ? 'unmute' : 'mute',
        source: 'manual',
        summary: `${idx >= 0 ? 'Unmuted' : 'Muted'} lore entry.`,
    });
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
    return true;
}

function createEditableLoreMetaBadge(entry, field, value, values = null, tooltip = '') {
    const fallbackValues = {
        category: LORE_CATEGORY_VALUES,
        canon: ['canon', 'au'],
        canonStatus: ['canon', 'au'],
        truthStatus: ['true', 'false', 'public_belief', 'rumor', 'contested', 'hidden'],
        revealPolicy: ['public', 'private', 'do_not_reveal', 'only_if_knower_present', 'only_if_user_reveals'],
    };
    const registryName = getLoreFieldRegistry(field);
    const effectiveValues = Array.from(new Set((Array.isArray(values) && values.length
        ? values
        : getLoreRegistryValues(registryName, fallbackValues[field] || [])
    ).map(v => String(v || '').trim()).filter(Boolean)));

    const currentValue = String(value || effectiveValues[0] || '').trim();
    const currentLabel = getLoreDisplayLabel(field, currentValue);
    const meta = registryName ? getLoreRegistryMeta(registryName, currentValue) : null;
    const help = tooltip || meta?.description || `${field}: ${currentLabel}. Choose a new value from the dropdown.`;

    const wrap = document.createElement('label');
    wrap.className = 'saga-lore-meta-select-wrap';
    applyManualChipSchema(wrap, { tone: getLoreRegistryChipTone(field, currentValue), kind: 'metadata' });
    addTooltip(wrap, help);

    const prefix = document.createElement('span');
    prefix.className = 'saga-lore-meta-select-prefix';
    prefix.textContent = (field === 'canonStatus' || field === 'canon')
        ? 'Canon'
        : field === 'truthStatus'
            ? 'Truth'
            : field === 'revealPolicy'
                ? 'Reveal'
                : 'Category';
    wrap.appendChild(prefix);

    const select = document.createElement('select');
    select.className = 'saga-lore-meta-select';
    select.setAttribute('aria-label', `${prefix.textContent} metadata`);
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());
    select.addEventListener('pointerdown', e => e.stopPropagation());
    select.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

    for (const optionValue of effectiveValues) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = getLoreDisplayLabel(field, optionValue);
        if (optionValue === currentValue) option.selected = true;
        select.appendChild(option);
    }

    if (currentValue && !effectiveValues.includes(currentValue)) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = getLoreDisplayLabel(field, currentValue);
        option.selected = true;
        select.insertBefore(option, select.firstChild);
    }

    select.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextValue = select.value;
        updateLoreEntryById(entry.id, raw => field === 'canonStatus' || field === 'canon'
            ? ({ ...raw, canon: nextValue, canonStatus: nextValue })
            : ({ ...raw, [field]: nextValue }), { deferSave: true });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    });

    wrap.appendChild(select);
    return wrap;
}

function createEditablePriorityBadge(entry) {
    const current = Number(entry.priority || 50);
    const wrap = document.createElement('label');
    wrap.className = 'saga-lore-meta-select-wrap saga-lore-meta-select-priority';
    applyManualChipSchema(wrap, { tone: 'relevance', kind: 'metadata' });
    addTooltip(wrap, 'Priority controls sorting and injection preference. Choose P10 through P100.');

    const prefix = document.createElement('span');
    prefix.className = 'saga-lore-meta-select-prefix';
    prefix.textContent = 'Priority';
    wrap.appendChild(prefix);

    const select = document.createElement('select');
    select.className = 'saga-lore-meta-select';
    select.setAttribute('aria-label', 'Priority metadata');
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());
    select.addEventListener('pointerdown', e => e.stopPropagation());
    select.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

    for (const value of getLorePriorityValues()) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = `P${value}`;
        if (value === current) option.selected = true;
        select.appendChild(option);
    }

    select.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextValue = Math.max(0, Math.min(100, Number(select.value) || 50));
        updateLoreEntryById(entry.id, raw => ({ ...raw, priority: nextValue }), { deferSave: true });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    });

    wrap.appendChild(select);
    return wrap;
}

function createEditableLoreEntryEditor(entry, options = {}) {
    const basicReview = !!options.basicReview;
    const pendingReview = !!options.pendingReview || entry?.isPending === true;
    const editor = document.createElement('div');
    editor.className = 'saga-lore-entry-editor';

    addTooltip(editor, pendingReview
        ? 'Edit this Pending Review entry directly. Changes are saved only when you click Save Entry.'
        : (basicReview ? 'Edit this Accepted Lorecard directly. Changes are saved only when you click Save Entry.' : 'Edit this Accepted Lorecard directly. Changes are saved only when you click Save Entry.'));
    for (const eventName of ['click', 'mousedown', 'pointerdown', 'touchstart']) {
        editor.addEventListener(eventName, event => event.stopPropagation(), eventName === 'touchstart' ? { passive: true } : undefined);
    }

    const autosizeTextarea = (input) => {
        if (!input || input.tagName !== 'TEXTAREA') return;
        const grow = () => {
            input.style.height = 'auto';
            input.style.height = `${Math.max(88, input.scrollHeight + 2)}px`;
        };
        input.addEventListener('input', grow);
        requestAnimationFrame(grow);
    };

    const makeField = (labelText, value, multiline = false) => {
        const label = document.createElement('label');
        label.className = 'saga-lore-editor-field';
        const span = document.createElement('span');
        span.textContent = labelText;
        label.appendChild(span);
        const input = multiline ? document.createElement('textarea') : document.createElement('input');
        input.className = multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
        if (!multiline) input.type = 'text';
        input.value = value || '';
        input.addEventListener('click', e => e.stopPropagation());
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('pointerdown', e => e.stopPropagation());
        input.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
        label.appendChild(input);
        editor.appendChild(label);
        autosizeTextarea(input);
        return input;
    };

    const titleInput = makeField('Title', entry.title || '', false);
    const factInput = makeField('Lore text / fact', entry.fact || entry.content?.fact || '', true);
    const injectionInput = basicReview ? null : makeField('Injection override', entry.content?.injection || '', true);
    const notesInput = makeField('Notes', entry.notes || entry.content?.notes || '', true);
    const metaGrid = document.createElement('div');
    metaGrid.className = 'saga-new-lore-meta-grid saga-lore-editor-meta-grid';
    editor.appendChild(metaGrid);
    const categorySelect = createNewLoreSelect(metaGrid, 'Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), entry.category || 'other');
    const canonSelect = createNewLoreSelect(metaGrid, 'Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), entry.canon || entry.canonStatus || 'canon');
    const relevanceSelect = createNewLoreSelect(metaGrid, 'Relevance', LORE_RELEVANCE_TIERS, entry.relevance || 'normal', value => RELEVANCE_META[value]?.label || value);
    const prioritySelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Priority', getLorePriorityValues().map(String), String(entry.priority || 50));
    const truthSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Truth', getLoreRegistryValues('truthStatuses', ['true', 'rumor', 'contested', 'hidden']), entry.truthStatus || 'true');
    const revealSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Reveal', getLoreRegistryValues('revealPolicies', ['private', 'public', 'do_not_reveal']), entry.revealPolicy || 'private');
    const tagsControl = null;
    const tagsInput = makeField('Tags', (entry.tags || []).join(', '), false);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const saveBtn = createButton('Save Entry', pendingReview ? 'Saves the edited title, lore text, injection override, and notes for this Pending Review entry.' : 'Saves the edited title, lore text, injection override, and notes for this Accepted Lorecard.', (btn, e) => {
        e?.stopPropagation?.();
        const title = titleInput.value.trim() || entry.title || '(Untitled lore)';
        const fact = factInput.value.trim();
        const injection = injectionInput ? injectionInput.value.trim() : entry.content?.injection || fact;
        const notes = notesInput.value.trim();
        updateLoreEntryById(entry.id, raw => ({
            ...raw,
            title,
            fact,
            notes,
            category: categorySelect.value,
            canon: canonSelect.value,
            canonStatus: canonSelect.value,
            relevance: normalizeLoreRelevance(relevanceSelect.value),
            priority: prioritySelect ? Number(prioritySelect.value) || 50 : raw.priority,
            truthStatus: truthSelect ? truthSelect.value : raw.truthStatus,
            revealPolicy: revealSelect ? revealSelect.value : raw.revealPolicy,
            tags: tagsInput.value,
            content: {
                ...(raw.content || {}),
                fact,
                injection,
                notes,
            },
            userEdited: true,
        }), {
            deferSave: false,
            loreAutomationDisableReason: pendingReview
                ? undefined
                : LORE_AUTOMATION_MANUAL_DISABLE_REASONS.content,
        });
        if (pendingReview) {
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            refreshLoreWorkbench();
            return;
        }
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }, 'saga-primary-button');
    actions.appendChild(saveBtn);
    if (options.actionsContainer) {
        options.actionsContainer.appendChild(actions);
    } else {
        editor.appendChild(actions);
    }
    return editor;
}

function updateLoreEntryById(entryId, updater, options = {}) {
    const state = getState();
    if (!entryId || typeof updater !== 'function') return false;
    const beforeTimeline = captureLoreTimelineState(state);

    for (const key of ['loreMatrix', 'pendingLoreEntries']) {
        const list = Array.isArray(state[key]) ? state[key] : [];
        const idx = list.findIndex(item => item?.id === entryId);
        if (idx < 0) continue;

        let updated = normalizeLoreEntry(updater(list[idx]));
        updated.userEdited = true;
        if (key === 'loreMatrix' && options.preserveLoreAutomation !== true) {
            updated = normalizeLoreEntry(disableLoreAutomationForManualChange(
                updated,
                options.loreAutomationDisableReason || LORE_AUTOMATION_MANUAL_DISABLE_REASONS.metadata,
                { at: Date.now(), by: 'user' },
            ));
            updated.userEdited = true;
        }
        list[idx] = updated;
        state[key] = list;
        if (key === 'loreMatrix') {
            recordLoreTimelineEvent(state, {
                before: beforeTimeline,
                after: captureLoreTimelineState(state),
                type: options.timelineType || 'edit',
                source: options.timelineSource || 'manual',
                summary: options.timelineSummary || `Edited lore entry: ${updated.title || updated.id}.`,
            });
        }
        if (options.deferSave) scheduleStateSave(state);
        else saveState(state);
        return true;
    }

    return false;
}

function addLoreTag(entryId, tag, options = {}) {
    const clean = normalizeLoreTag(tag);
    if (!clean) return false;
    return updateLoreEntryById(entryId, (entry) => {
        const tags = Array.isArray(entry.tags) ? entry.tags.map(normalizeLoreTag).filter(Boolean) : [];
        const exists = tags.some(t => t.toLowerCase() === clean.toLowerCase());
        return { ...entry, tags: exists ? tags : [...tags, clean] };
    }, options);
}

function removeLoreTag(entryId, tag, options = {}) {
    const clean = normalizeLoreTag(tag).toLowerCase();
    return updateLoreEntryById(entryId, (entry) => ({
        ...entry,
        tags: (Array.isArray(entry.tags) ? entry.tags : [])
            .map(normalizeLoreTag)
            .filter(t => t && t.toLowerCase() !== clean),
    }), options);
}

export function refreshAcceptedLoreList(options = {}) {
    const root = getPanelRoot();
    if (!root) return;
    const list = root.querySelector('.saga-lore-entry-list');
    if (!list) return;
    const scrollTop = options.preserveScroll ? list.scrollTop : 0;
    renderAcceptedLoreEntryList(list, getState(), { basicReview: isBasicExperience() });
    scheduleAcceptedLoreLayoutUpdate();
    if (options.preserveScroll) list.scrollTop = scrollTop;
}

function refreshAcceptedLoreBulkToolbar() {
    return dep('refreshAcceptedLoreBulkToolbar', () => null)();
}

function cssEscape(value) {
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function setAcceptedLoreEntryAutomation(entryId = '', enabled = true) {
    const id = String(entryId || '').trim();
    if (!id) return false;
    return updateLoreEntryById(id, entry => setLoreAutomationEnabled(entry, enabled, {
        at: Date.now(),
        by: 'manual',
        reason: enabled ? '' : LORE_AUTOMATION_MANUAL_DISABLE_REASONS.metadata,
    }), {
        deferSave: true,
        preserveLoreAutomation: true,
        timelineType: enabled ? 'lore_automation_enable' : 'lore_automation_disable',
        timelineSummary: `${enabled ? 'Enabled' : 'Disabled'} Lore Automation for Lorecard.`,
    });
}

function createLoreAutomationStateBadge(entry) {
    const automation = getLoreAutomationState(entry);
    const enabled = automation.enabled !== false;
    const reason = automation.disabledReason ? ` Reason: ${humanizeScopeKey(automation.disabledReason)}.` : '';
    return createBadge(
        enabled ? 'LA managed' : 'LA protected',
        enabled
            ? 'Lore Automation may manage this Accepted Lorecard within the selected authority mode.'
            : `Lore Automation will skip this Accepted Lorecard until it is re-enabled.${reason}`,
        { tone: enabled ? 'source' : 'muted', kind: 'status' }
    );
}

function createMicToggleIcon(muted = false) {
    const icon = document.createElement('span');
    icon.className = `saga-lorecard-mic-icon ${muted ? 'saga-lorecard-mic-icon-muted' : 'saga-lorecard-mic-icon-live'}`;
    icon.setAttribute('aria-hidden', 'true');
    const head = document.createElement('span');
    head.className = 'saga-lorecard-mic-head';
    const stem = document.createElement('span');
    stem.className = 'saga-lorecard-mic-stem';
    const slash = document.createElement('span');
    slash.className = 'saga-lorecard-mic-slash';
    icon.append(head, stem, slash);
    return icon;
}

function createWandEditIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('saga-lorecard-edit-icon-svg');

    const wand = document.createElementNS(ns, 'path');
    wand.setAttribute('class', 'saga-lorecard-edit-icon-wand');
    wand.setAttribute('d', 'M5.5 18.5 18.5 5.5');
    svg.appendChild(wand);

    const tip = document.createElementNS(ns, 'path');
    tip.setAttribute('class', 'saga-lorecard-edit-icon-spark saga-lorecard-edit-icon-spark-main');
    tip.setAttribute('d', 'm17.5 2.8.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z');
    svg.appendChild(tip);

    const lowerSpark = document.createElementNS(ns, 'path');
    lowerSpark.setAttribute('class', 'saga-lorecard-edit-icon-spark');
    lowerSpark.setAttribute('d', 'm6.2 4.2.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5.5-1.1Z');
    svg.appendChild(lowerSpark);

    const sideSpark = document.createElementNS(ns, 'path');
    sideSpark.setAttribute('class', 'saga-lorecard-edit-icon-spark');
    sideSpark.setAttribute('d', 'm19.3 14.1.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4.4-.9Z');
    svg.appendChild(sideSpark);

    return svg;
}

function openAcceptedLoreEntryEditor(entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return;

    setPanelState({
        selectedEntryId: id,
        lifecycleStage: 'accepted',
        lorecardWorkspaceEditId: id,
    }, { deferSave: true });
    refreshPanelBody({ preserveScroll: true });
    refreshLoreWorkbench();
}

function createLorecardEditButton(entry = {}, options = {}) {
    const id = String(entry?.id || '').trim();
    const editActive = id && String(getState()?.lorePanel?.lorecardWorkspaceEditId || '') === id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `saga-lorecard-edit-toggle ${editActive ? 'saga-lorecard-edit-toggle-active' : ''} ${options.className || ''}`.trim();
    button.setAttribute('aria-label', editActive ? 'Close Lorecard editor' : 'Edit Lorecard');
    button.setAttribute('aria-pressed', editActive ? 'true' : 'false');
    addTooltip(button, editActive ? 'Close this Lorecard editor.' : (options.tooltip || 'Edit this Lorecard.'));
    button.appendChild(createWandEditIcon());
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!id) return;
        if (editActive) {
            setPanelState({ selectedEntryId: id, lorecardWorkspaceEditId: '' }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true });
            refreshLoreWorkbench();
            return;
        }
        openAcceptedLoreEntryEditor(id);
    });
    return button;
}

function createLorecardMuteToggleButton(entry = {}, options = {}) {
    const muted = !!(entry.isSuppressed || entry.suppressed || entry.muted);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `saga-lorecard-mute-toggle ${muted ? 'saga-lorecard-mute-toggle-muted' : 'saga-lorecard-mute-toggle-live'} ${options.className || ''}`.trim();
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
    button.setAttribute('aria-label', muted ? 'Unmute Lorecard' : 'Mute Lorecard');
    addTooltip(button, muted
        ? 'Muted. Click to let this saved Lorecard affect prompts again.'
        : 'Unmuted. Click to keep this Lorecard saved but excluded from injection.');
    button.appendChild(createMicToggleIcon(muted));
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const updated = toggleSuppressEntry(entry.id, { deferSave: true });
        if (updated) {
            if (typeof options.onChange === 'function') options.onChange(entry.id);
            else refreshAcceptedLoreSurfaces(entry.id);
        }
    });
    return button;
}

function createLorecardElevateToggleButton(entry = {}, options = {}) {
    const elevated = isElevatedLorecardEntry(entry);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `saga-lorecard-elevate-toggle saga-lorecard-active-toggle ${elevated ? 'saga-lorecard-elevate-toggle-active saga-lorecard-active-toggle-active' : 'saga-lorecard-elevate-toggle-inactive saga-lorecard-active-toggle-inactive'} ${options.className || ''}`.trim();
    button.setAttribute('aria-pressed', elevated ? 'true' : 'false');
    button.setAttribute('aria-label', elevated ? 'Remove Elevation from Lorecard' : 'Elevate Lorecard');
    addTooltip(button, elevated
        ? 'Elevated. Click to restore this Lorecard to its previous relevance, mute, and Lore Automation state.'
        : 'Elevate this Lorecard: force High relevance, protect it from Lore Automation, and inject it directly even when High relevance is compressed.');
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const updated = toggleElevateEntry(entry.id, { deferSave: true });
        if (updated) {
            if (typeof options.onChange === 'function') options.onChange(entry.id);
            else refreshAcceptedLoreSurfaces(entry.id);
        }
    });
    return button;
}

export function createEntryCard(entry, state, options = {}) {
    const basicReview = !!options.basicReview;
    const workspaceRow = options.workspaceRow === true;
    const activeNow = isActiveLorecardEntry(entry);
    const elevatedNow = isElevatedLorecardEntry(entry);
    const card = document.createElement('div');
    card.className = 'saga-lore-entry-card';
    markTourTarget(card, entry.isPending ? 'lore.pending.entry' : 'lore.accepted.entry');
    if (entry.id) card.dataset.entryId = entry.id;
    if (basicReview) card.classList.add('saga-basic-review-entry-card');

    if (entry.isPending) card.classList.add('saga-lore-entry-pending');
    if (activeNow) card.classList.add('saga-lore-entry-active');
    if (elevatedNow) card.classList.add('saga-lore-entry-elevated');
    if (entry.isSuppressed) card.classList.add('saga-lore-entry-suppressed');
    if (getAcceptedSelectionSet(state).has(entry.id)) card.classList.add('saga-lore-entry-selected');

    const panelState = state?.lorePanel || {};
    const isExpanded = !workspaceRow && panelState.selectedEntryId === entry.id;
    if (isExpanded) card.classList.add('saga-lore-entry-expanded');

    const headerRow = document.createElement('div');
    headerRow.className = 'saga-lore-entry-header';

    if (!basicReview && !workspaceRow) {
        const selectBox = document.createElement('input');
        selectBox.type = 'checkbox';
        selectBox.className = 'saga-lore-entry-select';
        selectBox.checked = getAcceptedSelectionSet(state).has(entry.id);
        selectBox.setAttribute('aria-label', 'Select Accepted Lorecard for bulk actions');
        addTooltip(selectBox, selectBox.checked ? 'Remove this Accepted Lorecard from the bulk selection.' : 'Select this Accepted Lorecard for bulk actions.');
        selectBox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAcceptedLoreSelection(entry.id, selectBox.checked);
            if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
        });
        headerRow.appendChild(selectBox);
    }

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-entry-title-wrap';

    const titleEl = document.createElement('span');
    titleEl.className = 'saga-lore-entry-title';
    titleEl.textContent = entry.title || '(Untitled lore)';
    addTooltip(titleEl, workspaceRow ? 'Select this Accepted Lorecard to review its details.' : 'Use Edit to open this Accepted Lorecard.');
    titleWrap.appendChild(titleEl);
    headerRow.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-lore-entry-actions';
    if (!entry.isPending) {
        actions.appendChild(createLorecardEditButton(entry, {
            className: workspaceRow ? 'saga-lorecard-row-edit-toggle' : 'saga-lorecard-entry-edit-toggle',
            tooltip: basicReview ? 'Open this Accepted Lorecard for editing.' : 'Edit this Accepted Lorecard.',
        }));
        actions.appendChild(createEditableRelevanceControl(entry));
        actions.appendChild(createLorecardMuteToggleButton(entry, {
            className: workspaceRow ? 'saga-lorecard-row-mute-toggle' : '',
        }));
        actions.appendChild(createLorecardElevateToggleButton(entry, {
            className: workspaceRow ? 'saga-lorecard-row-elevate-toggle' : 'saga-lore-entry-elevate-btn',
            onChange: () => {
                if (workspaceRow) {
                    refreshPanelBody({ preserveScroll: true });
                    refreshHeader();
                    refreshLoreWorkbench();
                } else {
                    refreshAcceptedLoreSurfaces(entry.id);
                }
            },
        }));
    }

    if (actions.children.length) {
        headerRow.appendChild(actions);
    }
    card.appendChild(headerRow);

    const metaRow = document.createElement('div');
    metaRow.className = 'saga-lore-entry-meta';
    if (isExpanded) {
        metaRow.appendChild(createEditableLoreMetaBadge(entry, 'category', entry.category || 'other', null, `Category: ${entry.category || 'canon'}. Use dropdown to change.`));
        metaRow.appendChild(createLorePurposeBadge(entry));
        metaRow.appendChild(createEditableLoreMetaBadge(entry, 'canonStatus', entry.canon || entry.canonStatus || 'canon', null, `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}. Use dropdown to change.`));
        if (!basicReview) {
            metaRow.appendChild(createEditableLoreMetaBadge(entry, 'truthStatus', entry.truthStatus || 'true', null, `Truth/reveal status: ${entry.truthStatus || 'true'}. Use dropdown to change.`));
            metaRow.appendChild(createEditableLoreMetaBadge(entry, 'revealPolicy', entry.revealPolicy || 'private', null, `Reveal policy: ${entry.revealPolicy || 'private'}. Use dropdown to change.`));
            metaRow.appendChild(createEditablePriorityBadge(entry));
        }
    } else {
        metaRow.appendChild(createRegistryBadge('category', entry.category || 'other', `Category: ${entry.category || 'canon'}. Expand the entry to edit.`));
        metaRow.appendChild(createLorePurposeBadge(entry));
        metaRow.appendChild(createRegistryBadge('canonStatus', entry.canon || entry.canonStatus || 'canon', `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}. Expand the entry to edit.`));
        if (!basicReview) metaRow.appendChild(createBadge(`P${Number(entry.priority || 50)}`, 'Priority. Expand the entry to edit.', { tone: 'relevance', kind: 'metadata' }));
    }
    if (!basicReview) metaRow.appendChild(createSpellMetadataBadges(entry));
    if (entry.isPending) metaRow.appendChild(createBadge('pending', 'This entry is in Pending Review.', { tone: 'review', kind: 'status' }));
    if (elevatedNow) metaRow.appendChild(createBadge('elevated', 'Elevated entries are forced to High relevance, protected from Lore Automation, and injected directly.', { tone: 'success', kind: 'status' }));
    if (entry.isSuppressed) metaRow.appendChild(createBadge('muted', 'Muted entries are excluded from injection.', { tone: 'muted', kind: 'status' }));
    card.appendChild(metaRow);

    if (!workspaceRow) {
        card.appendChild(createTagsRow(entry, { editable: true }));
    }

    const factEl = document.createElement('div');
    factEl.className = 'saga-lore-entry-fact';
    factEl.textContent = truncateText(entry.fact || '', 140);
    addTooltip(factEl, workspaceRow ? 'Lore fact text. Select this Lorecard to review its details.' : 'Lore fact text. Use Edit to review the full entry.');
    card.appendChild(factEl);

    {
        card.addEventListener('click', (event) => {
            if (event.target?.closest?.('button, input, select, textarea, label, a')) return;
            if (!workspaceRow) return;
            setPanelState({ selectedEntryId: entry.id }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true });
        });
    }

    if (isExpanded) {
        const details = document.createElement('div');
        details.className = 'saga-lore-entry-details';

        details.appendChild(createEditableLoreEntryEditor(entry, { basicReview }));

        if (entry.fact && entry.fact.length > 140) {
            const fullFact = document.createElement('div');
            fullFact.className = 'saga-lore-entry-full-fact';
            fullFact.textContent = entry.fact;
            details.appendChild(fullFact);
        }

        const detailRows = [];
        if (activeNow) detailRows.push(['Why selected', getActiveLorecardReason(entry)]);
        if (entry.source) detailRows.push(['Source', entry.source]);
        if (hasDisplayableScope(entry.scope)) detailRows.push(['Scope', entry.scope]);
        if (entry.appliesTo?.length) detailRows.push(['Applies to', entry.appliesTo.join(', ')]);
        if (entry.publicVersion) detailRows.push(['Public version', entry.publicVersion]);
        if (entry.whoKnowsTruth?.length) detailRows.push(['Who knows truth', entry.whoKnowsTruth.join(', ')]);
        if (entry.whoSuspects?.length) detailRows.push(['Who suspects', entry.whoSuspects.join(', ')]);
        if (entry.revealPolicy) detailRows.push(['Reveal policy', entry.revealPolicy]);
        if (entry.validFrom || entry.validTo) detailRows.push(['Valid window', `${entry.validFrom || '...'} to ${entry.validTo || '...'}`]);
        if (entry.notes) detailRows.push(['Notes', entry.notes]);

        for (const [label, value] of detailRows) {
            details.appendChild(createKeyValue(label, value, `${label} metadata for this lore entry.`));
        }

        const aw = entry.activeWhen || {};
        const conditions = [];
        if (aw.erasAny?.length) conditions.push(`Eras: ${aw.erasAny.join(', ')}`);
        if (aw.locationsAny?.length) conditions.push(`Locations: ${aw.locationsAny.join(', ')}`);
        if (aw.charactersPresentAny?.length) conditions.push(`Cast: ${aw.charactersPresentAny.join(', ')}`);
        if (aw.tagsAny?.length) conditions.push(`Tags: ${aw.tagsAny.join(', ')}`);
        if (conditions.length) {
            const cond = document.createElement('div');
            cond.className = 'saga-lore-entry-conditions';
            cond.textContent = `Relevant when: ${conditions.join(' | ')}`;
            addTooltip(cond, 'Context conditions used to determine whether this lore entry should be active.');
            details.appendChild(cond);
        }

        if (entry.isPending) {
            const pendingActions = document.createElement('div');
            pendingActions.className = 'saga-lore-entry-pending-actions';
            pendingActions.appendChild(createButton('Accept', 'Accepts this pending entry into the lore matrix.', (btn, e) => {
                e?.stopPropagation?.();
                const current = getState();
                const pending = normalizeLoreMatrix(current?.pendingLoreEntries || []);
                const idx = pending.findIndex(pe => pe.id === entry.id);
                if (idx >= 0) {
                    acceptPendingLoreEntry(idx);
                    refreshPanelBody({ preserveScroll: true });
                    refreshHeader();
                }
            }, 'saga-primary-button'));
            pendingActions.appendChild(createButton('Reject', 'Rejects this pending entry.', (btn, e) => {
                e?.stopPropagation?.();
                const current = getState();
                const pending = normalizeLoreMatrix(current?.pendingLoreEntries || []);
                const idx = pending.findIndex(pe => pe.id === entry.id);
                if (idx >= 0) {
                    rejectPendingLoreEntry(idx);
                    refreshPanelBody({ preserveScroll: true });
                    refreshHeader();
                }
            }));
            details.appendChild(pendingActions);
        }

        card.appendChild(details);
    }

    return card;
}

function shouldShowLorecardListTags() {
    return true;
}

function createTagsRow(entry, options = {}) {
    const editable = options.editable !== false;
    const row = document.createElement('div');
    row.className = 'saga-lore-entry-tags';
    if (!editable) row.classList.add('saga-lore-entry-tags-readonly');
    addTooltip(row, editable
        ? 'Tags are editable search labels. Search matches tags as well as entry titles.'
        : 'Lorecard tags. Long-press the card and open the editor to change tags.');

    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    for (const tag of tags) {
        const chip = createChip({
            label: '',
            tooltip: `Lorecard tag: ${tag}`,
            kind: 'tag',
            tone: 'tag',
            density: 'compact',
            className: 'saga-lore-tag-chip',
        });

        if (editable) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'saga-lore-tag-remove';
            removeBtn.type = 'button';
            removeBtn.textContent = 'x';
            addTooltip(removeBtn, `Remove tag: ${tag}`);
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeLoreTag(entry.id, tag, { deferSave: true });
                if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
                refreshLoreWorkbench();
            });
            chip.appendChild(removeBtn);
        }

        const label = document.createElement('span');
        label.className = 'saga-lore-tag-label';
        label.textContent = tag;
        chip.appendChild(label);
        row.appendChild(chip);
    }

    if (editable) {
        const addBtn = document.createElement('button');
        addBtn.className = 'saga-lore-tag-add';
        addBtn.type = 'button';
        addBtn.textContent = '+';
        addTooltip(addBtn, 'Add a searchable tag to this lore entry.');
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showInlineTagInput(row, entry.id, addBtn);
        });
        row.appendChild(addBtn);
    }

    return row;
}

function showInlineTagInput(row, entryId, addBtn) {
    if (row.querySelector('.saga-lore-tag-input')) return;

    const input = document.createElement('input');
    input.className = 'saga-lore-tag-input';
    input.type = 'text';
    input.placeholder = 'tag';
    addTooltip(input, 'Type a tag and press Enter. Press Escape to cancel.');

    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            input.dataset.committed = '1';
            commitInlineTagInput(entryId, input.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            input.remove();
        }
    });
    input.addEventListener('blur', () => {
        if (input.dataset.committed === '1') return;
        if (input.value.trim()) {
            input.dataset.committed = '1';
            commitInlineTagInput(entryId, input.value);
        } else {
            input.remove();
        }
    });

    row.insertBefore(input, addBtn);
    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : callback => setTimeout(callback, 0);
    schedule(() => input.focus());
}

function commitInlineTagInput(entryId, rawTag) {
    const tag = normalizeLoreTag(rawTag);
    if (!tag) {
        refreshPanelBody({ preserveScroll: true });
        return;
    }
    addLoreTag(entryId, tag, { deferSave: true });
    if (!refreshAcceptedLoreRow(entryId)) refreshAcceptedLoreList({ preserveScroll: true });
    refreshLoreWorkbench();
}

function normalizeLorecardLifecycleStage(value = '') {
    const stage = String(value || '').trim().toLowerCase();
    return LORECARD_LIFECYCLE_STAGES.includes(stage) ? stage : '';
}

function normalizeLorecardWorkflowStage(value = '') {
    const stage = String(value || '').trim().toLowerCase();
    if (stage === 'pending' || stage === 'accepted' || stage === 'active' || stage === 'approved' || stage === 'cards') return 'lore';
    if (stage === 'suggested' || stage === 'generation') return 'generate';
    return ['generate', 'automation', 'lore'].includes(stage) ? stage : '';
}

function isSuggestedPendingLore(entry = {}) {
    if (!entry || typeof entry !== 'object') return false;
    const source = getLoreSourceBucket(entry);
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    return source !== 'manual'
        || !!generation.operation
        || !!generation.qualityRoute
        || !!reviewMeta.reviewRoute
        || String(entry.source || '').toLowerCase().includes('suggest');
}

function isActiveLorecardEntry(entry = {}) {
    if (!entry || entry.isPending) return false;
    if (entry.isSuppressed || entry.suppressed || entry.muted) return false;
    return getLifecycleStatus(entry) === 'high';
}

function getActiveLorecardReason(entry = {}) {
    if (!isActiveLorecardEntry(entry)) return '';
    const lifecycleReason = String(entry.lifecycle?.reason || '').trim();
    if (lifecycleReason) return truncateText(lifecycleReason, 180);
    const autoRelevanceReason = String(entry.extensions?.autoRelevance?.reason || '').trim();
    if (autoRelevanceReason) return truncateText(autoRelevanceReason, 180);
    if (isElevatedLorecardEntry(entry)) return 'Elevated: forced to High relevance, protected from Lore Automation, and injected directly when needed.';
    if (getLifecycleStatus(entry) === 'high') return 'High relevance Lorecards are eligible for high-tier prompt injection.';
    return 'Eligible for prompt injection.';
}

function getLorecardLifecycleStats(state = getState()) {
    const pendingEntries = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const loreState = getPanelLoreState(state);
    const acceptedEntries = (loreState.entries || []).filter(entry => !entry.isPending);
    const activeEntries = acceptedEntries.filter(isActiveLorecardEntry);
    const suggestedEntries = pendingEntries.filter(isSuggestedPendingLore);
    const pendingReviewEntries = pendingEntries.filter(entry => !isSuggestedPendingLore(entry));
    return {
        suggestedEntries,
        pendingEntries: pendingReviewEntries,
        allPendingEntries: pendingEntries,
        acceptedEntries,
        activeEntries,
        suggestedCount: suggestedEntries.length,
        pendingCount: pendingReviewEntries.length,
        allPendingCount: pendingEntries.length,
        acceptedCount: acceptedEntries.length,
        activeCount: activeEntries.length,
    };
}

function normalizeLorecardWorkspaceFilter(value = '') {
    const filter = String(value || '').trim().toLowerCase();
    return LORECARD_WORKSPACE_FILTERS.some(([key]) => key === filter) ? filter : 'all';
}

function normalizeLorecardWorkspaceSort(value = '') {
    const sort = String(value || '').trim().toLowerCase();
    return LORECARD_WORKSPACE_SORTS.some(([key]) => key === sort) ? sort : 'alphabetical';
}

function getNextLorecardWorkspaceSort(value = 'alphabetical') {
    const normalized = normalizeLorecardWorkspaceSort(value);
    const index = LORECARD_WORKSPACE_SORTS.findIndex(([key]) => key === normalized);
    return LORECARD_WORKSPACE_SORTS[(index + 1) % LORECARD_WORKSPACE_SORTS.length]?.[0] || 'alphabetical';
}

function getLorecardWorkspaceRows(state = getState()) {
    const pendingEntries = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const acceptedEntries = (getPanelLoreState(state).entries || []).filter(entry => !entry.isPending);
    const pendingRows = pendingEntries.map((entry, index) => {
        const descriptors = getPendingLoreReviewStateDescriptors(entry);
        return {
            id: getLoreReviewId(entry) || entry.id || `pending-${index}`,
            entry,
            index,
            status: 'pending',
            isPending: true,
            isAccepted: false,
            isActive: false,
            isElevated: false,
            isMuted: !!(entry.isSuppressed || entry.suppressed || entry.muted),
            hasConflict: descriptors.some(descriptor => descriptor.key === 'conflict'),
            hasDuplicate: descriptors.some(descriptor => descriptor.key === 'duplicate'),
            confidence: Number(entry.confidence),
            relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
            priority: Number(entry.priority || 50),
            updatedAt: Number(entry.updatedAt || entry.createdAt || entry.extensions?.sagaManualDraft?.createdAt || 0),
        };
    });
    const acceptedRows = acceptedEntries.map((entry, index) => ({
        id: entry.id || `accepted-${index}`,
        entry,
        index,
        status: 'accepted',
        isPending: false,
        isAccepted: true,
        isActive: isActiveLorecardEntry(entry),
        isElevated: !!entry.isElevated,
        isMuted: !!(entry.isSuppressed || entry.suppressed || entry.muted),
        hasConflict: false,
        hasDuplicate: false,
        confidence: Number(entry.confidence),
        relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
        priority: Number(entry.priority || 50),
        updatedAt: Number(entry.updatedAt || entry.createdAt || entry.lastUpdated || 0),
    }));
    return [...pendingRows, ...acceptedRows];
}

function getLorecardWorkspaceCounts(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return {
        all: safeRows.length,
        'needs-review': safeRows.filter(row => row.isPending).length,
        high: safeRows.filter(row => row.isActive).length,
        elevated: safeRows.filter(row => row.isElevated).length,
        muted: safeRows.filter(row => row.isMuted).length,
        conflicts: safeRows.filter(row => row.hasConflict || row.hasDuplicate).length,
    };
}

function rowMatchesLorecardWorkspaceFilter(row, filter = 'all') {
    if (filter === 'needs-review') return row.isPending;
    if (filter === 'active' || filter === 'high') return row.isActive;
    if (filter === 'pinned' || filter === 'elevated') return row.isElevated;
    if (filter === 'muted') return row.isMuted;
    if (filter === 'conflicts') return row.hasConflict || row.hasDuplicate;
    return true;
}

function getLorecardWorkspaceRowTitle(row = {}) {
    return String(row.entry?.title || row.id || '').trim();
}

function getLorecardWorkspaceRelevanceSortRank(row = {}) {
    if (row.isElevated) return 0;
    const relevance = normalizeLoreRelevance(row.relevance || row.entry?.relevance || 'normal');
    if (relevance === 'high') return 1;
    if (relevance === 'normal') return 2;
    return 3;
}

function sortLorecardWorkspaceRows(a, b, sortMode = 'alphabetical') {
    const normalizedSort = normalizeLorecardWorkspaceSort(sortMode);
    const titleScore = getLorecardWorkspaceRowTitle(a).localeCompare(getLorecardWorkspaceRowTitle(b));
    const priorityScore = Number(b.priority || 50) - Number(a.priority || 50);
    if (normalizedSort === 'relevance') {
        const relevanceScore = getLorecardWorkspaceRelevanceSortRank(a) - getLorecardWorkspaceRelevanceSortRank(b);
        if (relevanceScore) return relevanceScore;
        if (titleScore) return titleScore;
        if (priorityScore) return priorityScore;
        return String(a.id || '').localeCompare(String(b.id || ''));
    }
    if (normalizedSort === 'alphabetical') {
        if (titleScore) return titleScore;
        if (priorityScore) return priorityScore;
        return String(a.id || '').localeCompare(String(b.id || ''));
    }
    if (priorityScore) return priorityScore;
    if (titleScore) return titleScore;
    return String(a.id || '').localeCompare(String(b.id || ''));
}

function getFilteredLorecardWorkspaceRows(state = getState()) {
    const rows = getLorecardWorkspaceRows(state);
    const panelState = state?.lorePanel || {};
    const filter = normalizeLorecardWorkspaceFilter(panelState.lorecardWorkspaceFilter || 'all');
    const sort = normalizeLorecardWorkspaceSort(panelState.lorecardWorkspaceSort || 'alphabetical');
    const query = String(panelState.search || '').trim().toLowerCase();
    const filtered = rows
        .filter(row => rowMatchesLorecardWorkspaceFilter(row, filter))
        .filter(row => !query || scoreSearchEntry(row.entry, query) > 0);
    return filtered.sort((a, b) => {
        if (query) {
            const score = scoreSearchEntry(b.entry, query) - scoreSearchEntry(a.entry, query);
            if (score) return score;
        }
        return sortLorecardWorkspaceRows(a, b, sort);
    });
}

function setLorecardWorkspaceFilter(filter = 'all') {
    setPanelState({
        lorecardWorkspaceFilter: normalizeLorecardWorkspaceFilter(filter),
        acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit(),
        pendingReviewVisibleLimit: 10,
    }, { deferSave: true });
    refreshPanelBody({ preserveScroll: true });
}

function setLorecardWorkspaceSort(sort = 'alphabetical') {
    setPanelState({
        lorecardWorkspaceSort: normalizeLorecardWorkspaceSort(sort),
        acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit(),
    }, { deferSave: true });

    refreshPanelBody({ preserveScroll: true });
}

function refreshLorecardWorkspaceListOnly() {
    const root = getPanelRoot();
    const workspace = root?.querySelector?.('.saga-lorecard-workspace');
    const list = workspace?.querySelector?.('.saga-lorecard-workspace-list');
    if (!workspace || !list) return false;
    const state = getState();
    const panelState = state?.lorePanel || {};
    const sortButton = workspace.querySelector('.saga-lorecard-workspace-sort-toggle');
    const preserveSortFocus = sortButton && document.activeElement === sortButton;
    if (sortButton) {
        const nextButton = createLorecardWorkspaceSortToggle(panelState.lorecardWorkspaceSort || 'alphabetical');
        sortButton.replaceWith(nextButton);
        if (preserveSortFocus) nextButton.focus?.();
    }
    renderLorecardWorkspaceList(list, state, getFilteredLorecardWorkspaceRows(state), {
        basic: isBasicExperience(),
    });
    scheduleAcceptedLoreLayoutUpdate();
    return true;
}

function refreshLorecardWorkspaceListForSortSensitiveChange() {
    const sort = normalizeLorecardWorkspaceSort(getState()?.lorePanel?.lorecardWorkspaceSort || 'alphabetical');
    if (sort !== 'relevance') return false;
    return refreshLorecardWorkspaceListOnly();
}

function createLorecardWorkspaceFilterChip(filter, label, count, activeFilter) {
    const active = filter === activeFilter;
    const chip = createChip({
        label: `${label}${count > 0 ? ` ${count}` : ''}`,
        tooltip: active ? `Showing ${label} Lorecards.` : `Filter Lorecards to ${label}.`,
        kind: 'filter',
        tone: active ? 'selected' : (count ? 'source' : 'muted'),
        density: 'touch',
        interactive: true,
        className: 'saga-lorecard-workspace-filter-chip',
    });
    chip.dataset.lorecardWorkspaceFilter = filter;
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) chip.classList.add('saga-lorecard-workspace-filter-active');
    chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLorecardWorkspaceFilter(filter);
    });
    return chip;
}

function createLorecardWorkspaceSortToggle(activeSort = 'alphabetical') {
    const normalized = normalizeLorecardWorkspaceSort(activeSort);
    const [, label, title] = LORECARD_WORKSPACE_SORTS.find(([key]) => key === normalized) || LORECARD_WORKSPACE_SORTS[0];
    const nextSort = getNextLorecardWorkspaceSort(normalized);
    const [, nextLabel, nextTitle] = LORECARD_WORKSPACE_SORTS.find(([key]) => key === nextSort) || LORECARD_WORKSPACE_SORTS[0];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'saga-lorecard-workspace-sort-toggle';
    button.dataset.lorecardWorkspaceSort = normalized;
    const ariaLabel = `Sort Lorecards by ${title}. Press to switch to ${nextTitle}. Modes: Alphabetical, Priority, Relevance.`;
    button.setAttribute('aria-label', ariaLabel);
    button.textContent = label;
    addTooltip(button, `Sort by ${title}. Press for ${nextLabel}: ${nextTitle}. Modes: A, P, R.`);
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLorecardWorkspaceSort(nextSort);
    });
    return button;
}

function createLorecardWorkspace(state = getState(), options = {}) {
    const basic = !!options.basic;
    const rows = getLorecardWorkspaceRows(state);
    const filteredRows = getFilteredLorecardWorkspaceRows(state);
    const counts = getLorecardWorkspaceCounts(rows);
    const selectedCount = getAcceptedSelectionSet(state).size + getPendingReviewSelectedIds(state).size;
    const panelState = state?.lorePanel || {};
    const activeFilter = normalizeLorecardWorkspaceFilter(panelState.lorecardWorkspaceFilter || 'all');
    const activeSort = normalizeLorecardWorkspaceSort(panelState.lorecardWorkspaceSort || 'alphabetical');

    const workspace = document.createElement('div');
    workspace.className = 'saga-runtime-card saga-lorecard-workspace';

    markTourTarget(workspace, 'lore.workspace');

    const status = document.createElement('div');
    status.className = 'saga-loredeck-row-meta saga-lorecard-workspace-status';
    status.appendChild(createStatusPill(`Needs Review: ${counts['needs-review']}`, 'Pending Review entries waiting for Accept or Reject.', { tone: counts['needs-review'] ? 'review' : 'muted', kind: 'count' }));
    status.appendChild(createStatusPill(`High: ${counts.high}`, 'Accepted Lorecards in the High relevance tier, including Elevated cards.', { tone: counts.high ? 'selected' : 'muted', kind: 'count' }));
    status.appendChild(createStatusPill(`Elevated: ${counts.elevated}`, 'Accepted Lorecards temporarily forced to High relevance and protected from Lore Automation.', { tone: counts.elevated ? 'success' : 'muted', kind: 'count' }));
    if (selectedCount) status.appendChild(createStatusPill(`Selected: ${selectedCount}`, 'Lorecards selected for contextual actions.', { tone: 'source', kind: 'count' }));

    const toolbar = document.createElement('div');
    toolbar.className = 'saga-lorecard-workspace-toolbar';
    const searchRow = document.createElement('div');
    searchRow.className = 'saga-lorecard-workspace-search-row';
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'saga-lore-search saga-lorecard-workspace-search';
    search.placeholder = 'Search Lorecards...';
    search.value = panelState.search || '';
    addTooltip(search, 'Search pending and accepted Lorecards by title, tags, fact text, notes, or ID.');
    search.addEventListener('input', (event) => {
        preserveInputFocusAfterRender(search, '.saga-lorecard-workspace-search', () => {
            setPanelState({
                search: event.target.value,
                acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit(),
            }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true });
        });
    });
    searchRow.appendChild(search);
    searchRow.appendChild(createLorecardWorkspaceSortToggle(activeSort));
    toolbar.appendChild(searchRow);

    {
        const utilities = document.createElement('div');
        utilities.className = 'saga-lorecard-workspace-utilities';
        if (!basic) {
            utilities.appendChild(markTourTarget(createButton('Pending Workbench', 'Open a larger Pending Review workspace with dense rows and a detail pane.', () => {
                openLoreWorkbench('pending');
            }, 'saga-small-button'), 'lore.pending.workbench'));
            utilities.appendChild(markTourTarget(createButton('Accepted Workbench', 'Open a larger Accepted Lorecards workspace with filters, bulk actions, dense rows, and a detail pane.', () => {
                openLoreWorkbench('accepted');
            }, 'saga-small-button'), 'lore.accepted.workbench'));
            utilities.appendChild(markTourTarget(createButton('Timeline', 'Open the Lore Timeline audit and recovery workbench.', () => {
                openLoreTimeline();
            }, 'saga-small-button'), 'lore.timeline.open'));
        }
        if (utilities.childElementCount) toolbar.appendChild(utilities);
    }
    workspace.appendChild(toolbar);

    const filterRow = document.createElement('div');
    filterRow.className = 'saga-lorecard-workspace-filters';
    for (const [filter, label] of LORECARD_WORKSPACE_FILTERS) {
        filterRow.appendChild(createLorecardWorkspaceFilterChip(filter, label, Number(counts[filter] || 0), activeFilter));
    }
    workspace.appendChild(filterRow);

    const body = document.createElement('div');
    body.className = 'saga-lorecard-workspace-body';
    const list = document.createElement('div');
    list.className = 'saga-lore-entry-list saga-lorecard-workspace-list';
    markTourTarget(list, 'lore.cards.list');
    list.setAttribute('role', 'region');
    list.setAttribute('aria-label', 'Lorecards');
    renderLorecardWorkspaceList(list, state, filteredRows, { basic });
    body.appendChild(list);

    {
        body.appendChild(createLorecardWorkspaceDetailPane(state, filteredRows, { basic }));
    }
    workspace.appendChild(body);

    return workspace;
}

function renderLorecardWorkspaceList(list, state, rows, options = {}) {
    if (!list) return;
    list.replaceChildren();
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        list.appendChild(createEmptyMessage('No Lorecards match the current filters.'));
        return;
    }

    const panelState = state?.lorePanel || {};
    const initialVisibleLimit = getAcceptedLoreInitialVisibleLimit();
    const visibleLimit = Math.min(
        safeRows.length,
        Math.max(initialVisibleLimit, Number(panelState.acceptedLoreVisibleLimit) || initialVisibleLimit)
    );
    const visible = safeRows.slice(0, visibleLimit);
    const summary = document.createElement('div');
    summary.className = 'saga-lore-list-summary saga-lorecard-workspace-list-summary';
    const summaryCount = document.createElement('span');
    summaryCount.className = 'saga-lorecard-workspace-list-summary-count';
    summaryCount.textContent = safeRows.length > visible.length
            ? `Showing ${visible.length} of ${safeRows.length} Lorecards.`
            : `Showing ${safeRows.length} Lorecard${safeRows.length === 1 ? '' : 's'}.`;
    summary.appendChild(summaryCount);
    list.appendChild(summary);

    for (const row of visible) {
        list.appendChild(createLorecardWorkspaceRow(row, state, options));
    }

    if (safeRows.length > visible.length) {
        const more = createButton(`Show ${Math.min(getAcceptedLorePageIncrement(), safeRows.length - visible.length)} more`, 'Renders more Lorecards in the unified list.', () => {
            setPanelState({ acceptedLoreVisibleLimit: visible.length + getAcceptedLorePageIncrement() }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true });
        }, 'saga-small-button saga-lore-show-more');
        list.appendChild(more);
    }
}

function createLorecardWorkspaceRow(row, state, options = {}) {
    const basic = !!options.basic;
    if (row.isPending) {
        const selected = isPendingLoreSelected(state, row.entry);
        const card = createPendingLoreReviewCard(row.entry, row.index, selected, {
            basicReview: basic,
            allowSelection: false,
            workspaceRow: true,
        });
        card.classList.add('saga-lorecard-workspace-row');
        card.dataset.lorecardWorkspaceStatus = 'pending';
        return card;
    }

    const card = createEntryCard(row.entry, state, {
        basicReview: basic,
        workspaceRow: true,
    });
    card.classList.add('saga-lorecard-workspace-row');
    card.dataset.lorecardWorkspaceStatus = 'accepted';
    return card;
}

function createLorecardWorkspaceDetailPane(state, rows = [], options = {}) {
    const detail = document.createElement('div');
    detail.className = 'saga-lorecard-workspace-detail';
    markTourTarget(detail, 'lore.cards.detail');

    const selectedId = String(state?.lorePanel?.selectedEntryId || '').trim();
    const selected = rows.find(row => row.id === selectedId || row.entry?.id === selectedId) || rows[0];
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select a Lorecard to review details.'));
        return detail;
    }

    if (selected.isPending) {
        detail.appendChild(createPendingLorecardWorkspaceDetail(selected));
    } else {
        detail.appendChild(createAcceptedLorecardWorkspaceDetail(selected.entry, options));
    }
    return detail;
}

function createPendingLorecardWorkspaceDetail(row) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lorecard-detail-card saga-lorecard-detail-card-pending';
    const entry = row.entry || {};
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = entry.title || 'Pending Lorecard';
    wrap.appendChild(title);
    wrap.appendChild(createPendingLoreDetailSummary(entry));
    const fact = document.createElement('div');
    fact.className = 'saga-lore-entry-full-fact';
    fact.textContent = entry.fact || '(No fact text)';
    wrap.appendChild(fact);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-lorecard-detail-actions';
    actions.appendChild(createButton('Accept', 'Accept this Pending Review entry.', () => {
        acceptPendingLoreEntry(row.index);
        togglePendingReviewSelection(getLoreReviewId(entry), false);
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reject', 'Reject this Pending Review entry.', () => {
        rejectPendingLoreEntry(row.index);
        togglePendingReviewSelection(getLoreReviewId(entry), false);
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }, 'saga-small-button'));
    wrap.appendChild(actions);
    return wrap;
}

function createAcceptedLorecardWorkspaceDetail(entry = {}, options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lorecard-detail-card saga-lorecard-detail-card-accepted';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = entry.title || '(Untitled lore)';
    wrap.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-lore-entry-meta saga-lorecard-detail-meta';
    meta.appendChild(createRegistryBadge('category', entry.category || 'other', `Category: ${entry.category || 'other'}.`));
    meta.appendChild(createLorePurposeBadge(entry));
    meta.appendChild(createRegistryBadge('canonStatus', entry.canon || entry.canonStatus || 'canon', `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}.`));
    if (entry.isElevated) meta.appendChild(createBadge('elevated', 'Elevated entries are forced to High relevance, protected from Lore Automation, and injected directly.', { tone: 'success', kind: 'status' }));
    if (entry.isSuppressed) meta.appendChild(createBadge('muted', 'Muted entries are excluded from injection.', { tone: 'muted', kind: 'status' }));
    meta.appendChild(createLoreAutomationStateBadge(entry));
    wrap.appendChild(meta);

    const fact = document.createElement('div');
    fact.className = 'saga-lore-entry-full-fact';
    fact.textContent = entry.fact || '(No fact text)';
    wrap.appendChild(fact);

    const rows = [];
    rows.push(['Relevance', LORE_RELEVANCE_LABELS[getLifecycleStatus(entry)] || getLifecycleStatus(entry) || 'Normal']);
    rows.push(['Priority', `P${Number(entry.priority || 50)}`]);
    if (isActiveLorecardEntry(entry)) rows.push(['Why selected', getActiveLorecardReason(entry)]);
    if (entry.source) rows.push(['Source', entry.source]);
    if (hasDisplayableScope(entry.scope)) rows.push(['Scope', entry.scope]);
    if (entry.notes) rows.push(['Notes', truncateText(entry.notes, 240)]);
    for (const [label, value] of rows) {
        wrap.appendChild(createKeyValue(label, value, `${label} metadata for this Lorecard.`));
    }

    const editActive = String(getState()?.lorePanel?.lorecardWorkspaceEditId || '') === String(entry.id || '');

    if (editActive) {
        wrap.appendChild(createEditableLoreEntryEditor(entry, { basicReview: !!options.basic }));
    }

    return wrap;
}

function getRecommendedLorecardLifecycleStage(state = getState(), stats = getLorecardLifecycleStats(state)) {

    if (stats.suggestedCount) return 'suggested';
    if (stats.pendingCount) return 'pending';
    return 'accepted';
}

function getLorecardLifecycleStage(state = getState(), stats = getLorecardLifecycleStats(state)) {
    const savedStage = normalizeLorecardLifecycleStage(state?.lorePanel?.lifecycleStage);
    return savedStage
        || getRecommendedLorecardLifecycleStage(state, stats);
}

function openLorecardLifecycleStage(stage) {
    const normalized = (normalizeLorecardLifecycleStage(stage)) || ('accepted');

    const workspaceFilter = normalized === 'pending'
        ? 'needs-review'
        : normalized === 'active'
            ? 'active'
            : 'all';
    setPanelState({
        lorecardsStage: normalized === 'suggested' ? 'generate' : 'lore',
        lifecycleStage: normalized === 'suggested' ? 'generate' : 'lore',
        lorecardWorkspaceFilter: workspaceFilter,
        pendingReviewVisibleLimit: 10,
        acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit(),
    }, { deferSave: true });
    selectRuntimeLorecardsStage(normalized === 'suggested' ? 'generate' : 'lore');
}

function createLorecardActiveSetSection(state = getState(), stats = getLorecardLifecycleStats(state)) {
    const section = document.createElement('div');
    section.className = 'saga-lore-active-set-section';
    const activeEntries = stats.activeEntries || [];
    const hasAcceptedEntries = Number(stats.acceptedCount || 0) > 0;
    const availableEntries = [...(stats.acceptedEntries || [])]
        .filter(entry => !isActiveLorecardEntry(entry))
        .sort(sortLoreEntriesForPanel);
    const availableCount = availableEntries.length;

    const header = document.createElement('div');
    header.className = 'saga-lore-active-set-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'High Relevance';
    addTooltip(title, 'Accepted Lorecards currently in the High relevance tier, including Elevated cards.');
    header.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(`${activeEntries.length} high`, 'High-relevance Accepted Lorecards.', { tone: activeEntries.length ? 'selected' : 'muted', kind: 'count' }));
    chips.appendChild(createStatusPill(`${availableCount} normal/low`, 'Accepted Lorecards saved outside High relevance.', { tone: availableCount ? 'source' : 'muted', kind: 'count' }));
    header.appendChild(chips);
    section.appendChild(header);

    if (!activeEntries.length) {
        section.appendChild(createEmptyMessage(hasAcceptedEntries
            ? 'No Accepted Lorecards are currently High relevance. Use Accepted Lorecards to set relevance, Elevate, or unmute saved facts.'
            : 'No High relevance Lorecards yet. Capture or suggest a Lorecard to start the review flow.'
        ));
    } else {
        const tray = document.createElement('div');
        tray.className = 'saga-lore-active-set-tray';
        for (const entry of activeEntries.slice(0, 8)) {
            tray.appendChild(createLorecardActiveSetItem(entry));
        }
        section.appendChild(tray);
        if (activeEntries.length > 8) {
            const more = document.createElement('div');
            more.className = 'saga-runtime-help saga-compact-help';
            more.textContent = `Showing 8 of ${activeEntries.length} High relevance Lorecards.`;
            section.appendChild(more);
        }
    }

    if (availableEntries.length) {
        const available = document.createElement('div');
        available.className = 'saga-lore-available-set';
        const availableHeader = document.createElement('div');
        availableHeader.className = 'saga-lore-active-set-subheader';
        const availableTitle = document.createElement('div');
        availableTitle.className = 'saga-runtime-card-title';
        availableTitle.textContent = 'Normal / Low Accepted Lorecards';
        addTooltip(availableTitle, 'Accepted Lorecards saved outside the High relevance tier.');
        availableHeader.appendChild(availableTitle);
        availableHeader.appendChild(createStatusPill(`${availableEntries.length} available`, 'Accepted Lorecards that are not currently High relevance.', {
            tone: 'source',
            kind: 'count',
        }));
        available.appendChild(availableHeader);

        const availableTray = document.createElement('div');
        availableTray.className = 'saga-lore-active-set-tray saga-lore-available-set-tray';
        for (const entry of availableEntries.slice(0, 6)) {
            availableTray.appendChild(createLorecardAvailableSetItem(entry));
        }
        available.appendChild(availableTray);

        if (availableEntries.length > 6) {
            const more = document.createElement('div');
            more.className = 'saga-runtime-help saga-compact-help';
            more.textContent = `Showing 6 of ${availableEntries.length} available Accepted Lorecards.`;
            available.appendChild(more);
        }
        section.appendChild(available);
    }

    {
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-lore-active-set-actions';
        actions.appendChild(createButton('Accepted Lorecards', 'Show the Accepted Lorecards list for relevance, mute, Elevate, and edit controls.', () => openLorecardLifecycleStage('accepted'), hasAcceptedEntries ? 'saga-primary-button' : ''));
        actions.appendChild(createButton('Generate', 'Open Generate to create more reviewable Lorecards.', () => openLorecardLifecycleStage('suggested'), hasAcceptedEntries ? '' : 'saga-primary-button'));
        section.appendChild(actions);
    }
    return section;
}

function refreshLorecardLifecycleSurface() {
    refreshPanelBody({ preserveScroll: true });
    refreshHeader();
    refreshLoreWorkbench();
}

function appendActiveSetStateChips(main, entry = {}, mode = 'active') {
    const states = [];
    if (mode !== 'active' && (entry.isSuppressed || entry.suppressed || entry.muted)) {
        states.push({
            label: 'Muted',
            tooltip: 'This Accepted Lorecard is saved but temporarily excluded from prompt injection.',
            tone: 'muted',
        });
    } else if (mode !== 'active') {
        states.push({
            label: 'Available',
            tooltip: 'This Accepted Lorecard is trusted and saved but not currently High relevance.',
            tone: 'source',
        });
    }
    if (entry.isElevated) {
        states.push({
            label: 'Elevated',
            tooltip: 'Elevated Accepted Lorecards are forced to High relevance, protected from Lore Automation, and injected directly.',
            tone: 'success',
        });
    }
    if (!states.length) return;
    const row = document.createElement('div');
    row.className = 'saga-lore-active-set-state-row';
    for (const state of states) {
        row.appendChild(createChip({
            label: state.label,
            tooltip: state.tooltip,
            kind: 'status',
            tone: state.tone,
            density: 'compact',
            className: 'saga-lore-active-set-state-chip',
        }));
    }
    main.appendChild(row);
}

function createLorecardActiveSetItem(entry = {}) {
    const item = document.createElement('div');
    item.className = 'saga-lore-active-set-item';

    const main = document.createElement('div');
    main.className = 'saga-lore-active-set-main';
    const title = document.createElement('div');
    title.className = 'saga-lore-active-set-title';
    title.textContent = entry.title || '(Untitled lore)';
    main.appendChild(title);
    const fact = document.createElement('div');
    fact.className = 'saga-runtime-help saga-lore-active-set-fact';
    fact.textContent = truncateText(entry.fact || '', 120) || 'No fact text.';
    main.appendChild(fact);
    appendActiveSetStateChips(main, entry, 'active');
    item.appendChild(main);

    {
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-lore-active-set-item-actions';
        actions.appendChild(createLorecardEditButton(entry, {
            className: 'saga-lorecard-active-set-edit-toggle',
            tooltip: 'Edit this High relevance Lorecard in Accepted Lorecards.',
        }));
        actions.appendChild(createEditableRelevanceControl(entry));
        actions.appendChild(createLorecardMuteToggleButton(entry, { onChange: refreshLorecardLifecycleSurface }));
        actions.appendChild(createLorecardElevateToggleButton(entry, { onChange: refreshLorecardLifecycleSurface }));
        item.appendChild(actions);
    }
    return item;
}

function createLorecardAvailableSetItem(entry = {}) {
    const item = document.createElement('div');
    item.className = 'saga-lore-active-set-item saga-lore-available-set-item';

    const main = document.createElement('div');
    main.className = 'saga-lore-active-set-main';
    const title = document.createElement('div');
    title.className = 'saga-lore-active-set-title';
    title.textContent = entry.title || '(Untitled lore)';
    main.appendChild(title);
    const fact = document.createElement('div');
    fact.className = 'saga-runtime-help saga-lore-active-set-fact';
    fact.textContent = truncateText(entry.fact || '', 120) || 'No fact text.';
    main.appendChild(fact);
    appendActiveSetStateChips(main, entry, 'available');
    item.appendChild(main);

    {
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-lore-active-set-item-actions';
        actions.appendChild(createLorecardEditButton(entry, {
            className: 'saga-lorecard-active-set-edit-toggle',
            tooltip: 'Edit this Accepted Lorecard.',
        }));
        actions.appendChild(createEditableRelevanceControl(entry));
        actions.appendChild(createLorecardMuteToggleButton(entry, { onChange: refreshLorecardLifecycleSurface }));
        actions.appendChild(createLorecardElevateToggleButton(entry, { onChange: refreshLorecardLifecycleSurface }));
        item.appendChild(actions);
    }
    return item;
}

function inspectAcceptedLoreEntry(entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return;

    setPanelState({ selectedEntryId: id, lifecycleStage: 'accepted' }, { deferSave: true });
    refreshPanelBody({ preserveScroll: true });
    refreshLoreWorkbench();
}

function activateAcceptedLoreEntry(entryId = '') {
    return toggleElevateEntry(entryId, { elevated: true, deferSave: true });
}

function deactivateAcceptedLoreEntry(entryId = '') {
    return toggleElevateEntry(entryId, { elevated: false, deferSave: true });
}

function refreshAcceptedLoreSurfaces(entryId = '', options = {}) {
    const listRefreshed = options.sortSensitive === true && refreshLorecardWorkspaceListForSortSensitiveChange();
    if (!listRefreshed) {
        if (entryId && !refreshAcceptedLoreRow(entryId)) refreshAcceptedLoreList({ preserveScroll: true });
        if (!entryId) refreshAcceptedLoreList({ preserveScroll: true });
    }
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

export function renderLorecardsTab(container, state) {
    const basic = isBasicExperience();
    const lifecycleStats = getLorecardLifecycleStats(state);
    const recommendedLifecycleStage = getRecommendedLorecardLifecycleStage(state, lifecycleStats);
    const lifecycleStage = getRuntimeLorecardsStage(state?.lorePanel, recommendedLifecycleStage, getSettings());
    const stageMeta = LORECARD_LIFECYCLE_STAGE_META[lifecycleStage] || LORECARD_LIFECYCLE_STAGE_META.lore;
    container.classList.add('saga-operator-tab', 'saga-lorecards-lifecycle-tab', 'saga-lorecards-workspace-tab', `saga-lore-stage-filter-${lifecycleStage}`);
    container.dataset.sagaLoreLifecycleStage = lifecycleStage;
    container.appendChild(createSectionHeader(
        `Lorecards: ${stageMeta.label || 'Lore'}`,
        getLorecardsStageSummary(lifecycleStage, { basic, lifecycleStats })
    ));

    container.appendChild(createLorecardsStageContent(state, { basic, lifecycleStats, lifecycleStage }));
}

function getLorecardsStageSummary(lifecycleStage = 'lore', options = {}) {
    const basic = !!options.basic;
    const lifecycleStats = options.lifecycleStats || {};
    if (lifecycleStage === 'generate') {
        return basic
            ? 'Draft Manual Lore Notes, scan story text, and prepare Pending Review entries.'
            : 'Draft Manual Lore Notes, preview canon sources, scan story text, and prepare Pending Review entries.';
    }
    if (lifecycleStage === 'automation') {
        return 'Configure Lore Automation, run it now, inspect recent activity, and recover the last run.';
    }
    const total = Number(lifecycleStats.allPendingCount || lifecycleStats.pendingCount || 0) + Number(lifecycleStats.acceptedCount || 0);
    return basic
        ? `Review and manage ${total} Lorecard${total === 1 ? '' : 's'} with advanced controls hidden.`
        : 'Review pending and accepted Lorecards in one workspace with search, filters, timeline tools, and card details.';
}

function createLorecardsStageContent(state, options = {}) {
    const fragment = document.createDocumentFragment();
    const basic = !!options.basic;
    const lifecycleStats = options.lifecycleStats || getLorecardLifecycleStats(state);
    const requestedStage = normalizeLorecardWorkflowStage(options.lifecycleStage);
    const lifecycleStage = basic && requestedStage === 'automation'
        ? getDefaultRuntimeLorecardsStage(getSettings())
        : requestedStage;
    if (lifecycleStage === 'generate') {
        fragment.appendChild(createLorecardGenerationCollapsible(state, { basic, lifecycleStats, lifecycleStage: 'generate' }));
        return fragment;
    }
    if (!basic && lifecycleStage === 'automation') {
        fragment.appendChild(createLoreAutomationPage(state));
        return fragment;
    }
    fragment.appendChild(createLorecardWorkspace(state, { basic, lifecycleStats }));
    return fragment;
}

function createLoreAutomationPage(state = getState()) {
    const page = document.createElement('div');
    page.className = 'saga-lore-automation-page';

    markTourTarget(page, 'lore.autoRelevance.page');
    page.appendChild(createAutoRelevanceCard(state));
    return page;
}

function createLorecardGenerationCollapsible(state, options = {}) {
    const basic = !!options.basic;
    const lifecycleStats = options.lifecycleStats || getLorecardLifecycleStats(state);
    const lifecycleStage = normalizeLorecardWorkflowStage(options.lifecycleStage) || normalizeLorecardLifecycleStage(options.lifecycleStage);
    const generationSection = createCollapsibleSection(
        'lore.generation',
        'Generate',
        basic ? 'manual note + story scan' : 'manual note + canon/story sources',
        lifecycleStage === 'generate' || lifecycleStage === 'suggested' || (!lifecycleStats.pendingCount && !lifecycleStats.acceptedCount),
        dep('createLoreGenerationCard')(state),
        { tooltip: 'Suggest canon Lorecards from the local database or generate story-specific Lorecards from recent chat messages.', className: 'saga-lore-generation-collapsible' }
    );
    markTourTarget(generationSection, 'lore.generation.section');
    return generationSection;
}

function createLorecardPendingCollapsible(state, options = {}) {
    const basic = !!options.basic;
    const lifecycleStage = options.lifecycleStage || 'pending';
    const reviewStageCount = Number(options.reviewStageCount || 0);
    const pendingSection = createCollapsibleSection(
        'lore.pendingReview',
        'Pending Review',
        reviewStageCount ? `${reviewStageCount} pending` : 'none',
        lifecycleStage === 'pending' || (basic && reviewStageCount > 0),
        createPendingLoreReviewSection(state, { basicReview: basic, lifecycleStage }),
        { tooltip: 'Review suggested/generated Lorecards before accepting them.', className: 'saga-lore-pending-collapsible' }
    );
    markTourTarget(pendingSection, 'lore.pending');
    return pendingSection;
}

function createLorecardActiveSetCollapsible(state, options = {}) {
    const lifecycleStats = options.lifecycleStats || getLorecardLifecycleStats(state);
    const lifecycleStage = options.lifecycleStage || 'accepted';
    const activeSetSection = createCollapsibleSection(
        'lore.activeSet',
        'High Relevance',
        lifecycleStats.activeCount ? `${lifecycleStats.activeCount} high` : 'none high',
        lifecycleStage === 'accepted' || lifecycleStage === 'active',
        createLorecardActiveSetSection(state, lifecycleStats),
        { tooltip: 'Edit, set relevance, mute, and Elevate Accepted Lorecards currently in High relevance.', className: 'saga-lore-active-set-collapsible' }
    );
    markTourTarget(activeSetSection, 'lore.activeSet');
    return activeSetSection;
}

function createLorecardAcceptedCollapsible(state, options = {}) {
    const basic = !!options.basic;
    const acceptedCount = Number(options.acceptedCount || 0);
    const injectableCount = Number(options.injectableCount || 0);
    const acceptedSection = createCollapsibleSection(
        'lore.acceptedEntries',
        'Accepted Lorecards',
        basic ? `${acceptedCount} accepted \u00b7 ${injectableCount} selected` : `${acceptedCount} accepted \u00b7 ${injectableCount} injectable`,
        true,
        createAcceptedLoreEntriesSection(state, { basicReview: basic }),
        { tooltip: basic ? 'Search and review Accepted Lorecards that can affect future responses.' : 'Search, filter, bulk edit, tag, Elevate, mute, and edit Accepted Lorecards.', className: 'saga-lore-accepted-collapsible' }
    );
    markTourTarget(acceptedSection, 'lore.accepted');
    return acceptedSection;
}

export function createPendingLoreReviewSection(state, options = {}) {
    const basicReview = !!options.basicReview;
    const pendingLore = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const filteredPendingRows = getFilteredPendingLoreRows(state, { lifecycleStage: options.lifecycleStage });
    const filteredPendingEntries = filteredPendingRows.map(row => row.entry);
    const allowSelection = !basicReview;
    const section = document.createElement('div');
    section.className = 'saga-review-section saga-pending-lore-section';
    if (state.layer1ReviewRevision) section.appendChild(createButton('Show all pending proposals', 'Clear this analysis filter.', () => {
        const current = getState(); delete current.layer1ReviewRevision; saveState(current);
        refreshPanelBody({ preserveScroll: true }); refreshLoreWorkbench();
    }));
    if (basicReview) section.classList.add('saga-basic-review-pending-section');

    if (!basicReview) {
        section.appendChild(createLoreWorkbenchLaunchRow('pending', pendingLore.length ? `${pendingLore.length} Pending Review entries` : 'No Pending Review entries yet'));
    }

    if (pendingLore.length > 0) {
        const batchInfo = document.createElement('div');
        batchInfo.className = 'saga-runtime-help';
        batchInfo.textContent = basicReview
            ? 'Accept facts that should affect future responses. Reject the rest.'
            : getPendingLoreBatchLabel(state);
        section.appendChild(batchInfo);

        const filterRow = document.createElement('div');
        filterRow.className = 'saga-lore-filter-row saga-pending-lore-filter-row';
        filterRow.appendChild(createLoreTypeFilterSelect(
            pendingLore,
            getPendingReviewTypeFilter(state),
            (value) => {
                setPendingReviewTypeFilter(value);
                refreshPanelBody({ preserveScroll: true });
                refreshLoreWorkbench();
            },
            { tooltip: 'Filter Pending Review entries by relevance, card type, canon/AU, or review state.' }
        ));
        filterRow.appendChild(createLoreSourceFilterSelect(
            pendingLore,
            getPendingReviewSourceFilter(state),
            (value) => {
                setPendingReviewSourceFilter(value);
                refreshPanelBody({ preserveScroll: true });
                refreshLoreWorkbench();
            },
            {
                className: 'saga-lore-source-filter',
                tooltip: 'Filter Pending Review entries by source: manual notes, story scans, Deck Maker drafts, or Context suggestions.',
                showCounts: true,
            }
        ));
        filterRow.appendChild(createStatusPill(`${filteredPendingRows.length} matching`, 'Pending Review entries matching the current review filters.', {
            tone: filteredPendingRows.length ? 'selected' : 'muted',
            kind: 'count',
            className: 'saga-lore-workbench-count',
        }));
        section.appendChild(filterRow);

        const selectedBatchCount = countPendingReviewSelections(state, filteredPendingEntries);
        if (filteredPendingEntries.length && (!basicReview)) {
            section.appendChild(markTourTarget(createPendingLoreBulkControls(filteredPendingEntries, state), 'lore.pending.bulk'));
        } else if (basicReview && pendingLore.length > 8) {
            const advancedRow = document.createElement('div');
            advancedRow.className = 'saga-basic-advanced-handoff';
            advancedRow.appendChild(createButton('Bulk Tools in Advanced', 'Switch to Advanced Lorecards and open the Pending Review workbench.', () => openAdvancedLoreReview('pending'), 'saga-small-button'));
            section.appendChild(advancedRow);
        }

        const visibleLimit = Math.max(5, Math.min(1000, Number(state?.lorePanel?.pendingReviewVisibleLimit) || 10));
        const list = document.createElement('div');
        list.className = 'saga-review-lore-list saga-pending-lore-list';
        markTourTarget(list, 'lore.pending.list');
        filteredPendingRows.slice(0, visibleLimit).forEach(row => list.appendChild(createPendingLoreReviewCard(row.entry, row.index, isPendingLoreSelected(state, row.entry), { basicReview, allowSelection })));
        if (!filteredPendingRows.length) {
            list.appendChild(createEmptyMessage('No Pending Review entries match the current filters.'));
        }
        section.appendChild(list);

        if (filteredPendingRows.length > visibleLimit) {
            const more = createButton(`Show ${Math.min(25, filteredPendingRows.length - visibleLimit)} more`, 'Renders more Pending Review entries. Keeping this list paged prevents large canon batches from freezing the browser.', () => {
                const current = getState();
                current.lorePanel.pendingReviewVisibleLimit = Math.min(filteredPendingRows.length, visibleLimit + 25);
                saveState(current);
                refreshPanelBody({ preserveScroll: true });
            });
            more.classList.add('saga-small-button');
            section.appendChild(more);
        }
    } else {
        section.appendChild(createEmptyMessage(basicReview
            ? 'No Pending Review entries are waiting. Use Generate to draft a Manual Lore Note.'
            : 'No Pending Review entries are waiting. Use Generate for canon suggestions, story scans, or Manual Lore Notes.'
        ));
    }

    return section;
}

export function createAcceptedLoreEntriesSection(state, options = {}) {
    const basicReview = !!options.basicReview;
    const section = document.createElement('div');
    section.className = 'saga-accepted-lore-section';

    if (basicReview) section.classList.add('saga-basic-review-accepted-section');

    const controls = document.createElement('div');
    controls.className = 'saga-lore-controls';

    const panelState = state?.lorePanel || { selectedCategory: 'all', search: '' };
    const loreState = getPanelLoreState(state);
    const { entries, categories, counts } = loreState;
    const acceptedCount = Math.max(0, (counts?.all || 0) - (counts?.pending || 0));

    if (!basicReview) {
        controls.appendChild(createLoreWorkbenchLaunchRow('accepted', `${acceptedCount} Accepted Lorecards`));
    } else if (basicReview && acceptedCount > 12) {
        const advancedRow = document.createElement('div');
        advancedRow.className = 'saga-basic-advanced-handoff';
        advancedRow.appendChild(createButton('Manage in Advanced', 'Switch to Advanced Lorecards and open the Accepted Lorecards workbench.', () => openAdvancedLoreReview('accepted'), 'saga-small-button'));
        controls.appendChild(advancedRow);
    }

    if (!basicReview) {
        const tabs = document.createElement('div');
        tabs.className = 'saga-lore-tabs';
        markTourTarget(tabs, 'lore.accepted.categoryTabs');
        for (const cat of categories) {
            const tab = document.createElement('button');
            tab.className = 'saga-lore-tab';
            if (cat === panelState.selectedCategory) tab.classList.add('saga-lore-tab-active');
            tab.type = 'button';
            const label = getLoreDisplayLabel('category', cat);
            const catCount = getCategoryCount(cat, entries, counts);
            tab.textContent = `${label} (${catCount})`;
            tab.dataset.category = cat;
            addTooltip(tab, getCategoryTooltip(cat));
            tab.addEventListener('click', () => {
                setPanelState({ selectedCategory: cat, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
                refreshAcceptedLoreCategoryTabs(cat);
                refreshAcceptedLoreFilterResults({ resetListScroll: true });
            });
            tabs.appendChild(tab);
        }
        controls.appendChild(tabs);
    }

    const filterRow = document.createElement('div');
    filterRow.className = 'saga-lore-filter-row';
    markTourTarget(filterRow, 'lore.accepted.filters');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'saga-lore-search';
    searchInput.placeholder = basicReview ? 'Search Accepted Lorecards...' : 'Search titles and tags...';
    searchInput.value = panelState.search || '';
    addTooltip(searchInput, basicReview ? 'Search Accepted Lorecards by title, tags, fact text, notes, or ID.' : 'Searches lore entry titles and tags first. Fact text, notes, and IDs are searched as fallback.');
    searchInput.addEventListener('input', (e) => {
        setPanelState({ search: e.target.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        scheduleAcceptedLoreListRender(section);
    });
    filterRow.appendChild(searchInput);

    if (!basicReview) {
        const sourceSelect = document.createElement('select');
        sourceSelect.className = 'saga-lore-source-filter';
        addTooltip(sourceSelect, 'Filter Accepted Lorecards by origin: canon database, story scan, Deck Maker drafts, Context suggestions, or manual/user-created entries.');
        for (const [value, label] of LORE_SOURCE_FILTER_OPTIONS) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if ((panelState.sourceFilter || 'all') === value) opt.selected = true;
            sourceSelect.appendChild(opt);
        }
        sourceSelect.addEventListener('change', () => {
            setPanelState({ sourceFilter: sourceSelect.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
        });
        filterRow.appendChild(sourceSelect);

        const acceptedPool = entries.filter(entry => !entry.isPending);
        const deckSelect = document.createElement('select');
        deckSelect.className = 'saga-lore-deck-filter';
        addTooltip(deckSelect, 'Filter Accepted Lorecards by their source Loredeck or entries without deck metadata.');
        for (const [value, label] of getAcceptedLoreDeckFilterOptions(acceptedPool)) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if ((panelState.acceptedDeckFilter || 'all') === value) opt.selected = true;
            deckSelect.appendChild(opt);
        }
        deckSelect.addEventListener('change', () => {
            setPanelState({ acceptedDeckFilter: deckSelect.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
        });
        filterRow.appendChild(deckSelect);

        const contextSelect = document.createElement('select');
        contextSelect.className = 'saga-lore-context-filter';
        addTooltip(contextSelect, 'Filter Accepted Lorecards by Context metadata or Context gate result.');
        for (const [value, label] of getAcceptedLoreContextFilterOptions(acceptedPool)) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if ((panelState.acceptedContextFilter || 'all') === value) opt.selected = true;
            contextSelect.appendChild(opt);
        }
        contextSelect.addEventListener('change', () => {
            setPanelState({ acceptedContextFilter: contextSelect.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
        });
        filterRow.appendChild(contextSelect);

        filterRow.appendChild(createLoreTypeFilterSelect(
            acceptedPool,
            panelState.loreTypeFilter || 'all',
            (value) => {
                setPanelState({ loreTypeFilter: value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
                refreshAcceptedLoreFilterResults({ resetListScroll: true });
            },
            { tooltip: 'Filter Accepted Lorecards by relevance, card type, canon/AU, elevation, or mute state.' }
        ));
    }
    controls.appendChild(filterRow);

    if (!basicReview) {
        const pinHelp = document.createElement('div');
        pinHelp.className = 'saga-runtime-help saga-pin-help';
        markTourTarget(pinHelp, 'lore.accepted.pinMuteHelp');
        pinHelp.textContent = 'Elevated = High, protected, direct. Muted = excluded from injection. Relevance controls tier placement, sorting, and compression budget.';
        addTooltip(pinHelp, 'Elevate important facts that must stay prominent and uncompressed. Mute facts that should stay stored but not be sent to the model.');
        controls.appendChild(pinHelp);

        const bulkMount = document.createElement('div');
        bulkMount.className = 'saga-lore-bulk-toolbar';
        markTourTarget(bulkMount, 'lore.accepted.bulk');
        bulkMount.appendChild(createAcceptedLoreBulkControls(state));
        controls.appendChild(bulkMount);
    }

    section.appendChild(controls);

    const list = document.createElement('div');
    list.className = 'saga-lore-entry-list saga-accepted-lore-scroll-region';
    markTourTarget(list, 'lore.accepted.list');
    list.setAttribute('role', 'region');
    list.setAttribute('aria-label', 'Accepted Lorecards');
    renderAcceptedLoreEntryList(list, state, { basicReview });
    section.appendChild(list);
    return section;
}

export function renderAcceptedLoreEntryList(list, state, options = {}) {
    if (!list) return;
    list.replaceChildren();

    const basicReview = !!options.basicReview;
    const lifecycleStage = getLorecardLifecycleStage(state);
    const filtered = basicReview ? getBasicAcceptedLoreEntries(state) : getFilteredLoreEntries(state);
    const lifecycleFiltered = !basicReview && lifecycleStage === 'active'
        ? filtered.filter(isActiveLorecardEntry)
        : filtered;
    if (lifecycleFiltered.length === 0) {
        list.appendChild(createEmptyMessage(lifecycleStage === 'active'
            ? 'No High relevance Lorecards match the current filter. Use Accepted Lorecards to set relevance or Elevate saved facts.'
            : 'No Accepted Lorecards match the current filter.'
        ));
        return;
    }

    const panelState = state?.lorePanel || {};
    const initialVisibleLimit = getAcceptedLoreInitialVisibleLimit();
    const visibleLimit = Math.min(
        lifecycleFiltered.length,
        Math.max(initialVisibleLimit, Number(panelState.acceptedLoreVisibleLimit) || initialVisibleLimit)
    );
    const visible = lifecycleFiltered.slice(0, visibleLimit);
    const fragment = document.createDocumentFragment();

    const summary = document.createElement('div');
    summary.className = 'saga-lore-list-summary';
    summary.textContent = lifecycleFiltered.length > visible.length
        ? `Showing ${visible.length} of ${lifecycleFiltered.length} Accepted Lorecards.`
        : `Showing ${lifecycleFiltered.length} Accepted Lorecard${lifecycleFiltered.length === 1 ? '' : 's'}.`;
    fragment.appendChild(summary);

    for (const entry of visible) {
        fragment.appendChild(createEntryCard(entry, state, { basicReview }));
    }

    if (lifecycleFiltered.length > visible.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'saga-secondary-button saga-lore-show-more';
        const pageIncrement = getAcceptedLorePageIncrement();
        const nextCount = Math.min(pageIncrement, lifecycleFiltered.length - visible.length);
        more.textContent = `Show ${nextCount} more`;
        addTooltip(more, 'Renders more Accepted Lorecards. Keeping the list paged prevents large lore matrices from slowing the browser.');
        more.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPanelState({ acceptedLoreVisibleLimit: visible.length + pageIncrement }, { deferSave: true });
            refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
        });
        fragment.appendChild(more);
    }

    list.appendChild(fragment);
}
