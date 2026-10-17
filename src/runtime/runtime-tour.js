import {
    getSettings,
    getState,
    saveState,
} from '../state/state-manager.js';
import {
    createButton,
    hideFloatingTooltip,
    toast,
} from '../ui/runtime-ui-kit.js';

let runtimeTourDeps = {};
let activeSagaTour = null;

export function configureRuntimeTour(deps = {}) {
    runtimeTourDeps = { ...runtimeTourDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = runtimeTourDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga runtime tour dependency is not configured: ${name}`);
}

function normalizeExperienceMode(mode) {
    return dep('normalizeExperienceMode', value => (value === 'advanced' ? 'advanced' : 'basic'))(mode);
}

function getGuideSteps(mode) {
    return dep('getGuideSteps', () => [])(mode);
}

function setSectionCollapsed(sectionId, collapsed) {
    return dep('setSectionCollapsed', () => null)(sectionId, collapsed);
}

function normalizePanelLayoutState(state) {
    return dep('normalizePanelLayoutState', value => value?.lorePanel || null)(state);
}

function normalizeTabForExperience(tab) {
    return dep('normalizeTabForExperience', value => value || 'session')(tab);
}

function showRuntimePanel() {
    return dep('showRuntimePanel', () => null)();
}

function navigateRuntimeTab(tabId, options = {}) {
    return dep('navigateRuntimeTab', () => false)(tabId, options);
}

function prepareGuideStep(step) {
    if (!getTourStepPrepareAction(step)) return null;
    return dep('prepareGuideStep', () => null)(step);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function getPanelId() {
    return runtimeTourDeps?.panelId || 'saga-lore-panel';
}

export function markTourTarget(el, target) {
    if (el && target) el.dataset.sagaTour = String(target);
    return el;
}

function getTourStepSectionId(step) {
    return String(step?.section || step?.tab || 'session').trim() || 'session';
}

function getTourStepPrepareAction(step) {
    return String(step?.prepare || step?.prepareAction || '').trim();
}

export function startSagaTour(mode = normalizeExperienceMode(getSettings().experienceMode), options = {}) {
    const normalized = normalizeExperienceMode(mode);
    const allSteps = [...(getGuideSteps(normalized) || getGuideSteps('basic') || [])];
    const sectionId = String(options?.sectionId || '').trim();
    const steps = sectionId ? allSteps.filter(step => getTourStepSectionId(step) === sectionId) : allSteps;
    if (!steps.length) {
        toast('No walkthrough steps are available for this section.', 'info');
        return;
    }

    startSagaTourSteps(steps, {
        ...options,
        mode: normalized,
        sectionId,
    });
}

export function startSagaTourSteps(steps = [], options = {}) {
    const normalizedSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];
    if (!normalizedSteps.length) {
        toast(options.emptyMessage || 'No walkthrough steps are available for this guide.', 'info');
        return;
    }

    closeSagaTour({ preserveToast: true, skipOnClose: true });
    activeSagaTour = {
        mode: normalizeExperienceMode(options.mode || getSettings().experienceMode),
        sectionId: String(options.sectionId || '').trim(),
        steps: normalizedSteps,
        index: 0,
        renderToken: 0,
        currentTarget: null,
        className: String(options.className || '').trim(),
        progressLabel: String(options.progressLabel || '').trim(),
        closeLabel: String(options.closeLabel || 'Close').trim() || 'Close',
        closeTooltip: String(options.closeTooltip || 'Close the walkthrough.').trim() || 'Close the walkthrough.',
        finishLabel: String(options.finishLabel || 'Finish').trim() || 'Finish',
        finishTooltip: String(options.finishTooltip || 'Close the walkthrough.').trim() || 'Close the walkthrough.',
        getFinishLabel: typeof options.getFinishLabel === 'function' ? options.getFinishLabel : null,
        getFinishTooltip: typeof options.getFinishTooltip === 'function' ? options.getFinishTooltip : null,
        onFinish: typeof options.onFinish === 'function' ? options.onFinish : null,
        onClose: typeof options.onClose === 'function' ? options.onClose : null,
    };
    document.addEventListener('keydown', onSagaTourKeydown);
    window.addEventListener('resize', repositionSagaTourPopover);
    renderActiveSagaTourStep();
}

function renderActiveSagaTourStep(skipCount = 0) {
    const tour = activeSagaTour;
    if (!tour) return;
    if (tour.index < 0) tour.index = 0;
    if (tour.index >= tour.steps.length) {
        closeSagaTour();
        return;
    }

    const step = tour.steps[tour.index];
    const hasPrepare = !!getTourStepPrepareAction(step);
    showGuideStep(step, {
        highlight: true,
        tour: true,
        onReady: (target, prepareResult) => {
            if (!activeSagaTour || activeSagaTour !== tour) return;
            if (!target && !hasPrepare && skipCount < tour.steps.length - 1) {
                tour.index += 1;
                renderActiveSagaTourStep(skipCount + 1);
                return;
            }
            renderSagaTourPopover(step, target, prepareResult);
        },
    });
}

export function showGuideStep(step, options = {}) {
    if (!step) return;

    for (const sectionId of step.expandSections || []) {
        setSectionCollapsed(sectionId, false);
    }

    const targetTab = normalizeTabForExperience(step.tab || 'session');
    const navigated = navigateRuntimeTab(targetTab, { source: 'tour' });
    if (!navigated) {
        const state = getState();
        if (state?.lorePanel) {
            normalizePanelLayoutState(state);
            state.lorePanel.drawerOpen = true;
            state.lorePanel.collapsed = false;
            state.lorePanel.activeTab = targetTab;
            saveState(state);
        }
        showRuntimePanel();
    }

    const tour = activeSagaTour;
    const token = tour ? ++tour.renderToken : 0;
    const runTargetLookup = (prepareResult = null) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (tour && (!activeSagaTour || activeSagaTour !== tour || token !== tour.renderToken)) return;
                const target = getTourTargetElement(step.target) || getTourTargetElement(step.fallbackTarget);
                if (options.highlight) {
                    highlightSagaTourTarget(target);
                    if (!options.tour) {
                        window.setTimeout(() => {
                            if (!activeSagaTour) clearSagaTourHighlight();
                        }, 2200);
                    }
                }
                if (!target && !options.tour) {
                    toast(prepareResult?.message || `${step.title || 'Feature'} is not visible in the current state.`, 'info');
                }
                options.onReady?.(target, prepareResult);
            });
        });
    };

    Promise.resolve()
        .then(() => prepareGuideStep(step))
        .catch(error => {
            console.warn('[Saga] Walkthrough prepare failed:', error);
            return { ok: false, error, message: `${step.title || 'Feature'} could not be prepared automatically.` };
        })
        .then(prepareResult => {
            if (tour && (!activeSagaTour || activeSagaTour !== tour || token !== tour.renderToken)) return;
            runTargetLookup(prepareResult);
        });
}

function getTourTargetElement(targetName) {
    if (!targetName) return null;
    const root = getPanelRoot() || document.getElementById(getPanelId()) || document.body;
    const candidates = [
        ...Array.from(root.querySelectorAll('[data-saga-tour]')),
        ...Array.from(document.querySelectorAll('[data-saga-tour]')),
    ];
    return candidates.find(el => el?.dataset?.sagaTour === targetName) || null;
}

function highlightSagaTourTarget(target) {
    clearSagaTourHighlight();
    if (!target) return;
    target.classList.add('saga-tour-highlight');
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
}

function clearSagaTourHighlight() {
    for (const el of document.querySelectorAll('.saga-tour-highlight')) {
        el.classList.remove('saga-tour-highlight');
    }
}

function renderSagaTourPopover(step, target, prepareResult = null) {
    const tour = activeSagaTour;
    if (!tour) return;

    let popover = document.getElementById('saga-tour-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'saga-tour-popover';
        document.body.appendChild(popover);
    }
    popover.className = `saga-tour-popover ${tour.className || ''}`.trim();

    popover.innerHTML = '';
    const progress = document.createElement('div');
    progress.className = 'saga-tour-progress';
    progress.textContent = tour.progressLabel
        ? `${tour.progressLabel} ${tour.index + 1} / ${tour.steps.length}`
        : `${tour.index + 1} / ${tour.steps.length}`;
    popover.appendChild(progress);

    const title = document.createElement('div');
    title.className = 'saga-tour-title';
    title.textContent = step.title || 'Saga';
    popover.appendChild(title);

    const body = document.createElement('div');
    body.className = 'saga-tour-body';
    body.textContent = step.body || '';
    popover.appendChild(body);

    appendSagaTourDetail(popover, 'Preparation', prepareResult?.message);
    appendSagaTourDetail(popover, 'When to use', step.when);
    appendSagaTourDetail(popover, 'Expected result', step.expected);

    const actions = document.createElement('div');
    actions.className = 'saga-tour-actions';
    const back = createButton('Back', 'Return to the previous walkthrough step.', () => {
        if (!activeSagaTour) return;
        activeSagaTour.index = Math.max(0, activeSagaTour.index - 1);
        renderActiveSagaTourStep();
    }, 'saga-mini-button');
    back.disabled = tour.index <= 0;
    actions.appendChild(back);

    const close = createButton(tour.closeLabel || 'Close', tour.closeTooltip || 'Close the walkthrough.', () => closeSagaTour(), 'saga-mini-button');
    actions.appendChild(close);

    const finalStep = tour.index >= tour.steps.length - 1;
    const nextLabel = finalStep ? getSagaTourFinishLabel(tour) : 'Next';
    const nextTooltip = finalStep ? getSagaTourFinishTooltip(tour) : 'Move to the next walkthrough step.';
    const next = createButton(nextLabel, nextTooltip, () => {
        if (!activeSagaTour) return;
        if (activeSagaTour.index >= activeSagaTour.steps.length - 1) {
            finishActiveSagaTour();
            return;
        }
        activeSagaTour.index += 1;
        renderActiveSagaTourStep();
    }, 'saga-primary-button saga-mini-button');
    actions.appendChild(next);
    popover.appendChild(actions);

    activeSagaTour.currentTarget = target || null;
    requestAnimationFrame(repositionSagaTourPopover);
}

function getSagaTourFinishLabel(tour) {
    const dynamicLabel = typeof tour?.getFinishLabel === 'function' ? String(tour.getFinishLabel(tour) || '').trim() : '';
    return dynamicLabel || tour?.finishLabel || 'Finish';
}

function getSagaTourFinishTooltip(tour) {
    const dynamicTooltip = typeof tour?.getFinishTooltip === 'function' ? String(tour.getFinishTooltip(tour) || '').trim() : '';
    return dynamicTooltip || tour?.finishTooltip || 'Close the walkthrough.';
}

function finishActiveSagaTour() {
    const tour = activeSagaTour;
    if (!tour) return;
    if (typeof tour.onFinish === 'function' && tour.onFinish(tour)) return;
    closeSagaTour();
}

function appendSagaTourDetail(popover, labelText, value) {
    const text = String(value || '').trim();
    if (!text) return;
    const row = document.createElement('div');
    row.className = 'saga-tour-detail';
    const label = document.createElement('span');
    label.className = 'saga-tour-detail-label';
    label.textContent = `${labelText}:`;
    row.appendChild(label);
    row.appendChild(document.createTextNode(` ${text}`));
    popover.appendChild(row);
}

function repositionSagaTourPopover() {
    const popover = document.getElementById('saga-tour-popover');
    if (!popover) return;
    const target = activeSagaTour?.currentTarget;
    const margin = 12;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
    const mobile = viewportWidth <= 640;
    popover.style.width = '';
    popover.style.maxHeight = '';
    const popRect = popover.getBoundingClientRect();

    if (!target) {
        popover.style.left = `${Math.max(margin, (viewportWidth - popRect.width) / 2)}px`;
        popover.style.top = `${Math.max(margin, (viewportHeight - popRect.height) / 2)}px`;
        popover.dataset.placement = 'center';
        return;
    }

    const rect = target.getBoundingClientRect();
    const popWidth = popRect.width;
    const popHeight = popRect.height;
    const clampLeft = left => Math.max(margin, Math.min(left, viewportWidth - popWidth - margin));
    const clampTop = top => Math.max(margin, Math.min(top, viewportHeight - popHeight - margin));
    const makeCandidate = (placement, left, top, priority = 0) => {
        const nextLeft = clampLeft(left);
        const nextTop = clampTop(top);
        const nextRect = {
            left: nextLeft,
            top: nextTop,
            right: nextLeft + popWidth,
            bottom: nextTop + popHeight,
        };
        return {
            placement,
            left: nextLeft,
            top: nextTop,
            priority,
            overlap: getRectOverlapArea(rect, nextRect),
            distance: getRectCenterDistance(rect, nextRect),
        };
    };
    const centeredLeft = rect.left + (rect.width / 2) - (popWidth / 2);
    const centeredTop = rect.top + (rect.height / 2) - (popHeight / 2);
    const candidates = [
            makeCandidate('right', rect.right + margin, centeredTop, 0),
            makeCandidate('left', rect.left - popWidth - margin, centeredTop, 1),
            makeCandidate('bottom', centeredLeft, rect.bottom + margin, 2),
            makeCandidate('top', centeredLeft, rect.top - popHeight - margin, 3),
        ];
    const best = candidates.sort((a, b) => (
        (a.overlap - b.overlap)
        || (a.priority - b.priority)
        || (a.distance - b.distance)
    ))[0];

    popover.style.left = `${best.left}px`;
    popover.style.top = `${best.top}px`;
    popover.dataset.placement = best.placement;
}

function getRectOverlapArea(a, b) {
    if (!a || !b) return 0;
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
}

function getRectCenterDistance(a, b) {
    if (!a || !b) return 0;
    const ax = a.left + ((a.right - a.left) / 2);
    const ay = a.top + ((a.bottom - a.top) / 2);
    const bx = b.left + ((b.right - b.left) / 2);
    const by = b.top + ((b.bottom - b.top) / 2);
    return Math.hypot(ax - bx, ay - by);
}

export function closeSagaTour(options = {}) {
    const closingTour = activeSagaTour;
    activeSagaTour = null;
    clearSagaTourHighlight();
    document.removeEventListener('keydown', onSagaTourKeydown);
    window.removeEventListener('resize', repositionSagaTourPopover);
    const popover = document.getElementById('saga-tour-popover');
    if (popover) popover.remove();
    if (!options.preserveToast) hideFloatingTooltip();
    if (!options.skipOnClose && typeof closingTour?.onClose === 'function') {
        closingTour.onClose(options);
    }
}

function onSagaTourKeydown(event) {
    if (!activeSagaTour) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeSagaTour();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeSagaTour.index >= activeSagaTour.steps.length - 1) finishActiveSagaTour();
        else {
            activeSagaTour.index += 1;
            renderActiveSagaTourStep();
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        activeSagaTour.index = Math.max(0, activeSagaTour.index - 1);
        renderActiveSagaTourStep();
    }
}
