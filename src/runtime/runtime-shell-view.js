/**
 * runtime-shell-view.js - Saga
 * Runtime rail, drawer, and header rendering.
 */

import { getPanelLoreState } from '../lorecards/lore-matrix.js';
import { getDefaultState } from '../state/constants.js';
import {
    getSettings,
    getState,
} from '../state/state-manager.js';
import {
    getBrandLogoSrc,
    getTabIconSrc,
    applyRuntimeTheme,
} from '../theme/runtime-theme.js';
import {
    addTooltip,
    createIconButton,
    createStatusPill,
    hideFloatingTooltip,
} from '../ui/runtime-ui-kit.js';
import { getRuntimeLorecardsStages, getRuntimeLorecardsStage, getConstrainedDrawerHeight, getConstrainedDrawerWidth, getRailWidth, normalizePanelLayoutState, normalizeRailMode, onRuntimeDrawerResizeStart, onRuntimeRailDragStart, resolveDrawerDirection, selectRuntimeLorecardsStage, updateDrawerScrollMetrics } from "./runtime-shell.js";
import { markTourTarget } from './runtime-tour.js';
import { TAB_ICONS, getAutomationLabel, getAutomationTooltip, getExperienceLabel, getExperienceTooltip, getTabLabelForExperience, getTabTooltipForExperience, getVisibleTabsForExperience, normalizeExperienceMode, normalizeTabForExperience } from "./runtime-navigation.js";

let deps = {};
let mobileLorecardsSubtabsIntroSeen = false;
let desktopLorecardsFlyoutOpen = false;
let desktopLorecardsFlyoutDocumentHandlerInstalled = false;
let desktopLorecardsFlyoutCloseTimer = null;

const LORECARDS_SUBTAB_META = Object.freeze({
    generate: Object.freeze({
        label: 'Generate',
        tooltip: 'Create or suggest new Lorecards.',
    }),
    automation: Object.freeze({
        label: 'Automate',
        tooltip: 'Configure and run Lore Automation.',
    }),
    lore: Object.freeze({
        label: 'Lore',
        tooltip: 'Review and manage all Lorecards in one object list.',
    }),
});

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureRuntimeShellView(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function renderPanelShell(root, state) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();

    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const drawerDirection = drawerOpen ? resolveDrawerDirection(panelState) : 'right';
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.removeEventListener('keydown', onRuntimeDesktopShellKeydown);
    root.addEventListener('keydown', onRuntimeDesktopShellKeydown);
    root.classList.add(`saga-runtime-rail-${railMode}`);
    if (drawerOpen) root.classList.add('saga-runtime-drawer-open');
    if (desktopLorecardsFlyoutOpen) root.classList.add('saga-runtime-lorecards-flyout-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.dataset.lorecardsStage = activeTab === 'lore'
        ? getRuntimeLorecardsStage(panelState, getDesktopLorecardsFallbackStage(state), settings)
        : '';
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));
    if (desktopLorecardsFlyoutOpen) root.appendChild(renderDesktopLorecardsFlyout(root, state, settings));
    if (drawerOpen) root.appendChild(renderDrawer(state, drawerDirection));
    syncDesktopLorecardsFlyoutDocumentHandler();

    refreshRuntimeHeader(root);
}

export function renderPanelFallbackShell(root, state, error) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();

    const railMode = normalizeRailMode(panelState.railMode);
    const drawerDirection = panelState.drawerOpen === true ? resolveDrawerDirection(panelState) : 'right';

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.removeEventListener('keydown', onRuntimeDesktopShellKeydown);
    root.addEventListener('keydown', onRuntimeDesktopShellKeydown);
    root.classList.add(`saga-runtime-rail-${railMode}`);
    root.classList.add('saga-runtime-drawer-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${drawerDirection}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;
    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = 'Saga';
    titleWrap.appendChild(title);
    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);
    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    const tabBody = document.createElement('div');
    tabBody.className = 'saga-runtime-tab-body';
    tabBody.appendChild(dep('createRuntimeRenderErrorCard')('Runtime Window', error));
    body.appendChild(tabBody);
    drawer.appendChild(body);
    root.appendChild(drawer);
}

function syncDesktopLorecardsFlyoutDocumentHandler() {
    if (typeof document === 'undefined') return;
    if (desktopLorecardsFlyoutOpen && !desktopLorecardsFlyoutDocumentHandlerInstalled) {
        document.addEventListener('pointerdown', onDesktopLorecardsFlyoutDocumentPointerDown, true);
        document.addEventListener('keydown', onDesktopLorecardsFlyoutDocumentKeydown, true);
        desktopLorecardsFlyoutDocumentHandlerInstalled = true;
    } else if (!desktopLorecardsFlyoutOpen && desktopLorecardsFlyoutDocumentHandlerInstalled) {
        document.removeEventListener('pointerdown', onDesktopLorecardsFlyoutDocumentPointerDown, true);
        document.removeEventListener('keydown', onDesktopLorecardsFlyoutDocumentKeydown, true);
        desktopLorecardsFlyoutDocumentHandlerInstalled = false;
    }
}

function setDesktopLorecardsFlyoutOpen(open, options = {}) {
    const nextOpen = !!open;
    if (desktopLorecardsFlyoutOpen === nextOpen) {
        syncDesktopLorecardsFlyoutDocumentHandler();
        return;
    }
    desktopLorecardsFlyoutOpen = nextOpen;
    syncDesktopLorecardsFlyoutDocumentHandler();
    if (options.render !== false) dep('showRuntimePanel')();
}

export function disposeRuntimeShellView() {
    if (desktopLorecardsFlyoutCloseTimer !== null) {
        globalThis.clearTimeout?.(desktopLorecardsFlyoutCloseTimer);
        desktopLorecardsFlyoutCloseTimer = null;
    }
    setDesktopLorecardsFlyoutOpen(false, { render: false });
}

function onDesktopLorecardsFlyoutDocumentPointerDown(event) {
    if (!desktopLorecardsFlyoutOpen) return;
    const target = event.target;
    if (target?.closest?.('.saga-desktop-lorecards-flyout, .saga-runtime-rail-tab[data-tab-id="lore"]')) return;
    const schedule = globalThis.setTimeout || (callback => callback());
    if (desktopLorecardsFlyoutCloseTimer !== null) globalThis.clearTimeout?.(desktopLorecardsFlyoutCloseTimer);
    desktopLorecardsFlyoutCloseTimer = schedule(() => {
        desktopLorecardsFlyoutCloseTimer = null;
        setDesktopLorecardsFlyoutOpen(false);
    }, 0);
}

function onDesktopLorecardsFlyoutDocumentKeydown(event) {
    if (!desktopLorecardsFlyoutOpen || event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    setDesktopLorecardsFlyoutOpen(false);
}

function onRuntimeDesktopShellKeydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || !desktopLorecardsFlyoutOpen) return;
    const target = event.target;
    const targetTag = String(target?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || target?.isContentEditable) return;

    event.preventDefault();
    event.stopPropagation();
    setDesktopLorecardsFlyoutOpen(false);
}

function getDesktopLorecardsFallbackStage(state) {
    void state;
    return 'generate';
}

function renderDesktopLorecardsFlyout(root, state, settings = getSettings()) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const activeStage = getRuntimeLorecardsStage(panelState, getDesktopLorecardsFallbackStage(state), settings);
    const stages = getRuntimeLorecardsStages(settings);
    const nav = document.createElement('nav');
    nav.id = 'saga-desktop-lorecards-flyout';
    nav.className = 'saga-desktop-lorecards-flyout';
    const rowHeight = 36;
    const rowGap = 5;
    const verticalPadding = 8;
    const flyoutHeight = (stages.length * rowHeight) + (Math.max(0, stages.length - 1) * rowGap) + verticalPadding;
    nav.style.setProperty('--saga-lorecards-flyout-count', String(stages.length));
    nav.style.setProperty('--saga-lorecards-flyout-height', `${flyoutHeight}px`);
    nav.style.setProperty('--saga-lorecards-flyout-offset', `${Math.round(flyoutHeight / 2)}px`);
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Lorecards workspace');

    updateDesktopLorecardsFlyoutPosition(root, nav);
    const schedule = globalThis.requestAnimationFrame || (callback => setTimeout(callback, 0));
    schedule(() => updateDesktopLorecardsFlyoutPosition(root, nav));

    for (const stage of stages) {
        const meta = LORECARDS_SUBTAB_META[stage] || LORECARDS_SUBTAB_META.lore;
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'saga-desktop-lorecards-flyout-option';
        option.dataset.stage = stage;
        option.setAttribute('role', 'tab');
        option.setAttribute('aria-selected', stage === activeStage ? 'true' : 'false');
        option.setAttribute('aria-label', meta.label);
        option.tabIndex = stage === activeStage ? 0 : -1;
        if (stage === activeStage) option.classList.add('saga-desktop-lorecards-flyout-option-active');

        const label = document.createElement('span');
        label.className = 'saga-desktop-lorecards-flyout-label';
        label.textContent = meta.label;
        option.appendChild(label);

        option.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            hideFloatingTooltip();
            setDesktopLorecardsFlyoutOpen(false, { render: false });
            selectRuntimeLorecardsStage(stage);
        });
        nav.appendChild(option);
    }

    return nav;
}

function updateDesktopLorecardsFlyoutPosition(root, flyout) {
    if (!root || !flyout) return;
    const railTab = root.querySelector('.saga-runtime-rail-tab[data-tab-id="lore"]');
    const rootRect = root.getBoundingClientRect?.();
    const tabRect = railTab?.getBoundingClientRect?.();
    const centerY = rootRect && tabRect && tabRect.height > 0
        ? Math.round(tabRect.top - rootRect.top + (tabRect.height / 2))
        : Math.round((Number(railTab?.offsetTop) || 0) + ((Number(railTab?.offsetHeight) || 36) / 2));
    if (Number.isFinite(centerY) && centerY > 0) {
        flyout.style.setProperty('--saga-lorecards-flyout-center-y', `${centerY}px`);
    }
}

function renderRail(state) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);
    const metrics = dep('getRailMetrics', () => ({}))(state, settings);
    const metricTooltips = dep('getRailMetricTooltips', () => ({}))(state, settings);

    const rail = document.createElement('div');
    rail.className = `saga-runtime-rail saga-runtime-rail-${railMode}`;

    const drag = document.createElement('div');
    drag.className = 'saga-runtime-rail-drag';
    drag.addEventListener('mousedown', onRuntimeRailDragStart);
    addTooltip(drag, 'Drag to move the Saga rail. The drawer stays anchored to this rail.');

    const mark = document.createElement('div');
    mark.className = 'saga-runtime-rail-mark';

    const markImg = document.createElement('img');
    markImg.className = 'saga-runtime-rail-logo-img';
    markImg.src = getBrandLogoSrc(railMode, settings);
    markImg.alt = railMode === 'compact' ? 'Saga' : 'Saga logo';
    markImg.draggable = false;
    markImg.addEventListener('error', () => {
        markImg.remove();
        mark.textContent = railMode === 'compact' ? 'S' : 'Saga';
        mark.classList.add('saga-runtime-rail-mark-fallback');
    }, { once: true });
    mark.appendChild(markImg);
    drag.appendChild(mark);

    const sub = document.createElement('div');
    sub.className = 'saga-runtime-rail-subtitle';
    sub.textContent = railMode === 'expanded' ? 'Fandom Loresystem' : '';
    drag.appendChild(sub);
    rail.appendChild(drag);
    const tabs = document.createElement('div');
    tabs.className = 'saga-runtime-rail-tabs';
    const visibleTabs = getVisibleTabsForExperience(settings);
    for (const tabId of visibleTabs) {
        const label = getTabLabelForExperience(tabId, settings);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-runtime-rail-tab';
        tab.dataset.tabId = tabId;
        const isGlobalLoredecksTab = tabId === 'loredecks';
        const isLorecardsTab = tabId === 'lore';
        if (isGlobalLoredecksTab) tab.classList.add('saga-runtime-rail-tab-global');
        if (isLorecardsTab && desktopLorecardsFlyoutOpen) tab.classList.add('saga-runtime-rail-tab-flyout-open');
        if (drawerOpen && tabId === activeTab) tab.classList.add('saga-runtime-rail-tab-active');
        tab.setAttribute('aria-label', label);
        if (isLorecardsTab) {
            tab.setAttribute('aria-haspopup', 'true');
            tab.setAttribute('aria-expanded', desktopLorecardsFlyoutOpen ? 'true' : 'false');
            tab.setAttribute('aria-controls', 'saga-desktop-lorecards-flyout');
        }

        const icon = document.createElement('span');
        icon.className = 'saga-runtime-rail-icon';
        icon.dataset.fallbackIcon = TAB_ICONS[tabId] || label.slice(0, 1);
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
        }
        tab.appendChild(icon);

        const labelEl = document.createElement('span');
        labelEl.className = 'saga-runtime-rail-label';
        labelEl.textContent = label;
        tab.appendChild(labelEl);

        const metric = document.createElement('span');
        metric.className = 'saga-runtime-rail-metric';
        metric.dataset.tabId = tabId;
        dep('renderRailMetric')(metric, tabId, metrics, metricTooltips);
        tab.appendChild(metric);

        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            hideFloatingTooltip();
            if (isLorecardsTab) {
                setDesktopLorecardsFlyoutOpen(!desktopLorecardsFlyoutOpen);
                return;
            }
            setDesktopLorecardsFlyoutOpen(false, { render: false });
            dep('toggleRuntimeDrawerForTab')(tabId);
        });
        tabs.appendChild(tab);
        if (isGlobalLoredecksTab && visibleTabs.length > 1) {
            const divider = document.createElement('div');
            divider.className = 'saga-runtime-rail-tab-divider';
            divider.setAttribute('aria-hidden', 'true');
            tabs.appendChild(divider);
        }
    }
    rail.appendChild(tabs);

    const controls = document.createElement('div');
    controls.className = 'saga-runtime-rail-controls';

    const density = createIconButton(
        railMode === 'compact' ? '>' : '<',
        railMode === 'compact' ? 'Show labels and compact metrics.' : 'Use icons only.',
        'saga-runtime-rail-control saga-runtime-rail-density',
        (e) => {
            e.stopPropagation();
            dep('toggleRuntimeRailMode')();
        }
    );
    controls.appendChild(density);

    const close = createIconButton(
        'x',
        'Close the Saga rail. Reopen it from the extension launcher.',
        'saga-runtime-rail-control saga-runtime-rail-close',
        (e) => {
            e.stopPropagation();
            setDesktopLorecardsFlyoutOpen(false, { render: false });
            dep('hideRuntimePanel')();
        }
    );
    controls.appendChild(close);
    rail.appendChild(controls);

    return rail;
}

export function createExperienceModeSwitch(settings = getSettings(), options = {}) {
    const mode = normalizeExperienceMode(settings.experienceMode);
    const control = document.createElement('div');
    control.className = `saga-experience-switch saga-experience-switch-${mode}`;
    markTourTarget(control, options.tourTarget || 'settings.experienceMode');
    control.setAttribute('role', 'radiogroup');
    control.setAttribute('aria-label', `Experience Mode: ${getExperienceLabel(settings)}`);
    addTooltip(control, getExperienceTooltip(settings));

    const basic = document.createElement('button');
    basic.type = 'button';
    basic.className = 'saga-experience-switch-label saga-experience-switch-label-basic';
    basic.textContent = 'Basic';
    basic.setAttribute('role', 'radio');
    basic.setAttribute('aria-checked', mode === 'basic' ? 'true' : 'false');
    addTooltip(basic, 'Switch to Basic Experience.');
    basic.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('basic');
    });
    control.appendChild(basic);

    const advanced = document.createElement('button');
    advanced.type = 'button';
    advanced.className = 'saga-experience-switch-label saga-experience-switch-label-advanced';
    advanced.textContent = 'Advanced';
    advanced.setAttribute('role', 'radio');
    advanced.setAttribute('aria-checked', mode === 'advanced' ? 'true' : 'false');
    addTooltip(advanced, 'Switch to Advanced Experience.');
    advanced.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('advanced');
    });
    control.appendChild(advanced);

    const knob = document.createElement('span');
    knob.className = 'saga-experience-switch-knob';
    control.appendChild(knob);

    return control;
}

function selectExperienceMode(mode) {
    const normalized = normalizeExperienceMode(mode);
    const current = normalizeExperienceMode(getSettings().experienceMode);
    if (current === normalized) return;
    dep('setExperienceMode')(normalized);
    dep('showRuntimePanel')();
}

function renderDrawer(state, direction = 'right') {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${direction}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, direction)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;

    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = getTabLabelForExperience(activeTab, settings);
    addTooltip(title, getTabTooltipForExperience(activeTab, settings));
    titleWrap.appendChild(title);

    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);

    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    drawer.appendChild(body);
    dep('renderPanelBody')(body, state);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'saga-lore-panel-resize-handle saga-runtime-drawer-resize-handle';
    resizeHandle.addEventListener('pointerdown', onRuntimeDrawerResizeStart);
    addTooltip(resizeHandle, 'Drag to resize the active drawer. The size is remembered across tabs.');
    drawer.appendChild(resizeHandle);

    updateDrawerScrollMetrics(drawer);
    return drawer;
}

export function refreshRuntimeHeader(panelRoot) {
    if (!panelRoot) return;

    const state = getState();
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);
    const drawerOpen = panelState.drawerOpen === true;
    const metrics = dep('getRailMetrics', () => ({}))(state, settings);
    const metricTooltips = dep('getRailMetricTooltips', () => ({}))(state, settings);
    const renderRailMetric = dep('renderRailMetric');

    panelRoot.classList.toggle('saga-runtime-drawer-open', drawerOpen);
    panelRoot.dataset.lorecardsStage = activeTab === 'lore'
        ? getRuntimeLorecardsStage(panelState, getDesktopLorecardsFallbackStage(state), settings)
        : '';

    for (const tab of panelRoot.querySelectorAll('.saga-runtime-rail-tab[data-tab-id]')) {
        const tabId = tab.dataset.tabId;
        tab.classList.toggle('saga-runtime-rail-tab-active', drawerOpen && tabId === activeTab);
    }

    const title = panelRoot.querySelector('.saga-runtime-drawer-title');
    if (title) {
        title.textContent = getTabLabelForExperience(activeTab, settings);
        const tooltip = getTabTooltipForExperience(activeTab, settings);
        title.dataset.sagaTooltip = tooltip;
        title.setAttribute('aria-label', tooltip);
    }

    for (const metric of panelRoot.querySelectorAll('.saga-runtime-rail-metric[data-tab-id]')) {
        const tabId = metric.dataset.tabId;
        renderRailMetric(metric, tabId, metrics, metricTooltips);
    }

    const status = panelRoot.querySelector('.saga-runtime-drawer-status');
    if (!status) return;

    const pendingLore = (state?.pendingLoreEntries || []).length;
    const pendingDelta = state?.lastDelta ? 1 : 0;
    const counts = getPanelLoreState(state).counts;
    const selectedLore = dep('getSelectedLoreInjectionCount', () => 0)(state, settings);

    status.innerHTML = '';
    status.appendChild(createStatusPill(`Experience: ${getExperienceLabel(settings)}`, getExperienceTooltip(settings), { tone: 'info', kind: 'status' }));
    status.appendChild(createStatusPill(`Automation: ${getAutomationLabel(settings)}`, getAutomationTooltip(settings), { tone: 'info', kind: 'status' }));
    status.appendChild(createStatusPill(settings.enabled ? 'Active' : 'Paused', 'Master runtime toggle. When paused, Saga does not inject, scan, or generate.', { tone: settings.enabled ? 'success' : 'muted', kind: 'status' }));
    status.appendChild(createStatusPill((settings.injectContinuity !== false && settings.injectMemo !== false) ? 'Continuity Injected' : 'Continuity Not Injected', 'Whether Saga includes structured continuity state in roleplay generation prompts.', { tone: (settings.injectContinuity !== false && settings.injectMemo !== false) ? 'success' : 'muted', kind: 'status' }));
    if (pendingDelta + pendingLore > 0) {
        status.appendChild(createStatusPill(`Pending: ${pendingDelta + pendingLore}`, 'Pending Review entries plus any legacy continuity delta.', { tone: 'review', kind: 'count' }));
    }
    status.appendChild(createStatusPill(`Lore Selected: ${selectedLore}`, 'Accepted Lorecards selected for the next injection after context activation, relevance, Elevate, and Mute rules.', { tone: selectedLore ? 'selected' : 'muted', kind: 'count' }));
    void counts;
}

export function refreshRuntimeRailIcons(panelRoot, settings = getSettings()) {
    if (!panelRoot) return;
    const state = getState();
    const railMode = normalizeRailMode(state?.lorePanel?.railMode);
    const logo = panelRoot.querySelector('.saga-runtime-rail-logo-img');
    if (logo) {
        logo.src = getBrandLogoSrc(railMode, settings);
        logo.alt = railMode === 'compact' ? 'Saga' : 'Saga logo';
    }
    for (const tab of panelRoot.querySelectorAll('.saga-runtime-rail-tab[data-tab-id]')) {
        const tabId = tab.dataset.tabId;
        const icon = tab.querySelector('.saga-runtime-rail-icon');
        if (!icon) continue;
        const label = getTabLabelForExperience(tabId, settings);
        const fallback = TAB_ICONS[tabId] || label.slice(0, 1);
        icon.classList.remove('saga-runtime-rail-icon-missing');
        icon.dataset.fallbackIcon = fallback;
        icon.textContent = '';
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = fallback;
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = fallback;
        }
    }
}
