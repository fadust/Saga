import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const context = vm.createContext({ console, Date, Set, Map });
const modules = new Map();
const stateStub = new vm.SyntheticModule(['getSettings'], function () {
    this.setExport('getSettings', () => ({ injectLore: true, injectContinuity: false }));
}, { context });
const indexStub = new vm.SyntheticModule(['getContextIndexSync'], function () {
    this.setExport('getContextIndexSync', () => null);
}, { context });

async function load(filename) {
    if (filename.endsWith(`${path.sep}state-manager.js`)) return stateStub;
    if (filename.endsWith(`${path.sep}context-index.js`)) return indexStub;
    if (modules.has(filename)) return modules.get(filename);
    const module = new vm.SourceTextModule(await readFile(filename, 'utf8'), { context, identifier: filename });
    modules.set(filename, module);
    return module;
}

const module = await load(path.join(root, 'src/continuity/memo-builder.js'));
await module.link((specifier, referrer) => load(path.resolve(path.dirname(referrer.identifier), specifier)));
await module.evaluate();
const { buildLoreMemo } = module.namespace;
const base = {
    id: 'gated-fact', title: 'Gated fact', relevance: 'high',
    content: { fact: 'PROTECTED_FACT', constraints: ['PROTECTED_CONSTRAINT'], antiLore: ['PROTECTED_ANTILORE'] },
};
const stateFor = entry => ({
    loreContext: { sceneDate: '2026-01-01', branchId: 'main' },
    loreMatrix: [entry],
});
const rejected = [
    { ...base, canonTiming: { hardValidFrom: '2027-01-01' } },
    { ...base, canonTiming: { hardValidTo: '2025-01-01' } },
    { ...base, branchId: 'other-branch' },
    { ...base, activation: { requiresEvents: ['unreached-event'] } },
    { ...base, expiration: { expiresWhenEventsHappen: ['finished-event'] } },
    { ...base, context: { anchorId: 'unresolved-anchor' }, extensions: { sagaLoredeck: { packId: 'missing-deck' } } },
];

for (const entry of rejected) {
    const state = stateFor(entry);
    state.storyMilestones = { 'finished-event': { status: 'happened' } };
    for (const elevated of [false, true]) {
        state.loreSelection = { elevated: elevated ? { [entry.id]: { previousRelevance: 'high' } } : {} };
        const memo = buildLoreMemo(state);
        for (const secret of ['PROTECTED_FACT', 'PROTECTED_CONSTRAINT', 'PROTECTED_ANTILORE']) {
            assert.ok(!memo.includes(secret), `${JSON.stringify(entry)} leaks ${secret}, elevated=${elevated}`);
        }
    }
}

const active = buildLoreMemo(stateFor({ ...base, canonTiming: { hardValidFrom: '2025-01-01' } }));
for (const expected of ['PROTECTED_FACT', 'PROTECTED_CONSTRAINT', 'PROTECTED_ANTILORE']) {
    assert.ok(active.includes(expected), `Eligible lore must preserve ${expected}`);
}
console.log('Memo lifecycle gating passed: future, expired, branch, milestone, Context, elevated and allowed lore.');
