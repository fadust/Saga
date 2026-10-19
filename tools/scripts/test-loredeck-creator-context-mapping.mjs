import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseLoredeckCreatorTitleResponse } from '../../src/loredecks/loredeck-assistant.js';
import { normalizeLoredeckCreatorTitleDrafts, compactLoredeckCreatorTitleDraftForRevision } from '../../src/loredecks/loredeck-creator-panel.js';
import { preflightLoredeckCreatorEntryTargets } from '../../src/loredecks/loredeck-creator-entry-preflight.js';
import { guardLoredeckCreatorEntryDraftChange } from '../../src/loredecks/loredeck-creator-entry-guard.js';

const timelineRegistry = {
  anchors: [{ id: 'early', sortKey: 10 }, { id: 'late', sortKey: 30 }],
  windows: [{ id: 'span', anchorFrom: 'early', anchorTo: 'late', sortKeyFrom: 10, sortKeyTo: 30 }],
};
const pack = { entrySchemaVersion: 3, timelineRegistry };
function target(mapping) {
  const parsed = parseLoredeckCreatorTitleResponse(JSON.stringify({ titleDrafts: [{ titleId: 'actor', title: 'Actor', ...mapping }] }));
  const saved = normalizeLoredeckCreatorTitleDrafts(JSON.parse(JSON.stringify(parsed.titleDrafts)));
  const compact = compactLoredeckCreatorTitleDraftForRevision(saved[0]);
  return preflightLoredeckCreatorEntryTargets({ targetTitles: [compact], timelineRegistry }).targetTitleDrafts[0];
}
function guard(title, context, retrieval = { activation: 'topic_or_entity', frequency: 'low', contextBoost: 'low' }) {
  const entry = { id: 'actor', schemaVersion: 3, context: { precision: 'anchor', label: 'Reviewed context', ...context }, retrieval,
    content: { fact: 'A stable fact.', injection: 'Use the fact when relevant.' } };
  return guardLoredeckCreatorEntryDraftChange(pack, { payload: { entryOverrides: { actor: entry } } }, {
    targetEntryIds: ['actor'], targetTitleByEntryId: new Map([['actor', title]]),
  });
}
const mapped = target({ timelineAnchorIds: ['early'] });
assert.deepEqual(mapped.timelineAnchorIds, ['early']);
assert.equal(mapped.contextMappingError, '');
const early = { scope: 'anchor', anchorId: 'early', sortKeyFrom: 10, sortKeyTo: 10 };
assert.deepEqual(guard(mapped, early).errors, []);
for (const context of [
  { ...early, anchorId: 'late', sortKeyFrom: 30, sortKeyTo: 30 },
  { ...early, sortKeyTo: 30 },
  { ...early, validToAnchor: 'late' },
  { scope: 'window', validFromAnchor: 'early', validToAnchor: 'late', sortKeyFrom: 10, sortKeyTo: 30 },
  { scope: 'global', sortKeyFrom: 0, sortKeyTo: 0 },
]) assert.equal(guard(mapped, context).change, null);
const windowTitle = target({ timelineWindowIds: ['span'] });
assert.deepEqual(windowTitle.timelineWindowIds, ['span']);
assert.deepEqual(guard(windowTitle, { scope: 'window', validFromAnchor: 'early', validToAnchor: 'late', sortKeyFrom: 10, sortKeyTo: 30 }).errors, []);
const globalTitle = target({ contextScope: 'global' });
assert.deepEqual(guard(globalTitle, { scope: 'global', sortKeyFrom: 0, sortKeyTo: 0 }).errors, []);
assert.equal(guard(globalTitle, early).change, null);
assert.equal(guard(globalTitle, { scope: 'global', sortKeyFrom: 0, sortKeyTo: 0 }, { activation: 'always', frequency: 'high', contextBoost: 'high' }).change, null);
for (const mapping of [{}, { timelineAnchorIds: ['gone'] }, { contextScope: 'global', timelineAnchorIds: ['early'] }]) {
  const title = target(mapping);
  assert.ok(title.contextMappingError);
  assert.equal(guard(title, early).change, null);
}
const changedRegistry = structuredClone(pack);
changedRegistry.timelineRegistry.anchors[0].sortKey = 20;
const staleResult = guardLoredeckCreatorEntryDraftChange(changedRegistry, { payload: { entryOverrides: { actor: {
  id: 'actor', schemaVersion: 3, context: { ...early, precision: 'anchor', label: 'Earlier accepted context' },
  content: { fact: 'Fact', injection: 'Use this fact.' },
  retrieval: { activation: 'topic_or_entity', frequency: 'low', contextBoost: 'low' },
} } } }, {
  targetTitleByEntryId: new Map([['actor', mapped]]),
});
assert.equal(staleResult.change, null);
assert.ok(staleResult.errors.every(error => error.includes('reviewed title context mapping')));

// Exercise the real pre-provider gate: unmapped legacy drafts must make zero provider calls.
const runtime = readFileSync(new URL('../../src/runtime/lore-panel.js', import.meta.url), 'utf8');
const gate = runtime.slice(runtime.indexOf('    const unmappedTitles ='), runtime.indexOf('    const retryContextByTarget =', runtime.indexOf('    const unmappedTitles =')));
assert.ok(gate.includes('contextMappingError'));
let writes = [];
let calls = 0;
const result = runInNewContext(`(function () { ${gate} provider(); return null; })()`, {
  entryTargetPreflight: { targetTitleDrafts: [target({})] }, targetTitles: [{}], preflightCachePatch: {},
  getLoredeckCreatorBriefCache: () => ({ preserved: true }), setLoredeckCreatorBriefCache: value => writes.push(value),
  provider: () => { calls += 1; },
});
assert.equal(result.status, 'questions');
assert.equal(calls, 0);
assert.equal(writes[0].preserved, true);
assert.equal(writes[0].status, 'needs_input');
console.log('Deck Maker context mapping round-trip, guard and no-provider gate tests passed.');
