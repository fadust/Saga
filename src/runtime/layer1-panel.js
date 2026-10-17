import { getSettings, saveSettings, getState, saveState } from '../state/state-manager.js';
import { createButton } from '../ui/runtime-ui-kit.js';
import { analyzeCanonSources, canonCardKey, invalidateCanon, semanticCanonStatus, selectedCanonBooks } from '../context/semantic-canon.js';
import { reviewProposals } from '../context/layer1-model.js';
import { ensureLoreSelectionShape } from '../lorecards/lore-selection.js';

export function renderLayer1Panel(container, state) {
    const panel = document.createElement('section'); panel.className = 'saga-section';
    const title = document.createElement('h3'); title.textContent = 'Layer 1 — Canon sources'; panel.appendChild(title);
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = getSettings().semanticCanonEnabled;
    const label = document.createElement('label'); label.append(enabled, ' Retrieve canon from this card and selected original books'); panel.appendChild(label);
    enabled.addEventListener('change', () => {
        const settings = getSettings(); settings.semanticCanonEnabled = enabled.checked; saveSettings(settings);
        invalidateCanon(); if (enabled.checked) void analyzeCanonSources();
    });
    const sourcePicker = document.createElement('details');
    const sourceHeading = document.createElement('summary'); sourceHeading.textContent = `Original lorebooks (${selectedCanonBooks().length} selected)`; sourcePicker.appendChild(sourceHeading);
    const choices = document.createElement('div'); choices.textContent = 'Loading original lorebook choices…'; sourcePicker.appendChild(choices); panel.appendChild(sourcePicker);
    void import('../../../../../world-info.js').then(api => {
        choices.replaceChildren();
        const selected = new Set(selectedCanonBooks());
        for (const name of api.world_names || []) {
            const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected.has(name);
            const row = document.createElement('label'); row.style.display = 'block'; row.append(input, document.createTextNode(name)); choices.appendChild(row);
            input.addEventListener('change', () => {
                if (input.checked) selected.add(name); else selected.delete(name);
                sourceHeading.textContent = `Original lorebooks (${selected.size} selected)`;
                const settings = getSettings(); settings.layer1Sources ||= {}; settings.layer1Sources[canonCardKey()] = [...selected];
                saveSettings(settings); invalidateCanon(); void analyzeCanonSources();
            });
        }
    }).catch(() => { choices.textContent = 'Original lorebook catalogue unavailable.'; });
    const status = document.createElement('p'); panel.appendChild(status);
    const entities = document.createElement('p'); panel.appendChild(entities);
    const analysisDetails = document.createElement('details');
    const analysisHeading = document.createElement('summary'), changedSources = document.createElement('p');
    analysisDetails.append(analysisHeading, changedSources); panel.appendChild(analysisDetails);
    const review = createButton('Review proposals', 'Open Pending Review for this source analysis.', async () => {
        const summary = getState().layer1Analysis; if (!summary) return;
        const current = getState(); current.layer1ReviewRevision = summary.revision; saveState(current);
        const { openLayer1Review } = await import('../lorecards/lorecards-panel.js'); openLayer1Review();
    }, 'saga-small-button');
    const refresh = () => {
        const summary = getState().layer1Analysis, metrics = semanticCanonStatus().metrics;
        status.textContent = summary
            ? `${summary.status}: ${summary.changedSources.length} changed sources; ${summary.proposalsCreated} proposals created. ${summary.error || ''}`
            : 'Select original sources, then analyze. Source files remain unchanged.';
        entities.textContent = summary?.entities.length ? `Entities touched: ${summary.entities.map(e => e.name).join(', ')}` : '';
        for (const entity of summary?.entities || []) {
            if (!globalThis.NPCStateDelta?.actorProfiles?.().some(n => n.name === entity.name)) continue;
            entities.appendChild(createButton(`Open ${entity.name} dossier`, 'Inspect the accepted actor in NPC Codex.', () => globalThis.NPCStateDelta?.openDossier?.(entity.name), 'saga-small-button'));
        }
        analysisDetails.hidden = !summary;
        analysisHeading.textContent = `Analysis revision: ${summary?.revision?.slice(0, 12) || 'unavailable'}`;
        changedSources.textContent = summary?.changedSources.length ? `Changed sources: ${summary.changedSources.join(', ')}` : 'No source content changed.';
        const count = summary ? reviewProposals(getState(), summary.revision).length : 0;
        review.disabled = !count; review.textContent = count ? `Review proposals (${count})` : 'No proposals';
        panel.title = `Session requests: ${metrics.analysisCalls} analysis, ${metrics.embeddingCalls} embedding. Analysis cache hits: ${metrics.analysisCacheHits}. Latest retrieval: ${Math.round(metrics.retrievalMs)} ms. Input tokens are estimated.`;
    };
    refresh();
    // Replace the prior panel listener when the Session drawer rerenders.
    renderLayer1Panel.listener?.abort();
    const listener = new AbortController(); renderLayer1Panel.listener = listener;
    document.addEventListener('saga:canon-analysis', refresh, { signal: listener.signal });
    panel.appendChild(createButton('Analyze selected sources', 'Reuse unchanged analysis and embeddings.', async button => {
        button.disabled = true; status.textContent = 'Analyzing selected sources…';
        try { await analyzeCanonSources(); } finally { button.disabled = false; refresh(); }
    }, 'saga-small-button'));
    panel.appendChild(review);
    panel.appendChild(createButton('Browse applicable evidence', 'Inspect supported passages and their source basis. Elevate and Mute use the existing Lorecard selection state.', () => {
        const list = document.createElement('div'); list.dataset.layer1Evidence = '';
        for (const entry of semanticCanonStatus().evidence) {
            const card = document.createElement('details');
            const heading = document.createElement('summary'); heading.textContent = `${entry.title} — ${entry.kind}`; card.appendChild(heading);
            const text = document.createElement('p'); text.textContent = entry.text; card.appendChild(text);
            const source = document.createElement('p'); source.textContent = entry.basis.map(b => `${b.source}: ${b.quote}`).join('\n'); card.appendChild(source);
            const selection = ensureLoreSelectionShape(getState());
            card.appendChild(createButton(selection.elevated[entry.id] ? 'Lower' : 'Elevate', 'Prioritize this passage within the shared canon budget.', button => {
                const current = getState(), selected = ensureLoreSelectionShape(current);
                if (selected.elevated[entry.id]) delete selected.elevated[entry.id];
                else { selected.elevated[entry.id] = { elevatedAt: Date.now(), previousRelevance: 'normal' }; selected.suppressedIds = selected.suppressedIds.filter(id => id !== entry.id); }
                saveState(current); button.textContent = selected.elevated[entry.id] ? 'Lower' : 'Elevate';
            }, 'saga-small-button'));
            card.appendChild(createButton(selection.suppressedIds.includes(entry.id) ? 'Unmute' : 'Mute', 'Exclude this passage from retrieval.', button => {
                const current = getState(), selected = ensureLoreSelectionShape(current);
                if (selected.suppressedIds.includes(entry.id)) selected.suppressedIds = selected.suppressedIds.filter(id => id !== entry.id);
                else { selected.suppressedIds.push(entry.id); delete selected.elevated[entry.id]; }
                saveState(current); button.textContent = selected.suppressedIds.includes(entry.id) ? 'Unmute' : 'Mute';
            }, 'saga-small-button'));
            list.appendChild(card);
        }
        if (!list.childElementCount) list.textContent = 'No analyzed evidence is available.';
        panel.querySelector('[data-layer1-evidence]')?.remove(); panel.appendChild(list);
    }, 'saga-small-button'));
    panel.appendChild(createButton('Secondary references', 'Browse portrayal guidance; never inject it as canon.', async () => {
        const response = await fetch(new URL('../../content/layer1-secondary.json', import.meta.url));
        if (!response.ok) return;
        const library = await response.json();
        const details = document.createElement('details'); details.open = true;
        const heading = document.createElement('summary'); heading.textContent = 'BunnyMo — secondary portrayal references (manual preview)'; details.appendChild(heading);
        for (const entry of library.entries) { const p = document.createElement('p'); p.textContent = `${entry.title}: ${entry.text}`; details.appendChild(p); }
        panel.querySelector('[data-layer1-secondary]')?.remove(); details.dataset.layer1Secondary = ''; panel.appendChild(details);
    }, 'saga-small-button'));
    container.appendChild(panel);
}
