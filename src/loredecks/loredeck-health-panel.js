import {
    addTooltip,
    confirmAction as confirmUiAction,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    toast,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';
import {
    appendLoredeckStatusPills,
    createLoredeckRenderErrorCard,
} from './loredeck-ui-kit.js';
import {
    createLoredeckValidationCategoryList,
    createLoredeckValidationIssueList,
    createLoredeckValidationMetric,
    createLoredeckValidationSeverityGrid,
} from './loredeck-validation-view.js';
import {
    createLoredeckActionRow,
    setLoredeckActionButtonBusy,
    withLoredeckActionButtonBusy,
} from './loredeck-action-rows.js';
import {
    redactDiagnosticValue,
    stringifyRedactedDiagnostic,
} from '../runtime/runtime-redaction.js';
import {
    cleanupLoredeckHealthRepairSessions,
    deleteLoredeckHealthRepairSession as deleteLoredeckHealthRepairSessionFromStorage,
    listLoredeckHealthRepairSessions,
} from './loredeck-health-repair-session-storage.js';
import {
    persistLoredeckHealthIssueState as persistLoredeckHealthIssueStateToStorage,
} from './loredeck-health-issue-state-storage.js';
import {
    hydrateCachedExternalLorepackPayloadRecord,
    isExternalLorepackPayloadBackedRecord,
} from '../storage/saga-lorepack-payload-storage.js';

let healthPanelDeps = {};

export function configureLoredeckHealthPanel(deps = {}) {
    healthPanelDeps = { ...healthPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = healthPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Pack Health dependency is not configured: ${name}`);
}

function getState() { return dep('getState', () => ({}))(); }
function getCanonLoreDatabaseSync() { return dep('getCanonLoreDatabaseSync', () => null)(); }
function getLoredeckLibrary(state) { return dep('getLoredeckLibrary', () => [])(state); }
function getLoredeckStack(state) { return dep('getLoredeckStack', () => [])(state); }
function getLoredeckLibraryIndexForPacks(state, library) { return dep('getLoredeckLibraryIndexForPacks', () => ({ folders: [], packs: {} }))(state, library); }
function resolveLoredeckStackItems(stack, index, options) { return dep('resolveLoredeckStackItems', () => ({ stack: [] }))(stack, index, options); }
function buildLoredeckPackScopedHealth(pack, loadedMeta, stackHealth) { return dep('buildLoredeckPackScopedHealth', () => null)(pack, loadedMeta, stackHealth); }
function getLoredeckPackSummaryCounts(pack, cached, loadedMeta, health, report) { return dep('getLoredeckPackSummaryCounts', () => ({ entryCount: 0, fileCount: 0, loadedFileCount: 0, categoryCounts: {} }))(pack, cached, loadedMeta, health, report); }
function getLoredeckTypeLabel(packId) { return dep('getLoredeckTypeLabel', () => 'Custom')(packId); }
function getFreshLoredeckLibraryPack(packId, fallback) { return dep('getFreshLoredeckLibraryPack', (_packId, _fallback) => _fallback || null)(packId, fallback); }
function persistLoredeckLibraryRecordMutation(pack, mutator, message, options) { return dep('persistLoredeckLibraryRecordMutation', () => false)(pack, mutator, message, options); }
function persistLoredeckHealthIssueState(pack, issueKey, stateRecord, message, options) { return dep('persistLoredeckHealthIssueState', persistLoredeckHealthIssueStateToStorage)(pack, issueKey, stateRecord, message, options); }
function normalizeLoredeckHealthIssueStates(value) { return dep('normalizeLoredeckHealthIssueStates', () => ({}))(value); }
function normalizeLoredeckPendingIdList(value, limit) { return dep('normalizeLoredeckPendingIdList', () => [])(value, limit); }
function normalizeLoredeckPendingTimelineIdList(value, limit) { return dep('normalizeLoredeckPendingTimelineIdList', () => [])(value, limit); }
function validateLoredeckForEditor(pack, button, options) { return dep('validateLoredeckForEditor', async () => ({ health: null, error: 'Validation is unavailable.' }))(pack, button, options); }
function refreshLoredeckSurfaces(options) { return dep('refreshLoredeckSurfaces', () => {})(options); }
function clearCanonLoreDatabaseCache() { return dep('clearCanonLoreDatabaseCache', () => {})(); }
function clearContextIndexCache() { return dep('clearContextIndexCache', () => {})(); }
function loadCanonLoreDatabase() { return dep('loadCanonLoreDatabase', async () => null)(); }
function refreshPanelBody(options) { return dep('refreshPanelBody', () => {})(options); }
function refreshHeader() { return dep('refreshHeader', () => {})(); }
function sanitizeFileStem(value) { return dep('sanitizeFileStem', value => String(value || 'saga-deck-health').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'saga-deck-health')(value); }
function downloadJson(data, filename) { return dep('downloadJson', () => {})(data, filename); }
function openDuplicateLoredeckDialog(pack) { return dep('openDuplicateLoredeckDialog', () => {})(pack); }
function canValidateLoredeckInEditor(pack) { return dep('canValidateLoredeckInEditor', () => false)(pack); }

function isBasicExperienceMode() { return dep('isBasicExperience', () => false)() === true; }
function isLoredeckMalformedTagIssueGroup(group) { return dep('isLoredeckMalformedTagIssueGroup', () => false)(group); }
function queueLoredeckMalformedTagRepairFromHealthGroup(pack, group, button) { return dep('queueLoredeckMalformedTagRepairFromHealthGroup', async () => {})(pack, group, button); }
function applyLoredeckHealthRepairChoice(pack, choiceSet, option, session, button) { return dep('applyLoredeckHealthRepairChoice', async () => null)(pack, choiceSet, option, session, button); }
function reevaluateLoredeckHealthRepairChoice(pack, choiceSet, session, button) { return dep('reevaluateLoredeckHealthRepairChoice', async () => null)(pack, choiceSet, session, button); }
function cancelLoredeckHealthRepairRun(packId) { return dep('cancelLoredeckHealthRepairRun', () => false)(packId); }
function continueLoredeckHealthModelRepairSession(pack, session, button) { return dep('continueLoredeckHealthModelRepairSession', async () => null)(pack, session, button); }
function getLoredeckHealthRepairActiveRun(packId) { return dep('getLoredeckHealthRepairActiveRun', () => null)(packId); }
function attemptLoredeckHealthFixes(pack, button) {
    return dep('attemptLoredeckHealthFixes', async () => {})(pack, button);
}
function loadLoredeckHealthRepairSessions(packId) { return dep('loadLoredeckHealthRepairSessions', listLoredeckHealthRepairSessions)(packId); }
function cleanupLoredeckHealthRepairSessionFiles(packId, options) { return dep('cleanupLoredeckHealthRepairSessions', cleanupLoredeckHealthRepairSessions)(packId, options); }
function deleteLoredeckHealthRepairSession(session) { return dep('deleteLoredeckHealthRepairSession', deleteLoredeckHealthRepairSessionFromStorage)(session); }
function confirmAction(title, message, options) { return dep('confirmAction', confirmUiAction)(title, message, options); }
function markTourTarget(element, target) { return dep('markTourTarget', value => value)(element, target); }

const loredeckEntryPreviewCache = { get: id => healthPanelDeps.getLoredeckEntryPreviewCacheRecord?.(id) || null };
const loredeckManifestPreviewCache = { get: id => healthPanelDeps.getLoredeckManifestPreviewCacheRecord?.(id) || null };

let loredeckHealthCenterOpen = false;
let loredeckHealthCenterPackId = '';
let loredeckHealthCenterTab = 'overview';
const loredeckHealthRepairSessionCache = new Map();
const loredeckHealthRepairSessionLoads = new Map();
const loredeckHealthRepairSkippedChoiceIds = new Map();

function hashLoredeckHealthRepairIssueId(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function createLoredeckHealthRepairSessionDiagnostic(error = null, code = 'repair_session_load_failed') {
    return {
        severity: 'warning',
        code,
        message: String(error?.message || error || 'Repair session state could not be loaded.'),
    };
}

function getLoredeckHealthRepairSessionState(packId = '') {
    const id = String(packId || '').trim();
    if (!id) return { status: 'idle', sessions: [], diagnostics: [] };
    if (loredeckHealthRepairSessionLoads.has(id)) {
        return loredeckHealthRepairSessionCache.get(id) || { status: 'loading', sessions: [], diagnostics: [] };
    }
    return loredeckHealthRepairSessionCache.get(id) || { status: 'idle', sessions: [], diagnostics: [] };
}

function ensureLoredeckHealthRepairSessionsLoaded(packId = '', options = {}) {
    const id = String(packId || '').trim();
    if (!id) return Promise.resolve(null);
    if (!options.force && loredeckHealthRepairSessionLoads.has(id)) return loredeckHealthRepairSessionLoads.get(id);
    const current = getLoredeckHealthRepairSessionState(id);
    if (!options.force && current.status === 'ready') return Promise.resolve(current);
    const loadingState = {
        ...current,
        status: 'loading',
        sessions: Array.isArray(current.sessions) ? current.sessions : [],
        diagnostics: Array.isArray(current.diagnostics) ? current.diagnostics : [],
    };
    loredeckHealthRepairSessionCache.set(id, loadingState);
    const loadPromise = Promise.resolve()
        .then(() => loadLoredeckHealthRepairSessions(id))
        .then(result => {
            const next = {
                status: result?.ok === false && !result?.sessions?.length ? 'error' : 'ready',
                ok: result?.ok !== false,
                sessions: Array.isArray(result?.sessions) ? result.sessions : [],
                diagnostics: Array.isArray(result?.diagnostics) ? result.diagnostics : [],
                error: result?.error || '',
                loadedAt: Date.now(),
            };
            loredeckHealthRepairSessionCache.set(id, next);
            return next;
        })
        .catch(error => {
            const next = {
                status: 'error',
                ok: false,
                sessions: [],
                diagnostics: [createLoredeckHealthRepairSessionDiagnostic(error)],
                error: error?.message || String(error || 'Repair session state could not be loaded.'),
                loadedAt: Date.now(),
            };
            loredeckHealthRepairSessionCache.set(id, next);
            return next;
        })
        .finally(() => {
            loredeckHealthRepairSessionLoads.delete(id);
            if (loredeckHealthCenterOpen && loredeckHealthCenterPackId === id) {
                renderLoredeckHealthCenterOverlay({ preserveScroll: true });
            }
        });
    loredeckHealthRepairSessionLoads.set(id, loadPromise);
    return loadPromise;
}

export function openLoredeckHealthCenter(packId = '', options = {}) {
    if (isBasicExperienceMode()) {
        toast('Switch to Advanced Experience to open Pack Health Center repair tools.', 'info');
        return;
    }
    loredeckHealthCenterOpen = true;
    loredeckHealthCenterPackId = String(packId || '').trim();
    const tab = String(options?.tab || '').trim();
    loredeckHealthCenterTab = ['overview', 'issues', 'coverage', 'files', 'advanced'].includes(tab) ? tab : 'overview';
    renderLoredeckHealthCenterOverlay();
}

export function closeLoredeckHealthCenter() {
    loredeckHealthCenterOpen = false;
    document.querySelector('.saga-loredeck-health-center-overlay')?.remove();
}

const LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS = Object.freeze({
    body: '.saga-loredeck-health-center-body',
    content: '.saga-loredeck-health-center-content',
});

function captureLoredeckHealthCenterScrollState() {
    const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
    if (!overlay) return null;
    const snapshot = { elements: {} };
    for (const [key, selector] of Object.entries(LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS)) {
        const element = overlay.querySelector(selector);
        if (!element) continue;
        snapshot.elements[key] = {
            top: element.scrollTop || 0,
            left: element.scrollLeft || 0,
        };
    }
    const pageScrollElement = typeof document !== 'undefined' ? document.scrollingElement || document.documentElement : null;
    if (pageScrollElement) {
        snapshot.page = {
            top: pageScrollElement.scrollTop || 0,
            left: pageScrollElement.scrollLeft || 0,
        };
    }
    return snapshot;
}

function restoreLoredeckHealthCenterScrollState(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const restore = () => {
        const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
        if (overlay && snapshot.elements && typeof snapshot.elements === 'object') {
            for (const [key, value] of Object.entries(snapshot.elements)) {
                const selector = LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS[key];
                const element = selector ? overlay.querySelector(selector) : null;
                if (!element || !value) continue;
                element.scrollTop = Number(value.top) || 0;
                element.scrollLeft = Number(value.left) || 0;
            }
        }
        const pageScrollElement = typeof document !== 'undefined' ? document.scrollingElement || document.documentElement : null;
        if (pageScrollElement && snapshot.page) {
            pageScrollElement.scrollTop = Number(snapshot.page.top) || 0;
            pageScrollElement.scrollLeft = Number(snapshot.page.left) || 0;
        }
    };
    restore();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
}

export function renderLoredeckHealthCenterOverlay(options = {}) {
    const scrollState = options.preserveScroll === false ? null : captureLoredeckHealthCenterScrollState();
    const previousOverlay = document.querySelector('.saga-loredeck-health-center-overlay');
    if (isBasicExperienceMode()) {
        loredeckHealthCenterOpen = false;
        previousOverlay?.remove();
        return;
    }
    if (!loredeckHealthCenterOpen) {
        previousOverlay?.remove();
        return;
    }

    let overlay = null;
    try {
        const context = getLoredeckHealthCenterContext(loredeckHealthCenterPackId);
        const mobile = false;

        overlay = document.createElement('div');
        overlay.className = 'saga-lore-workbench-overlay saga-loredeck-health-center-overlay';
        wireOverlayBackdropClose(overlay, closeLoredeckHealthCenter);

        const shell = document.createElement('div');
        shell.className = 'saga-lore-workbench-shell saga-loredeck-health-center-shell';

        overlay.appendChild(shell);

        const header = document.createElement('div');
        header.className = 'saga-lore-workbench-header saga-loredeck-health-center-header';
        markTourTarget(header, 'loredecks.health.header');
        const titleWrap = document.createElement('div');
        titleWrap.className = 'saga-lore-workbench-title-wrap';
        const title = document.createElement('div');
        title.className = 'saga-lore-workbench-title';
        title.textContent = 'Pack Health Center';
        titleWrap.appendChild(title);
        const subtitle = document.createElement('div');
        subtitle.className = 'saga-lore-workbench-subtitle';
        subtitle.textContent = context.subtitle;
        titleWrap.appendChild(subtitle);
        header.appendChild(titleWrap);

        header.appendChild(createLoredeckHealthCenterActions(context));
        shell.appendChild(header);

        const body = document.createElement('div');
        body.className = 'saga-loredeck-health-center-body';
        body.appendChild(createLoredeckHealthCenterTabs());
        const content = document.createElement('div');
        content.className = `saga-loredeck-health-center-content saga-loredeck-health-center-content-${loredeckHealthCenterTab}`;
        if (loredeckHealthCenterTab === 'issues') content.appendChild(createLoredeckHealthIssuesView(context));
        else if (loredeckHealthCenterTab === 'coverage') content.appendChild(createLoredeckHealthCoverageView(context));
        else if (loredeckHealthCenterTab === 'files') content.appendChild(createLoredeckHealthFilesView(context));
        else if (loredeckHealthCenterTab === 'advanced') content.appendChild(createLoredeckHealthAdvancedView(context));
        else content.appendChild(createLoredeckHealthOverviewView(context));
        body.appendChild(content);
        shell.appendChild(body);

    } catch (e) {
        console.error('[Saga] Pack Health Center render failed:', e);
        toast('Pack Health Center failed to render. Keeping the previous view open.', 'error');
        if (!previousOverlay) {
            document.body.appendChild(createLoredeckHealthCenterRenderErrorOverlay(e));
        }
        return;
    }

    previousOverlay?.remove();
    document.body.appendChild(overlay);
    restoreLoredeckHealthCenterScrollState(scrollState);
}

function createLoredeckHealthCenterRenderErrorOverlay(error = null) {
    const mobile = false;
    const overlay = document.createElement('div');
    overlay.className = 'saga-lore-workbench-overlay saga-loredeck-health-center-overlay';
    wireOverlayBackdropClose(overlay, closeLoredeckHealthCenter);

    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell saga-loredeck-health-center-shell';

    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header saga-loredeck-health-center-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Pack Health Center';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = 'The report could not be rendered.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    header.appendChild(createLoredeckHealthCenterErrorActions());
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-loredeck-health-center-body';
    body.appendChild(createLoredeckRenderErrorCard({
        title: 'Pack Health Center could not render this report.',
        message: error?.message || 'Close and reopen the Health Center after rerunning the scan.',
    }));
    shell.appendChild(body);

    return overlay;
}

function createLoredeckHealthCenterActions(context, options = {}) {
    const actions = createLoredeckActionRow({
        className: `saga-primary-actions saga-loredeck-health-center-actions${options.mobile ? ' saga-loredeck-health-center-bottom-actions' : ''}`,
    });
    markTourTarget(actions, 'loredecks.health.actions');
    actions.appendChild(markTourTarget(createButton('Refresh Scan', context.pack ? 'Validate this Loredeck and refresh its Pack Health report.' : 'Reload active Loredecks and recompute stack Pack Health.', async (btn) => {
        await refreshLoredeckHealthCenterScan(context, btn);
    }, 'saga-primary-button'), 'loredecks.health.refreshScan'));
    const exportButton = createButton('Export Report', 'Download this Pack Health report as JSON.', () => exportLoredeckHealthCenterReport(context));
    exportButton.disabled = !context.health;
    actions.appendChild(exportButton);
    actions.appendChild(createButton('Close', 'Close the Pack Health Center.', closeLoredeckHealthCenter));
    return actions;
}

function createLoredeckHealthCenterErrorActions(options = {}) {
    const actions = createLoredeckActionRow({
        className: `saga-primary-actions saga-loredeck-health-center-actions${options.mobile ? ' saga-loredeck-health-center-bottom-actions' : ''}`,
    });
    actions.appendChild(createButton('Close', 'Close the Pack Health Center.', closeLoredeckHealthCenter));
    return actions;
}

function createLoredeckHealthCenterTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'saga-lore-workbench-mode-tabs saga-loredeck-health-tabs';
    const options = [
        ['overview', 'Overview', 'Readiness, priority issues, categories, and inventory.'],
        ['issues', 'Issues', 'Grouped issue triage with affected data and repair guidance.'],
        ['coverage', 'Coverage', 'Narrative and schema coverage signals.'],
        ['files', 'Files', 'File-level diagnostics for imported and bundled decks.'],
        ['advanced', 'Advanced', 'Raw metrics and JSON-oriented diagnostics.'],
    ];
    for (const [id, label, tooltip] of options) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `saga-lore-workbench-mode-tab${loredeckHealthCenterTab === id ? ' saga-lore-workbench-mode-tab-active' : ''}`;
        btn.textContent = label;
        addTooltip(btn, tooltip);
        btn.addEventListener('click', () => {
            loredeckHealthCenterTab = id;
            renderLoredeckHealthCenterOverlay({ preserveScroll: false });
        });
        tabs.appendChild(btn);
    }
    return tabs;
}

function getLoredeckHealthCenterContext(packId = '') {
    const state = getState();
    const canonDb = getCanonLoreDatabaseSync();
    const library = getLoredeckLibrary(state);
    const requestedPackId = String(packId || '').trim();
    const libraryPack = requestedPackId
        ? (library.find(item => item.packId === requestedPackId) || null)
        : null;
    const pack = requestedPackId
        ? (getFreshLoredeckLibraryPack(requestedPackId, libraryPack) || libraryPack || null)
        : null;
    const cached = pack ? getCachedLoredeckHealthRecord(pack.packId) : {};
    const loadedMeta = pack ? ((canonDb?.loredecks || []).find(item => item.id === pack.packId) || null) : null;
    const health = pack ? (cached.health || buildLoredeckPackScopedHealth(pack, loadedMeta, canonDb?.health || null)) : (canonDb?.health || null);
    const report = buildLoredeckHealthReport(state, pack ? null : canonDb, health);
    if (pack) {
        const counts = getLoredeckPackSummaryCounts(pack, cached, loadedMeta, health, report);
        report.scanned = !!health;
        report.insights = [];
        report.packs = [buildLoredeckHealthPackSummary(pack, cached, health)];
        report.enabledPackIds = [pack.packId];
        report.databaseId = pack.packId;
        report.summary = {
            ...(report.summary || {}),
            entryCount: counts.entryCount,
            fileCount: counts.fileCount,
            loadedFileCount: counts.loadedFileCount,
            categoryCounts: counts.categoryCounts,
        };
    }
    const status = getLoredeckHealthStatusDescriptor(report, health);
    const title = pack?.title || (report.packs?.[0]?.title || 'Active Loredeck Stack');
    const subtitle = pack
        ? `${getLoredeckTypeLabel(pack.packId)} Loredeck health report for ${title}.`
        : 'Active stack health report across loaded Loredecks.';
    const repairSessionState = pack ? getLoredeckHealthRepairSessionState(pack.packId) : null;
    if (pack) ensureLoredeckHealthRepairSessionsLoaded(pack.packId);
    return {
        state,
        canonDb,
        pack,
        cached,
        health,
        report,
        status,
        title,
        subtitle,
        generatedAt: cached.loadedAt || report.generatedAt || Date.now(),
        repairSessionState,
    };
}

export function getCachedLoredeckHealthRecord(packId = '') {
    const id = String(packId || '').trim();
    const entryCache = loredeckEntryPreviewCache.get(id) || {};
    const manifestCache = loredeckManifestPreviewCache.get(id) || {};
    const manifest = entryCache.manifest || manifestCache.manifest || null;
    const entryFiles = Array.isArray(entryCache.entryFiles) ? entryCache.entryFiles : [];
    return {
        health: entryCache.health || manifestCache.health || null,
        manifest,
        entryCache,
        entryFiles,
        loadedAt: Number(entryCache.loadedAt) || Number(manifestCache.loadedAt) || 0,
        entryCount: entryFiles.reduce((sum, file) => sum + (Array.isArray(file.entries) ? file.entries.length : 0), 0),
        fileCount: entryFiles.length || countLoredeckManifestFiles(manifest),
        loadedFileCount: entryFiles.filter(file => file?.ok !== false).length,
    };
}

export function countLoredeckManifestFiles(manifest = null) {
    return Array.isArray(manifest?.files) ? manifest.files.length : 0;
}

function isHealthForLoredeckPack(packId = '', health = null) {
    const id = String(packId || '').trim();
    return !!id && !!health && String(health.packId || '').trim() === id;
}

export function buildLoredeckHealthPackSummary(pack = {}, cached = {}, health = null) {
    const overrideCount = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? Object.keys(pack.entryOverrides).length
        : 0;
    const canUseHealthSummary = isHealthForLoredeckPack(pack.packId, health);
    return {
        packId: pack.packId,
        title: pack.title || pack.packId,
        type: pack.type || 'custom',
        typeLabel: ({ bundled: 'Bundled', generated: 'Generated', custom: 'Custom' })[pack.type] || getLoredeckTypeLabel(pack.packId),
        description: pack.description || '',
        manifest: pack.manifest || '',
        derivedFrom: pack.derivedFrom?.packId || '',
        entryCount: Number(canUseHealthSummary ? health?.summary?.entryCount : 0) || Number(cached.entryCount) || Number(pack.stats?.entryCount) || Number(pack.entryCount) || 0,
        healthStatus: (canUseHealthSummary ? health?.status : '') || pack.healthStatus || 'unknown',
        overrideCount,
        disabledCount: Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds.length : 0,
    };
}

export function getLoredeckHealthStatusDescriptor(report = {}, health = null) {
    const summary = report.summary || {};
    const errors = Number(summary.errorCount) || (Array.isArray(report.errors) ? report.errors.length : 0);
    const warnings = Number(summary.warningCount) || (Array.isArray(report.warnings) ? report.warnings.length : 0);
    const suggestions = Number(summary.suggestionCount) || (Array.isArray(report.suggestions) ? report.suggestions.length : 0);
    const raw = String(health?.status || report.status || 'unknown').trim();
    if (!health) {
        return {
            key: 'unknown',
            label: 'Not scanned',
            tone: 'unknown',
            summary: 'Run a scan to check this deck for schema, tag, timeline, and file issues.',
            detail: 'No current Pack Health report is available for this target.',
        };
    }
    if (errors > 0 || raw === 'error') {
        return {
            key: 'blocked',
            label: 'Blocked',
            tone: 'error',
            summary: 'This deck has errors that should be fixed before relying on it.',
            detail: 'Start with errors, then rerun Pack Health before sharing or stacking this deck.',
        };
    }
    if (warnings > 0 || raw === 'needs_review') {
        return {
            key: 'warnings',
            label: 'Usable with warnings',
            tone: 'warning',
            summary: 'This deck can run, but metadata cleanup is recommended.',
            detail: 'Address the priority issues below to improve reliability.',
        };
    }
    if (raw === 'partial') {
        return {
            key: 'partial',
            label: 'Incomplete',
            tone: 'warning',
            summary: 'This deck loaded partially and should be reviewed.',
            detail: 'Check file and schema diagnostics to find what did not load cleanly.',
        };
    }
    if (suggestions > 0) {
        return {
            key: 'healthy_suggestions',
            label: 'Healthy with suggestions',
            tone: 'suggestion',
            summary: 'This deck can run cleanly; optional improvements are available.',
            detail: 'Suggestions are not blockers. Use them when polishing a deck for sharing.',
        };
    }
    return {
        key: 'healthy',
        label: 'Healthy',
        tone: 'ok',
        summary: 'This deck passed the current Pack Health checks.',
        detail: 'No blocking or review-worthy issues were found in the latest scan.',
    };
}

function createLoredeckHealthOverviewView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-overview';
    wrap.appendChild(createLoredeckHealthSummaryHero(context));
    wrap.appendChild(createLoredeckHealthSeverityGrid(context));
    const repairSessions = createLoredeckHealthRepairSessionPanel(context);
    if (repairSessions) wrap.appendChild(repairSessions);

    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-overview-main';
    const issues = document.createElement('div');
    issues.className = 'saga-loredeck-health-panel';
    markTourTarget(issues, 'loredecks.health.issues');
    const issueTitle = document.createElement('div');
    issueTitle.className = 'saga-runtime-card-title';
    issueTitle.textContent = 'Priority Issues';
    issues.appendChild(issueTitle);
    const groups = getLoredeckHealthIssueGroupsForContext(context);
    if (!groups.length) {
        issues.appendChild(createEmptyMessage(context.report.scanned === false ? 'Run Refresh Scan to check this deck for priority issues.' : 'No priority issues found.'));
    } else {
        for (const group of groups.slice(0, 4)) {
            issues.appendChild(createLoredeckHealthIssueGroupCard(group, context));
        }
    }
    main.appendChild(issues);

    const categories = document.createElement('div');
    categories.className = 'saga-loredeck-health-panel';
    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'saga-runtime-card-title';
    categoryTitle.textContent = 'Health Categories';
    categories.appendChild(categoryTitle);
    categories.appendChild(createLoredeckHealthCategoryList(context));
    main.appendChild(categories);
    wrap.appendChild(main);

    wrap.appendChild(createLoredeckHealthInventoryBar(context));
    if (groups[0]) wrap.appendChild(createLoredeckHealthIssueDetailPanel(groups[0], context));
    return wrap;
}

function createLoredeckHealthIssuesView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-issues-view';
    markTourTarget(wrap, 'loredecks.health.issues');
    const groups = getLoredeckHealthIssueGroupsForContext(context, { includeIgnored: true });
    const header = document.createElement('div');
    header.className = 'saga-loredeck-health-view-header';
    const stateCounts = getLoredeckHealthIssueStateCounts(context, groups);
    header.appendChild(createStatusPill(`${groups.length} grouped issue${groups.length === 1 ? '' : 's'}`, 'Issues are grouped by severity, code, and affected file when possible.', { tone: groups.length ? 'warning' : 'muted', kind: 'count' }));
    header.appendChild(createStatusPill(`${getLoredeckHealthAllIssues(context.report).length} raw finding${getLoredeckHealthAllIssues(context.report).length === 1 ? '' : 's'}`, 'Raw Pack Health findings before grouping.', { tone: getLoredeckHealthAllIssues(context.report).length ? 'warning' : 'muted', kind: 'count' }));
    if (stateCounts.ignored) header.appendChild(createStatusPill(`${stateCounts.ignored} accepted as-is`, 'Accepted issue groups are hidden from Overview priority issues but remain visible here.', { tone: 'muted', kind: 'count' }));
    if (stateCounts.resolved) header.appendChild(createStatusPill(`${stateCounts.resolved} verification requested`, 'Issue groups marked for verification by the user. Rerun Pack Health after repairs to confirm they disappear.', { tone: 'success', kind: 'count' }));
    wrap.appendChild(header);
    const repairSessions = createLoredeckHealthRepairSessionPanel(context, { compact: true });
    if (repairSessions) wrap.appendChild(repairSessions);
    if (!groups.length) {
        wrap.appendChild(createEmptyMessage('No issues found in this Pack Health report.'));
        return wrap;
    }
    const table = document.createElement('div');
    table.className = 'saga-loredeck-health-issue-table';
    table.appendChild(createLoredeckHealthIssueTableHeader());
    for (const group of groups) {
        table.appendChild(createLoredeckHealthIssueTableRow(group, context));
    }
    wrap.appendChild(table);
    return wrap;
}

function getLoredeckHealthRepairSessionStatusLabel(status = '') {
    const key = String(status || '').trim();
    if (key === 'needs_review') return 'Needs review';
    if (key === 'model_pending') return 'Model pending';
    if (key === 'manual_remaining') return 'Manual remaining';
    if (key === 'blocked') return 'Blocked';
    if (key === 'complete') return 'Complete';
    if (key === 'loading') return 'Loading';
    return key ? humanizeScopeKey(key) : 'Active';
}

function getLoredeckHealthRepairSessionStatusTone(status = '') {
    const key = String(status || '').trim();
    if (key === 'complete') return 'success';
    if (key === 'blocked' || key === 'error') return 'danger';
    if (key === 'needs_review') return 'review';
    if (key === 'model_pending' || key === 'manual_remaining') return 'warning';
    if (key === 'loading') return 'info';
    return 'muted';
}

function getLoredeckHealthRepairSessionRemainingCounts(session = {}) {
    const remaining = session.remaining || {};
    return {
        choice: Number(remaining.choiceSetCount || remaining.choiceSets?.length) || 0,
        model: Number(remaining.modelUnits?.length) || 0,
        deferred: Number(remaining.deferredUnits?.length) || 0,
        manual: Number(remaining.manualBuckets?.length) || 0,
    };
}

function getLoredeckHealthRepairSessionLifecycle(session = {}) {
    const lifecycle = session.lifecycle && typeof session.lifecycle === 'object' && !Array.isArray(session.lifecycle)
        ? session.lifecycle
        : {};
    const counts = getLoredeckHealthRepairSessionRemainingCounts(session);
    const remainingWorkCount = counts.choice + counts.model + counts.deferred + counts.manual;
    return {
        ...lifecycle,
        remainingWorkCount: Number(lifecycle.remainingWorkCount ?? remainingWorkCount) || remainingWorkCount,
        diagnosticCount: Number(lifecycle.diagnosticCount ?? session.diagnostics?.length) || 0,
        canAutoDelete: lifecycle.canAutoDelete === true || (session.status === 'complete' && remainingWorkCount === 0 && !(Number(lifecycle.diagnosticCount ?? session.diagnostics?.length) || 0)),
        canUserDelete: lifecycle.canUserDelete !== false,
    };
}

function appendLoredeckHealthRepairSessionPills(container, session = {}) {
    const counts = getLoredeckHealthRepairSessionRemainingCounts(session);
    container.appendChild(createStatusPill(getLoredeckHealthRepairSessionStatusLabel(session.status), 'Repair session status.', { tone: getLoredeckHealthRepairSessionStatusTone(session.status), kind: 'status' }));
    if (counts.choice) container.appendChild(createStatusPill(`${counts.choice} needs choice`, 'Review choice sets saved in this repair session.', { tone: 'review', kind: 'count' }));
    if (counts.model) container.appendChild(createStatusPill(`${counts.model} model batch${counts.model === 1 ? '' : 'es'}`, 'Model repair units ready for a provider-backed pass.', { tone: 'warning', kind: 'count' }));
    if (counts.deferred) container.appendChild(createStatusPill(`${counts.deferred} deferred`, 'Model repair units deferred by batch limits.', { tone: 'warning', kind: 'count' }));
    if (counts.manual) container.appendChild(createStatusPill(`${counts.manual} manual`, 'Manual-only repair groups saved in this repair session.', { tone: 'muted', kind: 'count' }));
    if (session.updatedAt) container.appendChild(createStatusPill(`Updated ${formatRelativeHealthTime(session.updatedAt)}`, 'Repair session update time.', { tone: 'info', kind: 'status' }));
}

function createLoredeckHealthRepairSessionRow(session = {}) {
    const row = document.createElement('div');
    row.className = `saga-loredeck-health-issue saga-loredeck-health-repair-session-row saga-loredeck-health-repair-session-${session.status || 'active'}`;
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-issue-code';
    title.textContent = session.outcome ? `Attempt Fixing: ${getLoredeckHealthRepairSessionStatusLabel(session.outcome)}` : 'Attempt Fixing Session';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    appendLoredeckHealthRepairSessionPills(meta, session);
    main.appendChild(meta);
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-health-issue-message';
    const health = session.summary?.finalHealth || {};
    const issueCount = Number(health.issueCount) || ((Number(health.errorCount) || 0) + (Number(health.warningCount) || 0) + (Number(health.suggestionCount) || 0));
    summary.textContent = issueCount
        ? `${issueCount} Pack Health finding${issueCount === 1 ? '' : 's'} remained when this session was saved.`
        : 'No remaining Pack Health findings were recorded in this session.';
    main.appendChild(summary);
    const lifecycle = getLoredeckHealthRepairSessionLifecycle(session);
    if (session.status === 'complete' && lifecycle.remainingWorkCount === 0) {
        const note = document.createElement('div');
        note.className = 'saga-runtime-help';
        note.textContent = lifecycle.diagnosticCount
            ? 'Completed diagnostic summary. It can be cleared when you no longer need the saved result.'
            : 'Completed cleanly. Saga can clear this finished session without losing active repair work.';
        main.appendChild(note);
    }
    row.appendChild(main);
    return row;
}

function formatLoredeckRepairChoiceConfidence(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '';
    return `${Math.round(Math.max(0, Math.min(1, number)) * 100)}% confidence`;
}

function truncateLoredeckRepairChoicePreviewText(value = '', maxLength = 160) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getLoredeckRepairChoiceSessionKey(context = {}, session = {}) {
    const packId = String(context.pack?.packId || session.packId || loredeckHealthCenterPackId || '').trim();
    const sessionId = String(session.sessionId || session.sessionFile || '').trim();
    return [packId, sessionId || 'session'].filter(Boolean).join('::');
}

function getLoredeckRepairSkippedChoiceIds(context = {}, session = {}) {
    const key = getLoredeckRepairChoiceSessionKey(context, session);
    return key ? new Set(loredeckHealthRepairSkippedChoiceIds.get(key) || []) : new Set();
}

function setLoredeckRepairChoiceSkipped(context = {}, session = {}, choice = {}, skipped = true) {
    const key = getLoredeckRepairChoiceSessionKey(context, session);
    const choiceId = String(choice.choiceSetId || '').trim();
    if (!key || !choiceId) return;
    const current = getLoredeckRepairSkippedChoiceIds(context, session);
    if (skipped) current.add(choiceId);
    else current.delete(choiceId);
    if (current.size) loredeckHealthRepairSkippedChoiceIds.set(key, [...current]);
    else loredeckHealthRepairSkippedChoiceIds.delete(key);
}

function clearLoredeckRepairSkippedChoices(context = {}, session = {}) {
    const key = getLoredeckRepairChoiceSessionKey(context, session);
    if (key) loredeckHealthRepairSkippedChoiceIds.delete(key);
}

function getLoredeckRepairChoiceOperationTarget(operation = {}) {
    return [
        operation.entryId ? `Entry ${operation.entryId}` : '',
        operation.tagId ? `Tag ${operation.tagId}` : '',
        operation.anchorId ? `Anchor ${operation.anchorId}` : '',
        operation.windowId ? `Window ${operation.windowId}` : '',
    ].filter(Boolean).join(' | ') || 'Pack metadata';
}

function getNestedLoredeckRepairChoiceValue(source = {}, path = '') {
    const parts = String(path || '').split('.').map(part => part.trim()).filter(Boolean);
    let value = source;
    for (const part of parts) {
        if (!value || typeof value !== 'object') return undefined;
        value = value[part];
    }
    return value;
}

function getLoredeckRepairChoiceOperationPayload(operation = {}) {
    return operation.entry || operation.definition || operation.anchor || operation.window || operation.stats || null;
}

function createLoredeckRepairChoiceOperationPreview(operation = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-repair-choice-preview-row';

    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = `${humanizeScopeKey(operation.op || 'change')} -> ${getLoredeckRepairChoiceOperationTarget(operation)}`;
    row.appendChild(title);

    const fields = Array.isArray(operation.fields) ? operation.fields.map(field => String(field || '').trim()).filter(Boolean) : [];
    const payload = getLoredeckRepairChoiceOperationPayload(operation);
    const details = document.createElement('div');
    details.className = 'saga-loredeck-row-description';
    if (fields.length) {
        const fieldSummaries = fields.slice(0, 4).map(field => {
            const value = payload ? getNestedLoredeckRepairChoiceValue(payload, field) : undefined;
            if (value === undefined) return field;
            return `${field}: ${truncateLoredeckRepairChoicePreviewText(value)}`;
        });
        if (fields.length > fieldSummaries.length) fieldSummaries.push(`${fields.length - fieldSummaries.length} more field${fields.length - fieldSummaries.length === 1 ? '' : 's'}`);
        details.textContent = fieldSummaries.join(' | ');
    } else if (payload) {
        details.textContent = truncateLoredeckRepairChoicePreviewText(payload);
    } else {
        details.textContent = 'No field-level preview was supplied for this operation.';
    }
    row.appendChild(details);
    return row;
}

function createLoredeckHealthRepairChoiceDiffPreview(option = {}) {
    const operations = Array.isArray(option.patch?.operations) ? option.patch.operations : [];
    if (!operations.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-repair-choice-preview';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Preview';
    wrap.appendChild(title);
    for (const operation of operations.slice(0, 5)) {
        wrap.appendChild(createLoredeckRepairChoiceOperationPreview(operation));
    }
    if (operations.length > 5) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 5 of ${operations.length} storage changes.`;
        wrap.appendChild(more);
    }
    return wrap;
}

function createLoredeckHealthRepairChoiceOptionRow(context = {}, session = {}, choice = {}, option = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-repair-choice-option';
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-issue-code';
    title.textContent = `${option.optionId || '?'}: ${option.label || 'Repair option'}`;
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const confidence = formatLoredeckRepairChoiceConfidence(option.confidence);
    if (confidence) meta.appendChild(createStatusPill(confidence, 'Model or local confidence for this repair option.', { tone: 'info', kind: 'status' }));
    const opCount = Number(option.patch?.operations?.length) || 0;
    if (opCount) meta.appendChild(createStatusPill(`${opCount} change${opCount === 1 ? '' : 's'}`, 'Storage operations this option will apply.', { tone: 'review', kind: 'count' }));
    if (meta.children.length) main.appendChild(meta);
    if (option.reason) {
        const reason = document.createElement('div');
        reason.className = 'saga-loredeck-health-issue-message';
        reason.textContent = option.reason;
        main.appendChild(reason);
    }
    const preview = createLoredeckHealthRepairChoiceDiffPreview(option);
    if (preview) main.appendChild(preview);
    row.appendChild(main);
    const actions = createLoredeckActionRow();
    const applyButton = createButton(`Apply ${option.optionId || ''}`.trim(), `Apply repair option ${option.optionId || option.label || ''}.`, async (btn) => {
        await applyLoredeckHealthRepairChoice(context.pack, choice, option, session, btn);
        await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
        renderLoredeckHealthCenterOverlay({ preserveScroll: true });
    }, 'saga-primary-button');
    applyButton.disabled = !canValidateLoredeckInEditor(context.pack);
    actions.appendChild(applyButton);
    row.appendChild(actions);
    return row;
}

function createLoredeckHealthRepairChoiceRow(context = {}, session = {}, choice = {}) {
    const row = document.createElement('div');
    row.className = `saga-loredeck-health-issue saga-loredeck-health-repair-choice-row saga-loredeck-health-issue-${choice.severity || 'warning'}`;
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-issue-code';
    title.textContent = choice.question || 'Choose a repair option.';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill('Needs Review', 'This repair choice needs an option before Saga can apply it.', { tone: 'review', kind: 'status' }));
    if (choice.code) meta.appendChild(createStatusPill(choice.code, 'Pack Health finding code.', { tone: 'muted', kind: 'status' }));
    const findingCount = Number(choice.findingIds?.length) || 0;
    if (findingCount) meta.appendChild(createStatusPill(`${findingCount} finding${findingCount === 1 ? '' : 's'}`, 'Findings covered by this choice.', { tone: 'info', kind: 'count' }));
    main.appendChild(meta);
    if (choice.reason) {
        const reason = document.createElement('div');
        reason.className = 'saga-loredeck-health-issue-message';
        reason.textContent = choice.reason;
        main.appendChild(reason);
    }
    row.appendChild(main);
    const choiceActions = createLoredeckActionRow();
    const reevaluateButton = createButton('Ask Model To Re-evaluate', 'Ask the Reasoning Provider to generate a fresh repair proposal for this saved choice set.', async (btn) => {
        await reevaluateLoredeckHealthRepairChoice(context.pack, choice, session, btn);
        await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
        renderLoredeckHealthCenterOverlay({ preserveScroll: true });
    });
    reevaluateButton.disabled = !canValidateLoredeckInEditor(context.pack);
    choiceActions.appendChild(reevaluateButton);
    choiceActions.appendChild(createButton('Skip For Now', 'Hide this review choice until you refresh or show skipped choices. No repair session data is changed.', () => {
        setLoredeckRepairChoiceSkipped(context, session, choice, true);
        renderLoredeckHealthCenterOverlay({ preserveScroll: true });
    }));
    row.appendChild(choiceActions);
    const options = document.createElement('div');
    options.className = 'saga-loredeck-health-repair-choice-options';
    for (const option of Array.isArray(choice.options) ? choice.options : []) {
        options.appendChild(createLoredeckHealthRepairChoiceOptionRow(context, session, choice, option));
    }
    row.appendChild(options);
    return row;
}

function createLoredeckHealthRepairChoiceList(context = {}, session = {}, options = {}) {
    const choiceSets = Array.isArray(session.remaining?.choiceSets) ? session.remaining.choiceSets : [];
    if (!choiceSets.length) return null;
    const list = document.createElement('div');
    list.className = 'saga-loredeck-health-repair-choice-list';
    const skippedIds = getLoredeckRepairSkippedChoiceIds(context, session);
    const visibleChoices = choiceSets.filter(choice => !skippedIds.has(String(choice.choiceSetId || '').trim()));
    const skippedCount = choiceSets.length - visibleChoices.length;
    if (!visibleChoices.length) {
        list.appendChild(createEmptyMessage(skippedCount
            ? 'All review choices are skipped for now. Show skipped choices or refresh sessions to continue.'
            : 'No review choices are available.'));
        if (skippedCount) {
            const actions = createLoredeckActionRow();
            actions.appendChild(createButton('Show Skipped Choices', 'Restore skipped review choices in this open Health Center view.', () => {
                clearLoredeckRepairSkippedChoices(context, session);
                renderLoredeckHealthCenterOverlay({ preserveScroll: true });
            }, 'saga-primary-button'));
            list.appendChild(actions);
        }
        return list;
    }
    const limit = options.compact ? 1 : 6;
    for (const choice of visibleChoices.slice(0, limit)) {
        list.appendChild(createLoredeckHealthRepairChoiceRow(context, session, choice));
    }
    if (visibleChoices.length > limit) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `${visibleChoices.length - limit} more review choice${visibleChoices.length - limit === 1 ? '' : 's'} saved. Apply, skip, or refresh to continue.`;
        list.appendChild(more);
    }
    if (skippedCount) {
        const skipped = document.createElement('div');
        skipped.className = 'saga-runtime-help';
        skipped.textContent = `${skippedCount} review choice${skippedCount === 1 ? '' : 's'} skipped for now. Refresh sessions or show skipped choices to restore them.`;
        list.appendChild(skipped);
        const actions = createLoredeckActionRow();
        actions.appendChild(createButton('Show Skipped Choices', 'Restore skipped review choices in this open Health Center view.', () => {
            clearLoredeckRepairSkippedChoices(context, session);
            renderLoredeckHealthCenterOverlay({ preserveScroll: true });
        }));
        list.appendChild(actions);
    }
    return list;
}

function buildLoredeckHealthRepairSessionDiagnosticsExport(context = {}, session = {}) {
    const counts = getLoredeckHealthRepairSessionRemainingCounts(session);
    return {
        schemaVersion: 1,
        kind: 'saga_loredeck_health_repair_session_diagnostics',
        packId: session.packId || context.pack?.packId || '',
        packTitle: context.pack?.title || context.pack?.name || '',
        sessionId: session.sessionId || '',
        status: session.status || '',
        outcome: session.outcome || '',
        sessionFile: session.sessionFile || '',
        createdAt: session.createdAt || 0,
        updatedAt: session.updatedAt || 0,
        lifecycle: session.lifecycle || {},
        remainingCounts: {
            reviewChoices: counts.choice,
            modelBatches: counts.model,
            deferredBatches: counts.deferred,
            manualGroups: counts.manual,
        },
        finalHealth: session.summary?.finalHealth || {},
        diagnostics: Array.isArray(session.diagnostics) ? session.diagnostics : [],
        appliedPatchIds: Array.isArray(session.appliedPatchIds) ? session.appliedPatchIds : [],
    };
}

function exportLoredeckHealthRepairSessionDiagnostics(context = {}, session = {}) {
    if (!session?.sessionId && !session?.sessionFile) {
        toast('No saved repair session is selected.', 'warning');
        return;
    }
    const packId = session.packId || context.pack?.packId || 'loredeck';
    const sessionId = session.sessionId || 'session';
    downloadJson(
        buildLoredeckHealthRepairSessionDiagnosticsExport(context, session),
        `${sanitizeFileStem(packId)}-${sanitizeFileStem(sessionId)}-repair-session-diagnostics.json`,
    );
    toast('Repair session diagnostics exported.', 'info');
}

async function clearLoredeckHealthRepairSession(context = {}, session = {}, button = null) {
    if (!session?.sessionId && !session?.sessionFile) {
        toast('No saved repair session is selected.', 'warning');
        return false;
    }
    const proceed = await confirmAction(
        'Clear Saved Session',
        'Delete this saved Attempt Fixing session? Loredeck content and Pack Health findings are not changed.',
    );
    if (!proceed) return false;
    const restore = setLoredeckActionButtonBusy(button, 'Clearing...', { fallbackLabel: 'Clear Saved Session' });
    try {
        const result = await deleteLoredeckHealthRepairSession(session);
        if (!result?.ok) throw new Error(result?.error || 'Saved repair session could not be cleared.');
        clearLoredeckRepairSkippedChoices(context, session);
        toast('Saved repair session cleared.', 'success');
        return true;
    } catch (error) {
        toast(error?.message || 'Saved repair session could not be cleared.', 'error');
        return false;
    } finally {
        restore();
    }
}

function createLoredeckHealthRepairSessionPanel(context = {}, options = {}) {
    if (!context.pack) return null;
    const state = context.repairSessionState || {};
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const diagnostics = Array.isArray(state.diagnostics) ? state.diagnostics : [];
    const activeRun = getLoredeckHealthRepairActiveRun(context.pack.packId);
    const loading = state.status === 'loading' || state.status === 'idle';
    if (!activeRun && !loading && !sessions.length && !diagnostics.length && !state.error) return null;

    const panel = document.createElement('div');
    panel.className = `saga-loredeck-health-panel saga-loredeck-health-repair-session-panel${options.compact ? ' saga-loredeck-health-repair-session-panel-compact' : ''}`;
    markTourTarget(panel, 'loredecks.health.repairSessions');
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Attempt Fixing Session';
    panel.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    if (activeRun) {
        summary.appendChild(createStatusPill(`${activeRun.label || 'Repair run'} running`, 'A Pack Health repair action is currently running for this Loredeck.', { tone: 'warning', kind: 'status' }));
        if (activeRun.cancellable) summary.appendChild(createStatusPill('Cancellable', 'This active repair run can be asked to stop after the current provider/checkpoint step.', { tone: 'info', kind: 'status' }));
        if (sessions.length) {
            summary.appendChild(createStatusPill(`${sessions.length} saved`, 'Saved repair sessions for this Loredeck.', { tone: 'review', kind: 'count' }));
            const latest = sessions[0];
            if (latest) appendLoredeckHealthRepairSessionPills(summary, latest);
        }
    } else if (loading) {
        summary.appendChild(createStatusPill('Loading sessions', 'Saga is checking storage for saved repair sessions.', { tone: 'info', kind: 'status' }));
    } else if (sessions.length) {
        summary.appendChild(createStatusPill(`${sessions.length} saved`, 'Saved repair sessions for this Loredeck.', { tone: 'review', kind: 'count' }));
        const latest = sessions[0];
        if (latest) appendLoredeckHealthRepairSessionPills(summary, latest);
    } else {
        summary.appendChild(createStatusPill('No saved sessions', 'No active repair sessions were found for this Loredeck.', { tone: 'muted', kind: 'status' }));
    }
    if (diagnostics.length || state.error) {
        summary.appendChild(createStatusPill(`${diagnostics.length || 1} session diagnostic${(diagnostics.length || 1) === 1 ? '' : 's'}`, state.error || diagnostics[0]?.message || 'Repair session diagnostics are available.', { tone: 'warning', kind: 'severity' }));
    }
    panel.appendChild(summary);

    for (const session of sessions.slice(0, options.compact ? 2 : 4)) {
        panel.appendChild(createLoredeckHealthRepairSessionRow(session));
    }
    if (!options.compact) {
        const choiceSession = sessions.find(session => Number(session.remaining?.choiceSetCount || session.remaining?.choiceSets?.length) > 0);
        const choiceList = choiceSession ? createLoredeckHealthRepairChoiceList(context, choiceSession, options) : null;
        if (choiceList) panel.appendChild(choiceList);
    }
    if (diagnostics.length && !options.compact) {
        panel.appendChild(createLoredeckHealthIssueList('Session Diagnostics', diagnostics, 'warning'));
    }

    const editable = context.pack?.type !== 'bundled';
    const activeSession = sessions.find(session => {
        const counts = getLoredeckHealthRepairSessionRemainingCounts(session);
        return counts.model || counts.deferred;
    }) || sessions[0] || null;
    const activeCounts = activeSession ? getLoredeckHealthRepairSessionRemainingCounts(activeSession) : null;
    const clearableSessionCount = sessions.filter(session => {
        const lifecycle = getLoredeckHealthRepairSessionLifecycle(session);
        return session.status === 'complete' && lifecycle.remainingWorkCount === 0;
    }).length;
    const actions = createLoredeckActionRow();
    markTourTarget(actions, 'loredecks.health.repairSessionActions');
    const refreshButton = createButton('Refresh Sessions', 'Reload saved repair sessions for this Loredeck.', async (btn) => {
        const restore = setLoredeckActionButtonBusy(btn, 'Refreshing...', { fallbackLabel: 'Refresh Sessions' });
        try {
            await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
        } finally {
            restore();
        }
    });
    actions.appendChild(refreshButton);
    if (clearableSessionCount > 0) {
        const clearButton = createButton('Clear Finished Sessions', `Delete ${clearableSessionCount} completed repair session file${clearableSessionCount === 1 ? '' : 's'}. Active, review, model, and manual sessions are kept.`, async (btn) => {
            const restore = setLoredeckActionButtonBusy(btn, 'Clearing...', { fallbackLabel: 'Clear Finished Sessions' });
            try {
                const result = await cleanupLoredeckHealthRepairSessionFiles(context.pack.packId, {
                    statuses: ['complete'],
                    includeDiagnosticSessions: true,
                });
                if (!result?.ok) {
                    toast(result?.error || 'Finished repair sessions could not be cleared.', 'warning');
                } else {
                    toast(result.deletedCount
                        ? `Cleared ${result.deletedCount} finished repair session${result.deletedCount === 1 ? '' : 's'}.`
                        : 'No finished repair sessions needed clearing.',
                    result.deletedCount ? 'success' : 'info');
                }
                await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
                renderLoredeckHealthCenterOverlay({ preserveScroll: true });
            } finally {
                restore();
            }
        });
        actions.appendChild(clearButton);
    }
    if (editable) {
        if (activeRun) {
            const cancelButton = createButton('Cancel Repair Run', 'Ask the active Pack Health repair run to stop after the current provider or checkpoint step.', async (btn) => {
                const restore = setLoredeckActionButtonBusy(btn, 'Cancelling...', { fallbackLabel: 'Cancel Repair Run' });
                try {
                    cancelLoredeckHealthRepairRun(context.pack.packId);
                    renderLoredeckHealthCenterOverlay({ preserveScroll: true });
                } finally {
                    restore();
                }
            });
            cancelButton.disabled = activeRun.cancellable === false;
            actions.appendChild(cancelButton);
        }
        if (activeSession && ((activeCounts?.model || 0) + (activeCounts?.deferred || 0)) > 0) {
            const continueButton = createButton('Continue Model Batches', 'Continue the saved model repair batches in this repair session.', async (btn) => {
                await continueLoredeckHealthModelRepairSession(context.pack, activeSession, btn);
                await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
                renderLoredeckHealthCenterOverlay({ preserveScroll: true });
            }, 'saga-primary-button');
            continueButton.disabled = !canValidateLoredeckInEditor(context.pack);
            actions.appendChild(markTourTarget(continueButton, 'loredecks.health.continueModelBatches'));
        }
        const attemptButton = createButton('Attempt Fixing', 'Run storage-backed Pack Health fixing again for this Loredeck.', async (btn) => {
            await attemptLoredeckHealthFixes(context.pack, btn);
            await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
            renderLoredeckHealthCenterOverlay({ preserveScroll: true });
        }, activeSession && ((activeCounts?.model || 0) + (activeCounts?.deferred || 0)) > 0 ? '' : 'saga-primary-button');
        attemptButton.disabled = !canValidateLoredeckInEditor(context.pack);
        actions.appendChild(markTourTarget(attemptButton, 'loredecks.health.attemptFixing'));
    }
    if (activeSession) {
        actions.appendChild(createButton('Export Diagnostics', 'Export compact diagnostics for this saved repair session.', () => {
            exportLoredeckHealthRepairSessionDiagnostics(context, activeSession);
        }));
        const clearButton = createButton('Clear Saved Session', 'Delete the saved repair session without changing Loredeck content or Pack Health findings.', async (btn) => {
            const cleared = await clearLoredeckHealthRepairSession(context, activeSession, btn);
            if (!cleared) return;
            await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
            renderLoredeckHealthCenterOverlay({ preserveScroll: true });
        });
        clearButton.disabled = !!activeRun || activeSession.lifecycle?.canUserDelete === false;
        actions.appendChild(clearButton);
    }
    panel.appendChild(actions);
    return panel;
}

function createLoredeckHealthCoverageView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-coverage-view';
    const summary = context.report.summary || {};
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-health-panel';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Narrative Coverage Signals';
    panel.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Coverage is advisory. These signals help identify whether a deck has enough Context, category, and retrieval structure to support long-form play.';
    panel.appendChild(help);
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-health-coverage-grid';
    const categoryCounts = summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
        ? summary.categoryCounts
        : {};
    const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    if (categories.length) {
        for (const [category, count] of categories) {
            grid.appendChild(createLoredeckHealthMetric(humanizeScopeKey(category), String(count), `Loaded ${category} Lorecards.`));
        }
    } else {
        grid.appendChild(createLoredeckHealthMetric('Categories', 'unset', 'No category counts are available yet.'));
    }
    grid.appendChild(createLoredeckHealthMetric('Context Gates', String(summary.contextGateCount || 0), 'Lorecards with Context gates.'));
    grid.appendChild(createLoredeckHealthMetric('Schema v3', String(summary.schemaV3EntryCount || 0), 'Lorecards checked against Saga schema v3.'));
    grid.appendChild(createLoredeckHealthMetric('Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`, 'Timeline anchors/windows available to Context.'));
    grid.appendChild(createLoredeckHealthMetric('Candidates', String(summary.timelineCandidateCount || ((summary.timelineAnchorCount || 0) + (summary.timelineWindowCount || 0))), 'Durable timeline candidates available to the Context Browser and Reasoner.'));
    grid.appendChild(createLoredeckHealthMetric('Gates / Candidate', String(summary.timelineGatesPerCandidate || 0), 'Approximate Context-gated Lorecard density per durable timeline candidate.'));
    grid.appendChild(createLoredeckHealthMetric('Density Hints', String(summary.timelineDensificationSuggestionCount || 0), 'Advisory suggestions for adding high-value anchors/windows without creating alias sprawl.'));
    panel.appendChild(grid);
    wrap.appendChild(panel);
    wrap.appendChild(createLoredeckHealthCategoryList(context, { asPanel: true }));
    return wrap;
}

function createLoredeckHealthFilesView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-files-view';
    const files = getLoredeckHealthFileRows(context);
    if (!files.length) {
        wrap.appendChild(createEmptyMessage('No file-level diagnostics are available yet. Run Refresh Scan or validate the selected Loredeck.'));
        return wrap;
    }
    const table = document.createElement('div');
    table.className = 'saga-loredeck-health-file-table';
    const header = document.createElement('div');
    header.className = 'saga-loredeck-health-file-row saga-loredeck-health-file-row-header';
    for (const text of ['File', 'Entries', 'Errors', 'Warnings', 'Status']) {
        const cell = document.createElement('div');
        cell.textContent = text;
        header.appendChild(cell);
    }
    table.appendChild(header);
    for (const file of files) {
        const row = document.createElement('div');
        row.className = `saga-loredeck-health-file-row saga-loredeck-health-file-row-${file.statusTone}`;
        for (const text of [file.file || '(unknown)', String(file.entries || 0), String(file.errors || 0), String(file.warnings || 0), file.status]) {
            const cell = document.createElement('div');
            cell.textContent = text;
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    wrap.appendChild(table);
    return wrap;
}

function createLoredeckHealthAdvancedView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-advanced-view';
    const actions = createLoredeckActionRow();
    actions.appendChild(createButton('Copy Diagnostics', 'Copy the current Pack Health report JSON to clipboard.', async () => {
        await copyTextToClipboard(stringifyRedactedDiagnostic(context.report), 'Pack Health diagnostics copied.');
    }));
    actions.appendChild(createButton('Export Report', 'Download this Pack Health report as JSON.', () => exportLoredeckHealthCenterReport(context), 'saga-primary-button'));
    wrap.appendChild(actions);

    const summary = context.report.summary || {};
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-health-grid';
    const metrics = [
        ['Status', context.report.status || 'unknown', 'Raw Pack Health status.'],
        ['Entries', String(summary.entryCount || 0), 'Loaded entry count after Custom overrides and stack dedupe.'],
        ['Files', `${summary.loadedFileCount || 0}/${summary.fileCount || 0}`, 'Loaded files over declared files.'],
        ['Overrides', String(summary.entryOverrideCount || 0), 'Custom entry overrides applied in loaded packs.'],
        ['Added', String(summary.entryAdditionCount || 0), 'Custom entries added through override layers.'],
        ['Disabled', String(summary.suppressedEntryCount || 0), 'Source entries suppressed by Custom packs.'],
        ['Stack Duplicates', String(context.report.duplicateEntryIdCount || 0), 'Duplicate entry IDs resolved by stack priority.'],
        ['Context Gates', String(summary.contextGateCount || 0), 'Entries with Context gates.'],
        ['Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`, 'Loaded Context anchors/windows.'],
        ['Schema v3', String(summary.schemaV3EntryCount || 0), 'Loaded entries checked against Saga schema v3 rules.'],
        ['v3 Issues', String(summary.schemaV3IssueCount || 0), 'Schema v3 Pack Health issues across loaded entries.'],
        ['Stats Drift', String(summary.manifestStatsMismatchCount || 0), 'Manifest stats mismatches found during validation.'],
        ['Tag Issues', String((summary.undefinedTagCount || 0) + (summary.deprecatedTagUsageCount || 0) + (summary.duplicateTagAliasCount || 0) + (summary.malformedTagCount || 0)), 'Undefined, deprecated, duplicate-alias, or malformed tag issues.'],
        ['Anchor Issues', String(summary.brokenAnchorReferenceCount || 0), 'Broken Context anchor references.'],
        ['Window Issues', String(summary.invalidContextWindowCount || 0), 'Invalid Context windows.'],
        ['Unmatchable', String(summary.unmatchableContextGateCount || 0), 'Context-gated entries that cannot match known Context anchors.'],
    ];
    for (const [label, value, tooltip] of metrics) grid.appendChild(createLoredeckHealthMetric(label, value, tooltip));
    wrap.appendChild(grid);

    if (context.report.packs?.length) {
        const packs = document.createElement('div');
        packs.className = 'saga-loredeck-health-pack-list';
        for (const pack of context.report.packs) packs.appendChild(createLoredeckHealthPackRow(pack));
        wrap.appendChild(packs);
    }
    if (context.report.insights?.length) wrap.appendChild(createLoredeckHealthIssueList('Stack Insights', context.report.insights, 'warning'));
    wrap.appendChild(createLoredeckHealthIssueList('Errors', context.report.errors, 'error'));
    wrap.appendChild(createLoredeckHealthIssueList('Warnings', context.report.warnings, 'warning'));
    wrap.appendChild(createLoredeckHealthIssueList('Suggestions', context.report.suggestions, 'suggestion'));
    return wrap;
}

function createLoredeckHealthSummaryHero(context, options = {}) {
    const hero = document.createElement('div');
    hero.className = `saga-loredeck-health-hero saga-loredeck-health-hero-${context.status.tone}${options.compact ? ' saga-loredeck-health-hero-compact' : ''}`;
    markTourTarget(hero, 'loredecks.health.status');
    const emblem = document.createElement('div');
    emblem.className = 'saga-loredeck-health-emblem';
    emblem.textContent = context.status.tone === 'error' ? '!' : (context.status.tone === 'ok' ? 'OK' : '!');
    hero.appendChild(emblem);
    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-hero-main';
    const deck = document.createElement('div');
    deck.className = 'saga-loredeck-health-deck-title';
    deck.textContent = context.title;
    main.appendChild(deck);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const pack = context.pack || context.report.packs?.[0] || null;
    appendLoredeckStatusPills(meta, [
        { text: pack ? (pack.typeLabel || getLoredeckTypeLabel(pack.packId)) : '', tooltip: 'Loredeck type.', show: !!pack, tone: 'source', kind: 'source' },
        [`${context.report.summary?.entryCount || 0} Lorecards`, 'Lorecards checked in this report.', { kind: 'count' }],
        [`Last scan: ${context.health ? formatRelativeHealthTime(context.generatedAt) : 'not scanned'}`, 'Last Pack Health scan time.', { tone: context.health ? 'info' : 'muted', kind: 'status' }],
    ]);
    main.appendChild(meta);
    const status = document.createElement('div');
    status.className = 'saga-loredeck-health-status-label';
    status.textContent = context.status.label;
    main.appendChild(status);
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-health-status-summary';
    summary.textContent = context.status.summary;
    main.appendChild(summary);
    if (!options.compact) {
        const detail = document.createElement('div');
        detail.className = 'saga-loredeck-health-status-detail';
        detail.textContent = context.status.detail;
        main.appendChild(detail);
    }
    hero.appendChild(main);
    return hero;
}

function createLoredeckHealthSeverityGrid(context, options = {}) {
    const summary = context.report.summary || {};
    return createLoredeckValidationSeverityGrid([
        { label: 'Errors', value: String(summary.errorCount || 0), detail: (summary.errorCount || 0) ? 'Fix first' : 'None found', tone: 'error' },
        { label: 'Warnings', value: String(summary.warningCount || 0), detail: (summary.warningCount || 0) ? 'Needs review' : 'Clear', tone: 'warning' },
        { label: 'Suggestions', value: String(summary.suggestionCount || 0), detail: (summary.suggestionCount || 0) ? 'Optional' : 'None', tone: 'suggestion' },
        { label: 'Checked', value: String(summary.entryCount || 0), detail: 'Lorecards', tone: 'checked' },
    ], options);
}

function createLoredeckHealthCategoryList(context, options = {}) {
    return createLoredeckValidationCategoryList(getLoredeckHealthCategories(context.report), {
        asPanel: options.asPanel,
    });
}

function getLoredeckHealthCategories(report = {}) {
    const summary = report.summary || {};
    const issues = getLoredeckHealthAllIssues(report);
    if (report.scanned === false) {
        const makeUnknown = (label, tooltip) => ({
            label,
            status: 'Not checked',
            tone: 'unknown',
            tooltip,
        });
        return [
            makeUnknown('Structure', 'Run Refresh Scan to check manifest structure and source metadata.'),
            makeUnknown('JSON Validity', 'Run Refresh Scan to check whether declared JSON resources load successfully.'),
            makeUnknown('Schema', 'Run Refresh Scan to check Saga schema v3 entry shape and required fields.'),
            makeUnknown('Tags', 'Run Refresh Scan to check tag registry, tag IDs, deprecated tags, aliases, and orphaned tags.'),
            makeUnknown('Timeline', 'Run Refresh Scan to check timeline anchors, windows, sort keys, and registry availability.'),
            makeUnknown('Anchors', 'Run Refresh Scan to check Context anchor references.'),
            makeUnknown('Coverage', 'Run Refresh Scan to check advisory completeness and retrieval coverage signals.'),
        ];
    }
    const hasCode = pattern => issues.some(issue => pattern.test(String(issue.code || '')));
    const make = (label, failed, review, tooltip) => ({
        label,
        status: failed ? 'Blocked' : (review ? 'Needs Review' : 'Passed'),
        tone: failed ? 'error' : (review ? 'warning' : 'ok'),
        tooltip,
    });
    return [
        make('Structure', hasCode(/missing_default_loredeck|missing_loredeck_manifest|invalid_pack_id|missing_virtual_loredeck_base_manifest/), hasCode(/duplicate_manifest_file|manifest_.*mismatch/), 'Manifest structure and library/source metadata.'),
        make('JSON Validity', hasCode(/missing_entry_file|load_failed/), false, 'Whether declared JSON resources loaded successfully.'),
        make('Schema', Number(summary.schemaV3IssueCount) > 0 && (report.errors || []).some(issue => String(issue.code || '').startsWith('schema_v3')), Number(summary.schemaV3IssueCount) > 0, 'Saga schema v3 entry shape and required fields.'),
        make('Tags', false, (Number(summary.undefinedTagCount) || 0) + (Number(summary.deprecatedTagUsageCount) || 0) + (Number(summary.duplicateTagAliasCount) || 0) + (Number(summary.malformedTagCount) || 0) > 0 || hasCode(/tag/), 'Tag registry, tag IDs, deprecated tags, aliases, and orphaned tags.'),
        make('Timeline', false, (Number(summary.invalidContextWindowCount) || 0) > 0 || (Number(summary.timelineDensificationSuggestionCount) || 0) > 0 || hasCode(/timeline|context_window/), 'Timeline anchors, windows, sort keys, and registry availability.'),
        make('Anchors', false, (Number(summary.brokenAnchorReferenceCount) || 0) > 0 || hasCode(/anchor/), 'Context anchor references from entries and windows.'),
        make('Coverage', false, (Number(summary.suggestionCount) || 0) > 0, 'Advisory completeness signals such as optional metadata and broad coverage.'),
    ];
}

function createLoredeckHealthInventoryBar(context) {
    const summary = context.report.summary || {};
    const bar = document.createElement('div');
    bar.className = 'saga-loredeck-health-inventory';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-inventory-title';
    title.textContent = 'Deck Inventory';
    bar.appendChild(title);
    const items = [
        ['Entries', String(summary.entryCount || 0)],
        ['Files', `${summary.loadedFileCount || 0}/${summary.fileCount || 0}`],
        ['Schema', summary.schemaV3EntryCount ? 'v3' : (context.pack?.entrySchemaVersion ? `v${context.pack.entrySchemaVersion}` : 'unknown')],
        ['Context Gates', String(summary.contextGateCount || 0)],
        ['Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`],
        ['Disabled', String(summary.suppressedEntryCount || context.pack?.disabledEntryIds?.length || 0)],
        ['Overrides', String(summary.entryOverrideCount || (context.pack?.entryOverrides ? Object.keys(context.pack.entryOverrides).length : 0))],
    ];
    for (const [label, value] of items) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-health-inventory-item';
        const k = document.createElement('span');
        k.textContent = label;
        item.appendChild(k);
        const v = document.createElement('strong');
        v.textContent = value;
        item.appendChild(v);
        bar.appendChild(item);
    }
    return bar;
}

function createLoredeckHealthIssueGroupCard(group, context, options = {}) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const card = document.createElement('details');
    card.className = `saga-loredeck-health-group-card saga-loredeck-health-group-${group.severity}${options.compact ? ' saga-loredeck-health-group-card-compact' : ''}`;
    if (issueState?.status) card.classList.add(`saga-loredeck-health-group-state-${issueState.status}`);
    card.open = false;
    const summary = document.createElement('summary');
    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-group-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-group-title';
    title.textContent = group.title;
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const severityTone = group.severity === 'error' ? 'danger' : (group.severity === 'warning' ? 'warning' : 'info');
    const severityPill = createStatusPill(humanizeScopeKey(group.severity), 'Issue severity.', { tone: severityTone, kind: 'severity' });
    meta.appendChild(severityPill);
    const affectedPill = createStatusPill(group.affectedLabel, 'Affected scope.', { tone: 'neutral', kind: 'metadata' });
    meta.appendChild(affectedPill);
    if (group.files.length) {
        const filePill = createStatusPill(`${group.files.length} file${group.files.length === 1 ? '' : 's'}`, group.files.join(', '), { tone: 'source', kind: 'count' });
        meta.appendChild(filePill);
    }
    if (group.autoFixLabel) {
        const fixPill = createStatusPill(group.autoFixLabel, group.autoFixTooltip, { tone: 'success', kind: 'status' });
        meta.appendChild(fixPill);
    }
    if (issueState?.status) {
        const stateLabel = getLoredeckHealthIssueStateLabel(issueState, group);
        const statePill = createStatusPill(stateLabel, issueState.note || 'User-set Pack Health issue state.', { tone: issueState.status === 'resolved' ? 'success' : 'muted', kind: 'status' });
        meta.appendChild(statePill);
    }
    main.appendChild(meta);
    const message = document.createElement('div');
    message.className = 'saga-loredeck-health-group-message';
    message.textContent = group.summary;
    main.appendChild(message);
    summary.appendChild(main);
    card.appendChild(summary);
    if (!options.compact) {
        card.appendChild(createLoredeckHealthIssueDetailPanel(group, context, { embedded: true }));
    }
    return card;
}

function createLoredeckHealthIssueDetailPanel(group, context, options = {}) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const editable = !!context.pack && context.pack.type !== 'bundled';
    const panel = document.createElement('div');
    panel.className = `saga-loredeck-health-detail-panel${options.embedded ? ' saga-loredeck-health-detail-panel-embedded' : ''}`;
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = options.embedded ? 'Details' : `Issue: ${group.title}`;
    panel.appendChild(title);
    const why = document.createElement('div');
    why.className = 'saga-loredeck-health-detail-block';
    const whyTitle = document.createElement('strong');
    whyTitle.textContent = 'Why this matters';
    why.appendChild(whyTitle);
    const whyText = document.createElement('p');
    whyText.textContent = group.why;
    why.appendChild(whyText);
    panel.appendChild(why);
    const fix = document.createElement('div');
    fix.className = 'saga-loredeck-health-detail-block';
    const fixTitle = document.createElement('strong');
    fixTitle.textContent = 'Recommended fix';
    fix.appendChild(fixTitle);
    const fixText = document.createElement('p');
    fixText.textContent = group.fix;
    fix.appendChild(fixText);
    panel.appendChild(fix);

    if (context.pack) {
        const workflow = document.createElement('div');
        workflow.className = 'saga-loredeck-health-detail-block';
        const workflowTitle = document.createElement('strong');
        workflowTitle.textContent = 'Repair workflow';
        workflow.appendChild(workflowTitle);
        const workflowText = document.createElement('p');
        workflowText.textContent = editable
            ? 'Run Attempt Fixing first. Saga applies deterministic local fixes, saves remaining model or review work to a repair session, then you rerun Refresh Scan after any later review choices are applied.'
            : 'Bundled Loredecks are read-only. Duplicate as Custom before repairing, accepting, or verifying issue state.';
        workflow.appendChild(workflowText);
        panel.appendChild(workflow);
    }

    const affected = createLoredeckHealthAffectedList(group);
    if (affected) panel.appendChild(affected);

    panel.appendChild(createLoredeckHealthIssueActionRow(group, context, issueState, editable));
    return panel;
}

function canAcceptLoredeckHealthIssueAsIs(group = {}) {
    return normalizeLoredeckHealthSeverity(group.severity || '') !== 'error';
}

function createLoredeckHealthIssueActionRow(group, context = {}, issueState = null, editable = false) {
    const actions = createLoredeckActionRow();
    markTourTarget(actions, 'loredecks.health.issueActions');
    actions.appendChild(createButton('Copy Details', 'Copy this grouped issue summary to clipboard.', async () => {
        await copyTextToClipboard(formatLoredeckHealthGroupForCopy(group), 'Pack Health issue copied.');
    }));
    if (group.files.length) {
        actions.appendChild(createButton('Copy File Path', 'Copy the first affected source file path.', async () => {
            await copyTextToClipboard(group.files[0], 'Affected file path copied.');
        }));
    }
    if (context.pack) {
        if (!editable) {
            actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck copy before repairing source-protected health issues.', () => {
                openDuplicateLoredeckDialog(context.pack);
            }));
        } else {
            if (issueState?.status === 'ignored' || canAcceptLoredeckHealthIssueAsIs(group)) {
                const ignoreButton = createButton(issueState?.status === 'ignored' ? 'Clear Accept As-Is' : 'Accept As-Is', issueState?.status === 'ignored' ? 'Clear this user-set accepted state.' : 'Accept this grouped finding as intentional for this editable Loredeck. The finding remains in diagnostics until Pack Health no longer reports it.', async () => {
                    await setLoredeckHealthIssueGroupState(context.pack, group, issueState?.status === 'ignored' ? '' : 'ignored');
                    renderLoredeckHealthCenterOverlay();
                });
                actions.appendChild(markTourTarget(ignoreButton, 'loredecks.health.acceptAsIs'));
            }
            const resolveButton = createButton(issueState?.status === 'resolved' ? 'Clear Verification' : 'Verify Fixed', issueState?.status === 'resolved' ? 'Clear this user-set verification marker.' : 'Mark this grouped finding as repaired only after you have changed the deck. Rerun Refresh Scan to confirm Pack Health no longer reports it.', async () => {
                await setLoredeckHealthIssueGroupState(context.pack, group, issueState?.status === 'resolved' ? '' : 'resolved');
                renderLoredeckHealthCenterOverlay();
            });
            actions.appendChild(markTourTarget(resolveButton, 'loredecks.health.verifyFixed'));
            const repairButton = createButton('Attempt Fixing', 'Apply deterministic fixes now and save remaining model or review work as a repair session.', async (btn) => {
                await attemptLoredeckHealthFixes(context.pack, btn);
                renderLoredeckHealthCenterOverlay();
            }, 'saga-primary-button');
            repairButton.disabled = !canValidateLoredeckInEditor(context.pack);
            actions.appendChild(markTourTarget(repairButton, 'loredecks.health.attemptFixing'));
            if (isLoredeckMalformedTagIssueGroup(group)) {
                const tagRepairButton = createButton('Queue Tag ID Review', 'Queue malformed tag ID replacements for manual review when Attempt Fixing cannot choose safely.', async (btn) => {
                    await queueLoredeckMalformedTagRepairFromHealthGroup(context.pack, group, btn);
                    renderLoredeckHealthCenterOverlay();
                });
                tagRepairButton.disabled = !canValidateLoredeckInEditor(context.pack);
                actions.appendChild(tagRepairButton);
            }
        }
    }
    return actions;
}

function createLoredeckHealthAffectedList(group) {
    const rows = getLoredeckHealthAffectedRows(group).slice(0, 12);
    if (!rows.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-affected-list';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Affected Items';
    wrap.appendChild(title);
    for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-health-affected-row';
        for (const text of row) {
            const cell = document.createElement('span');
            cell.textContent = text;
            item.appendChild(cell);
        }
        wrap.appendChild(item);
    }
    const total = getLoredeckHealthAffectedCount(group);
    if (total > rows.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing first ${rows.length} of ${total}. Export the report for the full set.`;
        wrap.appendChild(more);
    }
    return wrap;
}

function createLoredeckHealthIssueTableHeader() {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-issue-table-row saga-loredeck-health-issue-table-header';
    for (const text of ['Severity', 'Issue', 'Affected', 'File', 'Action']) {
        const cell = document.createElement('div');
        cell.textContent = text;
        row.appendChild(cell);
    }
    return row;
}

function createLoredeckHealthIssueTableRow(group, context) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const row = document.createElement('details');
    row.className = `saga-loredeck-health-issue-table-row saga-loredeck-health-issue-table-row-${group.severity}`;
    if (issueState?.status) row.classList.add(`saga-loredeck-health-issue-table-row-state-${issueState.status}`);
    const summary = document.createElement('summary');
    const actionText = issueState?.status
        ? `${getLoredeckHealthIssueStateLabel(issueState, group)} | ${group.fixShort}`
        : group.fixShort;
    for (const text of [humanizeScopeKey(group.severity), group.title, group.affectedLabel, group.files[0] || 'Multiple / none', actionText]) {
        const cell = document.createElement('div');
        cell.textContent = text;
        summary.appendChild(cell);
    }
    row.appendChild(summary);
    row.appendChild(createLoredeckHealthIssueDetailPanel(group, context, { embedded: true }));
    return row;
}

function getLoredeckHealthAllIssues(report = {}) {
    const rows = [];
    const add = (items, severity) => {
        for (const raw of Array.isArray(items) ? items : []) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            rows.push({ ...raw, severity: raw.severity || severity });
        }
    };
    add(report.errors, 'error');
    add(report.warnings, 'warning');
    add(report.suggestions, 'suggestion');
    add(report.insights, 'suggestion');
    return rows;
}

export function groupLoredeckHealthIssues(report = {}) {
    const map = new Map();
    for (const issue of getLoredeckHealthAllIssues(report)) {
        const severity = normalizeLoredeckHealthSeverity(issue.severity);
        const code = String(issue.code || severity || 'issue').trim() || 'issue';
        const files = collectLoredeckHealthIssueFiles(issue);
        const primaryFile = files[0] || '';
        const key = `${severity}|${code}|${primaryFile}`;
        if (!map.has(key)) {
            map.set(key, {
                severity,
                code,
                files: new Set(),
                tagIds: new Set(),
                entryIds: new Set(),
                timelineIds: new Set(),
                reasons: new Set(),
                issues: [],
            });
        }
        const group = map.get(key);
        group.issues.push(issue);
        for (const file of files) group.files.add(file);
        for (const tag of collectLoredeckHealthIssueTags(issue)) group.tagIds.add(tag);
        for (const id of normalizeLoredeckPendingIdList(issue.entryIds || issue.affectedEntryIds || [])) group.entryIds.add(id);
        for (const id of collectLoredeckHealthIssueTimelineIds(issue)) group.timelineIds.add(id);
        for (const reason of Array.isArray(issue.reasons) ? issue.reasons : []) {
            const text = String(reason || '').trim();
            if (text) group.reasons.add(text);
        }
    }
    return [...map.values()]
        .map(finalizeLoredeckHealthIssueGroup)
        .sort((a, b) => getLoredeckHealthSeverityWeight(a.severity) - getLoredeckHealthSeverityWeight(b.severity)
            || b.rawCount - a.rawCount
            || a.title.localeCompare(b.title));
}

function getLoredeckHealthIssueGroupsForContext(context = {}, options = {}) {
    const groups = groupLoredeckHealthIssues(context.report);
    if (options.includeIgnored === true) return groups;
    return groups.filter(group => getLoredeckHealthIssueState(context.pack, group)?.status !== 'ignored');
}

function getLoredeckHealthIssueStateCounts(context = {}, groups = groupLoredeckHealthIssues(context.report)) {
    const counts = { ignored: 0, resolved: 0 };
    for (const group of groups || []) {
        const status = getLoredeckHealthIssueState(context.pack, group)?.status;
        if (status === 'ignored') counts.ignored += 1;
        if (status === 'resolved') counts.resolved += 1;
    }
    return counts;
}

function finalizeLoredeckHealthIssueGroup(group) {
    const files = [...group.files];
    const tagIds = [...group.tagIds];
    const entryIds = [...group.entryIds];
    const timelineIds = [...group.timelineIds];
    const title = getLoredeckHealthIssueTitle(group.code);
    const advice = getLoredeckHealthIssueAdvice(group.code, group.severity);
    const affectedCount = tagIds.length || entryIds.length || timelineIds.length || group.issues.length;
    const affectedKind = tagIds.length ? 'tag' : (entryIds.length ? 'Lorecard' : (timelineIds.length ? 'timeline item' : 'finding'));
    const affectedLabel = `${affectedCount} affected ${affectedKind}${affectedCount === 1 ? '' : 's'}`;
    const issueKey = getLoredeckHealthIssueGroupKey({ ...group, files, tagIds, entryIds, timelineIds });
    return {
        ...group,
        issueKey,
        files,
        tagIds,
        entryIds,
        timelineIds,
        reasons: [...group.reasons],
        title,
        affectedLabel,
        rawCount: group.issues.length,
        summary: advice.summary || group.issues[0]?.message || title,
        why: advice.why,
        fix: advice.fix,
        fixShort: advice.fixShort,
        autoFixLabel: advice.autoFixLabel,
        autoFixTooltip: advice.autoFixTooltip,
    };
}

function getLoredeckHealthIssueGroupKey(group = {}) {
    const parts = [
        normalizeLoredeckHealthSeverity(group.severity),
        String(group.code || '').trim(),
        ...(group.files || []).map(item => `file:${String(item || '').trim()}`).sort(),
        ...(group.tagIds || []).map(item => `tag:${String(item || '').trim()}`).sort(),
        ...(group.entryIds || []).map(item => `entry:${String(item || '').trim()}`).sort(),
        ...(group.timelineIds || []).map(item => `timeline:${String(item || '').trim()}`).sort(),
    ].filter(Boolean);
    return `health_issue_${hashLoredeckHealthRepairIssueId(parts.join('|'))}`;
}

function getLoredeckHealthIssueState(pack = {}, group = {}) {
    const key = String(group.issueKey || getLoredeckHealthIssueGroupKey(group)).trim();
    if (!key) return null;
    return normalizeLoredeckHealthIssueStates(pack?.healthIssueStates)[key] || null;
}

function getLoredeckHealthIssueStateLabel(state = null, group = {}) {
    const status = String(state?.status || '').trim();
    if (status === 'ignored') return 'Accepted as-is';
    if (status === 'resolved') return 'Verification requested';
    return '';
}

function isLoredeckHealthPassingForVerification(health = null) {
    if (!health || typeof health !== 'object') return false;
    const status = String(health.status || '').trim();
    const summary = health.summary || {};
    const errorCount = Number(summary.errorCount ?? health.errors?.length) || 0;
    const warningCount = Number(summary.warningCount ?? health.warnings?.length) || 0;
    return status === 'good' && errorCount === 0 && warningCount === 0;
}

async function clearResolvedLoredeckHealthIssueStatesAfterPassingScan(pack = {}, health = null) {
    if (!isLoredeckHealthPassingForVerification(health)) return { clearedCount: 0, failedCount: 0 };
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh || fresh.type === 'bundled') return { clearedCount: 0, failedCount: 0 };
    const states = normalizeLoredeckHealthIssueStates(fresh.healthIssueStates);
    const resolvedKeys = Object.entries(states)
        .filter(([, state]) => state?.status === 'resolved')
        .map(([key]) => key);
    if (!resolvedKeys.length) return { clearedCount: 0, failedCount: 0 };
    let clearedCount = 0;
    let failedCount = 0;
    for (const issueKey of resolvedKeys) {
        const result = await persistLoredeckHealthIssueState(fresh, issueKey, null, '', {
            errorMessage: 'Pack Health verification marker cleanup failed.',
        });
        if (result?.ok) {
            clearedCount += 1;
            delete states[issueKey];
            fresh.healthIssueStates = { ...states };
        } else {
            failedCount += 1;
        }
    }
    if (clearedCount) {
        toast(`Verified fixed: cleared ${clearedCount} Pack Health verification marker${clearedCount === 1 ? '' : 's'} after a clean scan.`, failedCount ? 'warning' : 'success');
    }
    if (failedCount && !clearedCount) {
        toast(`Pack Health scan passed, but ${failedCount} verification marker${failedCount === 1 ? '' : 's'} could not be cleared.`, 'warning');
    }
    return { clearedCount, failedCount };
}

async function setLoredeckHealthIssueGroupState(pack = {}, group = {}, status = '') {
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh || fresh.type === 'bundled') {
        toast('Bundled Loredecks are read-only. Duplicate as Custom before setting issue state.', 'warning');
        return false;
    }
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const issueKey = String(group.issueKey || getLoredeckHealthIssueGroupKey(group)).trim();
    if (!issueKey) {
        toast('Pack Health issue state needs a stable issue key.', 'warning');
        return false;
    }
    const title = group.title || getLoredeckHealthIssueTitle(group.code);
    const message = normalizedStatus === 'ignored'
        ? `Accepted Pack Health issue as-is: ${title}.`
        : (normalizedStatus === 'resolved'
            ? `Marked Pack Health issue for verification: ${title}. Rerun Pack Health to verify.`
            : `Cleared Pack Health issue state: ${title}.`);
    const stateRecord = ['ignored', 'resolved'].includes(normalizedStatus)
        ? {
            issueKey,
            status: normalizedStatus,
            code: String(group.code || '').trim(),
            severity: normalizeLoredeckHealthSeverity(group.severity || ''),
            title,
            note: normalizedStatus === 'resolved'
                ? 'Verification requested by user. Rerun Pack Health after repairs to confirm it no longer appears.'
                : 'Accepted as-is by user. The finding remains in diagnostics but is no longer a priority for this deck.',
            updatedAt: Date.now(),
        }
        : null;
    const result = await persistLoredeckHealthIssueState(fresh, issueKey, stateRecord, message, {
        errorMessage: 'Pack Health issue state save failed.',
    });
    if (!result?.ok) {
        toast(result?.error || 'Pack Health issue state save failed.', 'error');
        return false;
    }
    clearCanonLoreDatabaseCache();
    clearContextIndexCache();
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    refreshHeader();
    if (message) toast(message, 'success');
    return true;
}

export function normalizeLoredeckHealthSeverity(severity = '') {
    const key = String(severity || '').trim().toLowerCase();
    if (key === 'error') return 'error';
    if (key === 'warning') return 'warning';
    return 'suggestion';
}

function getLoredeckHealthSeverityWeight(severity = '') {
    return severity === 'error' ? 0 : (severity === 'warning' ? 1 : 2);
}

function getLoredeckHealthIssueTitle(code = '') {
    const key = String(code || '').trim();
    const titles = {
        malformed_tag_namespace: 'Tag IDs contain spaces or unsupported characters',
        undefined_tag: 'Tags are missing from the registry',
        deprecated_tag_used: 'Deprecated tags are still used',
        duplicate_tag_alias: 'Tag aliases point to multiple definitions',
        orphaned_tag_definition: 'Unused tag definitions',
        tag_registry_missing: 'Tag registry is missing',
        tag_registry_load_failed: 'Tag registry failed to load',
        tag_parent_missing: 'Tag parent is missing',
        deprecated_tag_replacement_missing: 'Deprecated tag replacement is missing',
        unnamespaced_bundled_tag: 'Bundled tags should be namespaced',
        missing_entry_file: 'Entry file failed to load',
        duplicate_entry_id: 'Duplicate Lorecard IDs',
        missing_entry_id: 'Lorecards are missing IDs',
        duplicate_manifest_file: 'Manifest lists duplicate files',
        manifest_entry_count_mismatch: 'Manifest entry count is stale',
        manifest_category_counts_mismatch: 'Manifest category counts are stale',
        schema_v3_legacy_timing_fields: 'Legacy timing fields remain in schema v3 entries',
        schema_v3_missing_context: 'Lorecards are missing Context',
        schema_v3_invalid_context_scope: 'Context scope is invalid',
        schema_v3_missing_context_sort_keys: 'Context sort keys are missing',
        schema_v3_missing_context_precision: 'Context precision is missing',
        schema_v3_missing_context_label: 'Context label is missing',
        schema_v3_missing_retrieval: 'Retrieval metadata is missing',
        schema_v3_incomplete_retrieval: 'Retrieval metadata is incomplete',
        schema_v3_missing_content: 'Lorecard content is incomplete',
        schema_v3_wide_lore_retrieval: 'Wide lore activation should be topic-gated',
        broken_anchor_reference: 'Context anchors are missing',
        invalid_context_window: 'Context window is invalid',
        unmatchable_context_gate: 'Context gate cannot match',
        context_gates_without_timeline: 'Context gates need a timeline registry',
        context_timeline_empty: 'Timeline registry is empty',
        context_timeline_registry_malformed: 'Timeline registry overlay is malformed',
        context_timeline_load_failed: 'Timeline registry failed to load',
        context_timeline_invalid_ref: 'Timeline registry path is invalid',
        timeline_anchor_sortkey_mismatch: 'Timeline anchor sort key mismatch',
        timeline_window_sortkey_mismatch: 'Timeline window sort key mismatch',
        timeline_candidate_sparse: 'Timeline candidates are sparse',
        timeline_anchor_coverage_concentrated: 'Timeline coverage is concentrated',
        timeline_windows_missing: 'Timeline windows are missing',
        custom_entry_overrides_applied: 'Custom overrides are active',
        likely_duplicate_pack: 'Likely duplicate deck loaded',
        shared_manifest_with_overrides: 'Loaded decks share a manifest',
        loaded_pack_missing_library_record: 'Loaded deck is missing from the Library',
        loaded_pack_not_available: 'Loaded deck did not produce a source',
        custom_duplicate_has_no_entry_changes: 'Custom duplicate has no Lorecard changes',
        empty_loredeck_stack: 'No Loredecks are loaded',
    };
    return titles[key] || humanizeScopeKey(key || 'Pack Health issue');
}

function getLoredeckHealthIssueAdvice(code = '', severity = 'suggestion') {
    const key = String(code || '').trim();
    const generic = {
        summary: severity === 'error' ? 'This issue can prevent reliable deck loading.' : 'This issue may reduce reliability, search, or future editing quality.',
        why: 'Pack Health checks help keep Loredecks predictable when they are loaded, stacked, edited, exported, or shared.',
        fix: 'Review the affected records, correct the underlying metadata, then rerun Pack Health.',
        fixShort: 'Review',
    };
    const advice = {
        malformed_tag_namespace: {
            summary: 'Some tags appear to use display labels as machine IDs.',
            why: 'Tag IDs with spaces, punctuation, or unsupported characters can break filtering, matching, namespace routing, and future bulk operations.',
            fix: 'Use stable machine-safe IDs while preserving readable labels in the tag registry, such as "Year 1" as label and "year-1" as ID.',
            fixShort: 'Normalize IDs',
            autoFixLabel: 'Deterministic fix',
            autoFixTooltip: 'Machine-safe IDs can be generated deterministically, but bundled or remote source files still need a protected edit path.',
        },
        undefined_tag: {
            summary: 'Used tags are not defined in the active tag registry.',
            why: 'Undefined tags still display, but they cannot carry labels, descriptions, colors, hierarchy, aliases, or deprecation metadata.',
            fix: 'Define these tags in tags.json or remove them from entries that do not need them.',
            fixShort: 'Define tags',
        },
        tag_registry_missing: {
            summary: 'Lorecards use tags, but this deck has no tag registry.',
            why: 'A registry separates machine IDs from readable labels and makes tags safer for filtering, editing, and creator guidance.',
            fix: 'Create a tags.json registry or embed a Custom tag registry before sharing the deck.',
            fixShort: 'Create registry',
        },
        schema_v3_missing_context: {
            summary: 'Schema v3 Lorecards should define Context eligibility.',
            why: 'Context prevents future canon leakage and lets Saga activate lore at the right point in the story.',
            fix: 'Add context.scope, sort keys, precision, label, and anchor/window references where appropriate.',
            fixShort: 'Add Context',
        },
        schema_v3_missing_retrieval: {
            summary: 'Lorecards are missing retrieval metadata.',
            why: 'Retrieval metadata tells Saga when a card is useful and prevents broad entries from over-injecting.',
            fix: 'Add retrieval activation, frequency, Context boost, and cue metadata.',
            fixShort: 'Add retrieval',
        },
        schema_v3_wide_lore_retrieval: {
            summary: 'Wide lore should activate from scene topics or entities.',
            why: 'Global lore can be valid background material, but broad automatic activation can inject it into unrelated scenes.',
            fix: 'Use topic-or-entity activation for wide/global entries. Frequency and Context boost can stay higher when the entry is intentionally common background lore.',
            fixShort: 'Gate activation',
        },
        missing_entry_file: {
            summary: 'A declared entry file did not load.',
            why: 'Missing files reduce deck coverage and may make manifest stats inaccurate.',
            fix: 'Check the manifest path, URL, filename, and browser accessibility for the affected file.',
            fixShort: 'Fix path',
        },
        duplicate_entry_id: {
            summary: 'Multiple Lorecards share the same ID.',
            why: 'Duplicate IDs make overrides and stack priority ambiguous.',
            fix: 'Give each Lorecard a unique stable ID, then rerun validation.',
            fixShort: 'Rename IDs',
        },
        broken_anchor_reference: {
            summary: 'Entries or windows reference timeline anchors that do not exist.',
            why: 'Broken anchors can make Context gates fail or behave unpredictably.',
            fix: 'Add the missing anchors to timeline.json or update entries to reference existing anchors.',
            fixShort: 'Fix anchors',
        },
        invalid_context_window: {
            summary: 'A Context window starts after it ends or has invalid boundaries.',
            why: 'Invalid windows can make entries never eligible or eligible at the wrong time.',
            fix: 'Check anchor order, sort keys, and window start/end references.',
            fixShort: 'Fix window',
        },
        timeline_candidate_sparse: {
            summary: 'The timeline may be too sparse for the number of Context-gated Lorecards.',
            why: 'The Reasoner can translate casual phrasing, but it still needs a healthy set of known story candidates to choose from.',
            fix: 'Add durable anchors/windows for recurring high-value story moments, major reveals, arc turns, generated Deck Maker output, or accepted user/model suggestions. Do not add aliases for every possible phrase.',
            fixShort: 'Add waypoints',
        },
        timeline_anchor_coverage_concentrated: {
            summary: 'Many Context gates cluster around only a few anchors.',
            why: 'Over-concentrated anchors make broad areas of canon feel like one large bucket and reduce Context Browser usefulness.',
            fix: 'Split the coverage around meaningful story turns, relationship changes, location shifts, public knowledge changes, battles, lessons, or arc transitions.',
            fixShort: 'Split anchors',
        },
        timeline_windows_missing: {
            summary: 'The timeline has anchors but no broad selectable windows.',
            why: 'Windows let users choose ranges like arcs, school years, phases, seasons, or before/after spans without selecting a single exact event.',
            fix: 'Add broad windows over existing anchors for arcs, years, phases, seasons, quests, or chapters.',
            fixShort: 'Add windows',
        },
        manifest_entry_count_mismatch: {
            summary: 'Manifest stats do not match the loaded deck.',
            why: 'Stale stats make library cards and sharing metadata misleading.',
            fix: 'Refresh manifest stats from Pack Health before exporting or sharing.',
            fixShort: 'Refresh stats',
        },
    };
    return { ...generic, ...(advice[key] || {}) };
}

export function collectLoredeckHealthIssueTags(issue = {}) {
    const tags = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !tags.includes(text)) tags.push(text);
    };
    for (const tag of Array.isArray(issue.tagIds) ? issue.tagIds : []) push(tag);
    if (issue.tag) push(issue.tag);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (typeof tag === 'string') push(tag);
        else push(tag?.tag || tag?.id || '');
    }
    return tags;
}

function collectLoredeckHealthIssueFiles(issue = {}) {
    const files = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !files.includes(text)) files.push(text);
    };
    push(issue.file);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (tag && typeof tag === 'object') {
            for (const file of Array.isArray(tag.files) ? tag.files : []) push(file);
        }
    }
    return files;
}

function collectLoredeckHealthIssueTimelineIds(issue = {}) {
    return normalizeLoredeckPendingTimelineIdList([
        issue.anchorId || '',
        issue.timelineWindowId || '',
        ...(Array.isArray(issue.anchorIds) ? issue.anchorIds : []),
        ...(Array.isArray(issue.timelineIds) ? issue.timelineIds : []),
    ]);
}

function getLoredeckHealthAffectedCount(group = {}) {
    return group.tagIds?.length || group.entryIds?.length || group.timelineIds?.length || group.rawCount || 0;
}

function getLoredeckHealthAffectedRows(group = {}) {
    const rows = [];
    if (group.tagIds?.length) {
        for (const tag of group.tagIds) rows.push([tag, suggestLoredeckMachineId(tag), group.files[0] || '']);
        return rows;
    }
    if (group.entryIds?.length) {
        for (const id of group.entryIds) rows.push([id, group.code, group.files[0] || '']);
        return rows;
    }
    if (group.timelineIds?.length) {
        for (const id of group.timelineIds) rows.push([id, group.code, group.files[0] || '']);
        return rows;
    }
    for (const issue of group.issues || []) rows.push([issue.code || group.code, issue.message || '', issue.file || '']);
    return rows;
}

export function suggestLoredeckMachineId(value = '') {
    return normalizeLoredeckTagId(value) || String(value || '').trim().toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeLoredeckTagId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

function formatLoredeckHealthGroupForCopy(group = {}) {
    const lines = [
        `${group.title}`,
        `Severity: ${humanizeScopeKey(group.severity || 'suggestion')}`,
        `Affected: ${group.affectedLabel || ''}`,
        group.files?.length ? `Files: ${group.files.join(', ')}` : '',
        '',
        `Why this matters: ${group.why || ''}`,
        `Recommended fix: ${group.fix || ''}`,
    ].filter(line => line !== '');
    const rows = getLoredeckHealthAffectedRows(group).slice(0, 20);
    if (rows.length) {
        lines.push('', 'Affected items:');
        for (const row of rows) lines.push(`- ${row.filter(Boolean).join(' | ')}`);
    }
    return lines.join('\n');
}

function getLoredeckHealthFileRows(context = {}) {
    const rows = new Map();
    const addFile = (file, data = {}) => {
        const key = String(file || '').trim();
        if (!key) return;
        const current = rows.get(key) || { file: key, entries: 0, errors: 0, warnings: 0, suggestions: 0 };
        current.entries = Math.max(current.entries || 0, Number(data.entries) || 0);
        current.errors += Number(data.errors) || 0;
        current.warnings += Number(data.warnings) || 0;
        current.suggestions += Number(data.suggestions) || 0;
        rows.set(key, current);
    };
    for (const fileRecord of context.cached?.entryFiles || []) {
        addFile(fileRecord.file, {
            entries: Array.isArray(fileRecord.entries) ? fileRecord.entries.length : 0,
            errors: fileRecord.ok === false ? 1 : 0,
        });
    }
    for (const issue of getLoredeckHealthAllIssues(context.report)) {
        const files = collectLoredeckHealthIssueFiles(issue);
        for (const file of files) {
            addFile(file, {
                errors: normalizeLoredeckHealthSeverity(issue.severity) === 'error' ? 1 : 0,
                warnings: normalizeLoredeckHealthSeverity(issue.severity) === 'warning' ? 1 : 0,
                suggestions: normalizeLoredeckHealthSeverity(issue.severity) === 'suggestion' ? 1 : 0,
            });
        }
    }
    return [...rows.values()]
        .map(row => ({
            ...row,
            statusTone: row.errors ? 'error' : (row.warnings ? 'warning' : 'ok'),
            status: row.errors ? 'Blocked' : (row.warnings ? 'Review' : 'Healthy'),
        }))
        .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.file.localeCompare(b.file));
}

export function formatRelativeHealthTime(timestamp = 0) {
    const value = Number(timestamp) || 0;
    if (!value) return 'unknown';
    const delta = Date.now() - value;
    if (delta < 60000) return 'just now';
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(value).toLocaleString();
}

async function copyTextToClipboard(text = '', successMessage = 'Copied.') {
    try {
        await navigator.clipboard?.writeText(String(text || ''));
        toast(successMessage, 'info');
    } catch (_) {
        toast('Clipboard copy unavailable in this browser context.', 'warning');
    }
}

async function refreshLoredeckHealthCenterScan(context = getLoredeckHealthCenterContext(), button = null) {
    await withLoredeckActionButtonBusy(button, { busyText: 'Scanning...', fallbackLabel: 'Refresh Scan' }, async () => {
        try {
            if (context.pack) {
                const result = await validateLoredeckForEditor(context.pack, null, { quiet: true, updateLibrary: true });
                if (!result.health) throw new Error(result.error || 'Pack Health scan failed.');
                await clearResolvedLoredeckHealthIssueStatesAfterPassingScan(context.pack, result.health);
                await ensureLoredeckHealthRepairSessionsLoaded(context.pack.packId, { force: true });
                refreshLoredeckSurfaces();
            } else {
                clearCanonLoreDatabaseCache();
                clearContextIndexCache();
                await loadCanonLoreDatabase();
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                refreshHeader();
            }
        } catch (e) {
            toast(e?.message || 'Pack Health scan failed.', 'error');
        }
    });
    renderLoredeckHealthCenterOverlay();
}

function exportLoredeckHealthCenterReport(context = getLoredeckHealthCenterContext()) {
    if (!context.health) {
        toast('Pack Health has not loaded yet.', 'warning');
        return;
    }
    const fileStem = sanitizeFileStem(context.pack?.packId || context.report.databaseId || 'saga-deck-health');
    downloadJson(redactDiagnosticValue(context.report), `${fileStem}.health.json`);
}

function createLoredeckHealthMetric(label, value, tooltip) {
    return createLoredeckValidationMetric(label, value, tooltip);
}

function createLoredeckHealthPackRow(pack) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-pack-row';
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = pack.title || pack.packId;
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    desc.textContent = pack.description || pack.manifest || pack.packId;
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(pack.typeLabel || pack.type || 'Custom', 'Loredeck type.', { tone: 'source', kind: 'source' }));
    meta.appendChild(createStatusPill(`${pack.entryCount || 0} entries`, 'Loaded entries from this pack.', { kind: 'count' }));
    meta.appendChild(createStatusPill(pack.healthStatus || 'unknown', 'Per-pack health status.', { tone: pack.healthStatus === 'ok' ? 'success' : (pack.healthStatus === 'warning' ? 'warning' : (pack.healthStatus === 'error' ? 'danger' : 'muted')), kind: 'severity' }));
    if (pack.overrideCount) meta.appendChild(createStatusPill(`${pack.overrideCount} overrides`, 'Saved entry overrides in the library record.', { tone: 'info', kind: 'count' }));
    if (pack.disabledCount) meta.appendChild(createStatusPill(`${pack.disabledCount} disabled`, 'Disabled source entry IDs in the library record.', { tone: 'muted', kind: 'count' }));
    if (pack.derivedFrom) meta.appendChild(createStatusPill(`from ${pack.derivedFrom}`, 'Source pack recorded in derivedFrom metadata.', { tone: 'source', kind: 'source', maxChars: 34 }));
    main.appendChild(meta);
    row.appendChild(main);
    return row;
}

function createLoredeckHealthIssueList(titleText, issues = [], severity = 'suggestion') {
    return createLoredeckValidationIssueList(titleText, issues, {
        severity,
        getMetaItems: issue => [
            { text: issue.packId, tooltip: 'Affected pack ID.', show: !!issue.packId },
            { text: Array.isArray(issue.entryIds) && issue.entryIds.length ? `${issue.entryIds.length} entr${issue.entryIds.length === 1 ? 'y' : 'ies'}` : '', tooltip: 'Affected entry IDs.', show: Array.isArray(issue.entryIds) && issue.entryIds.length > 0 },
            { text: issue.file, tooltip: 'Affected file.', show: !!issue.file },
            { text: issue.anchorId ? `anchor: ${issue.anchorId}` : '', tooltip: 'Affected Context anchor.', show: !!issue.anchorId },
            { text: Array.isArray(issue.anchorIds) && issue.anchorIds.length ? `${issue.anchorIds.length} anchor${issue.anchorIds.length === 1 ? '' : 's'}` : '', tooltip: 'Affected Context anchors.', show: Array.isArray(issue.anchorIds) && issue.anchorIds.length > 0 },
            { text: issue.timelineWindowId ? `window: ${issue.timelineWindowId}` : '', tooltip: 'Affected Context timeline window.', show: !!issue.timelineWindowId },
            { text: issue.contextField, tooltip: 'Affected Context field.', show: !!issue.contextField },
            { text: Array.isArray(issue.contextFields) && issue.contextFields.length ? issue.contextFields.join(', ') : '', tooltip: 'Affected Context fields.', show: Array.isArray(issue.contextFields) && issue.contextFields.length > 0 },
            { text: issue.winningPackId ? `winner: ${issue.winningPackId}` : '', tooltip: 'Winning pack after stack duplicate resolution.', show: !!issue.winningPackId },
        ],
    });
}

export function buildLoredeckHealthReport(state, canonDb = null, health = null) {
    const stack = getLoredeckStack(state);
    const library = new Map(getLoredeckLibrary(state).map(pack => [pack.packId, pack]));
    const loadedPacks = Array.isArray(canonDb?.loredecks) ? canonDb.loredecks : [];
    const enabledIds = new Set(loadedPacks.length
        ? loadedPacks.map(pack => pack.id).filter(Boolean)
        : resolveLoredeckStackItems(stack, getLoredeckLibraryIndexForPacks(state), {
            packs: Object.fromEntries(library.entries()),
        }).stack.map(item => item.packId).filter(Boolean));
    const packs = loadedPacks.map(loaded => {
        const libraryPack = library.get(loaded.id) || {};
        const overrideCount = libraryPack.entryOverrides && typeof libraryPack.entryOverrides === 'object' && !Array.isArray(libraryPack.entryOverrides)
            ? Object.keys(libraryPack.entryOverrides).length
            : 0;
        const disabledCount = Array.isArray(libraryPack.disabledEntryIds) ? libraryPack.disabledEntryIds.length : 0;
        return {
            packId: loaded.id,
            title: loaded.title || libraryPack.title || loaded.id,
            type: loaded.type || libraryPack.type || 'custom',
            typeLabel: getLoredeckTypeLabel(loaded.id),
            description: libraryPack.description || '',
            manifest: libraryPack.manifest || '',
            derivedFrom: libraryPack.derivedFrom?.packId || '',
            stackIndex: loaded.stackIndex,
            stackPriority: loaded.stackPriority,
            sourceKind: loaded.sourceKind,
            entryCount: loaded.entryCount || 0,
            healthStatus: loaded.healthStatus || 'unknown',
            overrideCount,
            disabledCount,
        };
    });
    const duplicateEntryIdCount = Array.isArray(canonDb?.duplicateEntryIds)
        ? canonDb.duplicateEntryIds.length
        : Number(health?.summary?.duplicateEntryIdCount || 0);
    return {
        schemaVersion: 1,
        generatedAt: Date.now(),
        scanned: !!health,
        status: health?.status || 'unknown',
        databaseId: canonDb?.databaseId || '',
        enabledPackIds: Array.from(enabledIds),
        summary: health?.summary || {},
        duplicateEntryIdCount,
        packs,
        errors: Array.isArray(health?.errors) ? health.errors : [],
        warnings: Array.isArray(health?.warnings) ? health.warnings : [],
        suggestions: Array.isArray(health?.suggestions) ? health.suggestions : [],
        insights: getLoredeckStackHealthInsights(state, loadedPacks),
    };
}

function getLoredeckStackHealthInsights(state, loadedPacks = []) {
    const stackItems = getLoredeckStack(state).filter(item => item.enabled);
    const libraryPacks = getLoredeckLibrary(state);
    const library = new Map(libraryPacks.map(pack => [pack.packId, pack]));
    const stack = resolveLoredeckStackItems(stackItems, getLoredeckLibraryIndexForPacks(state, libraryPacks), {
        packs: Object.fromEntries(library.entries()),
    }).stack;
    const loadedIds = new Set(loadedPacks.map(pack => pack.id));
    const issues = [];

    for (const item of stack) {
        const pack = library.get(item.packId);
        if (!pack) {
            issues.push({
                severity: 'warning',
                code: 'loaded_pack_missing_library_record',
                packId: item.packId,
                message: `Loaded deck ${item.packId} is not present in the Loredeck Library.`,
            });
            continue;
        }
        if (!loadedIds.has(item.packId)) {
            issues.push({
                severity: 'warning',
                code: 'loaded_pack_not_available',
                packId: item.packId,
                message: `Loaded deck ${item.packId} did not produce a usable Loredeck source.`,
            });
        }
    }

    const manifestGroups = new Map();
    for (const item of stack) {
        const pack = library.get(item.packId);
        const manifest = String(pack?.manifest || '').trim();
        if (!manifest) continue;
        if (!manifestGroups.has(manifest)) manifestGroups.set(manifest, []);
        manifestGroups.get(manifest).push(pack);
    }
    for (const [manifest, packs] of manifestGroups.entries()) {
        if (packs.length <= 1) continue;
        const names = packs.map(pack => pack?.title || pack?.packId).join(', ');
        const editableCount = packs.filter(pack => {
            const overrides = pack?.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
                ? Object.keys(pack.entryOverrides).length
                : 0;
            const disabled = Array.isArray(pack?.disabledEntryIds) ? pack.disabledEntryIds.length : 0;
            return overrides + disabled > 0;
        }).length;
        issues.push({
            severity: editableCount ? 'suggestion' : 'warning',
            code: editableCount ? 'shared_manifest_with_overrides' : 'likely_duplicate_pack',
            packId: packs[0]?.packId || '',
            message: editableCount
                ? `Multiple loaded packs share ${manifest}; ${editableCount} have Custom entry changes. Stack priority decides duplicate IDs.`
                : `Multiple loaded packs share ${manifest} with no Custom entry changes: ${names}. This may be an unedited duplicate load.`,
        });
    }

    for (const pack of library.values()) {
        if (!pack?.derivedFrom?.packId) continue;
        if (!stack.some(item => item.packId === pack.packId)) continue;
        const hydratedPack = isExternalLorepackPayloadBackedRecord(pack)
            ? hydrateCachedExternalLorepackPayloadRecord(pack)
            : pack;
        const overrides = hydratedPack.entryOverrides && typeof hydratedPack.entryOverrides === 'object' && !Array.isArray(hydratedPack.entryOverrides)
            ? Object.keys(hydratedPack.entryOverrides).length
            : 0;
        const disabled = Array.isArray(hydratedPack.disabledEntryIds) ? hydratedPack.disabledEntryIds.length : 0;
        if (overrides + disabled === 0) {
            issues.push({
                severity: 'warning',
                code: 'custom_duplicate_has_no_entry_changes',
                packId: pack.packId,
                message: `${pack.title || pack.packId} is derived from ${pack.derivedFrom.packId} but has no entry overrides or disabled entries.`,
            });
        }
    }
    return issues;
}

export async function refreshLoredeckHealthReport(button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Refreshing...', { fallbackLabel: 'Refresh Health' });
    try {
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        await loadCanonLoreDatabase();
        refreshLoredeckSurfaces();
    } catch (e) {
        toast(e?.message || 'Pack Health refresh failed.', 'error');
    } finally {
        restoreBusy();
    }
}

export function exportLoredeckHealthReport(state, canonDb = null, health = null) {
    if (!health) {
        toast('Pack Health has not loaded yet.', 'warning');
        return;
    }
    downloadJson(buildLoredeckHealthReport(state, canonDb, health), 'saga-pack-health.json');
}
