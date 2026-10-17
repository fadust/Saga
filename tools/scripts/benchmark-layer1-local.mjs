import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { compileCanon, canonHash, retrieveCanon } from '../../src/context/layer1-model.js';
import { createCanonStore } from '../../src/context/layer1-store.js';
const base = process.env.SAGA_TRIAL_URL || 'http://127.0.0.1:8001';
const csrf = await fetch(`${base}/csrf-token`);
const cookie = csrf.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
const headers = { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': (await csrf.json()).token };
const request = (url, options) => fetch(new URL(url, base), options);
const fixture = JSON.parse(await fs.readFile(new URL('../../tests/fixtures/layer1-ari.json', import.meta.url)));
const model = process.env.SAGA_EMBEDDING_MODEL || 'text-embedding-embeddinggemma-2', apiUrl = process.env.SAGA_EMBEDDING_URL || 'http://127.0.0.1:1234';
let embeddingCalls = 0;
const store = createCanonStore({ fetch: request, headers: () => headers, embed: async (texts, signal) => {
    embeddingCalls++;
    const r = await request('/api/plugins/similharity/batch-embeddings', { method: 'POST', headers, signal, body: JSON.stringify({ texts, source: 'vllm', model, apiUrl }) });
    if (!r.ok) throw new Error(`Embedding HTTP ${r.status}: ${await r.text()}`);
    return (await r.json()).embeddings;
} });
const view = await compileCanon(fixture.sources, fixture.analysis, await canonHash(fixture.sources));
const started = performance.now();
const scope = await store.index(view, await canonHash([model, apiUrl]), AbortSignal.timeout(120000));
const indexMs = performance.now() - started;
const samples = [];
for (const query of ['Ari Vale', 'Ari', 'Ari headmistress', 'the healer with storm magic']) {
    const at = performance.now();
    const result = await retrieveCanon(view, query, { purpose: 'identity', signal: AbortSignal.timeout(3000),
        countTokens: async text => {
            const r = await request('/api/tokenizers/openai/encode?model=gpt-4o', { method: 'POST', headers, body: JSON.stringify({ text }) });
            if (!r.ok) throw new Error(`Tokenizer HTTP ${r.status}`);
            return (await r.json()).count;
        }, search: (text, signal) => store.search(scope, text, signal) });
    samples.push({ query, status: result.status, candidates: result.candidates, stage: result.stage, passages: result.entries.length, ms: Math.round(performance.now() - at) });
}
assert.equal(samples[0].status, 'matched'); assert.equal(samples[1].status, 'ambiguous');
const report = { at: new Date().toISOString(), model, database: 'saga-layer1', evidence: view.evidence.length, indexMs: Math.round(indexMs), embeddingCalls, samples, interpretation: 'deterministic fixture; live local embeddings and SQLite; live host tokenizer' };
const vector = await store.get('embeddings', `${await canonHash([model, apiUrl])}:${view.evidence[0].id}`);
const vectorCall = async (path, body) => {
    const r = await request(`/api/plugins/baibaoku/v1/vec/${path}`, { method: 'POST', headers, body: JSON.stringify({ database: 'saga-layer1', ...body }) });
    if (!r.ok) throw new Error(`Vector benchmark HTTP ${r.status}`); return r.json();
};
report.syntheticScale = [];
for (const size of [1000, 5000]) {
    const scope = `synthetic-scale-${size}`;
    try {
        for (let offset = 0; offset < size; offset += 250) await vectorCall('upsert', { scope, items: Array.from({ length: Math.min(250, size-offset) }, (_, i) => ({ ...vector, leafId: `synthetic-${offset+i}`, docHash: 'synthetic', document: 'Synthetic performance duplicate; no canon authority.' })) });
        const timings = [];
        for (let run = 0; run < 5; run++) {
            const at = performance.now(); await vectorCall('search', { scopes: [scope], queryVectors: [vector.vector], topK: 30 }); timings.push(Math.round(performance.now()-at));
        }
        report.syntheticScale.push({ vectors: size, dimensions: vector.dim, searchMs: timings });
    } finally { await vectorCall('clear-scope', { scope }); }
}
console.log(JSON.stringify(report, null, 2));
