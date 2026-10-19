import assert from 'node:assert/strict';
import { buildLoredeckCreatorGeneratedPackRecord } from '../../src/loredecks/loredeck-creator-generated-pack.js';
import { canUseVirtualLoredeckData } from '../../src/runtime/loredeck-virtual-data.js';
import { validateLoredeckForEditor } from '../../src/runtime/loredeck-editor-validation.js';

const pack = buildLoredeckCreatorGeneratedPackRecord({ brief: { title: 'Empty planning draft' } }, 'empty-planning-draft');
pack.timelineRegistry = { schemaVersion: 1, anchors: [{ id: 'arrival', label: 'Arrival', sortKey: 1 }], windows: [] };
pack.tagRegistry = { schemaVersion: 1, tags: { place: { label: 'Place' } } };
const before = structuredClone(pack);
globalThis.fetch = async () => { throw new Error('Embedded planning data must not fetch a manifest or registry.'); };
for (const candidate of [pack, { ...pack, payloadFile: '/user/files/empty-planning-draft.json' }]) {
    const result = await validateLoredeckForEditor(candidate, null, { quiet: true, updateLibrary: false });
    assert.ok(result.health, result.error);
    assert.equal(result.entryCache.entries.length, 0);
    assert.equal(result.manifest.id, pack.packId);
}
assert.deepEqual(pack, before, 'Validation must preserve planning data and the draft.');
assert.equal(canUseVirtualLoredeckData({ ...pack, type: 'custom' }), false, 'Empty ordinary Custom decks retain their guard.');
assert.equal(canUseVirtualLoredeckData({ ...pack, manifest: '/base/manifest.json' }), false);
assert.equal(canUseVirtualLoredeckData({ ...pack, manifestData: null }), false);
assert.equal(canUseVirtualLoredeckData({ ...pack, entryOverrides: { one: { id: 'one' } } }), true);
assert.equal(canUseVirtualLoredeckData({ ...pack, type: 'custom', entryOverrides: { one: { id: 'one' } } }), true);
console.log('Empty generated editor validation and storage guards passed.');
