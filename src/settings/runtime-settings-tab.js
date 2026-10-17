import { getSettings, getStateSafety, saveSettings } from '../state/state-manager.js';
import {
    addTooltip,
    createButton,
} from '../ui/runtime-ui-kit.js';
import { isBasicExperience } from '../runtime/runtime-navigation.js';
import { createExperienceModeSwitch } from '../runtime/runtime-shell-view.js';
import { getActiveThemeColors, getThemePackLibrary, getThemePreset } from '../theme/runtime-theme.js';
import {
    createBasicProviderQuickSetupCard,
    createProviderSettingsCard,
    getProviderStatusText,
} from './settings-panel.js';
import {
    createActiveThemePanel,
    createInstalledThemePackGallery,
    createThemeAdvancedPanel,
    createThemeColorOverridesPanel,
    createThemeIconSetPanel,
} from './theme-panel.js';
import { createThemePanelOptions } from './theme-actions.js';

let runtimeSettingsTabDeps = {};

export function configureRuntimeSettingsTab(deps = {}) {
    runtimeSettingsTabDeps = { ...runtimeSettingsTabDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = runtimeSettingsTabDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Runtime Settings tab dependency is not configured: ${name}`);
}

function createCollapsibleSection(...args) { return dep('createCollapsibleSection')(...args); }
function createDangerZoneCard(state) { return dep('createDangerZoneCard')(state); }
function createStateSafetyCard(state) { return dep('createStateSafetyCard')(state); }
function markTourTarget(element, target) { return dep('markTourTarget', value => value)(element, target); }

function appendDangerZoneCard(container, state) {
    container.appendChild(markTourTarget(createDangerZoneCard(state), 'settings.dangerZone'));
}

export function renderSettingsTab(container, state) {
    void state;
    const settings = getSettings();
    const basic = isBasicExperience(settings);
    container.appendChild(createExperienceModeSettingsCard(settings));
    if (basic) {
        container.appendChild(markTourTarget(createCollapsibleSection(
            'settings.providers',
            'Providers',
            `${getProviderStatusText('lore', settings)} / ${getProviderStatusText('continuity', settings)}`,
            true,
            createBasicProviderQuickSetupCard(settings),
            { tooltip: 'Check providers needed for model-backed Saga actions without exposing advanced provider tuning.' }
        ), 'settings.providers'));

        container.appendChild(markTourTarget(createCollapsibleSection(
            'settings.themePack',
            'Theme Pack',
            getThemePreset(settings.themePackId, settings)?.title || 'Theme',
            true,
            createThemeSettingsCard(settings),
            { tooltip: 'Manage Theme Packs, icon sets, and color overrides.' }
        ), 'settings.themePack'));

        appendDangerZoneCard(container, state);

        return;
    }

    container.appendChild(markTourTarget(createCollapsibleSection(
        'settings.providers',
        'Providers',
        'Utility and Reasoning model settings',
        true,
        createProviderSettingsCard(settings),
        { tooltip: 'Configure model providers used by Saga generation, Context detection, compression, and continuity workflows.' }
    ), 'settings.providers'));

    container.appendChild(markTourTarget(createCollapsibleSection(
        'settings.themePack',
        'Theme Pack',
        getThemePreset(settings.themePackId)?.title || 'Theme',
        false,
        createThemeSettingsCard(settings),
        { tooltip: 'Manage Theme Packs, icon sets, and color overrides.' }
    ), 'settings.themePack'));

    container.appendChild(markTourTarget(createCollapsibleSection(
        'settings.stateSafety',
        'State Safety',
        `${getStateSafety(state).backups.length} backup${getStateSafety(state).backups.length === 1 ? '' : 's'}`,
        false,
        createStateSafetyCard(state),
        { tooltip: 'Export, restore, and inspect Saga state backups and schema-normalization logs.' }
    ), 'settings.stateSafety'));

    appendDangerZoneCard(container, state);
}

function createExperienceModeSettingsCard(settings = getSettings()) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-settings-experience-card';
    markTourTarget(card, 'settings.experienceMode');

    const title = document.createElement('h4');
    title.textContent = 'Experience Mode';
    addTooltip(title, 'Basic keeps the interface focused. Advanced exposes every runtime workspace.');
    card.appendChild(title);

    card.appendChild(createExperienceModeSwitch(settings, { tourTarget: 'settings.experienceMode' }));
    return card;
}

export function createThemeSettingsCard(settings = getSettings()) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-settings-theme-card';
    const themeLibrary = getThemePackLibrary(settings);
    const activePreset = getThemePreset(settings.themePackId, settings);
    const colors = getActiveThemeColors(settings);
    const themePanelOptions = createThemePanelOptions();

    const header = document.createElement('div');
    header.className = 'saga-theme-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-theme-header-title-wrap';
    const icon = document.createElement('div');
    icon.className = 'saga-theme-header-icon';
    icon.textContent = 'T';
    titleWrap.appendChild(icon);
    const textWrap = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = 'Theme Pack';
    textWrap.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'JSON-only appearance presets for colors, surfaces, and shelf tab icons. Theme packs cannot run code.';
    textWrap.appendChild(help);
    titleWrap.appendChild(textWrap);
    header.appendChild(titleWrap);

    const topActions = document.createElement('div');
    topActions.className = 'saga-primary-actions saga-theme-header-actions';
    topActions.appendChild(createButton('Import Theme Pack', 'Install a user-made JSON Theme Pack into the local library.', () => {
        themePanelOptions.onImportThemePack?.();
    }, 'saga-primary-button'));
    topActions.appendChild(createButton('Export Active Theme', 'Download the active theme as a Custom Theme Pack JSON file.', () => {
        themePanelOptions.onExportActiveThemePack?.();
    }));
    topActions.appendChild(createButton('Reset Theme', 'Restore the bundled Saga Archive Theme Pack and clear color overrides.', () => {
        themePanelOptions.onResetThemeSettings?.();
    }));
    header.appendChild(topActions);
    card.appendChild(header);

    const topGrid = document.createElement('div');
    topGrid.className = 'saga-theme-top-grid';
    topGrid.appendChild(createActiveThemePanel(activePreset, settings, colors, themePanelOptions));
    card.appendChild(topGrid);

    const middleGrid = document.createElement('div');
    middleGrid.className = 'saga-theme-middle-grid';
    middleGrid.appendChild(createInstalledThemePackGallery(themeLibrary, activePreset, settings, themePanelOptions));
    middleGrid.appendChild(createThemeColorOverridesPanel(settings, activePreset, colors, themePanelOptions));
    card.appendChild(middleGrid);

    const lowerGrid = document.createElement('div');
    lowerGrid.className = 'saga-theme-lower-grid';
    lowerGrid.appendChild(createThemeIconSetPanel(activePreset, settings, themePanelOptions));
    card.appendChild(lowerGrid);

    card.appendChild(createThemeAdvancedPanel(settings, activePreset, colors, themePanelOptions));
    return card;
}
