import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    runBusyAction,
    toast,
} from '../ui/runtime-ui-kit.js';
import {
    preserveInputFocusAfterRender,
} from '../ui/input-focus-preservation.js';
import {
    formatContextIndexSummary,
    getContextPackSummary,
} from './context-panel.js';
import {
    analyzeContextQuery,
    contextTextIncludesTerm,
    normalizeContextSearchText,
    rankContextAnchors,
} from './context-index.js';

let contextWorkbenchDeps = {};

export function configureContextWorkbenchPanel(deps = {}) {
    contextWorkbenchDeps = { ...contextWorkbenchDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = contextWorkbenchDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Context Workbench dependency is not configured: ${name}`);
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

function getContextWorkbenchTab() { return dep('getContextWorkbenchTab', () => 'context')(); }
function setContextWorkbenchTab(tabId) { return dep('setContextWorkbenchTab', () => null)(tabId); }
function getContextWorkbenchPackId() { return dep('getContextWorkbenchPackId', () => '')(); }
function setContextWorkbenchPackId(packId) { return dep('setContextWorkbenchPackId', () => null)(packId); }
function clearContextWorkbenchSelectedKey() { return dep('clearContextWorkbenchSelectedKey', () => null)(); }
function renderContextWorkbench() { return dep('renderContextWorkbench', () => null)(); }
function closeContextWorkbench() { return dep('closeContextWorkbench', () => null)(); }

function refreshContextHeader() { return dep('refreshContextHeader', () => null)(); }
function clearContextIndexCache() { return dep('clearContextIndexCache', () => null)(); }
function loadContextIndex(options) { return dep('loadContextIndex', async () => null)(options); }
function getRuntimeState() { return dep('getRuntimeState', () => ({}))(); }
function getContextWorkbenchStack(state) { return dep('getContextWorkbenchStack', () => [])(state); }
function getContextWorkbenchPack(state) { return dep('getContextWorkbenchPack', () => null)(state); }
function getContextWorkbenchTimelineItems(pack, contextIndex) { return dep('getContextWorkbenchTimelineItems', () => [])(pack, contextIndex); }
function filterContextWorkbenchTimelineItems(items, query, typeFilter) { return dep('filterContextWorkbenchTimelineItems', items => items)(items, query, typeFilter); }
function getContextTimelineItemKey(item) { return dep('getContextTimelineItemKey', item => `${item?.kind || 'item'}:${item?.id || ''}`)(item); }
function getContextTimelineItemContextText(item) { return dep('getContextTimelineItemContextText', () => '')(item); }
function getContextTimelineItemCoordinateText(item) { return dep('getContextTimelineItemCoordinateText', () => '')(item); }
function getLoredeckContext(state, packId) { return dep('getLoredeckContext', () => ({}))(state, packId); }
function getLoredeckDisplayName(packId) { return dep('getLoredeckDisplayName', packId => String(packId || 'Loredeck'))(packId); }
function getContextTypeLabel(value) { return dep('getContextTypeLabel', value => String(value || 'Custom'))(value); }
function formatContextSummary(context) { return dep('formatContextSummary', () => 'Unset.')(context); }
function formatContextSource(value) { return dep('formatContextSource', value => String(value || 'Unknown'))(value); }
function getContextWorkbenchQuery() { return dep('getContextWorkbenchQuery', () => '')(); }
function setContextWorkbenchQuery(query) { return dep('setContextWorkbenchQuery', () => null)(query); }
function getContextWorkbenchSelectedKey() { return dep('getContextWorkbenchSelectedKey', () => '')(); }
function setContextWorkbenchSelectedKey(itemKey) { return dep('setContextWorkbenchSelectedKey', () => null)(itemKey); }
function getContextWorkbenchTypeFilter() { return dep('getContextWorkbenchTypeFilter', () => 'all')(); }
function setContextWorkbenchTypeFilter(typeFilter) { return dep('setContextWorkbenchTypeFilter', () => null)(typeFilter); }
function getContextWorkbenchStoryPositionQuery() { return dep('getContextWorkbenchStoryPositionQuery', () => '')(); }
function setContextWorkbenchStoryPositionQuery(query) { return dep('setContextWorkbenchStoryPositionQuery', () => null)(query); }
function getContextWorkbenchStoryPositionFilter() { return dep('getContextWorkbenchStoryPositionFilter', () => 'major')(); }
function setContextWorkbenchStoryPositionFilter(filter) { return dep('setContextWorkbenchStoryPositionFilter', () => null)(filter); }
function getContextWorkbenchResolverQuery() { return dep('getContextWorkbenchResolverQuery', () => '')(); }
function setContextWorkbenchResolverQuery(query) { return dep('setContextWorkbenchResolverQuery', () => null)(query); }
function resolveContextsFromContext(btn) { return dep('resolveContextsFromContext', async () => null)(btn); }
function modelResolveContexts(btn) { return dep('modelResolveContexts', async () => null)(btn); }
function setLoredeckContextManualLock(packId, manualLock) { return dep('setLoredeckContextManualLock', () => null)(packId, manualLock); }
function resetLoredeckContextFromWorkbench(packId) { return dep('resetLoredeckContextFromWorkbench', async () => null)(packId); }
function seedLoredeckContextFromRuntimeContext(packId, context) { return dep('seedLoredeckContextFromRuntimeContext', () => null)(packId, context); }
function appendContextManualFields(container, packId, context) { return dep('appendContextManualFields', () => null)(container, packId, context); }
function applyContextTimelineItem(packId, item) { return dep('applyContextTimelineItem', () => null)(packId, item); }
function applyContextAnchor(packId, anchor) { return dep('applyContextAnchor', () => null)(packId, anchor); }
function applyContextEntryCandidate(packId, match) { return dep('applyContextEntryCandidate', () => null)(packId, match); }
function applyContextAnchorBoundary(packId, item, mode) { return dep('applyContextAnchorBoundary', () => null)(packId, item, mode); }
function commitLoredeckContextPatch(packId, patch, options) { return dep('commitLoredeckContextPatch', () => null)(packId, patch, options); }
function validateLoredeckForEditor(pack, btn) { return dep('validateLoredeckForEditor', async () => null)(pack, btn); }
function loadLoredeckEntriesForEditor(pack, btn) { return dep('loadLoredeckEntriesForEditor', async () => null)(pack, btn); }
function canValidateLoredeckInEditor(pack) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function getLoredeckEntryPreview(packId) { return dep('getLoredeckEntryPreview', () => null)(packId); }
function getContextWorkbenchEntryRows(pack) { return dep('getContextWorkbenchEntryRows', () => [])(pack); }
function buildContextEntryDerivedAnchor(pack, row, analysis) { return dep('buildContextEntryDerivedAnchor', () => null)(pack, row, analysis); }
function getContextResolverMissReasons(pack, analysis, packIndex) { return dep('getContextResolverMissReasons', () => [])(pack, analysis, packIndex); }
function getContextEntryResolverMatches(pack, analysis, options) { return dep('getContextEntryResolverMatches', () => [])(pack, analysis, options); }
function queueContextEntryCandidateTimelineAnchor(pack, match) { return dep('queueContextEntryCandidateTimelineAnchor', () => false)(pack, match); }
function openDuplicateLoredeckDialog(pack) { return dep('openDuplicateLoredeckDialog', () => null)(pack); }
function normalizeLoredeckTimelineId(value) { return dep('normalizeLoredeckTimelineId', value => String(value || '').trim().toLowerCase())(value); }
function normalizeLoredeckTimelineNumber(value) { return dep('normalizeLoredeckTimelineNumber', value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
})(value); }

function getContextWorkbenchConfidenceTone(confidence) {
    const value = Number(confidence);
    if (!Number.isFinite(value)) return 'muted';
    if (value >= 0.8) return 'success';
    if (value >= 0.55) return 'info';
    return 'warning';
}

function getContextWorkbenchResolverScoreTone(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return 'muted';
    if (value >= 80) return 'success';
    if (value >= 55) return 'info';
    return 'warning';
}

function createContextWorkbenchResolverScorePill(score, tooltip) {
    return createStatusPill(String(Math.round(Number(score) || 0)), tooltip, {
        tone: getContextWorkbenchResolverScoreTone(score),
        kind: 'count',
        density: 'standard',
        className: 'saga-context-workbench-resolver-score',
    });
}

function getContextRegistryStateTone(state = '') {
    const normalized = String(state || '').trim().toLowerCase();
    if (normalized === 'undefined') return 'warning';
    if (normalized === 'disabled') return 'muted';
    return 'source';
}
function openLoredeckEditorForQuery(packId, query, message) { return dep('openLoredeckEditorForQuery', () => null)(packId, query, message); }
function openLoredeckTimelineAnchorDialog(pack, item) { return dep('openLoredeckTimelineAnchorDialog', () => null)(pack, item); }
function openLoredeckTimelineWindowDialog(pack, item) { return dep('openLoredeckTimelineWindowDialog', () => null)(pack, item); }
function setLoredeckTimelineItemDisabled(pack, kind, id, disabled) { return dep('setLoredeckTimelineItemDisabled', () => null)(pack, kind, id, disabled); }
function removeLoredeckTimelineDefinition(pack, kind, id) { return dep('removeLoredeckTimelineDefinition', () => null)(pack, kind, id); }
function exportContextWorkbenchTimelineRegistry(pack) { return dep('exportContextWorkbenchTimelineRegistry', () => null)(pack); }

export function createContextWorkbenchTimelineView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'saga-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const allItems = getContextWorkbenchTimelineItems(pack, contextIndex);
    const visibleItems = filterContextWorkbenchTimelineItems(allItems);
    let selectedKey = getContextWorkbenchSelectedKey();
    if (!visibleItems.some(item => getContextTimelineItemKey(item) === selectedKey)) {
        selectedKey = visibleItems[0] ? getContextTimelineItemKey(visibleItems[0]) : (allItems[0] ? getContextTimelineItemKey(allItems[0]) : '');
        setContextWorkbenchSelectedKey(selectedKey);
    }
    const selected = allItems.find(item => getContextTimelineItemKey(item) === selectedKey) || visibleItems[0] || allItems[0] || null;

    view.appendChild(createContextWorkbenchTimelineControls(state, contextIndex, pack, allItems, visibleItems));

    const main = document.createElement('div');
    main.className = 'saga-context-workbench-main';
    main.appendChild(createContextWorkbenchTimelineTable(pack, visibleItems, selected));
    main.appendChild(createContextWorkbenchInspector(pack, selected, allItems, contextIndex));
    view.appendChild(main);
    return view;
}

function createContextWorkbenchTimelineControls(state, contextIndex, pack, allItems = [], visibleItems = []) {
    const controls = document.createElement('div');
    controls.className = 'saga-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-lore-workbench-search';
    search.placeholder = 'Search anchors, windows, arcs, dates, aliases, tags...';
    search.value = getContextWorkbenchQuery();
    addTooltip(search, 'Search the selected Loredeck timeline registry.');
    search.addEventListener('input', () => {
        preserveInputFocusAfterRender(search, '.saga-context-workbench-overlay .saga-lore-workbench-search', () => {
            setContextWorkbenchQuery(search.value);
            renderContextWorkbench();
        });
    });
    controls.appendChild(search);

    const type = document.createElement('select');
    type.className = 'saga-lore-workbench-select';
    addTooltip(type, 'Filter timeline rows by registry object type.');
    const activeTypeFilter = getContextWorkbenchTypeFilter();
    for (const [value, label] of [['all', 'All Types'], ['anchor', 'Anchors'], ['window', 'Windows']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (activeTypeFilter === value) option.selected = true;
        type.appendChild(option);
    }
    type.addEventListener('change', () => {
        setContextWorkbenchTypeFilter(type.value);
        setContextWorkbenchSelectedKey('');
        renderContextWorkbench();
    });
    controls.appendChild(type);

    controls.appendChild(createStatusPill(`${visibleItems.length} / ${allItems.length} shown`, 'Timeline rows shown after search and type filters.', {
        tone: visibleItems.length ? 'selected' : 'muted',
        kind: 'count',
        className: 'saga-lore-workbench-count',
    }));

    const loadButton = createButton('Load Context', 'Load entries, tags, and timeline files so attachment counts and source registry rows are current.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        await loadContextIndex({ force: true }).catch(() => null);
        renderContextWorkbench();
    });
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    controls.appendChild(loadButton);

    const newAnchor = createButton('New Anchor', 'Create a new timeline anchor proposal for this Custom Loredeck.', () => openLoredeckTimelineAnchorDialog(pack, null));
    newAnchor.disabled = pack.type === 'bundled';
    controls.appendChild(newAnchor);

    const newWindow = createButton('New Window', 'Create a new timeline window proposal for this Custom Loredeck.', () => openLoredeckTimelineWindowDialog(pack, null));
    newWindow.disabled = pack.type === 'bundled';
    controls.appendChild(newWindow);

    const exportButton = createButton('Export Timeline', 'Download the merged active timeline registry for this Loredeck.', () => {
        exportContextWorkbenchTimelineRegistry(pack);
    });
    exportButton.disabled = !allItems.length;
    controls.appendChild(exportButton);
    return controls;
}

function createContextWorkbenchTimelineTable(pack, items = [], selected = null) {
    const table = document.createElement('div');
    table.className = 'saga-context-workbench-table';
    const header = document.createElement('div');
    header.className = 'saga-context-workbench-table-row saga-context-workbench-row-header';
    for (const label of ['Type', 'Label / ID', 'Context', 'Coordinates', 'Aliases', 'Tags', 'Attached', 'State']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    if (!items.length) {
        table.appendChild(createEmptyMessage('No matching timeline definitions. Load context, create anchors/windows, or clear the search.'));
        return table;
    }

    for (const item of items.slice(0, 500)) {
        const key = getContextTimelineItemKey(item);
        const def = item.definition || {};
        const row = document.createElement('div');
        row.className = 'saga-context-workbench-table-row';
        row.dataset.sagaContextWorkbenchItemKey = key;
        if (selected && key === getContextTimelineItemKey(selected)) row.classList.add('saga-context-workbench-row-active');
        if (item.disabled) row.classList.add('saga-context-workbench-row-disabled');
        row.addEventListener('click', () => {
            setContextWorkbenchSelectedKey(key);
            renderContextWorkbench();
        });
        row.appendChild(createWorkbenchTextCell(item.kind === 'window' ? 'Window' : 'Anchor', item.registryState || 'source'));
        row.appendChild(createWorkbenchTextCell(def.label || item.id, item.id));
        row.appendChild(createWorkbenchTextCell(getContextTimelineItemContextText(item), item.kind === 'window' ? `${def.anchorFrom || '?'} -> ${def.anchorTo || '?'}` : 'sort key'));
        row.appendChild(createWorkbenchTextCell(getContextTimelineItemCoordinateText(item), def.notes || ''));
        row.appendChild(createWorkbenchTextCell(String(def.aliases?.length || 0), def.aliases?.slice(0, 3).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(String(def.tags?.length || 0), def.tags?.slice(0, 3).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(String(item.entryIds?.length || 0), item.entryIds?.slice(0, 2).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(item.registryState || 'source', item.disabled ? 'disabled' : 'active'));
        table.appendChild(row);
    }
    if (items.length > 500) {
        const note = document.createElement('div');
        note.className = 'saga-lore-workbench-row-note';
        note.textContent = `Showing first 500 of ${items.length} matching definitions. Narrow the search to inspect more precisely.`;
        table.appendChild(note);
    }
    return table;
}

function createContextWorkbenchInspector(pack, selected = null, allItems = [], contextIndex = null) {
    const detail = document.createElement('div');
    detail.className = 'saga-context-workbench-inspector';
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select an anchor or window to inspect it.'));
        return detail;
    }
    const def = selected.definition || {};

    const title = document.createElement('div');
    title.className = 'saga-context-workbench-inspector-title';
    title.textContent = def.label || selected.id || 'Timeline Definition';
    detail.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(selected.kind === 'window' ? 'Window' : 'Anchor', 'Timeline registry object type.', { tone: 'source', kind: 'metadata' }));
    chips.appendChild(createStatusPill(selected.registryState || 'source', 'Source/custom overlay state.', { tone: getContextRegistryStateTone(selected.registryState), kind: 'source' }));
    chips.appendChild(createStatusPill(`${selected.entryIds?.length || 0} attached`, 'Lorecards attached to this timeline Context.', { tone: selected.entryIds?.length ? 'selected' : 'muted', kind: 'count' }));
    if (selected.disabled) chips.appendChild(createStatusPill('Disabled', 'This definition is suppressed by the Custom overlay.', { tone: 'muted', kind: 'status' }));
    detail.appendChild(chips);

    const grid = document.createElement('div');
    grid.className = 'saga-context-workbench-inspector-grid';
    grid.appendChild(createKeyValue('ID', selected.id, 'Stable timeline registry ID.'));
    grid.appendChild(createKeyValue('Context', getContextTimelineItemContextText(selected) || 'unset', 'Sort key or sort range.'));
    if (selected.kind === 'window') {
        grid.appendChild(createKeyValue('From', def.anchorFrom || 'unset', 'Window start anchor.'));
        grid.appendChild(createKeyValue('To', def.anchorTo || 'unset', 'Window end anchor.'));
    }
    grid.appendChild(createKeyValue('Coordinates', getContextTimelineItemCoordinateText(selected) || 'unset', 'Date, arc, episode, chapter, quest, or other coordinates.'));
    grid.appendChild(createKeyValue('Aliases', def.aliases?.join(', ') || 'none', 'Local resolver aliases.'));
    grid.appendChild(createKeyValue('Tags', def.tags?.join(', ') || 'none', 'Timeline tags.'));
    grid.appendChild(createKeyValue('Notes', def.notes || 'none', 'Registry author notes.'));
    detail.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-context-workbench-inspector-actions';
    const applyLabel = selected.kind === 'window' ? 'Use Window' : 'Use Anchor';
    const applyTooltip = selected.kind === 'window'
        ? 'Apply this timeline window as the current Context.'
        : 'Apply this timeline anchor as the exact current Context.';
    const applyButton = createButton(applyLabel, applyTooltip, () => {
        applyContextTimelineItem(pack.packId, selected);
    }, 'saga-primary-button');
    markTourTarget(applyButton, selected.kind === 'window' ? 'context.workbench.useWindow' : 'context.workbench.useAnchor');
    actions.appendChild(applyButton);

    const editButton = createButton('Edit Definition', 'Edit this timeline definition as a Pending Review proposal.', () => {
        if (selected.kind === 'anchor') openLoredeckTimelineAnchorDialog(pack, selected);
        else openLoredeckTimelineWindowDialog(pack, selected);
    });
    editButton.disabled = pack.type === 'bundled';
    actions.appendChild(editButton);

    const disableButton = createButton(selected.disabled ? 'Restore Definition' : 'Disable Definition', selected.disabled ? 'Queue restore for this timeline definition.' : 'Queue suppression for this timeline definition.', () => {
        setLoredeckTimelineItemDisabled(pack, selected.kind, selected.id, !selected.disabled);
    });
    disableButton.disabled = pack.type === 'bundled';
    actions.appendChild(disableButton);

    if (selected.customDefined) {
        const forgetButton = createButton('Forget Overlay', 'Queue removal of this Custom timeline overlay definition.', () => {
            removeLoredeckTimelineDefinition(pack, selected.kind, selected.id);
        }, 'saga-danger-button');
        forgetButton.disabled = pack.type === 'bundled';
        actions.appendChild(forgetButton);
    }
    if (pack.type === 'bundled') {
        actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck copy before changing bundled timeline data.', () => {
            openDuplicateLoredeckDialog(pack);
        }));
    }
    const attachedButton = createButton('Find Lorecards', 'Open this Loredeck details panel filtered to Lorecards attached to this timeline ID.', () => {
        openLoredeckEditorForQuery(pack.packId, selected.id || '', 'Loredeck editor filtered to attached timeline ID.');
    });
    attachedButton.disabled = !(selected.entryIds?.length);
    actions.appendChild(attachedButton);
    detail.appendChild(actions);

    const issues = getContextWorkbenchValidationIssues(pack, allItems, contextIndex).filter(issue => issue.itemKey === getContextTimelineItemKey(selected));
    if (issues.length) {
        const issueWrap = document.createElement('div');
        issueWrap.className = 'saga-context-workbench-mini-list';
        const issueTitle = document.createElement('div');
        issueTitle.className = 'saga-runtime-card-title';
        issueTitle.textContent = 'Warnings';
        issueWrap.appendChild(issueTitle);
        for (const issue of issues.slice(0, 4)) {
            const row = document.createElement('div');
            row.className = `saga-context-workbench-mini-item saga-context-workbench-issue-${issue.severity || 'suggestion'}`;
            row.textContent = issue.message;
            issueWrap.appendChild(row);
        }
        detail.appendChild(issueWrap);
    }
    return detail;
}

export function createContextWorkbenchShell(state = {}, contextIndex = null) {
    const mobile = false;
    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell saga-context-workbench-shell';

    markTourTarget(shell, 'context.workbench.shell');
    shell.addEventListener('click', event => event.stopPropagation());

    shell.appendChild(createContextWorkbenchHeader(state, contextIndex));

    const body = document.createElement('div');
    body.className = 'saga-context-workbench-body';
    const activeTab = getContextWorkbenchTab();
    if (activeTab === 'timeline') {
        body.appendChild(createContextWorkbenchTimelineView(state, contextIndex));
    } else if (activeTab === 'aliases') {
        body.appendChild(createContextWorkbenchAliasesView(state, contextIndex));
    } else if (activeTab === 'validation') {
        body.appendChild(createContextWorkbenchValidationView(state, contextIndex));
    } else {
        body.appendChild(createContextWorkbenchContextView(state, contextIndex));
    }
    shell.appendChild(body);

    return shell;
}

function createContextWorkbenchHeader(state = {}, contextIndex = null) {
    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header saga-context-workbench-header';
    markTourTarget(header, 'context.workbench.header');

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Context Workbench';
    titleWrap.appendChild(title);

    const stack = getContextWorkbenchStack(state);
    const selectedPack = getContextWorkbenchPack(state);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = selectedPack
        ? `${selectedPack.title || selectedPack.packId} | ${stack.length} loaded Loredeck${stack.length === 1 ? '' : 's'}`
        : 'Load a Loredeck stack to set Context.';
    titleWrap.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'saga-context-workbench-header-chips';
    chips.appendChild(createStatusPill(formatContextIndexSummary(contextIndex), 'Loaded Context timeline registry status.', { tone: contextIndex?.summary?.issueCount ? 'warning' : (contextIndex?.hasIndex ? 'source' : 'muted'), kind: 'source' }));
    if (selectedPack) {
        const context = getLoredeckContext(state, selectedPack.packId);
        chips.appendChild(createStatusPill(context.manualLock ? 'Manual lock' : 'Auto allowed', 'Manual lock prevents automatic Context resolvers from overwriting this deck.', { tone: context.manualLock ? 'muted' : 'success', kind: 'status' }));
        chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.', { tone: 'source', kind: 'source' }));
    }
    if (contextIndex?.summary?.issueCount) {
        chips.appendChild(createStatusPill(`${contextIndex.summary.issueCount} index issue${contextIndex.summary.issueCount === 1 ? '' : 's'}`, 'Timeline registry load issues from the active stack.', { tone: 'warning', kind: 'severity' }));
    }
    titleWrap.appendChild(chips);
    header.appendChild(titleWrap);

    const tabs = document.createElement('div');
    tabs.className = 'saga-lore-workbench-mode-tabs saga-context-workbench-tabs';
    const activeTab = getContextWorkbenchTab();
    for (const [id, label] of [
        ['context', 'Context'],
        ['timeline', 'Timeline'],
        ['aliases', 'Aliases'],
        ['validation', 'Validation'],
    ]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-lore-workbench-mode-tab';
        if (activeTab === id) tab.classList.add('saga-lore-workbench-mode-tab-active');
        tab.textContent = label;
        markTourTarget(tab, `context.workbench.tab.${id}`);
        addTooltip(tab, getContextWorkbenchTabTooltip(id), {});
        tab.addEventListener('click', () => {
            setContextWorkbenchTab(id);
            renderContextWorkbench();
        });
        tabs.appendChild(tab);
    }
    header.appendChild(tabs);

    header.appendChild(createContextWorkbenchActions());
    return header;
}

function createContextWorkbenchActions(options = {}) {
    const actions = document.createElement('div');
    actions.className = options.mobile
        ? 'saga-primary-actions saga-context-workbench-bottom-actions'
        : 'saga-primary-actions saga-context-workbench-header-actions';
    actions.appendChild(markTourTarget(createButton('Refresh Index', 'Reload loaded Loredeck timeline registries and refresh the workbench.', async (btn) => {
        await runBusyAction(btn, 'Refreshing...', async () => {
            clearContextIndexCache();
            await loadContextIndex({ force: true }).catch(() => null);
            renderContextWorkbench();
            refreshContextHeader();
        });
    }), 'context.workbench.refreshIndex'));
    actions.appendChild(markTourTarget(createButton('Done', 'Close the Context Workbench.', closeContextWorkbench, 'saga-primary-button'), 'context.workbench.done'));
    return actions;
}

function getContextWorkbenchTabTooltip(tabId = '') {
    if (tabId === 'timeline') return 'Search, inspect, create, and queue timeline anchor/window registry changes.';
    if (tabId === 'aliases') return 'Inspect resolver aliases and duplicate phrasing across the selected Loredeck timeline.';
    if (tabId === 'validation') return 'Check timeline structure for missing anchors, sort issues, sparse aliases, and unmatchable references.';
    return 'Set the current chat Context for each loaded Loredeck.';
}

export function createContextWorkbenchPackSelector(state = {}, contextIndex = null) {
    const select = document.createElement('select');
    select.className = 'saga-lore-workbench-select';
    addTooltip(select, 'Selected loaded Loredeck for timeline, alias, and validation views.');
    markTourTarget(select, 'context.workbench.packSelector');
    const selectedPackId = getContextWorkbenchPackId();
    for (const item of getContextWorkbenchStack(state)) {
        const packSummary = getContextPackSummary(contextIndex, item.packId);
        const option = document.createElement('option');
        option.value = item.packId;
        option.textContent = `${getLoredeckDisplayName(item.packId)}${packSummary?.hasIndex ? ` (${packSummary.anchorCount || 0}/${packSummary.windowCount || 0})` : ''}`;
        if (item.packId === selectedPackId) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => {
        setContextWorkbenchPackId(select.value);
        clearContextWorkbenchSelectedKey();
        renderContextWorkbench();
    });
    return select;
}

export function createContextWorkbenchContextView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'saga-context-workbench-view saga-context-workbench-context-view';
    const stack = getContextWorkbenchStack(state);
    if (!stack.length) {
        view.appendChild(createEmptyMessage('No enabled Loredecks are loaded. Open the Loredeck Library and add decks to the active stack first.'));
        return view;
    }

    const controls = document.createElement('div');
    controls.className = 'saga-context-workbench-controls';
    markTourTarget(controls, 'context.workbench.resolvers');
    controls.appendChild(markTourTarget(createButton('Resolve From Context', 'Use current Context and loaded timeline aliases to update unlocked Contexts.', async (btn) => {
        await resolveContextsFromContext(btn);
        renderContextWorkbench();
    }, 'saga-primary-button'), 'context.workbench.resolveFromContext'));
    controls.appendChild(markTourTarget(createButton('Resolve With Reasoner', 'Ask the configured Reasoning Provider to resolve unresolved Contexts using bounded known candidates.', async (btn) => {
        await modelResolveContexts(btn);
        renderContextWorkbench();
    }), 'context.workbench.resolveWithReasoner'));
    controls.appendChild(markTourTarget(createButton('Open Selected Timeline', 'Jump to the Timeline tab for the selected Loredeck.', () => {
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }), 'context.workbench.openSelectedTimeline'));
    view.appendChild(controls);

    const table = document.createElement('div');
    table.className = 'saga-context-workbench-context-table';
    markTourTarget(table, 'context.workbench.contextTable');
    const header = document.createElement('div');
    header.className = 'saga-context-workbench-context-row saga-context-workbench-row-header';
    for (const label of ['Loredeck', 'Current Context', 'Source', 'Index', 'Manual Lock', 'Actions']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const selectedPackId = getContextWorkbenchPackId();
    for (const item of stack) {
        const context = getLoredeckContext(state, item.packId);
        const packIndex = getContextPackSummary(contextIndex, item.packId);
        const row = document.createElement('div');
        row.className = 'saga-context-workbench-context-row';
        row.dataset.sagaContextWorkbenchPackId = item.packId;
        markTourTarget(row, 'context.workbench.loadedLoredeck');
        if (item.packId === selectedPackId) row.classList.add('saga-context-workbench-row-active');
        row.addEventListener('click', () => {
            setContextWorkbenchPackId(item.packId);
            renderContextWorkbench();
        });
        row.appendChild(createWorkbenchTextCell(getLoredeckDisplayName(item.packId), `Priority ${item.stackIndex + 1}`));
        row.appendChild(createWorkbenchTextCell(formatContextSummary(context), context.anchorId || context.anchorFrom || context.alias || ''));
        row.appendChild(createWorkbenchTextCell(formatContextSource(context.source), `${Math.round((Number(context.confidence) || 0) * 100)}% confidence`));
        row.appendChild(createWorkbenchTextCell(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors` : 'No timeline', packIndex?.hasIndex ? `${packIndex.windowCount || 0} windows` : 'Load or create registry data'));

        const lockCell = document.createElement('label');
        lockCell.className = 'saga-context-workbench-lock';
        markTourTarget(lockCell, 'context.workbench.loadedLoredeck.lock');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = context.manualLock === true;
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            setLoredeckContextManualLock(item.packId, check.checked);
        });
        lockCell.appendChild(check);
        const lockText = document.createElement('span');
        lockText.textContent = context.manualLock ? 'Locked' : 'Unlocked';
        lockCell.appendChild(lockText);
        row.appendChild(lockCell);

        const actions = document.createElement('div');
        actions.className = 'saga-context-workbench-row-actions';
        actions.appendChild(markTourTarget(createButton('Timeline', 'Open this Loredeck in the Timeline tab.', () => {
            setContextWorkbenchPackId(item.packId);
            setContextWorkbenchTab('timeline');
            clearContextWorkbenchSelectedKey();
            renderContextWorkbench();
        }), 'context.workbench.loadedLoredeck.timeline'));
        actions.appendChild(markTourTarget(createButton('Reset', 'Clear this Loredeck Context.', async () => {
            await resetLoredeckContextFromWorkbench(item.packId);
        }, 'saga-danger-button'), 'context.workbench.loadedLoredeck.reset'));
        row.appendChild(actions);
        table.appendChild(row);
    }

    const layout = document.createElement('div');
    layout.className = 'saga-context-workbench-context-layout';
    layout.appendChild(table);
    layout.appendChild(createContextWorkbenchContextEditor(state, contextIndex));
    view.appendChild(layout);
    return view;
}

function createContextWorkbenchContextEditor(state = {}, contextIndex = null) {
    const pack = getContextWorkbenchPack(state);
    const panel = document.createElement('div');
    panel.className = 'saga-context-workbench-inspector saga-context-workbench-context-editor';
    markTourTarget(panel, 'context.workbench.editor');
    if (!pack?.packId) {
        panel.appendChild(createEmptyMessage('Select a loaded Loredeck to edit its Context.'));
        return panel;
    }

    const context = getLoredeckContext(state, pack.packId);
    const packIndex = getContextPackSummary(contextIndex, pack.packId);
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-inspector-title';
    title.textContent = pack.title || getLoredeckDisplayName(pack.packId);
    panel.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(getContextTypeLabel(context.contextType), 'Context mode for this Loredeck.', { tone: 'category', kind: 'metadata' }));
    chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.', { tone: 'source', kind: 'source' }));
    chips.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts are protected from automatic resolver overwrites.', { tone: context.manualLock ? 'muted' : 'success', kind: 'status' }));
    chips.appendChild(createStatusPill(`${Math.round((Number(context.confidence) || 0) * 100)}%`, 'Resolver confidence for this Context.', { tone: getContextWorkbenchConfidenceTone(context.confidence), kind: 'metadata' }));
    chips.appendChild(createStatusPill(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors / ${packIndex.windowCount || 0} windows` : 'No timeline index', 'Loaded timeline registry coverage for this Loredeck.', { tone: packIndex?.hasIndex ? 'source' : 'muted', kind: packIndex?.hasIndex ? 'count' : 'source' }));
    panel.appendChild(chips);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-context-summary';
    summary.textContent = formatContextSummary(context);
    panel.appendChild(summary);

    panel.appendChild(createContextWorkbenchStoryPositionPicker(pack, context, contextIndex));
    panel.appendChild(createContextWorkbenchResolverTester(pack, context, contextIndex));

    const grid = document.createElement('div');
    grid.className = 'saga-context-workbench-editor-grid';
    appendContextManualFields(grid, pack.packId, context);
    panel.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-context-workbench-inspector-actions';
    actions.appendChild(markTourTarget(createButton('Seed From Context', 'Seed this Context from the current Context fields.', () => {
        seedLoredeckContextFromRuntimeContext(pack.packId, context);
    }), 'context.workbench.seedFromContext'));
    actions.appendChild(markTourTarget(createButton('Timeline', 'Open this Loredeck in the Timeline tab.', () => {
        setContextWorkbenchTab('timeline');
        clearContextWorkbenchSelectedKey();
        renderContextWorkbench();
    }), 'context.workbench.editorTimeline'));
    actions.appendChild(markTourTarget(createButton('Reset Context', 'Clear this Loredeck Context.', async () => {
        await resetLoredeckContextFromWorkbench(pack.packId);
    }, 'saga-danger-button'), 'context.workbench.resetContext'));
    panel.appendChild(actions);
    return panel;
}

const CONTEXT_STORY_POSITION_FILTER_OPTIONS = Object.freeze([
    ['major', 'Major Points'],
    ['windows', 'Windows'],
    ['anchors', 'Anchors'],
    ['events', 'Events'],
    ['lorecards', 'Lorecards'],
    ['all', 'All'],
]);

function createContextWorkbenchStoryPositionPicker(pack, context = {}, contextIndex = null) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-context-workbench-story-position-picker';
    markTourTarget(wrap, 'context.workbench.storyPosition');

    const top = document.createElement('div');
    top.className = 'saga-context-workbench-story-position-top';
    const label = document.createElement('div');
    label.className = 'saga-runtime-card-title';
    label.textContent = 'Choose Story Position';
    addTooltip(label, 'Choose the current story position directly. Use After and Before on two points to build a Context window.');
    top.appendChild(label);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-lore-workbench-search';
    search.placeholder = 'Search anchors, windows, events, aliases...';
    search.value = getContextWorkbenchStoryPositionQuery();
    addTooltip(search, 'Search timeline labels, IDs, aliases, tags, arcs, dates, episodes, chapters, attached Lorecard IDs, coordinates, and loaded event story positions.');
    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        setContextWorkbenchStoryPositionQuery(search.value.trim());
        renderContextWorkbench();
    });
    search.addEventListener('change', () => {
        setContextWorkbenchStoryPositionQuery(search.value.trim());
        renderContextWorkbench();
    });
    top.appendChild(search);

    const filter = document.createElement('select');
    filter.className = 'saga-lore-workbench-select';
    addTooltip(filter, 'Control how much of the Loredeck story-position map is shown.');
    const activeFilter = getContextWorkbenchStoryPositionFilter();
    for (const [value, text] of CONTEXT_STORY_POSITION_FILTER_OPTIONS) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (activeFilter === value) option.selected = true;
        filter.appendChild(option);
    }
    filter.addEventListener('change', () => {
        setContextWorkbenchStoryPositionFilter(filter.value);
        renderContextWorkbench();
    });
    top.appendChild(filter);

    top.appendChild(markTourTarget(createButton('Find', 'Search story positions.', () => {
        setContextWorkbenchStoryPositionQuery(search.value.trim());
        renderContextWorkbench();
    }, 'saga-primary-button'), 'context.workbench.storyPositionFind'));

    const cachedEntries = getLoredeckEntryPreview(pack?.packId);
    const loadEvents = createButton(cachedEntries?.loadedAt ? 'Reload Events' : 'Load Events', 'Load Lorecards so this picker can include event-level story positions.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        renderContextWorkbench();
    });
    markTourTarget(loadEvents, 'context.workbench.loadEvents');
    loadEvents.disabled = !canValidateLoredeckInEditor(pack);
    top.appendChild(loadEvents);
    wrap.appendChild(top);

    wrap.appendChild(createContextWorkbenchWindowBuilderSummary(pack, context));

    const allItems = getContextWorkbenchStoryPositionItems(pack, contextIndex);
    const query = getContextWorkbenchStoryPositionQuery();
    const visible = filterContextWorkbenchStoryPositionItems(allItems, query, activeFilter);
    const current = getContextWorkbenchCurrentTimelineItem(context, allItems);
    const currentKey = current ? getContextTimelineItemKey(current) : '';
    const rowItems = [];
    const seenKeys = new Set();
    if (!String(query || '').trim() && current) {
        rowItems.push(current);
        seenKeys.add(currentKey);
    }
    for (const item of visible) {
        const key = getContextTimelineItemKey(item);
        if (seenKeys.has(key)) continue;
        rowItems.push(item);
        seenKeys.add(key);
        if (rowItems.length >= 80) break;
    }
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const firstClassCount = allItems.filter(item => item.source === 'timeline').length;
    const eventCount = allItems.filter(item => item.source === 'lorecard').length;
    meta.appendChild(createStatusPill(`${firstClassCount} timeline`, 'First-class anchors/windows from the Loredeck timeline registry.', { tone: 'source', kind: 'count' }));
    meta.appendChild(createStatusPill(cachedEntries?.loadedAt ? `${eventCount} events` : 'Events unloaded', 'Lorecard-derived Context candidates are optional and loaded on demand.', { tone: cachedEntries?.loadedAt ? 'info' : 'muted', kind: cachedEntries?.loadedAt ? 'count' : 'status' }));
    meta.appendChild(createStatusPill(`${rowItems.length} shown`, 'Story positions shown after current selection, search, and filtering.', { tone: rowItems.length ? 'selected' : 'muted', kind: 'count' }));
    if (activeFilter === 'major') {
        meta.appendChild(createStatusPill('Major only', 'Major shows first-class timeline anchors/windows by default. Search or load Events for denser event selection.', { tone: 'info', kind: 'status' }));
    }
    if (currentKey) meta.appendChild(createStatusPill('Current pinned', 'The current selected Context row is kept visible when possible.', { tone: 'selected', kind: 'status' }));
    wrap.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'saga-context-workbench-story-position-list';
    if (!allItems.length) {
        list.appendChild(createEmptyMessage('No story positions are loaded for this Loredeck yet.'));
    } else if (!rowItems.length) {
        const lines = ['No story positions match the current search/filter.'];
        if (!cachedEntries?.loadedAt) lines.push('Load Events to include Lorecard-derived moments such as parties, lessons, battles, reveals, and relationship turns.');
        list.appendChild(createContextResolverDiagnosticCard('No browser match', lines, 'warning'));
    } else {
        for (const item of rowItems) {
            list.appendChild(createContextWorkbenchStoryPositionRow(pack, item, context, currentKey));
        }
        if (visible.length > rowItems.length) {
            const note = document.createElement('div');
            note.className = 'saga-runtime-help';
            note.textContent = `Showing ${rowItems.length} of ${visible.length} matching story positions. Narrow the search for a smaller set.`;
            list.appendChild(note);
        }
    }
    wrap.appendChild(list);
    return wrap;
}

function createContextWorkbenchWindowBuilderSummary(pack, context = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-context-workbench-window-builder';
    markTourTarget(wrap, 'context.workbench.windowBuilder');
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-window-builder-title';
    title.textContent = 'Selected Range';
    addTooltip(title, 'Use After and Before on story positions to define the active Context window for this Loredeck.');
    wrap.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(context.anchorFrom ? `After: ${formatContextAnchorBoundaryLabel(context.anchorFrom, context)}` : 'After: unset', 'Lower Context bound.', { tone: context.anchorFrom ? 'source' : 'muted', kind: 'source', maxChars: 42 }));
    meta.appendChild(createStatusPill(context.anchorTo ? `Before: ${formatContextAnchorBoundaryLabel(context.anchorTo, context)}` : 'Before: unset', 'Upper Context bound.', { tone: context.anchorTo ? 'source' : 'muted', kind: 'source', maxChars: 42 }));
    meta.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts are protected from automatic updates.', { tone: context.manualLock ? 'muted' : 'success', kind: 'status' }));
    wrap.appendChild(meta);

    const summary = document.createElement('div');
    summary.className = 'saga-context-workbench-window-summary';
    summary.textContent = context.anchorFrom || context.anchorTo
        ? formatContextSummary(context)
        : 'Select After on one story position and Before on another to create a bounded Context window.';
    wrap.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const lockButton = createButton(context.manualLock ? 'Unlock' : 'Lock Context', 'Toggle whether automatic Context detection may replace this selected window.', () => {
        commitLoredeckContextPatch(pack.packId, { manualLock: !context.manualLock }, { manual: false });
    });
    markTourTarget(lockButton, 'context.workbench.lockRange');
    actions.appendChild(lockButton);
    const clearBounds = createButton('Clear Selection', 'Clear the selected Anchor or After/Before bounds for this Loredeck Context.', () => {
        commitLoredeckContextPatch(pack.packId, {
            anchorFrom: '',
            anchorTo: '',
            anchorId: '',
            contextType: 'custom',
            label: '',
            contextSortKey: null,
            contextSortKeyFrom: null,
            contextSortKeyTo: null,
        });
    });
    markTourTarget(clearBounds, 'context.workbench.clearSelection');
    clearBounds.disabled = !context.anchorFrom && !context.anchorTo && !context.anchorId;
    actions.appendChild(clearBounds);
    wrap.appendChild(actions);
    return wrap;
}

function formatContextAnchorBoundaryLabel(anchorId = '', context = {}) {
    const id = String(anchorId || '').trim();
    if (!id) return 'unset';
    const label = String(context.label || '').trim();
    if (label && label.toLowerCase().includes(id.toLowerCase())) return label;
    return id;
}

function getContextWorkbenchStoryPositionItems(pack = null, contextIndex = null) {
    const timelineItems = getContextWorkbenchTimelineItems(pack, contextIndex).map(item => ({
        ...item,
        source: 'timeline',
    }));
    const entryItems = getContextWorkbenchEntryStoryPositionItems(pack);
    return [...timelineItems, ...entryItems].sort(compareContextStoryPositionItems);
}

function getContextWorkbenchEntryStoryPositionItems(pack = {}) {
    return getContextWorkbenchEntryRows(pack)
        .filter(row => row?.id && !row.disabled)
        .map(row => {
            const anchorDefinition = buildContextEntryDerivedAnchor(pack, row, {});
            if (!anchorDefinition) return null;
            const entry = row.entry || {};
            const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
            return {
                kind: 'entry',
                source: 'lorecard',
                id: anchorDefinition.id,
                row,
                entry,
                context: contextGate,
                definition: anchorDefinition,
                registryState: 'Lorecard-derived',
                entryIds: [row.id || entry.id].filter(Boolean),
            };
        })
        .filter(Boolean);
}

function compareContextStoryPositionItems(a = {}, b = {}) {
    const aSort = normalizeLoredeckTimelineNumber(a.definition?.sortKey ?? a.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    const bSort = normalizeLoredeckTimelineNumber(b.definition?.sortKey ?? b.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    const sourceOrder = { timeline: 0, lorecard: 1 };
    const sourceCompare = (sourceOrder[a.source] ?? 9) - (sourceOrder[b.source] ?? 9);
    if (sourceCompare) return sourceCompare;
    return String(a.definition?.label || a.id || '').localeCompare(String(b.definition?.label || b.id || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function filterContextWorkbenchStoryPositionItems(items = [], query = '', filter = 'major') {
    const q = String(query || '').trim();
    const analysis = analyzeContextQuery(q);
    return items.filter(item => {
        if (!contextStoryPositionMatchesFilter(item, filter, Boolean(q))) return false;
        if (!q) return true;
        const text = getContextStoryPositionSearchText(item);
        if (normalizeContextSearchText(text).includes(normalizeContextSearchText(q))) return true;
        return analysis.terms.every(term => contextTextIncludesTerm(text, term));
    });
}

function contextStoryPositionMatchesFilter(item = {}, filter = 'major', hasQuery = false) {
    if (filter === 'all') return true;
    if (filter === 'windows') return item.kind === 'window';
    if (filter === 'anchors') return item.kind === 'anchor';
    if (filter === 'events') return item.kind === 'entry' || contextStoryPositionLooksEventLike(item);
    if (filter === 'lorecards') return item.source === 'lorecard';
    if (filter === 'major') {
        if (item.source === 'timeline') return true;
        return hasQuery && contextStoryPositionLooksEventLike(item);
    }
    return true;
}

function contextStoryPositionLooksEventLike(item = {}) {
    const def = item.definition || {};
    if (item.source === 'lorecard') return true;
    const tags = Array.isArray(def.tags) ? def.tags.join(' ') : '';
    const haystack = normalizeContextSearchText([
        item.kind,
        def.contextType,
        def.label,
        def.arc,
        tags,
    ].filter(Boolean).join(' '));
    return /\bevent\b|\bclimax\b|\bbattle\b|\bdeath\b|\breveal\b|\bincident\b|\btask\b|\bparty\b|\blesson\b/.test(haystack);
}

function getContextStoryPositionSearchText(item = {}) {
    const def = item.definition || {};
    const entry = item.entry || {};
    const content = entry.content || {};
    return [
        item.kind,
        item.source,
        item.id,
        item.registryState,
        def.label,
        def.anchorFrom,
        def.anchorTo,
        def.book,
        def.work,
        def.schoolYear,
        def.arc,
        def.phase,
        def.season,
        def.episode,
        def.chapter,
        def.issue,
        def.quest,
        def.gameStage,
        def.notes,
        entry.title,
        entry.category,
        entry.lorePurpose,
        content.fact,
        ...(Array.isArray(content.constraints) ? content.constraints : []),
        ...(Array.isArray(def.aliases) ? def.aliases : []),
        ...(Array.isArray(def.tags) ? def.tags : []),
        ...(Array.isArray(item.entryIds) ? item.entryIds : []),
    ].filter(Boolean).join(' ');
}

function createContextWorkbenchStoryPositionRow(pack, item = {}, context = {}, currentKey = '') {
    const def = item.definition || {};
    const key = getContextTimelineItemKey(item);
    const row = document.createElement('div');
    row.className = 'saga-context-workbench-story-position-row';
    if (item.source === 'lorecard') row.classList.add('saga-context-workbench-story-position-row-entry');
    if (currentKey && key === currentKey) row.classList.add('saga-context-workbench-row-active');
    if (context.anchorId && normalizeLoredeckTimelineId(context.anchorId) === normalizeLoredeckTimelineId(item.id)) row.classList.add('saga-context-workbench-row-active');
    if ((context.anchorFrom && normalizeLoredeckTimelineId(context.anchorFrom) === normalizeLoredeckTimelineId(item.id))
        || (context.anchorTo && normalizeLoredeckTimelineId(context.anchorTo) === normalizeLoredeckTimelineId(item.id))) {
        row.classList.add('saga-context-workbench-row-active');
    }

    const main = document.createElement('div');
    main.className = 'saga-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-context-picker-title';
    title.textContent = def.label || item.entry?.title || item.id || 'Story position';
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-context-workbench-context-picker-meta';
    meta.textContent = [
        getContextStoryPositionKindLabel(item),
        item.id,
        getContextTimelineItemContextText(item),
        getContextTimelineItemCoordinateText(item),
        item.source === 'lorecard' ? item.row?.id : '',
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-context-workbench-row-actions';
    markTourTarget(actions, 'context.workbench.applyContext');
    if (item.kind === 'window') {
        const useWindow = createButton('Use Window', 'Apply this whole timeline window as the current Context.', () => {
            applyContextTimelineItem(pack.packId, item);
        }, 'saga-primary-button');
        markTourTarget(useWindow, 'context.workbench.useWindow');
        actions.appendChild(useWindow);
    } else {
        const startHere = createButton('Start Here', 'Apply this story position as the exact starting Context.', () => {
            applyContextStoryPositionItem(pack.packId, item);
        }, 'saga-primary-button');
        markTourTarget(startHere, 'context.workbench.startHere');
        actions.appendChild(startHere);
        const after = createButton('After', 'Use this story position as the lower bound of the current Context window.', () => {
            applyContextStoryPositionBoundary(pack.packId, item, 'from');
        });
        markTourTarget(after, 'context.workbench.after');
        actions.appendChild(after);
        const before = createButton('Before', 'Use this story position as the upper bound of the current Context window.', () => {
            applyContextStoryPositionBoundary(pack.packId, item, 'to');
        });
        markTourTarget(before, 'context.workbench.before');
        actions.appendChild(before);
    }
    const timeline = createButton(item.source === 'lorecard' ? 'Lorecard' : 'Timeline', item.source === 'lorecard' ? 'Find the source Lorecard.' : 'Inspect this story position in the Timeline tab.', () => {
        if (item.source === 'lorecard') {
            openLoredeckEditorForQuery(item.row?.packId || pack.packId, item.row?.id || item.entry?.title || '', 'Loredeck editor filtered to the source Lorecard.');
            return;
        }
        setContextWorkbenchSelectedKey(getContextTimelineItemKey(item));
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    });
    markTourTarget(timeline, item.source === 'lorecard' ? 'context.workbench.lorecardAction' : 'context.workbench.timelineAction');
    actions.appendChild(timeline);
    row.appendChild(actions);
    return row;
}

function getContextStoryPositionKindLabel(item = {}) {
    if (item.kind === 'window') return 'Window';
    if (item.source === 'lorecard') return 'Lorecard event';
    return 'Anchor';
}

function applyContextStoryPositionItem(packId, item = {}) {
    if (item.source === 'lorecard') {
        applyContextEntryCandidate(packId, {
            row: item.row,
            entry: item.entry,
            context: item.context,
            query: getContextWorkbenchStoryPositionQuery(),
            score: 120,
        });
        return;
    }
    applyContextTimelineItem(packId, item);
}

function applyContextStoryPositionBoundary(packId, item = {}, mode = 'from') {
    if (item.source !== 'lorecard') {
        applyContextAnchorBoundary(packId, item, mode);
        return;
    }
    const def = item.definition || {};
    const contextGate = item.context || {};
    const id = normalizeLoredeckTimelineId(def.id || item.id);
    if (!id) return;
    const context = getLoredeckContext(getRuntimeState(), packId);
    const label = String(def.label || item.entry?.title || id).trim();
    const sortKeyFrom = normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom ?? def.sortKey);
    const sortKeyTo = normalizeLoredeckTimelineNumber(contextGate.sortKeyTo ?? def.sortKey);
    const boundarySort = mode === 'to' ? (sortKeyFrom ?? sortKeyTo) : (sortKeyTo ?? sortKeyFrom);
    const patch = {
        contextType: 'anchor_window',
        anchorId: '',
        sceneDate: context.sceneDate || '',
        contextSortKey: Number.isFinite(Number(context.contextSortKey)) && mode === 'to'
            ? Number(context.contextSortKey)
            : boundarySort,
        arc: contextGate.arc || context.arc || '',
        phase: contextGate.phase || context.phase || '',
        season: contextGate.season || context.season || '',
        episode: contextGate.episode || context.episode || '',
        chapter: contextGate.chapter || context.chapter || '',
        issue: contextGate.issue || context.issue || '',
        quest: contextGate.quest || context.quest || '',
        gameStage: contextGate.gameStage || context.gameStage || '',
        alias: getContextWorkbenchStoryPositionQuery() || label,
        source: 'manual',
        notes: `Boundary applied from Lorecard-derived story position: ${item.row?.id || item.entry?.id || label}.`,
    };
    if (mode === 'to') {
        patch.anchorFrom = context.anchorFrom || '';
        patch.anchorTo = id;
        patch.contextSortKeyFrom = Number.isFinite(Number(context.contextSortKeyFrom))
            ? Number(context.contextSortKeyFrom)
            : (Number.isFinite(Number(context.contextSortKey)) ? Number(context.contextSortKey) : null);
        patch.contextSortKeyTo = boundarySort;
        patch.label = context.anchorFrom ? `${context.anchorFrom} to ${label}` : `Before ${label}`;
    } else {
        patch.anchorFrom = id;
        patch.anchorTo = context.anchorTo || '';
        patch.contextSortKeyFrom = boundarySort;
        patch.contextSortKeyTo = Number.isFinite(Number(context.contextSortKeyTo)) ? Number(context.contextSortKeyTo) : null;
        patch.label = context.anchorTo ? `${label} to ${context.anchorTo}` : `After ${label}`;
    }
    commitLoredeckContextPatch(packId, patch);
}

function createContextWorkbenchResolverTester(pack, context = {}, contextIndex = null) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-context-workbench-resolver';
    markTourTarget(wrap, 'context.workbench.phraseResolver');

    const top = document.createElement('div');
    top.className = 'saga-context-workbench-resolver-top';
    const label = document.createElement('div');
    label.className = 'saga-runtime-card-title';
    label.textContent = 'Phrase Resolver';
    addTooltip(label, 'Test casual context phrasing against this Loredeck timeline registry before applying a match.');
    top.appendChild(label);

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'saga-lore-workbench-search';
    input.placeholder = 'Try: after the Yule Ball, pre-Endgame, post Shibuya...';
    input.value = getContextWorkbenchResolverQuery();
    addTooltip(input, 'Local-only resolver test using loaded anchor labels, IDs, aliases, dates, arcs, tags, and coordinates.');
    markTourTarget(input, 'context.workbench.phraseResolverInput');
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    });
    input.addEventListener('change', () => {
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    });
    top.appendChild(input);

    const testPhrase = createButton('Test Phrase', 'Run the local phrase resolver for this Loredeck.', () => {
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    }, 'saga-primary-button');
    markTourTarget(testPhrase, 'context.workbench.testPhrase');
    top.appendChild(testPhrase);
    top.appendChild(markTourTarget(createButton('Use Context', 'Use the current Context and runtime context text as the test phrase.', () => {
        const seed = getContextResolverSeedText(context);
        if (!seed) {
            toast('No Context text is available to test.', 'warning');
            return;
        }
        setContextWorkbenchResolverQuery(seed);
        renderContextWorkbench();
    }), 'context.workbench.phraseUseContext'));
    top.appendChild(markTourTarget(createButton('Clear', 'Clear the phrase resolver test.', () => {
        setContextWorkbenchResolverQuery('');
        renderContextWorkbench();
    }), 'context.workbench.phraseClear'));
    const cachedEntries = getLoredeckEntryPreview(pack?.packId);
    const loadEntriesButton = createButton(cachedEntries?.loadedAt ? 'Reload Lorecards' : 'Load Lorecards', 'Load this Loredeck\'s Lorecards so the resolver can include Lorecard-derived Context candidates.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        renderContextWorkbench();
    });
    markTourTarget(loadEntriesButton, 'context.workbench.resolverLoadLorecards');
    loadEntriesButton.disabled = !canValidateLoredeckInEditor(pack);
    top.appendChild(loadEntriesButton);
    wrap.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const packIndex = getContextPackSummary(contextIndex, pack?.packId);
    meta.appendChild(createStatusPill('Local match', 'This test does not call a model.', { tone: 'info', kind: 'status' }));
    meta.appendChild(createStatusPill(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors` : 'No index', 'Anchor count available to the local resolver.', { tone: packIndex?.hasIndex ? 'source' : 'muted', kind: packIndex?.hasIndex ? 'count' : 'source' }));
    if (cachedEntries?.loadedAt) {
        meta.appendChild(createStatusPill(`${cachedEntries.entries?.length || 0} Lorecards loaded`, 'Loaded Lorecards are included as Lorecard-derived Context candidates.', { tone: 'success', kind: 'count' }));
    } else {
        meta.appendChild(createStatusPill('Lorecards not loaded', 'Click Load Lorecards to include event-level Context candidates in resolver testing.', { tone: 'muted', kind: 'status' }));
    }
    const resolverQuery = getContextWorkbenchResolverQuery();
    if (resolverQuery) {
        meta.appendChild(createStatusPill(`Query: ${truncateText(resolverQuery, 42)}`, 'Current resolver test phrase.', { tone: 'source', kind: 'source', maxChars: 52 }));
    }
    wrap.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'saga-context-workbench-resolver-results';
    const query = String(resolverQuery || '').trim();
    const analysis = analyzeContextQuery(query);
    if (query) {
        if (analysis.terms?.length) {
            meta.appendChild(createStatusPill(`Terms: ${analysis.terms.join(', ')}`, 'Search terms used by the local resolver after cleanup.', { tone: 'tag', kind: 'tag', maxChars: 52 }));
        }
        if (analysis.ignoredTerms?.length) {
            meta.appendChild(createStatusPill(`Ignored: ${analysis.ignoredTerms.join(', ')}`, 'Direction/filler words ignored so they do not cause false matches.', { tone: 'muted', kind: 'metadata', maxChars: 52 }));
        }
    }
    if (!contextIndex) {
        list.appendChild(createEmptyMessage('Context index is loading. Refresh the index and try again.'));
    } else if (!packIndex?.hasIndex) {
        list.appendChild(createEmptyMessage('This Loredeck has no loaded timeline registry for phrase matching.'));
    } else if (!query) {
        list.appendChild(createEmptyMessage('Enter a loose story phrase to preview matching anchors.'));
    } else if (!analysis.terms?.length) {
        list.appendChild(createContextResolverDiagnosticCard(
            'No searchable terms',
            [
                'The phrase only contains direction or filler words after cleanup.',
                'Add a story event, arc, date, book, chapter, episode, quest, or alias.',
            ],
            'warning'
        ));
    } else {
        const matches = rankContextAnchors(query, { packId: pack.packId, limit: 8, index: contextIndex });
        const entryMatches = getContextEntryResolverMatches(pack, analysis, { limit: 6 });
        if (!matches.length && !entryMatches.length) {
            list.appendChild(createContextResolverDiagnosticCard(
                'No local anchor match',
                getContextResolverMissReasons(pack, analysis, packIndex),
                'warning'
            ));
        } else {
            if (Number(matches[0]?.score) < 32) {
                list.appendChild(createContextResolverDiagnosticCard(
                    'Weak match set',
                    [
                        'The best result only matched low-weight coordinate text.',
                        'Review the reasons before applying, or add a stronger alias/anchor if this phrase should be supported.',
                    ],
                    'suggestion'
                ));
            }
            const currentAnchorId = normalizeLoredeckTimelineId(context.anchorId);
            for (const match of matches) {
                list.appendChild(createContextWorkbenchResolverResult(pack, match, currentAnchorId));
            }
        }
        if (entryMatches.length) {
            list.appendChild(createContextResolverDiagnosticCard(
                'Lorecard-derived candidates',
                [
                    'These candidates come from loaded Lorecard Context gates, not from first-class timeline anchors.',
                    pack.type === 'bundled'
                        ? 'Apply one for this chat, or duplicate the bundled deck as Custom before promoting it into the timeline registry.'
                        : 'Apply one for this chat, or queue it as a real timeline anchor for Pending Review.',
                ],
                'suggestion'
            ));
            for (const match of entryMatches) {
                list.appendChild(createContextWorkbenchEntryResolverResult(pack, match));
            }
        } else if (!cachedEntries?.loadedAt) {
            list.appendChild(createContextResolverDiagnosticCard(
                'Lorecards not included',
                ['Click Load Lorecards to also search entry-level Context gates for event-like phrases.'],
                'suggestion'
            ));
        }
    }
    wrap.appendChild(list);

    return wrap;
}

function createContextResolverDiagnosticCard(titleText = 'Resolver note', lines = [], severity = 'suggestion') {
    const card = document.createElement('div');
    card.className = `saga-context-workbench-resolver-diagnostic saga-context-workbench-issue-${severity || 'suggestion'}`;
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-context-picker-title';
    title.textContent = titleText;
    card.appendChild(title);
    for (const line of lines.filter(Boolean).slice(0, 5)) {
        const item = document.createElement('div');
        item.className = 'saga-context-workbench-resolver-diagnostic-line';
        item.textContent = line;
        card.appendChild(item);
    }
    return card;
}

function getContextResolverSeedText(context = {}, state = getRuntimeState()) {
    const runtimeContext = state?.loreContext || {};
    return uniqueStrings([
        context.alias,
        context.label,
        context.sceneDate,
        context.arc,
        context.phase,
        context.season ? `season ${context.season}` : '',
        context.episode ? `episode ${context.episode}` : '',
        context.chapter ? `chapter ${context.chapter}` : '',
        context.issue ? `issue ${context.issue}` : '',
        context.quest,
        context.gameStage,
        runtimeContext.canonBoundary,
        runtimeContext.sceneDate,
        runtimeContext.subjectiveDate,
    ]).join(' ');
}

function createContextWorkbenchResolverResult(pack, match = {}, currentAnchorId = '') {
    const anchor = match.anchor || {};
    const id = normalizeLoredeckTimelineId(anchor.id);
    const row = document.createElement('div');
    row.className = 'saga-context-workbench-resolver-row';
    if (id && id === currentAnchorId) row.classList.add('saga-context-workbench-row-active');

    const main = document.createElement('div');
    main.className = 'saga-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-context-picker-title';
    title.textContent = anchor.label || id || 'Anchor';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-context-workbench-context-picker-meta';
    meta.textContent = [
        id,
        getContextResolverConfidenceLabel(match.score),
        formatAnchorDateRange(anchor),
        anchor.book || anchor.work,
        anchor.arc,
        anchor.phase,
        anchor.aliases?.slice(0, 2).join(', '),
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    const reason = document.createElement('div');
    reason.className = 'saga-context-workbench-resolver-reason';
    reason.textContent = formatContextResolverReasonText(match);
    main.appendChild(reason);
    row.appendChild(main);

    const score = createContextWorkbenchResolverScorePill(match.score, 'Local resolver match score. Higher is better; this is not model confidence.');
    row.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'saga-context-workbench-row-actions';
    const apply = createButton('Apply', 'Apply this anchor as the exact Context.', () => {
        applyContextAnchor(pack.packId, anchor);
    }, 'saga-primary-button');
    markTourTarget(apply, 'context.workbench.resolverApply');
    actions.appendChild(apply);
    const after = createButton('After', 'Use this anchor as the lower bound of the current Context window.', () => {
        applyContextAnchorBoundary(pack.packId, { kind: 'anchor', id, definition: anchor }, 'from');
    });
    markTourTarget(after, 'context.workbench.resolverAfter');
    actions.appendChild(after);
    const before = createButton('Before', 'Use this anchor as the upper bound of the current Context window.', () => {
        applyContextAnchorBoundary(pack.packId, { kind: 'anchor', id, definition: anchor }, 'to');
    });
    markTourTarget(before, 'context.workbench.resolverBefore');
    actions.appendChild(before);
    const timeline = createButton('Timeline', 'Inspect this anchor in the Timeline tab.', () => {
        setContextWorkbenchSelectedKey(`anchor:${id}`);
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    });
    markTourTarget(timeline, 'context.workbench.resolverTimeline');
    actions.appendChild(timeline);
    row.appendChild(actions);
    return row;
}

function createContextWorkbenchEntryResolverResult(pack, match = {}) {
    const entry = match.entry || {};
    const row = document.createElement('div');
    row.className = 'saga-context-workbench-resolver-row saga-context-workbench-resolver-row-entry';

    const main = document.createElement('div');
    main.className = 'saga-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-context-picker-title';
    title.textContent = entry.title || match.row?.id || 'Lorecard candidate';
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-context-workbench-context-picker-meta';
    meta.textContent = [
        'Lorecard-derived',
        match.row?.id,
        getContextResolverConfidenceLabel(match.score),
        getContextEntryCandidateText(match),
        entry.category,
        entry.lorePurpose,
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);

    const reason = document.createElement('div');
    reason.className = 'saga-context-workbench-resolver-reason';
    reason.textContent = formatContextResolverReasonText(match);
    main.appendChild(reason);
    row.appendChild(main);

    const score = createContextWorkbenchResolverScorePill(match.score, 'Entry-derived resolver match score. Higher is better; this is not model confidence.');
    row.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'saga-context-workbench-row-actions';
    actions.appendChild(createButton('Apply', 'Apply this Lorecard-derived Context to the current chat.', () => {
        applyContextEntryCandidate(pack.packId, match);
    }, 'saga-primary-button'));
    if (pack.type === 'bundled') {
        actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck before promoting Lorecard-derived anchors.', () => {
            openDuplicateLoredeckDialog(pack);
        }));
    } else {
        actions.appendChild(createButton('Queue Anchor', 'Queue this Lorecard-derived candidate as a real timeline anchor for Pending Review.', () => {
            queueContextEntryCandidateTimelineAnchor(pack, match);
        }));
    }
    actions.appendChild(createButton('Find Lorecard', 'Open the Loredeck editor filtered to this Lorecard.', () => {
        openLoredeckEditorForQuery(pack.packId, match.row?.id || entry.title || '', 'Loredeck editor filtered to the resolver candidate Lorecard.');
    }));
    row.appendChild(actions);
    return row;
}

function getContextEntryCandidateText(match = {}) {
    const contextGate = match.context || {};
    const bounds = [
        normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom),
        normalizeLoredeckTimelineNumber(contextGate.sortKeyTo),
    ].filter(value => value !== null && value !== undefined).join(' -> ');
    return [
        contextGate.scope,
        bounds,
        contextGate.validFromAnchor || contextGate.anchorFrom,
        contextGate.validToAnchor || contextGate.anchorTo,
        contextGate.label,
    ].filter(Boolean).join(' | ');
}

function formatContextResolverReasonText(match = {}) {
    const pieces = [];
    const reasons = Array.isArray(match.reasons) ? match.reasons : [];
    if (reasons.length) {
        pieces.push(`Why: ${reasons.slice(0, 3).map(reason => reason.label).join('; ')}`);
    }
    if (Array.isArray(match.matchedTerms) && match.matchedTerms.length) {
        pieces.push(`Matched: ${match.matchedTerms.join(', ')}`);
    }
    if (Array.isArray(match.missingTerms) && match.missingTerms.length) {
        pieces.push(`Missing: ${match.missingTerms.join(', ')}`);
    }
    if (Array.isArray(match.ignoredTerms) && match.ignoredTerms.length) {
        pieces.push(`Ignored: ${match.ignoredTerms.join(', ')}`);
    }
    return pieces.join(' | ') || 'Matched by local timeline registry text.';
}

function getContextResolverConfidenceLabel(score = 0) {
    const value = Number(score) || 0;
    if (value >= 120) return 'Exact';
    if (value >= 70) return 'Strong';
    if (value >= 32) return 'Likely';
    return 'Possible';
}

function formatAnchorDateRange(anchor = {}) {
    const from = String(anchor.dateRange?.from || '').trim();
    const to = String(anchor.dateRange?.to || '').trim();
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
}

function uniqueStrings(values = []) {
    const output = [];
    const seen = new Set();
    for (const value of values) {
        const text = String(value || '').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        output.push(text);
    }
    return output;
}

function getContextWorkbenchCurrentTimelineItem(context = {}, items = []) {
    const anchorId = normalizeLoredeckTimelineId(context.anchorId);
    if (anchorId) {
        const anchor = items.find(item => item.kind !== 'window' && normalizeLoredeckTimelineId(item.id) === anchorId);
        if (anchor) return anchor;
    }
    const anchorFrom = normalizeLoredeckTimelineId(context.anchorFrom);
    const anchorTo = normalizeLoredeckTimelineId(context.anchorTo);
    if (anchorFrom || anchorTo) {
        if (anchorFrom && anchorTo) {
            const exactWindow = items.find(item => item.kind === 'window'
                && normalizeLoredeckTimelineId(item.definition?.anchorFrom) === anchorFrom
                && normalizeLoredeckTimelineId(item.definition?.anchorTo) === anchorTo);
            if (exactWindow) return exactWindow;
        }
        return items.find(item => item.kind !== 'window' && [anchorFrom, anchorTo].includes(normalizeLoredeckTimelineId(item.id))) || null;
    }
    return null;
}

export function createContextWorkbenchAliasesView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'saga-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const allItems = getContextWorkbenchTimelineItems(pack, contextIndex);
    const filteredItems = filterContextWorkbenchTimelineItems(allItems);
    const aliasRows = getContextWorkbenchAliasRows(filteredItems);

    const controls = document.createElement('div');
    controls.className = 'saga-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-lore-workbench-search';
    search.placeholder = 'Search aliases and targets...';
    search.value = getContextWorkbenchQuery();
    addTooltip(search, 'Search resolver aliases, target labels, IDs, tags, and coordinates.');
    search.addEventListener('input', () => {
        preserveInputFocusAfterRender(search, '.saga-context-workbench-overlay .saga-lore-workbench-search', () => {
            setContextWorkbenchQuery(search.value);
            renderContextWorkbench();
        });
    });
    controls.appendChild(search);
    controls.appendChild(createStatusPill(`${aliasRows.length} aliases`, 'Resolver alias rows matching the current filters.', {
        tone: aliasRows.length ? 'selected' : 'muted',
        kind: 'count',
        className: 'saga-lore-workbench-count',
    }));
    controls.appendChild(createButton('Timeline', 'Return to the timeline spreadsheet.', () => {
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    view.appendChild(controls);

    const table = document.createElement('div');
    table.className = 'saga-context-workbench-alias-table';
    const header = document.createElement('div');
    header.className = 'saga-context-workbench-alias-row saga-context-workbench-row-header';
    for (const label of ['Alias', 'Target', 'Kind', 'Context', 'State', 'Warning', 'Actions']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);
    if (!aliasRows.length) {
        table.appendChild(createEmptyMessage('No aliases match the current filters. Add aliases to timeline anchors/windows to improve casual resolver matching.'));
    } else {
        for (const aliasRow of aliasRows.slice(0, 500)) {
            table.appendChild(createContextWorkbenchAliasRow(pack, aliasRow));
        }
    }
    view.appendChild(table);
    return view;
}

export function getContextWorkbenchAliasRows(items = []) {
    const rows = [];
    const counts = new Map();
    for (const item of Array.isArray(items) ? items : []) {
        const aliases = Array.isArray(item.definition?.aliases) ? item.definition.aliases : [];
        for (const alias of aliases) {
            const text = String(alias || '').trim();
            if (!text) continue;
            const key = text.toLowerCase();
            counts.set(key, (counts.get(key) || 0) + 1);
            rows.push({ alias: text, aliasKey: key, item });
        }
    }
    return rows
        .map(row => ({ ...row, duplicate: (counts.get(row.aliasKey) || 0) > 1 }))
        .sort((a, b) => a.alias.localeCompare(b.alias, undefined, { numeric: true, sensitivity: 'base' }));
}

function createContextWorkbenchAliasRow(pack, aliasRow = {}) {
    const item = aliasRow.item || {};
    const def = item.definition || {};
    const row = document.createElement('div');
    row.className = 'saga-context-workbench-alias-row';
    if (aliasRow.duplicate) row.classList.add('saga-context-workbench-row-warning');
    row.appendChild(createWorkbenchTextCell(aliasRow.alias, aliasRow.duplicate ? 'duplicate alias' : 'resolver phrase'));
    row.appendChild(createWorkbenchTextCell(def.label || item.id, item.id));
    row.appendChild(createWorkbenchTextCell(item.kind === 'window' ? 'Window' : 'Anchor', item.registryState || 'source'));
    row.appendChild(createWorkbenchTextCell(getContextTimelineItemContextText(item), getContextTimelineItemCoordinateText(item)));
    row.appendChild(createWorkbenchTextCell(item.disabled ? 'Disabled' : 'Active', item.registryState || ''));
    row.appendChild(createWorkbenchTextCell(aliasRow.duplicate ? 'Duplicate' : 'OK', aliasRow.duplicate ? 'Same alias maps to multiple targets.' : ''));
    const actions = document.createElement('div');
    actions.className = 'saga-context-workbench-row-actions';
    actions.appendChild(createButton('Select', 'Select this timeline target in the Timeline tab.', () => {
        setContextWorkbenchSelectedKey(getContextTimelineItemKey(item));
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    actions.appendChild(createButton('Apply', 'Use this alias target as the selected Loredeck Context.', () => {
        applyContextTimelineItem(pack.packId, item);
    }, 'saga-primary-button'));
    row.appendChild(actions);
    return row;
}

export function createContextWorkbenchValidationView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'saga-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const items = getContextWorkbenchTimelineItems(pack, contextIndex);
    const issues = getContextWorkbenchValidationIssues(pack, items, contextIndex);

    const controls = document.createElement('div');
    controls.className = 'saga-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));
    const counts = {
        error: issues.filter(issue => issue.severity === 'error').length,
        warning: issues.filter(issue => issue.severity === 'warning').length,
        suggestion: issues.filter(issue => issue.severity === 'suggestion').length,
    };
    controls.appendChild(createStatusPill(`${counts.error} errors`, 'Structural timeline issues that can break resolution.', { tone: counts.error ? 'danger' : 'muted', kind: 'severity' }));
    controls.appendChild(createStatusPill(`${counts.warning} warnings`, 'Timeline issues that should be reviewed.', { tone: counts.warning ? 'warning' : 'muted', kind: 'severity' }));
    controls.appendChild(createStatusPill(`${counts.suggestion} suggestions`, 'Optional improvements for resolver coverage.', { tone: counts.suggestion ? 'info' : 'muted', kind: 'severity' }));
    controls.appendChild(createButton('Validate Deck', 'Run Pack Health validation and refresh timeline diagnostics.', async (btn) => {
        await validateLoredeckForEditor(pack, btn);
        await loadContextIndex({ force: true }).catch(() => null);
        renderContextWorkbench();
    }, 'saga-primary-button'));
    view.appendChild(controls);

    const main = document.createElement('div');
    main.className = 'saga-context-workbench-validation-layout';
    const table = document.createElement('div');
    table.className = 'saga-context-workbench-validation-table';
    const header = document.createElement('div');
    header.className = 'saga-context-workbench-validation-row saga-context-workbench-row-header';
    for (const label of ['Severity', 'Issue', 'Target', 'Suggested Action']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);
    if (!issues.length) {
        table.appendChild(createEmptyMessage('No Context validation issues found for the selected Loredeck.'));
    } else {
        for (const issue of issues.slice(0, 500)) {
            table.appendChild(createContextWorkbenchValidationRow(issue));
        }
    }
    main.appendChild(table);
    main.appendChild(createContextWorkbenchValidationSummary(pack, items, issues));
    view.appendChild(main);
    return view;
}

export function getContextWorkbenchValidationIssues(pack, items = [], contextIndex = null) {
    items = Array.isArray(items) ? items : [];
    const issues = [];
    const itemByKey = new Map(items.map(item => [getContextTimelineItemKey(item), item]));
    const anchorIds = new Set(items
        .filter(item => item.kind === 'anchor' && !item.disabled && item.registryState !== 'undefined')
        .map(item => item.id));
    const aliasTargets = new Map();
    for (const item of items) {
        const key = getContextTimelineItemKey(item);
        const def = item.definition || {};
        if (item.registryState === 'undefined') {
            issues.push({
                severity: 'warning',
                code: 'undefined_anchor',
                itemKey: key,
                target: item.id,
                message: `Lorecards reference ${item.id}, but the timeline registry does not define it.`,
                action: 'Create or map this anchor in the Custom timeline registry.',
            });
        }
        if (!String(def.label || '').trim()) {
            issues.push({
                severity: 'warning',
                code: 'missing_label',
                itemKey: key,
                target: item.id,
                message: `${item.id} is missing a readable label.`,
                action: 'Add a label before sharing the Loredeck.',
            });
        }
        if (!(def.aliases || []).length) {
            issues.push({
                severity: 'suggestion',
                code: 'missing_aliases',
                itemKey: key,
                target: item.id,
                message: `${def.label || item.id} has no resolver aliases.`,
                action: 'Add casual phrasing users might type.',
            });
        }
        for (const alias of def.aliases || []) {
            const aliasKey = String(alias || '').trim().toLowerCase();
            if (!aliasKey) continue;
            if (!aliasTargets.has(aliasKey)) aliasTargets.set(aliasKey, []);
            aliasTargets.get(aliasKey).push(key);
        }
        if (item.kind === 'window') {
            const sortFrom = normalizeLoredeckTimelineNumber(def.sortKeyFrom);
            const sortTo = normalizeLoredeckTimelineNumber(def.sortKeyTo);
            if (sortFrom !== null && sortTo !== null && sortFrom > sortTo) {
                issues.push({
                    severity: 'error',
                    code: 'invalid_window_sort',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} has sort bounds in reverse order.`,
                    action: 'Set Sort From lower than or equal to Sort To.',
                });
            }
            if (def.anchorFrom && !anchorIds.has(def.anchorFrom)) {
                issues.push({
                    severity: 'error',
                    code: 'dangling_start_anchor',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} starts at missing anchor ${def.anchorFrom}.`,
                    action: 'Create the anchor or update the window start.',
                });
            }
            if (def.anchorTo && !anchorIds.has(def.anchorTo)) {
                issues.push({
                    severity: 'error',
                    code: 'dangling_end_anchor',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} ends at missing anchor ${def.anchorTo}.`,
                    action: 'Create the anchor or update the window end.',
                });
            }
        }
    }
    for (const [alias, targets] of aliasTargets.entries()) {
        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length <= 1) continue;
        for (const itemKey of uniqueTargets) {
            const item = itemByKey.get(itemKey);
            issues.push({
                severity: 'warning',
                code: 'duplicate_alias',
                itemKey,
                target: item?.id || itemKey,
                message: `Alias "${alias}" maps to ${uniqueTargets.length} timeline definitions.`,
                action: 'Rename or narrow duplicate aliases so local matching is predictable.',
            });
        }
    }
    for (const issue of contextIndex?.issues || []) {
        if (issue?.packId && issue.packId !== pack?.packId) continue;
        issues.push({
            severity: issue?.severity || 'warning',
            code: issue?.code || 'index_issue',
            itemKey: '',
            target: issue?.timelineRef || pack?.packId || '',
            message: issue?.message || 'Context index reported an issue.',
            action: 'Inspect timeline registry source and reload the index.',
        });
    }
    return issues.sort((a, b) => {
        const order = { error: 0, warning: 1, suggestion: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
            || String(a.target || '').localeCompare(String(b.target || ''));
    });
}

function createContextWorkbenchValidationRow(issue = {}) {
    const row = document.createElement('div');
    row.className = `saga-context-workbench-validation-row saga-context-workbench-issue-${issue.severity || 'suggestion'}`;
    row.addEventListener('click', () => {
        if (issue.itemKey) {
            setContextWorkbenchSelectedKey(issue.itemKey);
            setContextWorkbenchTab('timeline');
            renderContextWorkbench();
        }
    });
    row.appendChild(createWorkbenchTextCell(humanizeScopeKey(issue.severity || 'suggestion'), issue.code || ''));
    row.appendChild(createWorkbenchTextCell(issue.message || 'Timeline issue', ''));
    row.appendChild(createWorkbenchTextCell(issue.target || 'registry', issue.itemKey || ''));
    row.appendChild(createWorkbenchTextCell(issue.action || 'Review timeline data.', issue.itemKey ? 'Click to inspect target.' : ''));
    return row;
}

function createContextWorkbenchValidationSummary(pack, items = [], issues = []) {
    const panel = document.createElement('div');
    panel.className = 'saga-context-workbench-inspector';
    const title = document.createElement('div');
    title.className = 'saga-context-workbench-inspector-title';
    title.textContent = 'Timeline Summary';
    panel.appendChild(title);
    const anchors = items.filter(item => item.kind === 'anchor');
    const windows = items.filter(item => item.kind === 'window');
    const aliases = items.reduce((sum, item) => sum + (item.definition?.aliases?.length || 0), 0);
    const attached = items.filter(item => item.entryIds?.length).length;
    const grid = document.createElement('div');
    grid.className = 'saga-context-workbench-inspector-grid';
    grid.appendChild(createKeyValue('Deck', pack.title || pack.packId, 'Selected Loredeck.'));
    grid.appendChild(createKeyValue('Anchors', String(anchors.length), 'Timeline anchors visible to the workbench.'));
    grid.appendChild(createKeyValue('Windows', String(windows.length), 'Timeline windows visible to the workbench.'));
    grid.appendChild(createKeyValue('Aliases', String(aliases), 'Explicit resolver aliases across anchors/windows.'));
    grid.appendChild(createKeyValue('Attached', String(attached), 'Timeline rows referenced by loaded Lorecards.'));
    grid.appendChild(createKeyValue('Issues', String(issues.length), 'Current Context validation findings.'));
    panel.appendChild(grid);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'This validation is focused on Context structure. Pack Health remains the broader import/export and schema health report.';
    panel.appendChild(help);
    return panel;
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

function truncateText(value, limit = 120) {
    const text = String(value || '');
    return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}...` : text;
}
