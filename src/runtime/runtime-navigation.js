import { getSettings } from '../state/state-manager.js';

export const TAB_LABELS = Object.freeze({
    loredecks: 'Loredecks',
    session: 'Session',
    context: 'Context',
    continuity: 'Continuity',
    lore: 'Lorecards',
    injection: 'Injection',
    settings: 'Settings',
});

export const TAB_ICONS = Object.freeze({
    loredecks: 'P',
    session: 'S',
    context: 'C',
    continuity: 'K',
    lore: 'L',
    injection: 'I',
    settings: 'O',
});

export const TAB_TOOLTIPS = Object.freeze({
    loredecks: 'Load, order, inspect, and edit Saga Loredecks.',
    session: 'Runtime overview, preset status, instructions, and active chat readiness.',
    context: 'Detect, browse, resolve, and lock story position across loaded Loredecks.',
    continuity: 'Scan, automatically track, view, and edit lightweight live continuity state: scene/timeline, active characters, key items, and active goals/threads.',
    lore: 'Open Generate, Automate, or Lore to create, automate, review, and manage Lorecards.',
    injection: 'Choose what Saga sends to the model: continuity state, lore entries, direct/compressed handling, and live split injection previews.',
    settings: 'Configure providers, runtime appearance, Saga Theme Packs, State Safety, and Danger Zone cleanup.',
});

export const AUTOMATION_MODES = Object.freeze({
    manual: Object.freeze({
        label: 'Manual',
        description: 'Story Maker and Deck Maker run when activated manually. Generated Lorecards still go to Pending Review in the Lorecards tab. Source-change canon analysis remains automatic when Layer 1 is enabled.',
        settings: Object.freeze({
            autoExtract: false,
            autoApplyDelta: false,
            autoGenerateLore: false,
            continuityTrackingMode: 'manual',
            contextDetectionMode: 'manual',
            loreGenerationMode: 'manual',
        }),
    }),

});

export const BASIC_EXPERIENCE_TABS = Object.freeze(['loredecks', 'session', 'context', 'lore', 'settings']);
export const ADVANCED_EXPERIENCE_TABS = Object.freeze(Object.keys(TAB_LABELS));

export function normalizeTab(tab) {
    return Object.prototype.hasOwnProperty.call(TAB_LABELS, tab) ? tab : 'session';
}

export function getVisibleTabsForExperience(settings = getSettings()) {
    return normalizeExperienceMode(settings?.experienceMode) === 'basic'
        ? BASIC_EXPERIENCE_TABS
        : ADVANCED_EXPERIENCE_TABS;
}

export function getTabLabelForExperience(tab, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(tab);
    return TAB_LABELS[normalized] || 'Saga';
}

export function getTabTooltipForExperience(tab, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(tab);
    return TAB_TOOLTIPS[normalized] || 'Saga runtime drawer.';
}

export function isBasicExperience(settings = getSettings()) {
    return normalizeExperienceMode(settings?.experienceMode) === 'basic';
}

export function normalizeTabForExperience(tab, settings = getSettings()) {
    const normalized = normalizeTab(tab);
    return getVisibleTabsForExperience(settings).includes(normalized) ? normalized : 'session';
}

export function normalizeAutomationMode(mode) {
    return Object.prototype.hasOwnProperty.call(AUTOMATION_MODES, mode) ? mode : 'manual';
}

export function normalizeExperienceMode(mode) {
    return mode === 'advanced' ? 'advanced' : 'basic';
}

export function getAutomationLabel(settings) {
    return AUTOMATION_MODES[normalizeAutomationMode(settings?.automationMode || settings?.workflowMode)].label;
}

export function getAutomationTooltip(settings) {
    return AUTOMATION_MODES[normalizeAutomationMode(settings?.automationMode || settings?.workflowMode)].description;
}

export function getExperienceLabel(settings) {
    return normalizeExperienceMode(settings?.experienceMode) === 'advanced' ? 'Advanced' : 'Basic';
}

export function getExperienceTooltip(settings) {
    return normalizeExperienceMode(settings?.experienceMode) === 'advanced'
        ? 'Advanced Experience gives you detailed control over Saga behavior.'
        : 'Basic Experience keeps Saga focused on the main roleplay workflow.';
}
