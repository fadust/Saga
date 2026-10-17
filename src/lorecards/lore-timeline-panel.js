import {
    getLoreTimelineEvents,
    getLoreTimelineSummary,
} from './lore-timeline.js';
import {
    addTooltip,
    confirmAction,
    createButton,
    createChip,
    createCompactPresetStat,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';
import {
    getLocalAssetSrc,
} from '../theme/runtime-theme.js';

let loreTimelinePanelDeps = {};

export function configureLoreTimelinePanel(deps = {}) {
    loreTimelinePanelDeps = { ...loreTimelinePanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = loreTimelinePanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Lore Timeline panel dependency is not configured: ${name}`);
}

function isBasicExperience() {
    return dep('isBasicExperience', () => false)();
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

function getState() {
    return dep('getState', () => ({}))();
}

function refreshPanelBody(options = {}) {
    return dep('refreshPanelBody', () => null)(options);
}

function refreshHeader() {
    return dep('refreshHeader', () => null)();
}

function refreshLoreWorkbench() {
    return dep('refreshLoreWorkbench', () => null)();
}

function getRecoverableTimelineEntries(event) {
    return dep('getRecoverableTimelineEntries', () => [])(event);
}

function restoreLoreTimelineEntriesToPending(eventId) {
    return dep('restoreLoreTimelineEntriesToPending', () => ({ restored: 0 }))(eventId);
}

function toast(message, type) {
    return dep('toast', () => null)(message, type);
}

export function createLoreTimelineCard(state) {
    const basic = isBasicExperience();
    const summary = getLoreTimelineSummary(state);
    const counts = summary.counts || {};
    const latest = summary.latest;
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-lore-timeline-card';
    markTourTarget(card, 'lore.timeline');

    const top = document.createElement('div');
    top.className = 'saga-lore-timeline-card-top';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = basic ? 'Lore Tools' : 'Lore Timeline';
    addTooltip(title, basic ? 'Draft manual notes and review suggested/generated entries below.' : 'Story-aware audit trail for Accepted Lorecards changes and recoverable lore versions.');
    top.appendChild(title);
    if (!basic) {
        top.appendChild(createStatusPill(summary.eventCount ? `${summary.eventCount} events` : 'No events', 'Lore timeline event count for this chat.', { tone: summary.eventCount ? 'source' : 'muted', kind: 'count' }));
    }
    card.appendChild(top);

    if (!basic) {
        const stats = document.createElement('div');
        stats.className = 'saga-lore-timeline-stats';
        stats.appendChild(createCompactPresetStat('Added', `+${counts.added || 0}`));
        stats.appendChild(createCompactPresetStat('Deleted', `-${counts.deleted || 0}`));
        stats.appendChild(createCompactPresetStat('Updated', String(counts.updated || 0)));
        stats.appendChild(createCompactPresetStat('Restored', String(counts.restored || 0)));
        card.appendChild(stats);

        const rail = document.createElement('div');
        rail.className = 'saga-lore-timeline-mini-rail';
        const events = getLoreTimelineEvents(state).slice(-18);
        if (events.length) {
            for (const event of events) {
                const tick = document.createElement('span');
                tick.className = `saga-lore-timeline-mini-tick ${getLoreTimelineEventClass(event)}`.trim();
                addTooltip(tick, event.summary || event.type);
                rail.appendChild(tick);
            }
        } else {
            const empty = document.createElement('span');
            empty.className = 'saga-lore-timeline-mini-empty';
            empty.textContent = 'No Accepted Lorecards changes recorded yet.';
            rail.appendChild(empty);
        }
        card.appendChild(rail);
    }

    const foot = document.createElement('div');
    foot.className = 'saga-lore-timeline-card-foot';
    const latestText = document.createElement('div');
    latestText.className = 'saga-lore-timeline-latest';
    latestText.textContent = basic
        ? 'Draft a Manual Lore Note, or use the generation tools below to add reviewable lore.'
        : (latest ? `Last: ${latest.summary || latest.type}` : 'Manual notes, Accepted Lorecards changes, and recoveries will appear here.');
    foot.appendChild(latestText);
    const actions = document.createElement('div');
    actions.className = 'saga-lore-timeline-actions';
    if (!basic) {
        actions.appendChild(markTourTarget(createButton('Open Timeline', 'Open the full Lore Timeline workbench.', () => {
            openLoreTimeline();
        }), 'lore.timeline.open'));
    }
    foot.appendChild(actions);
    card.appendChild(foot);
    return card;
}

export function getLoreTimelineEventClass(event = {}) {
    const counts = event.counts || {};
    if (counts.deleted > 0 || /delete|remove/i.test(event.type || '')) return 'saga-lore-timeline-event-delete';
    if (counts.restored > 0 || /restore|recover/i.test(event.type || '')) return 'saga-lore-timeline-event-restore';
    if (counts.updated > 0 || counts.elevated > 0 || counts.muted > 0 || /edit|relevance|elevate|mute|metadata/i.test(event.type || '')) return 'saga-lore-timeline-event-update';
    if (counts.pending > 0 || /pending|generate/i.test(event.type || '')) return 'saga-lore-timeline-event-pending';
    return 'saga-lore-timeline-event-add';
}
const LORE_TIMELINE_ID = 'saga-lore-timeline';
const LORE_TIMELINE_MIN_VIEW_MESSAGES = 20;
const LORE_TIMELINE_DEFAULT_VIEW_MESSAGES = 520;
const LORE_TIMELINE_MAX_MAIN_TICKS = 900;
const LORE_TIMELINE_MAX_MINIMAP_TICKS = 1200;

const LORE_TIMELINE_NODE_FILTERS = [
    { id: 'canon_lore', label: 'Canon', short: 'C', color: '#d8a84f' },
    { id: 'story_lore', label: 'Story Lore', short: 'S', color: '#b889ff' },
    { id: 'canon_divergence', label: 'Divergences', short: 'D', color: '#d45a3e' },
    { id: 'character_knowledge', label: 'Knowledge', short: 'K', color: '#6cc0bf' },
    { id: 'location_lore', label: 'Locations', short: 'L', color: '#4d92d8' },
    { id: 'relationship_change', label: 'Relationships', short: 'R', color: '#d18b8b' },
    { id: 'timeline_event', label: 'Timeline Events', short: 'T', color: '#d49c43' },
    { id: 'object_lore', label: 'Objects', short: 'O', color: '#bda463' },
    { id: 'resolved_continuity', label: 'Resolved', short: 'OK', color: '#7ca65a' },
];

const LORE_TIMELINE_NODE_ICON_PATHS = {
    canon_lore: './assets/lore-timeline-icons/canon_lore.svg',
    story_lore: './assets/lore-timeline-icons/story_lore.svg',
    canon_divergence: './assets/lore-timeline-icons/canon_divergence.svg',
    character_knowledge: './assets/lore-timeline-icons/character_knowledge.svg',
    location_lore: './assets/lore-timeline-icons/location_lore.svg',
    relationship_change: './assets/lore-timeline-icons/relationship_change.svg',
    timeline_event: './assets/lore-timeline-icons/timeline_event.svg',
    object_lore: './assets/lore-timeline-icons/object_lore.svg',
    resolved_continuity: './assets/lore-timeline-icons/resolved_continuity.svg',
};

const LORE_TIMELINE_SENDER_PALETTE = [
    '#f2e2bd',
    '#3f8bdc',
    '#b8453d',
    '#bd7e3b',
    '#6a8d49',
    '#5f8680',
    '#8169d8',
    '#c98a52',
    '#9ca6c9',
    '#d0b05e',
];

let loreTimelineOpen = false;
let loreTimelineSelectedId = '';
let loreTimelineViewport = null;
let loreTimelineActiveFilters = new Set(LORE_TIMELINE_NODE_FILTERS.map(filter => filter.id));

export function openLoreTimeline() {
    loreTimelineOpen = true;
    const events = getLoreTimelineEvents(getState());
    if (!loreTimelineSelectedId || !events.some(event => event.id === loreTimelineSelectedId)) {
        loreTimelineSelectedId = events[events.length - 1]?.id || '';
    }
    renderLoreTimeline();
}

export function closeLoreTimeline() {
    loreTimelineOpen = false;
    const existing = document.getElementById(LORE_TIMELINE_ID);
    existing?.remove();
}

export function refreshLoreTimeline() {
    if (loreTimelineOpen) renderLoreTimeline();
}

function renderLoreTimeline() {
    if (!loreTimelineOpen) return;
    hideContinuityTooltip();
    let overlay = document.getElementById(LORE_TIMELINE_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = LORE_TIMELINE_ID;
        overlay.className = 'saga-lore-timeline-overlay';
        wireOverlayBackdropClose(overlay, closeLoreTimeline);
        document.body.appendChild(overlay);
    }
    overlay.replaceChildren();

    const state = getState();
    const events = getLoreTimelineEvents(state);
    const summary = getLoreTimelineSummary(state);
    const model = buildLoreTimelineVisualizerModel(state, events);
    ensureLoreTimelineViewport(model.messages.length);
    const selected = events.find(event => event.id === loreTimelineSelectedId) || events[events.length - 1] || null;
    if (selected) loreTimelineSelectedId = selected.id;
    const selectedNode = model.nodes.find(node => node.event.id === loreTimelineSelectedId) || null;
    const visibleNodes = model.nodes.filter(node => isLoreTimelineFilterActive(node.type));
    const visibleEventIds = new Set(visibleNodes.map(node => node.event.id));

    const shell = document.createElement('div');
    shell.className = 'saga-lore-timeline-shell';
    overlay.appendChild(shell);

    shell.appendChild(createLoreTimelineFilterBar(model, summary));

    const stage = document.createElement('div');
    stage.className = 'saga-continuity-stage';
    shell.appendChild(stage);

    const graphWrap = document.createElement('div');
    graphWrap.className = 'saga-continuity-graph-wrap';
    graphWrap.appendChild(createLoreTimelineGraph(model, visibleNodes, selectedNode));
    graphWrap.appendChild(createLoreTimelineRuler(model));
    graphWrap.appendChild(createLoreTimelineMinimap(model, visibleNodes));
    graphWrap.appendChild(createLoreTimelineGraphControls(model));
    stage.appendChild(graphWrap);

    stage.appendChild(createLoreTimelineLegend(model, visibleNodes, summary));

    const body = document.createElement('div');
    body.className = 'saga-lore-timeline-body saga-continuity-detail-body';
    shell.appendChild(body);

    const list = document.createElement('div');
    list.className = 'saga-lore-timeline-event-list';
    const listedEvents = [...events].reverse().filter(event => !model.nodes.length || visibleEventIds.has(event.id));
    if (!events.length) {
        list.appendChild(createEmptyMessage('No lore timeline events yet. Create, accept, edit, or delete lore to begin the audit trail.'));
    } else if (!listedEvents.length) {
        list.appendChild(createEmptyMessage('No lore nodes match the active filters.'));
    } else {
        for (const event of listedEvents) {
            list.appendChild(createLoreTimelineEventRow(event, event.id === loreTimelineSelectedId));
        }
    }
    body.appendChild(list);

    const detail = document.createElement('div');
    detail.className = 'saga-lore-timeline-detail';
    detail.appendChild(createLoreTimelineEventDetail(selected));
    body.appendChild(detail);
}

function createLoreTimelineFilterBar(model, summary) {
    const bar = document.createElement('div');
    bar.className = 'saga-continuity-filter-bar';

    const heading = document.createElement('div');
    heading.className = 'saga-continuity-heading';
    const label = document.createElement('div');
    label.className = 'saga-continuity-filter-label';
    label.textContent = 'Lore Timeline Visualizer';
    heading.appendChild(label);
    heading.appendChild(createStatusPill(`${summary.eventCount || 0} lore nodes | +${summary.counts.added || 0} added | -${summary.counts.deleted || 0} deleted | ${summary.counts.updated || 0} updated`, 'Lore Timeline event summary for the current chat.', {
        tone: summary.eventCount ? 'source' : 'muted',
        kind: 'count',
        density: 'compact',
        className: 'saga-continuity-status',
        maxChars: 72,
    }));
    bar.appendChild(heading);

    const chips = document.createElement('div');
    chips.className = 'saga-continuity-filter-chips';
    for (const filter of LORE_TIMELINE_NODE_FILTERS) {
        const count = model.nodes.filter(node => node.type === filter.id).length;
        const chip = createChip({
            label: `${filter.short} ${filter.label}${count ? ` ${count}` : ''}`,
            tooltip: `Toggle ${filter.label} nodes in the timeline graph.`,
            kind: 'tag',
            tone: isLoreTimelineFilterActive(filter.id) ? 'selected' : 'muted',
            density: 'touch',
            interactive: true,
            className: 'saga-continuity-filter-chip',
        });
        chip.addEventListener('click', () => {
            if (isLoreTimelineFilterActive(filter.id)) loreTimelineActiveFilters.delete(filter.id);
            else loreTimelineActiveFilters.add(filter.id);
            renderLoreTimeline();
        });
        chips.appendChild(chip);
    }
    bar.appendChild(chips);

    const actions = document.createElement('div');
    actions.className = 'saga-continuity-header-actions';
    actions.appendChild(createButton('Close', 'Close Lore Timeline.', closeLoreTimeline));
    bar.appendChild(actions);
    return bar;
}

function isLoreTimelineFilterActive(type) {
    if (!(loreTimelineActiveFilters instanceof Set)) {
        loreTimelineActiveFilters = new Set(LORE_TIMELINE_NODE_FILTERS.map(filter => filter.id));
    }
    return loreTimelineActiveFilters.has(type);
}

function buildLoreTimelineVisualizerModel(state, events) {
    const messages = buildLoreTimelineMessages(events);
    const senderMap = new Map();
    for (const message of messages) {
        if (!senderMap.has(message.senderId)) {
            senderMap.set(message.senderId, {
                id: message.senderId,
                name: message.senderName,
                type: message.senderType,
                color: resolveLoreTimelineSenderColor(message.senderId, message.senderType, senderMap.size),
            });
        }
    }
    for (const message of messages) {
        message.color = senderMap.get(message.senderId)?.color || '#f2e2bd';
    }
    const messageCount = Math.max(1, messages.length);
    const nodes = events.map((event, index) => createLoreTimelineNode(event, index, messageCount));
    const connections = buildLoreTimelineConnections(nodes);
    const milestones = buildLoreTimelineMilestones(state, messageCount);
    const wordStats = computeTimelineWordStats(messages);
    return {
        messages,
        senders: Array.from(senderMap.values()),
        nodes,
        connections,
        milestones,
        maxWordCount: wordStats.max,
        wordScaleMax: wordStats.scaleMax,
        wordStats,
    };
}

function computeTimelineWordStats(messages = []) {
    const values = messages
        .map(message => Math.max(1, Number(message.wordCount) || 1))
        .sort((a, b) => a - b);
    if (!values.length) return { max: 1, median: 1, p90: 1, p95: 1, average: 1, scaleMax: 1 };
    const percentile = pct => values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * pct)))];
    const max = values[values.length - 1];
    const median = percentile(0.5);
    const p90 = percentile(0.9);
    const p95 = percentile(0.95);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const robustCap = Math.max(40, p95, median * 2.5, average * 1.5);
    return {
        max,
        median,
        p90,
        p95,
        average,
        scaleMax: Math.max(1, Math.min(max, Math.round(robustCap))),
    };
}

function buildLoreTimelineMessages(events = []) {
    const chat = getSillyTavernChatMessages();
    if (chat.length) {
        return chat.map((message, index) => {
            const text = getTimelineMessageText(message);
            const header = extractTimelineSagaHeader(text);
            const sampleText = header?.body || text;
            const sender = getTimelineMessageSender(message, index);
            return {
                id: String(message?.id || message?.swipe_id || `message_${index + 1}`),
                index: index + 1,
                senderId: sender.id,
                senderName: sender.name,
                senderType: sender.type,
                wordCount: countTimelineWords(sampleText),
                preview: compactTimelineText(sampleText, 260),
                detectedDateTime: header?.dateTime || '',
                timestamp: message?.send_date || message?.extra?.timestamp || '',
            };
        });
    }
    const maxAnchor = Math.max(1, ...events.map(event => Number(event.messageRange?.latest || event.messageRange?.end || event.messageRange?.start) || 0));
    return Array.from({ length: maxAnchor }, (_, index) => ({
        id: `message_${index + 1}`,
        index: index + 1,
        senderId: 'unknown',
        senderName: 'Unknown / Offline',
        senderType: 'system',
        wordCount: 1,
        preview: 'Chat message unavailable in this context.',
        detectedDateTime: '',
        timestamp: '',
    }));
}

function getSillyTavernChatMessages() {
    try {
        if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') return [];
        const chat = SillyTavern.getContext()?.chat;
        return Array.isArray(chat) ? chat : [];
    } catch (_) {
        return [];
    }
}

function getTimelineMessageText(message) {
    for (const value of [message?.mes, message?.message, message?.text, message?.content]) {
        if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
}

function extractTimelineSagaHeader(text) {
    const raw = String(text || '');
    const match = raw.match(/^\s*\*?\s*([A-Za-z]+,\s+[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s*\|\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*\|[^*\n]*(?:\*|\n|$)/i);
    if (!match) return null;
    const headerText = match[0];
    const body = raw.slice(headerText.length).replace(/^\s+/, '');
    return {
        date: match[1].trim(),
        time: match[2].trim(),
        dateTime: `${match[1].trim()} | ${match[2].trim()}`,
        body,
    };
}

function getTimelineMessageSender(message, index) {
    if (message?.is_user) return { id: 'user', name: 'You', type: 'user' };
    const rawName = String(message?.name || message?.ch_name || '').trim();
    if (rawName && !isTimelineSystemSenderName(rawName)) {
        const key = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'story';
        const type = /narrator|story/i.test(rawName) ? 'narrator' : 'character';
        return { id: `${type}:${key}`, name: rawName, type };
    }
    if (message?.is_system || message?.extra?.type === 'system') return { id: 'system', name: rawName || 'System', type: 'system' };
    const name = rawName || (index === 0 ? 'Narrator / Story' : 'Story');
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'story';
    const type = /narrator|story/i.test(name) ? 'narrator' : 'character';
    return { id: `${type}:${key}`, name, type };
}

function isTimelineSystemSenderName(name) {
    return /^(system|lore engine|saga|saga continuity)$/i.test(String(name || '').trim());
}

function countTimelineWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length || 1;
}

function compactTimelineText(text, max = 160) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, Math.max(0, max - 3))}...`;
}

function resolveLoreTimelineSenderColor(senderId, senderType, ordinal) {
    if (senderType === 'user') return '#f2e2bd';
    if (senderType === 'narrator') return '#3f8bdc';
    if (senderType === 'system') return '#8169d8';
    const hash = hashTimelineString(senderId);
    return LORE_TIMELINE_SENDER_PALETTE[(hash + ordinal) % LORE_TIMELINE_SENDER_PALETTE.length] || '#d0b05e';
}

function hashTimelineString(value) {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function createLoreTimelineNode(event, ordinal, messageCount) {
    const messageIndex = clampMessageIndex(Number(event.messageRange?.latest || event.messageRange?.end || event.messageRange?.start) || messageCount, messageCount);
    const type = classifyLoreTimelineNodeType(event);
    const filter = LORE_TIMELINE_NODE_FILTERS.find(item => item.id === type) || LORE_TIMELINE_NODE_FILTERS[1];
    const counts = event.counts || {};
    const weight = Math.max(1, counts.added || 0, counts.deleted || 0, counts.updated || 0, counts.pending || 0, counts.restored || 0);
    const lane = ordinal % 2 === 0 ? -1 : 1;
    return {
        id: event.id,
        event,
        type,
        label: filter.label,
        short: filter.short,
        color: filter.color,
        messageIndex,
        importance: Math.max(1, Math.min(5, Math.ceil(Math.sqrt(weight)))),
        lane,
        refs: Array.isArray(event.refs) ? event.refs : [],
    };
}

function classifyLoreTimelineNodeType(event = {}) {
    const type = String(event.type || '').toLowerCase();
    const source = String(event.source || '').toLowerCase();
    const refs = Array.isArray(event.refs) ? event.refs : [];
    const categories = refs.map(ref => String(ref.category || '').toLowerCase());
    if (/restore|recover|resolved/.test(type)) return 'resolved_continuity';
    if (/delete|remove|diverg/.test(type)) return 'canon_divergence';
    if (/canon/.test(type) || /canon/.test(source) || refs.some(ref => ref.canon === 'canon')) return 'canon_lore';
    if (categories.some(category => ['relationship', 'faction'].includes(category))) return 'relationship_change';
    if (categories.some(category => ['location', 'place'].includes(category))) return 'location_lore';
    if (categories.some(category => ['timeline', 'event'].includes(category))) return 'timeline_event';
    if (categories.some(category => ['character', 'knowledge', 'secret'].includes(category))) return 'character_knowledge';
    if (categories.some(category => ['item', 'artifact', 'spell', 'object'].includes(category))) return 'object_lore';
    if (/relevance|knowledge|elevate|mute|edit|metadata/.test(type)) return 'character_knowledge';
    return 'story_lore';
}

function buildLoreTimelineConnections(nodes) {
    const connections = [];
    const lastByRef = new Map();
    for (const node of nodes) {
        const refIds = node.refs.map(ref => ref.id).filter(Boolean);
        for (const refId of refIds) {
            const prior = lastByRef.get(refId);
            if (prior && prior.id !== node.id) {
                connections.push({
                    id: `${prior.id}_${node.id}_${refId}`,
                    sourceId: prior.id,
                    targetId: node.id,
                    relation: node.type === 'canon_divergence' ? 'contradicts' : node.type === 'resolved_continuity' ? 'resolves' : 'updates',
                    strength: 0.72,
                });
            }
            lastByRef.set(refId, node);
        }
    }
    return connections.slice(-80);
}

function buildLoreTimelineMilestones(state, messageCount) {
    const context = state?.loreContext || {};
    const milestones = [
        { id: 'start', label: 'Start', messageIndex: 1 },
    ];
    if (messageCount >= 300) milestones.push({ id: 'act_i', label: 'Act I', messageIndex: Math.max(1, Math.round(messageCount * 0.2)) });
    if (messageCount >= 900) milestones.push({ id: 'midpoint', label: 'Midpoint', messageIndex: Math.max(1, Math.round(messageCount * 0.5)) });
    if (context.sceneDate) milestones.push({ id: 'scene_date', label: context.sceneDate, messageIndex: Math.max(1, Math.round(messageCount * 0.75)) });
    milestones.push({ id: 'current', label: 'Current', messageIndex: messageCount });
    return milestones;
}

function ensureLoreTimelineViewport(messageCount) {
    const total = Math.max(1, messageCount || 1);
    if (!loreTimelineViewport || !Number.isFinite(loreTimelineViewport.start) || !Number.isFinite(loreTimelineViewport.end)) {
        const span = Math.min(total, LORE_TIMELINE_DEFAULT_VIEW_MESSAGES);
        loreTimelineViewport = { start: Math.max(1, total - span + 1), end: total };
        return;
    }
    setLoreTimelineViewport(loreTimelineViewport.start, loreTimelineViewport.end, total);
}

function setLoreTimelineViewport(start, end, messageCount) {
    const total = Math.max(1, messageCount || 1);
    const requestedStart = Math.round(start);
    const requestedEnd = Math.round(end);
    let span = Math.max(LORE_TIMELINE_MIN_VIEW_MESSAGES, requestedEnd - requestedStart + 1);
    span = Math.min(total, span);
    let nextStart = requestedStart;
    if (nextStart < 1) nextStart = 1;
    if (nextStart + span - 1 > total) nextStart = Math.max(1, total - span + 1);
    const nextEnd = Math.min(total, nextStart + span - 1);
    loreTimelineViewport = { start: nextStart, end: nextEnd };
}

function keepLoreTimelineIndexVisible(index, messageCount) {
    ensureLoreTimelineViewport(messageCount);
    const current = loreTimelineViewport;
    if (!current || (index >= current.start && index <= current.end)) return;
    const span = current.end - current.start + 1;
    const start = Math.round(index - span / 2);
    setLoreTimelineViewport(start, start + span - 1, messageCount);
}

function panLoreTimeline(delta, messageCount) {
    ensureLoreTimelineViewport(messageCount);
    const span = loreTimelineViewport.end - loreTimelineViewport.start + 1;
    setLoreTimelineViewport(loreTimelineViewport.start + delta, loreTimelineViewport.start + delta + span - 1, messageCount);
}

function zoomLoreTimeline(factor, messageCount, anchorIndex = null) {
    ensureLoreTimelineViewport(messageCount);
    const current = loreTimelineViewport;
    const total = Math.max(1, messageCount || 1);
    const oldSpan = current.end - current.start + 1;
    const newSpan = Math.max(LORE_TIMELINE_MIN_VIEW_MESSAGES, Math.min(total, Math.round(oldSpan * factor)));
    const anchor = anchorIndex || Math.round((current.start + current.end) / 2);
    const ratio = oldSpan <= 1 ? 0.5 : (anchor - current.start) / oldSpan;
    const start = Math.round(anchor - newSpan * ratio);
    setLoreTimelineViewport(start, start + newSpan - 1, total);
}

function clampMessageIndex(value, messageCount) {
    const total = Math.max(1, messageCount || 1);
    return Math.max(1, Math.min(total, Math.round(value) || total));
}

function createLoreTimelineGraph(model, nodes, selectedNode) {
    const svg = createTimelineSvg(1180, 180, 'saga-continuity-main-svg', 'xMidYMid meet');
    svg.setAttribute('aria-label', 'Continuity message timeline graph');
    const viewport = loreTimelineViewport || { start: 1, end: Math.max(1, model.messages.length) };
    const width = 1180;
    const height = 180;
    const padX = 44;
    const baselineY = 90;
    const innerWidth = width - padX * 2;
    const visibleSpan = Math.max(1, viewport.end - viewport.start);
    const indexToX = index => padX + ((index - viewport.start) / visibleSpan) * innerWidth;

    svg.appendChild(createTimelineSvgEl('rect', { x: 0, y: 0, width, height, rx: 12, class: 'saga-continuity-svg-bg' }));
    svg.appendChild(createTimelineSvgEl('line', { x1: padX, y1: baselineY, x2: width - padX, y2: baselineY, class: 'saga-continuity-baseline' }));

    const visibleMessages = model.messages.filter(message => message.index >= viewport.start && message.index <= viewport.end);
    const stride = Math.max(1, Math.ceil(visibleMessages.length / LORE_TIMELINE_MAX_MAIN_TICKS));
    visibleMessages.forEach((message, i) => {
        if (i % stride !== 0) return;
        const x = indexToX(message.index);
        const scaled = Math.sqrt(Math.min(Math.max(1, message.wordCount), model.wordScaleMax || model.maxWordCount) / Math.max(1, model.wordScaleMax || model.maxWordCount));
        const tickHeight = 4 + scaled * 52;
        const line = createTimelineSvgEl('line', {
            x1: x,
            y1: baselineY - tickHeight / 2,
            x2: x,
            y2: baselineY + tickHeight / 2,
            class: 'saga-continuity-message-tick',
            style: `--wl-tick-color:${message.color};--wl-tick-width:${Math.min(4, 1 + scaled * 2.4)}px;`,
        });
        svg.appendChild(line);
        const hit = createTimelineSvgEl('line', {
            x1: x,
            y1: baselineY - Math.max(18, tickHeight / 2 + 6),
            x2: x,
            y2: baselineY + Math.max(18, tickHeight / 2 + 6),
            class: 'saga-continuity-message-hit',
        });
        hit.addEventListener('mouseenter', event => showTimelineMessageTooltip(event, message));
        hit.addEventListener('mousemove', event => positionContinuityTooltip(event));
        hit.addEventListener('mouseleave', hideContinuityTooltip);
        svg.appendChild(hit);
    });

    const visibleNodeMap = new Map(nodes.filter(node => node.messageIndex >= viewport.start && node.messageIndex <= viewport.end).map(node => [node.id, node]));
    for (const connection of model.connections) {
        const source = visibleNodeMap.get(connection.sourceId);
        const target = visibleNodeMap.get(connection.targetId);
        if (!source || !target) continue;
        const sx = indexToX(source.messageIndex);
        const tx = indexToX(target.messageIndex);
        const sy = getTimelineNodeY(source, baselineY);
        const ty = getTimelineNodeY(target, baselineY);
        const cy = Math.min(sy, ty) - 42;
        svg.appendChild(createTimelineSvgEl('path', {
            d: `M ${sx} ${sy} Q ${(sx + tx) / 2} ${cy} ${tx} ${ty}`,
            class: `saga-continuity-connection saga-continuity-connection-${connection.relation}`,
        }));
    }

    for (const node of visibleNodeMap.values()) {
        const x = indexToX(node.messageIndex);
        const y = getTimelineNodeY(node, baselineY);
        const radius = 9 + node.importance * 1.5;
        svg.appendChild(createTimelineSvgEl('line', {
            x1: x,
            y1: baselineY,
            x2: x,
            y2: y,
            class: 'saga-continuity-node-stem',
            style: `--wl-node-color:${node.color};`,
        }));
        const group = createTimelineSvgEl('g', {
            class: `saga-continuity-node ${selectedNode?.id === node.id ? 'saga-continuity-node-selected' : ''}`,
            tabindex: '0',
            role: 'button',
            'aria-label': `${node.label}: ${node.event.summary || node.event.type}`,
            style: `--wl-node-color:${node.color};`,
        });
        group.appendChild(createTimelineSvgTitle(`${node.label} | message ${node.messageIndex} | ${node.event.summary || node.event.type}`));
        group.appendChild(createTimelineSvgEl('circle', { cx: x, cy: y, r: radius, class: 'saga-continuity-node-ring' }));
        const iconHref = getLoreTimelineNodeIconHref(node.type);
        if (iconHref) {
            group.appendChild(createTimelineSvgEl('image', {
                href: iconHref,
                x: x - radius * 0.58,
                y: y - radius * 0.58,
                width: radius * 1.16,
                height: radius * 1.16,
                class: 'saga-continuity-node-image',
                preserveAspectRatio: 'xMidYMid meet',
            }));
        } else {
            const text = createTimelineSvgEl('text', { x, y: y + 4, class: 'saga-continuity-node-icon', 'text-anchor': 'middle' });
            text.textContent = node.short;
            group.appendChild(text);
        }
        group.addEventListener('click', () => {
            loreTimelineSelectedId = node.event.id;
            renderLoreTimeline();
        });
        group.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                loreTimelineSelectedId = node.event.id;
                renderLoreTimeline();
            }
        });
        svg.appendChild(group);
    }

    svg.addEventListener('wheel', event => {
        event.preventDefault();
        const rect = svg.getBoundingClientRect();
        const ratio = rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0.5;
        const anchor = Math.round(viewport.start + ratio * Math.max(1, viewport.end - viewport.start));
        if (event.ctrlKey || event.metaKey) zoomLoreTimeline(event.deltaY < 0 ? 0.72 : 1.28, model.messages.length, anchor);
        else panLoreTimeline(Math.round((event.deltaY || event.deltaX || 0) / 30), model.messages.length);
        renderLoreTimeline();
    }, { passive: false });
    return svg;
}

function getLoreTimelineNodeIconHref(type) {
    const path = LORE_TIMELINE_NODE_ICON_PATHS[type] || '';
    return path ? getLocalAssetSrc(path) : '';
}

function getTimelineNodeY(node, baselineY) {
    const laneGap = 32 + Math.min(18, node.importance * 5);
    return baselineY + node.lane * laneGap;
}

function createLoreTimelineRuler(model) {
    const ruler = document.createElement('div');
    ruler.className = 'saga-continuity-ruler';
    const viewport = loreTimelineViewport || { start: 1, end: model.messages.length || 1 };
    const span = Math.max(1, viewport.end - viewport.start);
    for (const milestone of model.milestones) {
        if (milestone.messageIndex < viewport.start || milestone.messageIndex > viewport.end) continue;
        const mark = document.createElement('div');
        mark.className = 'saga-continuity-ruler-mark';
        mark.style.left = `${((milestone.messageIndex - viewport.start) / span) * 100}%`;
        mark.textContent = `${milestone.label} ${milestone.messageIndex}`;
        ruler.appendChild(mark);
    }
    return ruler;
}

function createLoreTimelineMinimap(model, nodes) {
    const svg = createTimelineSvg(1180, 44, 'saga-continuity-minimap-svg', 'none');
    const total = Math.max(1, model.messages.length);
    const width = 1180;
    const height = 44;
    const padX = 28;
    const baselineY = 22;
    const innerWidth = width - padX * 2;
    const indexToX = index => padX + ((index - 1) / Math.max(1, total - 1)) * innerWidth;
    const xToIndex = x => clampMessageIndex(1 + ((Math.max(padX, Math.min(width - padX, x)) - padX) / innerWidth) * Math.max(1, total - 1), total);
    svg.appendChild(createTimelineSvgEl('rect', { x: 0, y: 0, width, height, rx: 10, class: 'saga-continuity-minimap-bg' }));
    svg.appendChild(createTimelineSvgEl('line', { x1: padX, y1: baselineY, x2: width - padX, y2: baselineY, class: 'saga-continuity-minimap-line' }));

    const stride = Math.max(1, Math.ceil(model.messages.length / LORE_TIMELINE_MAX_MINIMAP_TICKS));
    model.messages.forEach((message, i) => {
        if (i % stride !== 0) return;
        const scaled = Math.sqrt(Math.min(Math.max(1, message.wordCount), model.wordScaleMax || model.maxWordCount) / Math.max(1, model.wordScaleMax || model.maxWordCount));
        const tickHeight = 2 + scaled * 16;
        svg.appendChild(createTimelineSvgEl('line', {
            x1: indexToX(message.index),
            y1: baselineY - tickHeight / 2,
            x2: indexToX(message.index),
            y2: baselineY + tickHeight / 2,
            class: 'saga-continuity-minimap-tick',
            style: `--wl-tick-color:${message.color};`,
        }));
    });

    for (const node of nodes) {
        svg.appendChild(createTimelineSvgEl('circle', {
            cx: indexToX(node.messageIndex),
            cy: 7,
            r: 3,
            class: 'saga-continuity-minimap-node',
            style: `--wl-node-color:${node.color};`,
        }));
    }

    const viewport = loreTimelineViewport || { start: 1, end: total };
    const vx = indexToX(viewport.start);
    const vw = Math.max(10, indexToX(viewport.end) - vx);
    svg.appendChild(createTimelineSvgEl('rect', { x: vx, y: 4, width: vw, height: 36, rx: 5, class: 'saga-continuity-minimap-window' }));
    svg.appendChild(createTimelineSvgEl('rect', { x: vx - 5, y: 5, width: 10, height: 34, rx: 3, class: 'saga-continuity-minimap-handle saga-continuity-minimap-handle-left' }));
    svg.appendChild(createTimelineSvgEl('rect', { x: vx + vw - 5, y: 5, width: 10, height: 34, rx: 3, class: 'saga-continuity-minimap-handle saga-continuity-minimap-handle-right' }));

    svg.addEventListener('pointerdown', event => {
        event.preventDefault();
        const rect = svg.getBoundingClientRect();
        const localX = rect.width ? ((event.clientX - rect.left) / rect.width) * width : vx + vw / 2;
        const handleZone = 12;
        const span = viewport.end - viewport.start + 1;
        const pointerIndex = xToIndex(localX);
        const mode = Math.abs(localX - vx) <= handleZone
            ? 'resize-left'
            : Math.abs(localX - (vx + vw)) <= handleZone
                ? 'resize-right'
                : localX >= vx && localX <= vx + vw
                    ? 'drag'
                    : 'center';
        const dragOffset = pointerIndex - viewport.start;
        let lastRender = 0;
        const updateFromClientX = clientX => {
            const currentLocalX = rect.width ? ((clientX - rect.left) / rect.width) * width : vx + vw / 2;
            const index = xToIndex(currentLocalX);
            if (mode === 'resize-left') {
                resizeLoreTimelineViewport('left', index, total);
            } else if (mode === 'resize-right') {
                resizeLoreTimelineViewport('right', index, total);
            } else if (mode === 'drag') {
                const start = index - dragOffset;
                setLoreTimelineViewport(start, start + span - 1, total);
            } else {
                const start = index - Math.floor(span / 2);
                setLoreTimelineViewport(start, start + span - 1, total);
            }
            const now = Date.now();
            if (now - lastRender > 45) {
                lastRender = now;
                renderLoreTimeline();
            }
        };
        const onMove = moveEvent => updateFromClientX(moveEvent.clientX);
        const onUp = upEvent => {
            updateFromClientX(upEvent.clientX);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            renderLoreTimeline();
        };
        updateFromClientX(event.clientX);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp, { once: true });
    });
    return svg;
}

function resizeLoreTimelineViewport(edge, index, messageCount) {
    ensureLoreTimelineViewport(messageCount);
    const total = Math.max(1, messageCount || 1);
    const current = loreTimelineViewport || { start: 1, end: total };
    if (edge === 'left') {
        const start = Math.min(index, current.end - LORE_TIMELINE_MIN_VIEW_MESSAGES + 1);
        setLoreTimelineViewport(start, current.end, total);
    } else {
        const end = Math.max(index, current.start + LORE_TIMELINE_MIN_VIEW_MESSAGES - 1);
        setLoreTimelineViewport(current.start, end, total);
    }
}

function createLoreTimelineGraphControls(model) {
    const controls = document.createElement('div');
    controls.className = 'saga-continuity-graph-controls';
    controls.appendChild(createButton('Fit', 'Show the full message timeline.', () => {
        setLoreTimelineViewport(1, model.messages.length || 1, model.messages.length || 1);
        renderLoreTimeline();
    }, 'saga-small-button'));
    controls.appendChild(createButton('+', 'Zoom into the current timeline range.', () => {
        zoomLoreTimeline(0.7, model.messages.length || 1);
        renderLoreTimeline();
    }, 'saga-small-button saga-continuity-zoom-button'));
    controls.appendChild(createButton('-', 'Zoom out from the current timeline range.', () => {
        zoomLoreTimeline(1.35, model.messages.length || 1);
        renderLoreTimeline();
    }, 'saga-small-button saga-continuity-zoom-button'));
    controls.appendChild(createButton('Current', 'Jump to the latest messages.', () => {
        const total = model.messages.length || 1;
        const span = Math.min(total, loreTimelineViewport ? loreTimelineViewport.end - loreTimelineViewport.start + 1 : LORE_TIMELINE_DEFAULT_VIEW_MESSAGES);
        setLoreTimelineViewport(total - span + 1, total, total);
        renderLoreTimeline();
    }, 'saga-small-button saga-primary-button'));
    return controls;
}

function createLoreTimelineLegend(model, visibleNodes, summary) {
    const legend = document.createElement('div');
    legend.className = 'saga-continuity-legend';
    legend.appendChild(createContinuityMetric('Messages', formatInteger(model.messages.length), 'Total'));
    legend.appendChild(createContinuityMetric('Lore Nodes', formatInteger(visibleNodes.length), `${summary.eventCount || 0} total`));

    const senderBox = document.createElement('div');
    senderBox.className = 'saga-continuity-legend-box';
    const senderTitle = document.createElement('div');
    senderTitle.className = 'saga-continuity-legend-title';
    senderTitle.textContent = 'Sender Color';
    senderBox.appendChild(senderTitle);
    for (const sender of model.senders.slice(0, 9)) {
        const row = document.createElement('div');
        row.className = 'saga-continuity-legend-row';
        row.style.setProperty('--wl-sender-color', sender.color);
        row.appendChild(document.createElement('span')).className = 'saga-continuity-legend-dot';
        const text = document.createElement('span');
        text.textContent = sender.name;
        row.appendChild(text);
        senderBox.appendChild(row);
    }
    legend.appendChild(senderBox);

    const scaleBox = document.createElement('div');
    scaleBox.className = 'saga-continuity-legend-box';
    const scaleTitle = document.createElement('div');
    scaleTitle.className = 'saga-continuity-legend-title';
    scaleTitle.textContent = 'Daily Writing Volume';
    scaleBox.appendChild(scaleTitle);
    const scale = document.createElement('div');
    scale.className = 'saga-continuity-day-volume';
    const bins = buildDailyWritingBins(model.messages);
    const maxTotal = Math.max(1, ...bins.map(bin => bin.words || 0));
    const labelStride = Math.max(1, Math.ceil(bins.length / 5));
    const strip = document.createElement('div');
    strip.className = 'saga-continuity-day-volume-strip';
    strip.style.minWidth = `${Math.max(100, bins.length * 8)}px`;
    bins.forEach((bin, idx) => {
        const binEl = document.createElement('div');
        binEl.className = 'saga-continuity-day-volume-bin';
        const bar = document.createElement('span');
        const scaled = Math.sqrt((bin.words || 0) / maxTotal);
        bar.style.height = `${Math.max(2, 4 + scaled * 34)}px`;
        binEl.appendChild(bar);
        const label = document.createElement('small');
        label.textContent = idx === 0 || idx === bins.length - 1 || idx % labelStride === 0 ? bin.shortLabel : '';
        binEl.appendChild(label);
        addTooltip(binEl, `${bin.longLabel}: ${formatInteger(bin.words)} words across ${bin.messages} message${bin.messages === 1 ? '' : 's'}.`);
        strip.appendChild(binEl);
    });
    scale.appendChild(strip);
    scaleBox.appendChild(scale);
    legend.appendChild(scaleBox);
    return legend;
}

function buildDailyWritingBins(messages = []) {
    const dated = messages
        .map(message => ({ message, time: parseTimelineRealtime(message.timestamp) }))
        .filter(item => item.time);
    if (!dated.length) {
        return [{
            key: 'undated',
            shortLabel: 'No date',
            longLabel: 'No realtime dates available',
            words: messages.reduce((sum, message) => sum + (Number(message.wordCount) || 0), 0),
            messages: messages.length,
        }];
    }

    const totals = new Map();
    for (const item of dated) {
        const key = getTimelineDayKey(item.time);
        const existing = totals.get(key) || { key, time: getTimelineDayStart(item.time), words: 0, messages: 0 };
        existing.words += Number(item.message.wordCount) || 0;
        existing.messages += 1;
        totals.set(key, existing);
    }

    const starts = Array.from(totals.values()).map(item => item.time).sort((a, b) => a - b);
    const first = starts[0];
    const last = starts[starts.length - 1];
    const bins = [];
    for (let time = first; time <= last; time = addTimelineDays(time, 1)) {
        const key = getTimelineDayKey(time);
        const existing = totals.get(key) || { key, time, words: 0, messages: 0 };
        bins.push({
            ...existing,
            shortLabel: formatTimelineRealtimeDate(time),
            longLabel: new Date(time).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }),
        });
    }
    return bins;
}

function getTimelineDayStart(value) {
    const date = new Date(Number(value));
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getTimelineDayKey(value) {
    const date = new Date(Number(value));
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function addTimelineDays(value, days) {
    const date = new Date(Number(value));
    date.setDate(date.getDate() + days);
    return date.getTime();
}

function parseTimelineRealtime(value) {
    if (!value) return null;
    if (typeof value === 'number') {
        const ms = value < 1000000000000 ? value * 1000 : value;
        return Number.isFinite(ms) ? ms : null;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return parseTimelineRealtime(Number(raw));
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
}

function formatTimelineRealtimeDate(value) {
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function createContinuityMetric(label, value, sublabel) {
    const metric = document.createElement('div');
    metric.className = 'saga-continuity-metric';
    const title = document.createElement('div');
    title.textContent = label;
    metric.appendChild(title);
    const count = document.createElement('strong');
    count.textContent = value;
    metric.appendChild(count);
    const sub = document.createElement('span');
    sub.textContent = sublabel;
    metric.appendChild(sub);
    return metric;
}

function formatInteger(value) {
    return Number(value || 0).toLocaleString();
}

function createTimelineSvg(width, height, className, preserveAspectRatio = 'none') {
    const svg = createTimelineSvgEl('svg', {
        viewBox: `0 0 ${width} ${height}`,
        class: className,
        preserveAspectRatio,
    });
    return svg;
}

function createTimelineSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null) continue;
        if (key === 'class') el.setAttribute('class', value);
        else if (key === 'style') el.setAttribute('style', value);
        else el.setAttribute(key, String(value));
    }
    return el;
}

function createTimelineSvgTitle(text) {
    const title = createTimelineSvgEl('title');
    title.textContent = text || '';
    return title;
}

function showTimelineMessageTooltip(event, message) {
    const tooltip = ensureContinuityTooltip();
    tooltip.replaceChildren();
    const title = document.createElement('div');
    title.className = 'saga-continuity-tooltip-title';
    title.textContent = `Message ${message.index} | ${message.senderName}`;
    tooltip.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-continuity-tooltip-meta';
    meta.textContent = `${message.wordCount || 0} words${message.detectedDateTime ? ` | ${message.detectedDateTime}` : ''}`;
    tooltip.appendChild(meta);

    const sample = document.createElement('div');
    sample.className = 'saga-continuity-tooltip-sample';
    sample.textContent = compactTimelineSentences(message.preview || 'No message text available.', 240);
    tooltip.appendChild(sample);
    positionContinuityTooltip(event);
}

function compactTimelineSentences(text, max = 240) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    const sample = sentences?.length ? sentences.slice(0, 2).join(' ').trim() : clean;
    return compactTimelineText(sample, max);
}

function ensureContinuityTooltip() {
    let tooltip = document.querySelector('.saga-continuity-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'saga-continuity-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function positionContinuityTooltip(event) {
    const tooltip = document.querySelector('.saga-continuity-tooltip');
    if (!tooltip || !event) return;
    const margin = 12;
    const width = 280;
    const x = Math.min(window.innerWidth - width - margin, Math.max(margin, event.clientX + 14));
    const y = Math.min(window.innerHeight - 120 - margin, Math.max(margin, event.clientY + 14));
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function hideContinuityTooltip() {
    document.querySelector('.saga-continuity-tooltip')?.remove();
}

function createLoreTimelineEventRow(event, selected = false) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `saga-lore-timeline-event-row ${getLoreTimelineEventClass(event)}`.trim();
    if (selected) row.classList.add('saga-lore-timeline-event-row-selected');
    row.addEventListener('click', () => {
        loreTimelineSelectedId = event.id;
        renderLoreTimeline();
    });

    const marker = document.createElement('span');
    marker.className = 'saga-lore-timeline-event-marker';
    row.appendChild(marker);

    const main = document.createElement('span');
    main.className = 'saga-lore-timeline-event-main';
    const summary = document.createElement('span');
    summary.className = 'saga-lore-timeline-event-summary';
    summary.textContent = event.summary || event.type;
    main.appendChild(summary);
    const meta = document.createElement('span');
    meta.className = 'saga-lore-timeline-event-meta';
    const message = event.messageRange?.latest ? `msg ${event.messageRange.latest}` : 'no message anchor';
    meta.textContent = `${formatShortDate(event.timestamp)} | ${message} | ${event.source || 'manual'}`;
    main.appendChild(meta);
    row.appendChild(main);

    const countText = formatTimelineCounts(event.counts);
    row.appendChild(createStatusPill(countText, 'Lore changes recorded in this timeline event.', {
        tone: countText === 'no visible changes' ? 'muted' : 'source',
        kind: 'count',
        density: 'compact',
        className: 'saga-lore-timeline-event-counts',
        maxChars: 32,
    }));
    return row;
}

function createLoreTimelineEventDetail(event) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-timeline-detail-card';
    if (!event) {
        wrap.appendChild(createEmptyMessage('Select a timeline event to inspect affected entries.'));
        return wrap;
    }

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = event.summary || event.type;
    wrap.appendChild(title);

    if (event.patch?.layer1Analysis) {
        const analysis = event.patch.layer1Analysis;
        wrap.appendChild(createKeyValue('Sources changed', analysis.changedSources.join(', ') || 'Unchanged', 'Original source identities.'));
        wrap.appendChild(createKeyValue('Analysis revision', `${analysis.status} · ${analysis.revision}`, 'Revision used to derive this result.'));
        const pending = (getState().pendingLoreEntries || []).filter(e => e.extensions?.layer1?.revision === analysis.revision);
        const review = createButton(pending.length ? 'Review proposals' : 'No proposals', 'Open this analysis in Pending Review.', async () => {
            const { openLayer1Review } = await import('./lorecards-panel.js'); openLayer1Review(analysis.revision);
        });
        review.disabled = !pending.length; wrap.appendChild(review);
    }

    wrap.appendChild(createKeyValue('When', formatLongDate(event.timestamp), 'When this lore event was recorded.'));
    wrap.appendChild(createKeyValue('Message', event.messageRange?.latest ? `Latest ${event.messageRange.latest}` : 'No anchor', 'Approximate chat message anchor at the time of the lore change.'));
    wrap.appendChild(createKeyValue('Source', event.source || 'manual', 'Source or workflow that created this lore event.'));
    if (event.sceneDate || event.canonBoundary) {
        wrap.appendChild(createKeyValue('Context', [event.sceneDate, event.canonBoundary].filter(Boolean).join(' | '), 'Context at the time of the event.'));
    }
    wrap.appendChild(createKeyValue('Counts', formatTimelineCounts(event.counts), 'Lore changes recorded in this event.'));

    const refs = Array.isArray(event.refs) ? event.refs : [];
    const refBox = document.createElement('div');
    refBox.className = 'saga-lore-timeline-ref-box';
    const refTitle = document.createElement('div');
    refTitle.className = 'saga-runtime-help';
    refTitle.textContent = refs.length ? `Affected entries (${refs.length})` : 'No entry references stored.';
    refBox.appendChild(refTitle);
    for (const ref of refs.slice(0, 24)) {
        const chip = createChip({
            label: ref.title || ref.id,
            tooltip: `${ref.category || 'lore'} | ${ref.relevance || 'normal'} | ${ref.canon || 'canon'}`,
            kind: 'source',
            tone: 'source',
            density: 'compact',
            className: 'saga-lore-timeline-ref-chip',
            maxChars: 42,
        });
        refBox.appendChild(chip);
    }
    if (refs.length > 24) {
        const more = createChip({
            label: `+${refs.length - 24} more`,
            tooltip: 'Additional affected entries are hidden in this compact timeline view.',
            kind: 'count',
            tone: 'muted',
            density: 'compact',
            className: 'saga-lore-timeline-ref-chip',
        });
        refBox.appendChild(more);
    }
    wrap.appendChild(refBox);

    const recoverable = getRecoverableTimelineEntries(event);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const restore = createButton(
        recoverable.length ? `Restore ${recoverable.length} to Pending Review` : 'Nothing to Restore',
        'Restores recoverable deleted or prior-version entries into Pending Review for editing and acceptance.',
        async () => {
            if (!recoverable.length) return;
            const proceed = await confirmAction('Restore lore to Pending Review?', `This will add ${recoverable.length} recovered lore entr${recoverable.length === 1 ? 'y' : 'ies'} to Pending Review. Accepted Lorecards will not be changed.`);
            if (!proceed) return;
            const result = restoreLoreTimelineEntriesToPending(event.id);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            refreshLoreTimeline();
            refreshLoreWorkbench();
            toast(`Restored ${result.restored || 0} lore entr${(result.restored || 0) === 1 ? 'y' : 'ies'} to Pending Review.`, result.restored ? 'success' : 'warning');
        },
        recoverable.length ? 'saga-primary-button' : ''
    );
    restore.disabled = recoverable.length === 0;
    actions.appendChild(restore);
    wrap.appendChild(actions);

    if (recoverable.length) {
        const preview = document.createElement('div');
        preview.className = 'saga-lore-timeline-recovery-preview';
        for (const item of recoverable.slice(0, 10)) {
            const line = document.createElement('div');
            line.className = 'saga-lore-timeline-recovery-row';
            line.textContent = `${item.recoveryKind}: ${item.entry.title || item.entry.id}`;
            preview.appendChild(line);
        }
        wrap.appendChild(preview);
    }

    return wrap;
}

function formatTimelineCounts(counts = {}) {
    const parts = [];
    if (counts.added) parts.push(`+${counts.added}`);
    if (counts.deleted) parts.push(`-${counts.deleted}`);
    if (counts.updated) parts.push(`${counts.updated} updated`);
    if (counts.elevated) parts.push(`${counts.elevated} elevated`);
    if (counts.muted) parts.push(`${counts.muted} mute`);
    if (counts.pending) parts.push(`${counts.pending} pending`);
    if (counts.restored) parts.push(`${counts.restored} restored`);
    return parts.join(' | ') || 'no visible changes';
}

function formatShortDate(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatLongDate(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleString();
}
