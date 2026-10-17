import {
    addTooltip,
    confirmAction,
    createButton,
    createEmptyMessage,
    createSectionHeader,
    createStatusPill,
    humanizeScopeKey,
    toast,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';

import { formatLoredeckContextUpdatedAt } from './context-formatters.js';
import { getContextIndexSync, loadContextIndex } from './context-index.js';

const CONTEXT_PROPOSAL_REVIEW_ID = 'saga-context-proposal-review';

let contextPanelDeps = {};

export function configureContextPanel(deps = {}) {
    contextPanelDeps = { ...contextPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = contextPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Context Panel dependency is not configured: ${name}`);
}

function getContextWorkbenchStack(state) { return dep('getContextWorkbenchStack', () => [])(state); }
function getLoredeckContext(state, packId) { return dep('getLoredeckContext', () => ({}))(state, packId); }
function getLoredeckDisplayName(packId) { return dep('getLoredeckDisplayName', packId => String(packId || 'Loredeck'))(packId); }
function getContextTypeLabel(value) { return dep('getContextTypeLabel', value => String(value || 'Custom'))(value); }
function formatContextSource(value) { return dep('formatContextSource', value => String(value || 'Unknown'))(value); }
function formatContextSummary(context) { return dep('formatContextSummary', () => 'No Context set.')(context); }
function hasSelectedLoredeckContext(context) { return dep('hasSelectedLoredeckContext', () => false)(context); }
function getContextAutomationModeLabel(mode) { return dep('getContextAutomationModeLabel', mode => String(mode || 'Manual'))(mode); }
function getContextBriefStatusLabel(status) { return dep('getContextBriefStatusLabel', () => 'Idle')(status); }
function getContextBriefStatusTone(status) { return dep('getContextBriefStatusTone', () => 'unknown')(status); }
function getContextResolutionProposals(state) { return dep('getContextResolutionProposals', () => [])(state); }
function openContextWorkbenchForPack(packId, tab) { return dep('openContextWorkbenchForPack', () => null)(packId, tab); }
function toggleLoredeckContextManualLock(packId, locked) { return dep('toggleLoredeckContextManualLock', () => null)(packId, locked); }
function seedLoredeckContextFromRuntimeContext(packId, context) { return dep('seedLoredeckContextFromRuntimeContext', () => null)(packId, context); }
function resetLoredeckContextFromPanel(packId) { return dep('resetLoredeckContextFromPanel', async () => null)(packId); }
function applyContextResolutionProposalSet(proposals, options) { return dep('applyContextResolutionProposalSet', () => 0)(proposals, options); }
function dismissContextResolutionProposalSet(proposals, options) { return dep('dismissContextResolutionProposalSet', () => 0)(proposals, options); }
function markTourTarget(el, target) { return dep('markTourTarget', el => el)(el, target); }
function handleDetectStoryContext(button) { return dep('handleDetectStoryContext', async () => null)(button); }
function handleResolveContextsFromContext(button) { return dep('handleResolveContextsFromContext', async () => null)(button); }
function handleModelResolveContexts(button) { return dep('handleModelResolveContexts', async () => null)(button); }
function appendContextGenerationStatus(card, state) { return dep('appendContextGenerationStatus', () => null)(card, state); }
function createContextBriefStatusCard(state) { return dep('createContextBriefStatusCard', () => document.createDocumentFragment())(state); }
function shouldShowContextAutomationPanel() { return dep('shouldShowContextAutomationPanel', () => false)(); }
function isBasicExperienceMode() { return dep('isBasicExperience', () => false)() === true; }
function createCollapsibleSection(sectionId, titleText, subtitleText, defaultOpen, content, options) { return dep('createCollapsibleSection')(sectionId, titleText, subtitleText, defaultOpen, content, options); }
function createContextEditorCard(state) { return dep('createContextEditorCard', () => document.createDocumentFragment())(state); }
function getState() { return dep('getState', () => ({}))(); }
function getSettings() { return dep('getSettings', () => ({}))(); }
function saveSettings(settings) { return dep('saveSettings', () => null)(settings); }
function refreshContextPanelBody(options = {}) { return dep('refreshContextPanelBody', () => null)(options); }
function resetContextDetectionSettings() { return dep('resetContextDetectionSettings', () => null)(); }

// Context tab -----------------------------------------------------------------

export function renderContextTab(container, state) {
    const settings = getSettings();
    const basic = isBasicExperienceMode();
    const contextIndex = getContextIndexSync();
    const mobileSubview = null;
    container.classList.add('saga-operator-tab', 'saga-context-operator-tab');
    if (!contextIndex) {
        loadContextIndex()
            .then(() => refreshContextPanelBody({ preserveScroll: true, preserveWindowScroll: true }))
            .catch(e => console.warn('[Saga] Context index load failed:', e));
    }

    container.appendChild(createSectionHeader(
        'Context',
        'Set and audit where this chat sits inside each loaded Loredeck.'
    ));
    container.appendChild(createContextOperatorSummary(state, contextIndex, { mobileSubview }));

    const contextStack = getContextWorkbenchStack(state);
    const contextProposals = getContextResolutionProposals(state);
    container.appendChild(createCollapsibleSection(
        'context.commandCenter',
        'Runtime Context',
        `${contextStack.length} loaded | ${contextProposals.length} proposal${contextProposals.length === 1 ? '' : 's'}`,
        true,
        createContextCommandCenterCard(state, contextIndex),
        {
            tooltip: 'Primary controls for browsing, detecting, resolving, and reviewing loaded Loredeck Context.',
        }
    ));
    container.appendChild(createCollapsibleSection(
        'context.loadedLoredecks',
        'Loaded Loredeck Contexts',
        contextStack.length ? `${contextStack.length} active` : 'none loaded',
        true,
        createLoredeckContextCard(state, contextIndex),
        {
            tooltip: 'Per-Loredeck Context rows for the active stack, including locks, manual browser access, and resolver confidence.',
        }
    ));
    if (!basic) container.appendChild(createContextAdvancedBriefSection(state));
}

function getContextOperatorActionLabel(actionId, label, nextActionId = '') {
    void actionId;
    void nextActionId;
    return label;
}

function getContextOperatorActionClass(actionId, nextActionId = '', fallbackClass = '') {
    if (!nextActionId) return fallbackClass;
    return actionId === nextActionId ? 'saga-primary-button' : '';
}

function createContextOperatorSummary(state = {}, contextIndex = null, options = {}) {
    const basic = isBasicExperienceMode();
    const mobileSubview = null;
    const stack = getContextWorkbenchStack(state);
    const proposals = getContextResolutionProposals(state);
    const selectedRows = stack
        .map(item => ({ item, context: getLoredeckContext(state, item.packId) }))
        .filter(row => hasSelectedLoredeckContext(row.context));
    const primary = selectedRows[0] || (stack[0] ? { item: stack[0], context: getLoredeckContext(state, stack[0].packId) } : null);
    const primarySummary = primary ? formatContextSummary(primary.context) : 'No loaded Loredeck Context.';
    const mobileRoot = false;
    const nextActionId = '';

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-operator-summary-card saga-context-operator-summary';
    markTourTarget(card, 'context.operator.summary');

    const header = document.createElement('div');
    header.className = 'saga-operator-summary-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-operator-summary-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-operator-summary-title';
    title.textContent = 'Story Position';
    addTooltip(title, 'Mobile operator summary for the current story position and next Context action.');
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-runtime-help saga-operator-summary-subtitle';
    subtitle.textContent = selectedRows.length
        ? `${getLoredeckDisplayName(primary.item.packId)}: ${primarySummary}`
        : (stack.length ? 'Choose the current story position before reviewing Context-aware Lorecards.' : 'Load Loredecks before setting story position.');
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta saga-operator-summary-chips';
    chips.appendChild(createStatusPill(`${stack.length} loaded`, 'Loaded Loredecks available for Context selection.', { tone: stack.length ? 'success' : 'muted', kind: 'count' }));
    chips.appendChild(createStatusPill(`${selectedRows.length} set`, 'Loaded Loredecks with a selected story position.', { tone: selectedRows.length ? 'success' : 'muted', kind: 'count' }));
    chips.appendChild(createStatusPill(formatContextIndexSummary(contextIndex), 'Timeline registry status for loaded Loredecks.', { tone: contextIndex?.summary?.issueCount ? 'warning' : (contextIndex?.hasIndex ? 'source' : 'muted'), kind: 'source' }));
    if (!basic || proposals.length) {
        chips.appendChild(createStatusPill(`${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`, 'Reasoner-backed Context proposals waiting for review.', { tone: proposals.length ? 'review' : 'muted', kind: 'count' }));
    }
    header.appendChild(chips);

    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-operator-summary-actions';
    actions.appendChild(markTourTarget(createButton(
        getContextOperatorActionLabel('browse', 'Browse Context', nextActionId),
        'Open the fullscreen Context Browser for loaded Loredecks, anchors, windows, resolver tests, and manual locks.',
        () => {
            if (!stack.length) {
                toast('Load a Loredeck before opening the Context Browser.', 'warning');
                return;
            }
            openContextWorkbenchForPack(primary?.item?.packId || stack[0]?.packId || '', 'context');
        },
        getContextOperatorActionClass('browse', nextActionId, 'saga-primary-button')
    ), 'context.operator.browse'));
    actions.appendChild(markTourTarget(createButton(
        getContextOperatorActionLabel('detect', 'Detect Context', nextActionId),
        'Analyze recent messages and update the Context Brief plus unlocked loaded Loredeck Contexts.',
        async (btn) => {
            await handleDetectStoryContext(btn);
        },
        getContextOperatorActionClass('detect', nextActionId, 'saga-primary-button')
    ), 'context.operator.detect'));
    if (!basic || proposals.length) {
        actions.appendChild(markTourTarget(createButton(
            getContextOperatorActionLabel('proposals', proposals.length ? `Review Proposals (${proposals.length})` : 'Review Proposals', nextActionId),
            'Open bounded Reasoner Context proposals waiting for approval.',
            () => openContextProposalReview(),
            getContextOperatorActionClass('proposals', nextActionId)
        ), 'context.operator.proposals'));
    }
    card.appendChild(actions);
    return card;
}

export function createContextAdvancedBriefSection(state = {}) {
    return createCollapsibleSection(
        'context.advancedBrief',
        'Advanced Context Brief',
        getAdvancedContextBriefSummary(state),
        false,
        createContextEditorCard(state),
        {
            tooltip: 'Legacy global Context projection used by older canon-preview flows. Loaded Loredeck rows are the primary Context surface.',
            className: 'saga-context-advanced-brief-section',
        }
    );
}

function getAdvancedContextBriefSummary(state = {}) {
    const context = state?.loreContext || {};
    const brief = state?.contextBrief || {};
    const signals = brief?.signals || {};
    const parts = [
        context.sceneDate || signals.sceneDate || '',
        context.canonBoundary || brief.summary || '',
        context.branchId && context.branchId !== 'main' ? `Branch: ${context.branchId}` : '',
    ].map(part => String(part || '').trim()).filter(Boolean);
    return parts.length ? parts.join(' | ') : 'Collapsed legacy/global Context fields';
}

function getContextAuditChipTone(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'muted';
    if (/\b(error|failed|provider issue|provider_error|blocked)\b/.test(normalized)) return 'danger';
    if (/\b(proposed|proposal|review|low confidence|unresolved|issue|warning)\b/.test(normalized)) return 'warning';
    if (/\b(applied|complete|completed|ready|success|detected|current)\b/.test(normalized)) return 'success';
    if (/\b(cached|skipped|waiting|manual|locked|no loaded|no_loaded|cadence|in flight)\b/.test(normalized)) return 'muted';
    return 'info';
}

function getContextConfidenceChipTone(confidence) {
    const value = Number(confidence);
    if (!Number.isFinite(value)) return 'muted';
    if (value >= 0.8) return 'success';
    if (value >= 0.55) return 'info';
    return 'warning';
}

export function createContextAutomationPanel() {
    const settings = getSettings();
    const selectedMode = String(settings.contextDetectionMode || 'manual').toLowerCase();
    const wrap = document.createElement('div');
    wrap.className = 'saga-context-automation-panel';
    markTourTarget(wrap, 'context.automation');

    const header = document.createElement('div');
    header.className = 'saga-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Automation';
    addTooltip(title, 'Controls automatic Context detection cadence. Manual locks still prevent overwrites.');
    header.appendChild(title);
    const modePill = createStatusPill(getContextAutomationModeLabel(selectedMode), 'Current Context detection automation mode.', {
        tone: selectedMode === 'manual' ? 'muted' : (selectedMode === 'automatic' ? 'warning' : 'info'),
        kind: 'status',
    });
    header.appendChild(modePill);
    wrap.appendChild(header);

    const buttons = document.createElement('div');
    buttons.className = 'saga-mode-buttons saga-context-mode-buttons';
    for (const [mode, label, tip] of [
        ['manual', 'Manual', 'Context detection runs only when you click Detect Context or Ask Reasoner.'],
        ['assisted', 'Assisted', 'Runs conservative background Context checks and queues uncertain Reasoner results for review.'],
        ['automatic', 'Automatic', 'Power-user background Context mode. Model-derived Context stays reviewable through alpha.'],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saga-mode-button';
        if (selectedMode === mode) btn.classList.add('saga-mode-button-active');
        btn.textContent = label;
        addTooltip(btn, tip);
        btn.addEventListener('click', () => {
            const next = { ...getSettings(), contextDetectionMode: mode };
            saveSettings(next);
            refreshContextPanelBody();
        });
        buttons.appendChild(btn);
    }
    wrap.appendChild(buttons);

    const modeDescription = document.createElement('div');
    modeDescription.className = 'saga-runtime-help saga-context-automation-description';
    modeDescription.textContent = getContextAutomationModeDescription(selectedMode);
    wrap.appendChild(modeDescription);

    const grid = document.createElement('div');
    grid.className = 'saga-context-automation-grid';

    grid.appendChild(createContextRangeSettingRow(
        'Min cadence',
        'Minimum completed model turns before Saga considers an automatic Context check. Text volume must also pass the character threshold unless the max cadence is reached.',
        'contextDetectionAutoMinTurns',
        { min: 1, max: 100, fallback: 8, suffix: ' turns' }
    ));
    grid.appendChild(createContextMaxCadenceRow(settings));
    grid.appendChild(createContextRangeSettingRow(
        'New text',
        'Minimum new recent-message characters before Saga runs an automatic Context check after the minimum turn cadence.',
        'contextDetectionAutoCharacterThreshold',
        { min: 0, max: 50000, fallback: 8000, suffix: ' chars', step: 250 }
    ));
    grid.appendChild(createContextSourceMessageRow(settings));
    grid.appendChild(createContextRangeSettingRow(
        'Reasoner fallback',
        'Minimum recent-message character count before automatic Context detection stores Reasoner-backed loaded-deck Context proposals. Manual Ask Reasoner ignores this threshold.',
        'contextModelFallbackMinCharacters',
        { min: 0, max: 8000, fallback: 1200, suffix: ' chars', step: 100 }
    ));
    grid.appendChild(createContextPercentRangeSettingRow(
        'Local apply',
        'Minimum local resolver confidence required before unlocked Loredeck Context rows are updated without review.',
        'contextLocalApplyMinConfidence',
        0.78
    ));
    grid.appendChild(createContextPercentRangeSettingRow(
        'Reasoner proposal',
        'Minimum bounded Reasoner confidence required before a Context choice becomes a reviewable proposal.',
        'contextReasonerProposalMinConfidence',
        0.55
    ));
    wrap.appendChild(grid);

    const toggles = document.createElement('div');
    toggles.className = 'saga-context-automation-toggles';
    toggles.appendChild(createContextToggleSetting(
        'Allow Reasoner fallback',
        'When enabled, automatic Context checks can ask the Reasoning Provider after local resolution leaves unlocked Loredecks unresolved. Results are stored as proposals for review.',
        'contextReasonerFallbackEnabled'
    ));
    wrap.appendChild(toggles);

    const resetRow = document.createElement('div');
    resetRow.className = 'saga-settings-reset-row';
    resetRow.appendChild(createButton(
        'Reset Defaults',
        'Reset only the context detection settings controls in this section to bundled defaults.',
        () => resetContextDetectionSettings(),
        'saga-small-button saga-settings-reset-button'
    ));
    wrap.appendChild(resetRow);

    return wrap;
}

function getContextAutomationModeDescription(mode = 'manual') {
    const normalized = String(mode || 'manual').toLowerCase();
    if (normalized === 'assisted') {
        return 'Runs conservative background Context checks on cadence, applies only high-confidence local matches, and queues Reasoner choices for review.';
    }
    if (normalized === 'automatic') {
        return 'Runs the same bounded pipeline on cadence with power-user tuning. Reasoner choices remain review proposals through alpha; only high-confidence local matches can apply automatically.';
    }
    return 'No background Context checks. Use Browse Context, Detect Context, Resolve Local, or Ask Reasoner when you want Saga to update Context.';
}

function createContextRangeSettingRow(labelPrefix, tooltip, settingKey, { min = 0, max = 100, fallback = 0, suffix = '', step = 1 } = {}) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const text = document.createElement('span');
    const rawValue = settings[settingKey] ?? fallback;
    const numericValue = Number.isFinite(Number(rawValue)) ? Number(rawValue) : fallback;
    const currentValue = Math.max(min, Math.min(max, numericValue));
    text.textContent = `${labelPrefix}: ${currentValue}${suffix}`;
    addTooltip(text, tooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(currentValue);
    input.addEventListener('input', () => {
        const parsed = parseInt(input.value, 10);
        const value = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        const next = { ...getSettings(), [settingKey]: value };
        saveSettings(next);
        text.textContent = `${labelPrefix}: ${value}${suffix}`;
    });
    row.appendChild(text);
    row.appendChild(input);
    return row;
}

function createContextMaxCadenceRow(settings = getSettings()) {
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const label = document.createElement('span');
    label.textContent = `Max cadence: ${settings.contextDetectionAutoInterval || 20} turns`;
    addTooltip(label, 'Maximum completed model turns before Saga runs a background Context check even if the character threshold has not been reached.');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '1';
    input.max = '100';
    input.step = '1';
    input.value = String(settings.contextDetectionAutoInterval || 20);
    input.addEventListener('input', () => {
        const value = Math.max(1, Math.min(100, parseInt(input.value, 10) || 20));
        const next = { ...getSettings(), contextDetectionAutoInterval: value };
        if (Number(next.contextDetectionAutoMinTurns || 1) > value) {
            next.contextDetectionAutoMinTurns = value;
        }
        saveSettings(next);
        label.textContent = `Max cadence: ${value} turns`;
    });
    row.appendChild(label);
    row.appendChild(input);
    return row;
}

function createContextSourceMessageRow(settings = getSettings()) {
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    markTourTarget(row, 'context.sourceMessages');
    const text = document.createElement('span');
    text.textContent = `Source messages: ${settings.contextSourceMessageCount || 20}`;
    addTooltip(text, 'How many recent chat messages are sent to Context detection.');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '4';
    input.max = '200';
    input.step = '1';
    input.value = String(settings.contextSourceMessageCount || 20);
    input.addEventListener('input', () => {
        const value = Math.max(4, Math.min(200, parseInt(input.value, 10) || 20));
        const next = { ...getSettings(), contextSourceMessageCount: value };
        saveSettings(next);
        text.textContent = `Source messages: ${value}`;
    });
    row.appendChild(text);
    row.appendChild(input);
    return row;
}

function createContextPercentRangeSettingRow(labelPrefix, tooltip, settingKey, fallback = 0.5) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const text = document.createElement('span');
    const currentValue = clampContextSettingConfidence(settings[settingKey], fallback);
    text.textContent = `${labelPrefix}: ${Math.round(currentValue * 100)}%`;
    addTooltip(text, tooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(currentValue * 100));
    input.addEventListener('input', () => {
        const percent = Math.max(0, Math.min(100, parseInt(input.value, 10) || 0));
        const next = { ...getSettings(), [settingKey]: percent / 100 };
        saveSettings(next);
        text.textContent = `${labelPrefix}: ${percent}%`;
    });
    row.appendChild(text);
    row.appendChild(input);
    return row;
}

function createContextToggleSetting(labelText, tooltip, settingKey) {
    const settings = getSettings();
    const label = document.createElement('label');
    label.className = 'saga-inline-toggle saga-context-automation-toggle';
    addTooltip(label, tooltip);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[settingKey] !== false;
    input.addEventListener('change', () => {
        const next = { ...getSettings(), [settingKey]: input.checked };
        saveSettings(next);
        refreshContextPanelBody();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${labelText}`));
    return label;
}

function clampContextSettingConfidence(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return Math.max(0, Math.min(1, fallback));
    if (number > 1 && number <= 100) return Math.max(0, Math.min(1, number / 100));
    return Math.max(0, Math.min(1, number));
}

export function createContextCommandCenterCard(state = {}, contextIndex = null) {
    const basic = isBasicExperienceMode();
    const stack = getContextWorkbenchStack(state);
    const proposals = getContextResolutionProposals(state);
    const briefStatus = state?.contextBrief?.status || {};
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-context-command-card';
    if (basic) card.classList.add('saga-context-command-card-basic');
    markTourTarget(card, 'context.commandCenter');

    const header = document.createElement('div');
    header.className = 'saga-context-command-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-context-command-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Runtime Context';
    addTooltip(title, 'Primary runtime controls for loaded Loredeck Context, detection, proposals, locks, and the Context Browser.');
    titleWrap.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Choose the current Context per loaded Loredeck. Manual Browser choices and locks outrank automatic detection.';
    titleWrap.appendChild(help);
    header.appendChild(titleWrap);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta saga-context-command-chips';
    chips.appendChild(createStatusPill(`${stack.length} loaded`, 'Enabled Loredecks currently participating in Context resolution.', { tone: stack.length ? 'success' : 'muted', kind: 'count' }));
    chips.appendChild(createStatusPill(formatContextIndexSummary(contextIndex), 'Context timeline registry status for the enabled Loredeck stack.', { tone: contextIndex?.summary?.issueCount ? 'warning' : (contextIndex?.hasIndex ? 'source' : 'muted'), kind: 'source' }));
    chips.appendChild(createContextBriefStatusPill(getContextBriefStatusLabel(briefStatus), 'Latest detector status from the saved Context Brief.', getContextBriefStatusTone(briefStatus)));
    if (!basic || proposals.length) {
        chips.appendChild(createStatusPill(
            `${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`,
            'Reasoner-backed Context proposals waiting for review.',
            { tone: proposals.length ? 'review' : 'muted', kind: 'count' }
        ));
    }
    header.appendChild(chips);
    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-context-command-actions';
    actions.appendChild(markTourTarget(createButton('Browse Context', 'Open the fullscreen Context Browser for loaded Loredecks, anchors, windows, resolver tests, and manual locks.', () => {
        if (!stack.length) {
            toast('Load a Loredeck before opening the Context Browser.', 'warning');
            return;
        }
        openContextWorkbenchForPack(stack[0]?.packId || '', 'context');
    }, 'saga-primary-button'), 'context.browser'));
    actions.appendChild(markTourTarget(createButton('Detect Context', 'Analyze recent messages and update the Context Brief plus unlocked loaded Loredeck Contexts.', async (btn) => {
        await handleDetectStoryContext(btn);
    }, 'saga-primary-button'), 'context.detect'));
    if (!basic || proposals.length) {
        actions.appendChild(markTourTarget(createButton(
            proposals.length
                ? `Review Proposals (${proposals.length})`
                : 'Review Proposals',
            'Open bounded Reasoner Context proposals waiting for approval.',
            () => {
                openContextProposalReview();
            }
        ), 'context.proposals.review'));
    }
    card.appendChild(actions);

    if (!basic) {
        const resolverActions = document.createElement('div');
        resolverActions.className = 'saga-primary-actions saga-context-resolver-actions';
        resolverActions.appendChild(markTourTarget(createButton('Resolve Local', 'Use current Context Brief signals and loaded timeline aliases to update unlocked Loredeck Contexts without a model call.', async (btn) => {
            await handleResolveContextsFromContext(btn);
        }), 'context.resolve.local'));
        resolverActions.appendChild(markTourTarget(createButton('Ask Reasoner', 'Ask the configured Reasoning Provider to choose from bounded known timeline candidates for unresolved loaded Loredecks.', async (btn) => {
            await handleModelResolveContexts(btn);
        }), 'context.resolve.reasoner'));
        card.appendChild(resolverActions);
    }

    appendContextGenerationStatus(card, state);
    card.appendChild(createContextBriefStatusCard(state));
    card.appendChild(createContextResolutionProposalPanel(state));
    if (!basic) {
        card.appendChild(createContextResolutionAuditPanel(state));
        card.appendChild(createContextAutomationAuditPanel(state));
    }

    if (shouldShowContextAutomationPanel()) {
        card.appendChild(createContextAutomationPanel());
    }

    return card;
}

function createContextBriefStatusPill(text, tooltip, tone = '') {
    const normalizedTone = tone === 'high'
        ? 'danger'
        : (tone === 'medium' ? 'warning' : (tone === 'low' ? 'success' : (tone || 'muted')));
    return createStatusPill(text, tooltip, {
        tone: normalizedTone,
        kind: normalizedTone === 'danger' || normalizedTone === 'warning' ? 'severity' : 'status',
    });
}

export function createLoredeckContextCard(state = {}, contextIndex = null) {
    const basic = isBasicExperienceMode();
    const stack = getContextWorkbenchStack(state);
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-loredeck-context-card';
    markTourTarget(card, 'context.loadedLoredecks');

    const header = document.createElement('div');
    header.className = 'saga-context-section-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = basic ? 'Loaded Loredecks' : 'Loaded Loredeck Contexts';
    addTooltip(title, 'Current Context for each enabled Loredeck in the active stack.');
    header.appendChild(title);

    const indexMeta = document.createElement('div');
    indexMeta.className = 'saga-context-index-summary';
    if (stack.length) {
        indexMeta.appendChild(createStatusPill(
            basic ? `${stack.length} loaded` : formatContextIndexSummary(contextIndex),
            basic ? 'Loaded Loredecks available for story-position selection.' : 'Context timeline registry status for the enabled Loredeck stack.',
            { tone: basic ? 'success' : (contextIndex?.summary?.issueCount ? 'warning' : (contextIndex?.hasIndex ? 'source' : 'muted')), kind: basic ? 'count' : 'source' }
        ));
        if (!basic && contextIndex?.summary?.issueCount) {
            indexMeta.appendChild(createStatusPill(`${contextIndex.summary.issueCount} index issue${contextIndex.summary.issueCount === 1 ? '' : 's'}`, 'Timeline registry load warnings or suggestions.', { tone: 'warning', kind: 'severity' }));
        }
    } else {
        indexMeta.appendChild(createStatusPill('No loaded Loredecks', 'Load Loredecks into the active stack before setting per-Loredeck Context.', { tone: 'muted', kind: 'status' }));
    }
    header.appendChild(indexMeta);
    card.appendChild(header);

    if (!stack.length) {
        card.appendChild(createEmptyMessage('No enabled Loredecks need active Context.'));
        return card;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-context-list';
    for (const item of stack) {
        list.appendChild(createLoredeckContextRow(item, state, contextIndex, { basic }));
    }
    card.appendChild(list);
    return card;
}

export function createContextResolutionAuditPanel(state = {}) {
    const audit = state?.lorePanel?.contextResolutionAudit || null;
    if (!audit || !audit.createdAt) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-context-quick saga-context-resolution-audit';

    const header = document.createElement('div');
    header.className = 'saga-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Last Resolver Check';
    addTooltip(title, 'Audit summary for the most recent local or Reasoner-backed Context resolver pass.');
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(audit.status || 'unknown', 'Final resolver status for the latest check.', { tone: getContextAuditChipTone(audit.status), kind: getContextAuditChipTone(audit.status) === 'danger' || getContextAuditChipTone(audit.status) === 'warning' ? 'severity' : 'status' }));
    if (audit.reason) chips.appendChild(createStatusPill(formatContextAuditReason(audit.reason), audit.message || audit.reason, { tone: getContextAuditChipTone(audit.reason), kind: 'status' }));
    if (audit.cached) chips.appendChild(createStatusPill('Cached', 'This result came from the repeated-check cache.', { tone: 'muted', kind: 'source' }));
    if (audit.inFlight) chips.appendChild(createStatusPill('In flight skipped', 'Saga skipped a duplicate Context Reasoner request because one was already running.', { tone: 'muted', kind: 'status' }));
    if (audit.counts?.localApplied) chips.appendChild(createStatusPill(`${audit.counts.localApplied} local applied`, 'High-confidence local Context updates applied to unlocked Loredecks.', { tone: 'success', kind: 'count' }));
    if (audit.counts?.proposed) chips.appendChild(createStatusPill(`${audit.counts.proposed} proposed`, 'Bounded Reasoner proposals waiting for review.', { tone: 'review', kind: 'count' }));
    if (audit.counts?.skipped && !audit.counts?.skippedLocked && !audit.counts?.skippedLowConfidence) chips.appendChild(createStatusPill(`${audit.counts.skipped} skipped`, 'Resolver or automation skipped one or more Context targets.', { tone: 'muted', kind: 'count' }));
    if (audit.counts?.skippedLocked) chips.appendChild(createStatusPill(`${audit.counts.skippedLocked} locked`, 'Loredecks skipped because manual lock is enabled.', { tone: 'muted', kind: 'count' }));
    if (audit.counts?.skippedLowConfidence) chips.appendChild(createStatusPill(`${audit.counts.skippedLowConfidence} low confidence`, 'Local or model results left unresolved because confidence was too low.', { tone: 'warning', kind: 'severity' }));
    if (audit.counts?.unresolved) chips.appendChild(createStatusPill(`${audit.counts.unresolved} unresolved`, 'Loredecks that still need clearer Context or manual selection.', { tone: 'warning', kind: 'severity' }));
    chips.appendChild(createStatusPill(new Date(audit.createdAt).toLocaleTimeString(), 'When this resolver check completed.', { tone: 'source', kind: 'source' }));
    header.appendChild(chips);
    wrap.appendChild(header);

    return wrap;
}

function formatContextAuditReason(reason = '') {
    const normalized = String(reason || '').trim().toLowerCase();
    const labels = {
        context_manual_mode: 'Manual mode',
        context_cadence_not_reached: 'Cadence waiting',
        max_turn_cadence: 'Max cadence',
        turn_and_text_cadence: 'Cadence ready',
        context_no_loaded_loredecks: 'No loaded decks',
        context_all_loredecks_locked: 'All locked',
        context_provider_not_configured: 'Provider missing',
        context_reasoner_fallback_disabled: 'Reasoner disabled',
        context_model_resolution_in_flight: 'Already running',
        manual_lock: 'Manual lock',
        local_low_confidence: 'Low confidence',
        model_low_confidence: 'Low confidence',
    };
    return labels[normalized] || humanizeScopeKey(normalized || 'unknown');
}

export function createContextAutomationAuditPanel(state = {}) {
    const audit = state?.lorePanel?.contextAutomationAudit || null;
    if (!audit || !audit.createdAt) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-context-quick saga-context-automation-audit';

    const header = document.createElement('div');
    header.className = 'saga-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Last Automation Check';
    addTooltip(title, 'Audit summary for the most recent background Context automation decision, including skipped cadence/provider/lock states.');
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(audit.status || 'unknown', audit.message || 'Latest Context automation status.', { tone: getContextAuditChipTone(audit.status), kind: getContextAuditChipTone(audit.status) === 'danger' || getContextAuditChipTone(audit.status) === 'warning' ? 'severity' : 'status' }));
    if (audit.reason) chips.appendChild(createStatusPill(formatContextAuditReason(audit.reason), audit.message || audit.reason, { tone: getContextAuditChipTone(audit.reason), kind: 'status' }));
    if (audit.mode) chips.appendChild(createStatusPill(getContextAutomationModeLabel(audit.mode), 'Context automation mode used for this decision.', { tone: String(audit.mode).toLowerCase() === 'manual' ? 'muted' : 'info', kind: 'status' }));
    if (audit.cadence) {
        chips.appendChild(createStatusPill(`${audit.cadence.turns || 0}/${audit.cadence.minTurns || 0} turns`, 'Completed model turns since the last automatic Context check.', { kind: 'count' }));
        chips.appendChild(createStatusPill(`${audit.cadence.newChars || 0}/${audit.cadence.characterThreshold || 0} chars`, 'New story characters since the last automatic Context check baseline.', { kind: 'count' }));
    }
    if (audit.providerError) chips.appendChild(createStatusPill('Provider issue', audit.providerError, { tone: 'danger', kind: 'severity' }));
    chips.appendChild(createStatusPill(new Date(audit.createdAt).toLocaleTimeString(), 'When this automation decision was recorded.', { tone: 'source', kind: 'source' }));
    header.appendChild(chips);
    wrap.appendChild(header);

    if (audit.message) {
        const message = document.createElement('div');
        message.className = 'saga-runtime-help';
        message.textContent = audit.message;
        wrap.appendChild(message);
    }

    return wrap;
}

export function createContextResolutionProposalPanel(state = {}) {
    const basic = isBasicExperienceMode();
    const proposals = getContextResolutionProposals(state);
    if (!proposals.length) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-context-quick';
    if (basic) wrap.classList.add('saga-context-suggestion-panel');
    wrap.dataset.sagaContextProposals = 'true';

    const header = document.createElement('div');
    header.className = 'saga-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Reasoner Proposals';
    addTooltip(title, 'Reasoner-backed Context proposals are bounded to known timeline candidates and require review before application.');
    header.appendChild(title);

    const meta = state?.lorePanel?.contextResolutionProposalMeta || {};
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(
        `${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`,
        'Pending Context proposals from the Reasoning Provider.',
        { tone: 'review', kind: 'count' }
    ));
    if (meta.createdAt) chips.appendChild(createStatusPill(`Drafted ${new Date(meta.createdAt).toLocaleTimeString()}`, 'When these Context proposals were drafted.', { tone: 'source', kind: 'source' }));
    header.appendChild(chips);
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'saga-context-workbench-mini-list';
    for (const proposal of proposals.slice(0, 6)) {
        const item = document.createElement('div');
        item.className = 'saga-context-workbench-mini-item';
        const label = document.createElement('strong');
        label.textContent = `${getLoredeckDisplayName(proposal.packId)}: ${proposal.label || proposal.patch?.label || proposal.candidateId || 'Context proposal'}`;
        item.appendChild(label);
        const detail = document.createElement('span');
        const confidence = !basic && Number.isFinite(Number(proposal.confidence)) ? ` (${Math.round(Number(proposal.confidence) * 100)}%)` : '';
        detail.textContent = `${proposal.summary || 'Reasoner selected a bounded timeline candidate.'}${confidence}`;
        item.appendChild(detail);
        list.appendChild(item);
    }
    if (proposals.length > 6) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help saga-compact-help';
        more.textContent = `Showing 6 of ${proposals.length} proposals.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Open Review', 'Open the fullscreen Context proposal review window.', () => {
        openContextProposalReview();
    }, 'saga-primary-button'));
    if (!basic) {
        actions.appendChild(createButton('Apply Proposals', 'Apply every listed Context proposal to its loaded Loredeck Context.', async () => {
            const ok = await confirmAction('Apply Context proposals?', `Apply ${proposals.length} Reasoner Context proposal${proposals.length === 1 ? '' : 's'}?`);
            if (!ok) return;
            applyContextResolutionProposalSet(proposals, {
                clearAll: true,
            });
        }));
    }
    actions.appendChild(createButton('Dismiss', 'Discard these Context proposals without changing loaded Loredeck Contexts.', () => {
        dismissContextResolutionProposalSet(proposals, { clearAll: true });
    }));
    wrap.appendChild(actions);
    return wrap;
}

export function openContextProposalReview() {
    const proposals = getContextResolutionProposals(getState());
    if (!proposals.length) {
        toast('No Context proposals are waiting for review.', 'info');
        return;
    }
    renderContextProposalReview();
}

export function closeContextProposalReview() {
    document.getElementById(CONTEXT_PROPOSAL_REVIEW_ID)?.remove();
}

export function renderContextProposalReview() {
    const state = getState();
    const proposals = getContextResolutionProposals(state);
    let overlay = document.getElementById(CONTEXT_PROPOSAL_REVIEW_ID);
    if (!proposals.length) {
        overlay?.remove();
        return;
    }
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = CONTEXT_PROPOSAL_REVIEW_ID;
        overlay.className = 'saga-lore-workbench-overlay saga-context-proposal-review-overlay';
        overlay.tabIndex = -1;
        wireOverlayBackdropClose(overlay, closeContextProposalReview);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeContextProposalReview();
        });
        document.body.appendChild(overlay);
    }
    overlay.replaceChildren(createContextProposalReviewShell(state));
    requestAnimationFrame(() => overlay.focus?.());
}

export function createContextProposalReviewShell(state = {}) {
    const basic = isBasicExperienceMode();
    const mobile = false;
    const proposals = getContextResolutionProposals(state);
    const meta = state?.lorePanel?.contextResolutionProposalMeta || {};
    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell saga-context-proposal-review-shell';
    if (basic) shell.classList.add('saga-context-proposal-review-shell-basic');

    shell.addEventListener('click', event => event.stopPropagation());

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header saga-context-proposal-review-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Context Proposal Review';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = 'Review bounded Reasoner choices before applying them to loaded Loredeck Context.';
    titleWrap.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'saga-context-workbench-header-chips';
    chips.appendChild(createStatusPill(
        `${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`,
        'Pending Context proposals from the Reasoning Provider.',
        { tone: 'review', kind: 'count' }
    ));
    if (meta.createdAt) chips.appendChild(createStatusPill(`Drafted ${new Date(meta.createdAt).toLocaleTimeString()}`, 'When these Context proposals were drafted.', { tone: 'source', kind: 'source' }));
    if (!basic && meta.cached) chips.appendChild(createStatusPill('Cached', 'This proposal batch came from the repeated-check cache.', { tone: 'muted', kind: 'source' }));
    if (!basic && meta.source) chips.appendChild(createStatusPill(formatContextProposalSource(meta.source), 'Source of this Context proposal batch.', { tone: 'source', kind: 'source' }));
    titleWrap.appendChild(chips);
    header.appendChild(titleWrap);

    header.appendChild(createContextProposalReviewActions(proposals));
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-context-proposal-review-body';
    const list = document.createElement('div');
    list.className = 'saga-context-proposal-review-list';
    for (const proposal of proposals) {
        list.appendChild(createContextProposalReviewRow(proposal, { basic }));
    }
    body.appendChild(list);
    shell.appendChild(body);

    return shell;
}

function createContextProposalReviewActions(proposals = [], options = {}) {
    const actions = document.createElement('div');
    actions.className = `saga-primary-actions saga-context-proposal-review-actions${options.mobile ? ' saga-context-proposal-review-bottom-actions' : ''}`;
    actions.appendChild(createButton('Apply All', 'Apply every listed Context proposal.', async () => {
        const ok = await confirmAction(
            'Apply Context proposals?',
            `Apply ${proposals.length} Reasoner Context proposal${proposals.length === 1 ? '' : 's'}?`
        );
        if (!ok) return;
        applyContextResolutionProposalSet(proposals, {
            clearAll: true,
        });
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Dismiss All', 'Discard every listed Context proposal without changing loaded Loredeck Contexts.', async () => {
        const ok = await confirmAction('Dismiss Context proposals?', `Dismiss ${proposals.length} Context proposal${proposals.length === 1 ? '' : 's'}?`);
        if (!ok) return;
        dismissContextResolutionProposalSet(proposals, { clearAll: true });
    }));
    actions.appendChild(createButton('Close', 'Close Context proposal review.', closeContextProposalReview));
    return actions;
}

function formatContextProposalSource(source = '') {
    const normalized = String(source || '').trim();
    if (normalized === 'manual_reasoner') return 'Manual Reasoner';
    if (normalized === 'manual_reasoner_cached') return 'Cached Reasoner';
    if (normalized === 'reasoner_context_resolution') return 'Automatic Reasoner';
    return normalized || 'Unknown';
}

function createContextProposalReviewRow(proposal = {}, options = {}) {
    const basic = options.basic === true;
    const row = document.createElement('div');
    row.className = 'saga-context-proposal-review-row';

    const main = document.createElement('div');
    main.className = 'saga-context-proposal-review-main';
    const title = document.createElement('div');
    title.className = 'saga-context-proposal-review-title';
    title.textContent = `${getLoredeckDisplayName(proposal.packId)}: ${proposal.label || proposal.patch?.label || proposal.candidateId || 'Context proposal'}`;
    main.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-context-proposal-review-summary';
    summary.textContent = proposal.summary || 'Reasoner selected a bounded timeline candidate.';
    main.appendChild(summary);

    if (!basic) {
        const chips = document.createElement('div');
        chips.className = 'saga-loredeck-row-meta';
        const confidence = Number(proposal.confidence) || 0;
        chips.appendChild(createStatusPill(`${Math.round(confidence * 100)}%`, 'Reasoner confidence for this bounded proposal.', { tone: getContextConfidenceChipTone(confidence), kind: 'metadata' }));
        if (proposal.candidateType) chips.appendChild(createStatusPill(proposal.candidateType, 'Timeline candidate type.', { tone: 'source', kind: 'metadata' }));
        if (proposal.candidateId) chips.appendChild(createStatusPill(proposal.candidateId, 'Bounded candidate ID selected by the Reasoner.', { tone: 'source', kind: 'source', maxChars: 38 }));
        main.appendChild(chips);
    }

    const patchSummary = document.createElement('div');
    patchSummary.className = 'saga-context-proposal-review-patch';
    patchSummary.textContent = formatContextPatchSummary(proposal.patch);
    main.appendChild(patchSummary);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-context-proposal-review-row-actions';
    actions.appendChild(createButton('Apply', 'Apply this Context proposal.', () => {
        const applied = applyContextResolutionProposalSet([proposal]);
        if (!applied) toast('Context proposal could not be applied.', 'warning');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Dismiss', 'Discard this Context proposal.', () => {
        dismissContextResolutionProposalSet([proposal]);
    }));
    row.appendChild(actions);
    return row;
}

function formatContextPatchSummary(patch = {}) {
    const values = [
        patch.label,
        patch.sceneDate,
        patch.arc ? `Arc: ${patch.arc}` : '',
        patch.phase ? `Phase: ${patch.phase}` : '',
        patch.season || patch.episode ? `S${patch.season || '?'} E${patch.episode || '?'}` : '',
        patch.chapter ? `Chapter: ${patch.chapter}` : '',
        patch.issue ? `Issue: ${patch.issue}` : '',
        patch.quest ? `Quest: ${patch.quest}` : '',
        patch.gameStage ? `Game: ${patch.gameStage}` : '',
        patch.stardate ? `Stardate: ${patch.stardate}` : '',
        patch.anchorId ? `Anchor: ${patch.anchorId}` : '',
        patch.anchorFrom || patch.anchorTo ? `Window: ${patch.anchorFrom || 'start'} -> ${patch.anchorTo || 'open'}` : '',
    ].map(value => String(value || '').trim()).filter(Boolean);
    const coordinates = patch.coordinates && typeof patch.coordinates === 'object'
        ? Object.entries(patch.coordinates).slice(0, 4).map(([key, value]) => `${key}: ${value}`)
        : [];
    return [...values, ...coordinates].slice(0, 12).join(' | ') || 'No visible Context patch fields.';
}

function createLoredeckContextRow(item, state = {}, contextIndex = null, options = {}) {
    const basic = options.basic === true;
    const packId = item.packId;
    const context = getLoredeckContext(state, packId);
    const packIndex = getContextPackSummary(contextIndex, packId);
    const summaryText = formatContextSummary(context);
    const hasSelectedContext = hasSelectedLoredeckContext(context);
    const row = document.createElement('div');
    row.className = 'saga-loredeck-context-row';
    if (basic) row.classList.add('saga-loredeck-context-row-basic');

    const header = document.createElement('div');
    header.className = 'saga-loredeck-context-header';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = getLoredeckDisplayName(packId);
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    if (basic) {
        chips.appendChild(createStatusPill(hasSelectedContext ? 'Context selected' : 'No Context set', hasSelectedContext ? 'This Loredeck has an active Context.' : 'Browse Context for this Loredeck.', { tone: hasSelectedContext ? 'success' : 'muted', kind: 'status' }));
        chips.appendChild(createStatusPill(`Updated: ${formatLoredeckContextUpdatedAt(context)}`, 'When this Loredeck Context was last updated.', { tone: 'source', kind: 'source' }));
        if (packIndex?.hasIndex) {
            chips.appendChild(createStatusPill(`${packIndex.anchorCount || 0} anchors`, 'Timeline anchors available from this Loredeck.', { tone: 'source', kind: 'count' }));
        }
    } else {
        chips.appendChild(createStatusPill(getContextTypeLabel(context.contextType), 'Context mode for this Loredeck.', { tone: 'category', kind: 'metadata' }));
        chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.', { tone: 'source', kind: 'source' }));
        chips.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts should not be overwritten by automatic resolvers.', { tone: context.manualLock ? 'muted' : 'success', kind: 'status' }));
        chips.appendChild(createStatusPill(`${Math.round((Number(context.confidence) || 0) * 100)}%`, 'Resolver confidence. Manual choices default to high confidence.', { tone: getContextConfidenceChipTone(context.confidence), kind: 'metadata' }));
        chips.appendChild(createStatusPill(`Updated: ${formatLoredeckContextUpdatedAt(context)}`, 'When this Loredeck Context was last updated.', { tone: 'source', kind: 'source' }));
        if (packIndex?.hasIndex) {
            chips.appendChild(createStatusPill(`${packIndex.anchorCount || 0}/${packIndex.windowCount || 0}`, 'Timeline anchors/windows available from this Loredeck registry.', { tone: 'source', kind: 'count' }));
        } else {
            chips.appendChild(createStatusPill(contextIndex ? 'No index' : 'Index loading', 'This Loredeck has no loaded timeline registry yet.', { tone: 'muted', kind: 'source' }));
        }
    }
    header.appendChild(chips);
    row.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-context-summary';
    summary.textContent = summaryText;
    row.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-loredeck-context-actions';
    actions.appendChild(markTourTarget(createButton('Browse', 'Open this Loredeck in the fullscreen Context Browser.', () => {
        openContextWorkbenchForPack(packId, 'context');
    }, 'saga-primary-button'), 'context.loadedLoredeck.browse'));
    if (!basic) {
        actions.appendChild(markTourTarget(createButton(context.manualLock ? 'Unlock' : 'Lock', context.manualLock ? 'Allow automatic Context resolvers to update this Loredeck.' : 'Prevent automatic Context resolvers from overwriting this Loredeck.', () => {
            toggleLoredeckContextManualLock(packId, !context.manualLock);
        }), 'context.loadedLoredeck.lock'));
        actions.appendChild(markTourTarget(createButton('Seed From Brief', 'Seed this Loredeck Context from the advanced global Context Brief projection.', () => {
            seedLoredeckContextFromRuntimeContext(packId, context);
        }), 'context.loadedLoredeck.seedFromBrief'));
        actions.appendChild(markTourTarget(createButton('Timeline', 'Open this Loredeck in the fullscreen Timeline registry view.', () => {
            openContextWorkbenchForPack(packId, 'timeline');
        }), 'context.loadedLoredeck.timeline'));
    }
    actions.appendChild(markTourTarget(createButton('Reset Context', 'Clear this Loredeck Context back to an empty default.', async () => {
        await resetLoredeckContextFromPanel(packId);
    }, 'saga-danger-button'), 'context.loadedLoredeck.reset'));
    row.appendChild(actions);

    return row;
}

export function getContextPackSummary(contextIndex, packId) {
    const id = String(packId || '').trim();
    if (!id || !contextIndex?.packs?.length) return null;
    return contextIndex.packs.find(pack => pack.packId === id) || null;
}

export function formatContextIndexSummary(contextIndex) {
    const summary = contextIndex?.summary || null;
    if (!summary) return 'Loading';
    if (!summary.packCount) return 'No packs';
    if (!summary.indexCount) return `${summary.packCount} pack${summary.packCount === 1 ? '' : 's'}, no timelines`;
    return `${summary.anchorCount || 0} anchors, ${summary.windowCount || 0} windows`;
}
