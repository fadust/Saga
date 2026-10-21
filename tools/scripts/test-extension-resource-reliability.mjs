import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, MODULE_KEY, getDefaultState } from '../../src/state/constants.js';
import { wireEvents, handleChatChanged } from '../../src/extension/events.js';
import { sagaOnEnable, sagaOnDisable, sagaOnUpdate } from '../../src/extension/lifecycle.js';
import { registerSagaToolManagerTools } from '../../src/extension/saga-tool-registry.js';
import { registerRuntimeAction } from '../../src/runtime/runtime-actions.js';

let syncs = 0;
registerRuntimeAction('prompt.sync', () => { syncs++; });
registerRuntimeAction('runtime.refresh', () => {});
registerRuntimeAction('runtime.hide', () => {});
registerRuntimeAction('ui.refresh', () => {});
const ctx = { chat: [], chatId: 'resources', chatMetadata: { [MODULE_KEY]: getDefaultState() },
  extensionSettings: { [MODULE_KEY]: { ...DEFAULT_SETTINGS, enabled: true } }, saveMetadata() {},
  setExtensionPrompt() {}, event_types: { CHAT_CHANGED: 'chat', GENERATION_ENDED: 'ended', EXTENSION_DISABLED: 'disabled' } };
ctx.sagaPersistence = { originBound: true, saveState: () => ({ ok: true, persisted: true }) };
globalThis.SillyTavern = { getContext: () => ctx };
function emitter() {
  const handlers = new Map();
  return { handlers,
    on(name, handler) { const items = handlers.get(name) || [];
      if (!Object.hasOwn(items, 'size')) Object.defineProperty(items, 'size', { get() { return this.length; } });
      items.push(handler); handlers.set(name, items); },
    off(name, handler) { const items = handlers.get(name); const index = items?.indexOf(handler) ?? -1;
      if (index >= 0) items.splice(index, 1); },
  };
}
function toolManager() {
  const tools = new Map(); return { tools, registerFunctionTool: tool => tools.set(tool.name, tool), unregisterFunctionTool: name => tools.delete(name) };
}
const failures = [];
async function test(name, run) { try { await run(); console.log(`PASS ${name}`); } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); } }

await test('repeated wiring retains one event listener and switch of sources disposes old listeners', async () => {
  const first = emitter(); ctx.eventSource = first; wireEvents(ctx); wireEvents(ctx);
  assert.equal(first.handlers.get('chat').size, 1);
  ctx.eventSource = emitter(); wireEvents(ctx); assert.equal(first.handlers.get('chat').size, 0);
});

await test('disable removes resources and enable restores one complete set', async () => {
  ctx.eventSource = emitter(); ctx.ToolManager = toolManager(); await sagaOnEnable();
  assert.equal(typeof globalThis.Saga?.bridge?.refreshUI, 'function');
  assert.equal(ctx.ToolManager.tools.size, 3); assert.equal(ctx.eventSource.handlers.get('chat').size, 1);
  const oldTool = ctx.ToolManager.tools.get('Saga_ProposeLorecard');
  await sagaOnDisable(); assert.equal(ctx.eventSource.handlers.get('chat').size, 0); assert.equal(ctx.ToolManager.tools.size, 0);
  assert.equal(globalThis.Saga?.bridge, undefined);
  const result = JSON.parse(await oldTool.execute({ title: 'late', content: 'late proposal' })); assert.equal(result.ok, false);
  await sagaOnEnable(); await sagaOnEnable();
  assert.equal(typeof globalThis.Saga?.bridge?.refreshUI, 'function');
  assert.equal(ctx.ToolManager.tools.size, 3); assert.equal(ctx.eventSource.handlers.get('chat').size, 1);
});

await test('replacement tool manager gets registrations and previous manager is disposed', async () => {
  const previous = toolManager(); ctx.ToolManager = previous; registerSagaToolManagerTools(ctx);
  assert.equal(previous.tools.size, 3);
  ctx.ToolManager = toolManager(); registerSagaToolManagerTools(ctx);
  assert.equal(ctx.ToolManager.tools.size, 3); assert.equal(previous.tools.size, 0);
});

await test('mutation tool checks current enabled settings at invocation', async () => {
  const tool = ctx.ToolManager.tools.get('Saga_ProposeLorecard');
  ctx.extensionSettings[MODULE_KEY].enabled = false;
  const result = JSON.parse(await tool.execute({ title: 'disabled', content: 'cannot write' }));
  assert.equal(result.ok, false); assert.equal(ctx.chatMetadata[MODULE_KEY].pendingLoreEntries.length, 0);
  ctx.extensionSettings[MODULE_KEY].enabled = true;
});

await test('TunnelVision ownership blocks retained raw tools and unregisters them', async () => {
  const search = ctx.ToolManager.tools.get('Saga_SearchLorecards');
  const propose = ctx.ToolManager.tools.get('Saga_ProposeLorecard');
  globalThis.TunnelVision = { bridge: { canonStatus: () => ({ enabled: true }) } };
  try {
    assert.equal(JSON.parse(await search.execute({ query: 'anything', include_muted: true })).ok, false);
    assert.equal(JSON.parse(await propose.execute({ title: 'bypass', content: 'cannot write' })).ok, false);
    assert.equal(registerSagaToolManagerTools(ctx).ok, false);
    assert.equal(ctx.ToolManager.tools.size, 0);
    assert.equal(ctx.extensionSettings[MODULE_KEY].enabled, true);
  } finally { delete globalThis.TunnelVision; registerSagaToolManagerTools(ctx); }
});

await test('chat change still synchronizes prompts after renderer failure', async () => {
  registerRuntimeAction('runtime.refresh', () => { throw new Error('render unavailable'); }, { replace: true });
  const before = syncs; const errors = []; const original = console.error; console.error = (...args) => errors.push(args);
  try { handleChatChanged(); } finally { console.error = original; }
  assert.equal(syncs, before + 1); assert.equal(errors.length, 1);
  registerRuntimeAction('runtime.refresh', () => {}, { replace: true });
});

await test('update waits for the lifecycle backup durable acknowledgement', async () => {
  let resolve; const pending = new Promise(r => { resolve = r; }); ctx.saveMetadata = () => pending;
  ctx.sagaPersistence.saveState = async () => { await pending; return { ok: true, persisted: true }; };
  let settled = false; const update = sagaOnUpdate().then(() => { settled = true; });
  await new Promise(r => setImmediate(r)); assert.equal(settled, false);
  resolve(); await update;
});

await test('hosts without unregister retain inert callbacks and re-enable without duplicates', async () => {
  const source = emitter(); delete source.off; ctx.eventSource = source;
  const manager = toolManager(); delete manager.unregisterFunctionTool; ctx.ToolManager = manager;
  let registered = 0; const register = manager.registerFunctionTool;
  manager.registerFunctionTool = tool => { registered++; register(tool); };
  await sagaOnEnable(); const stale = source.handlers.get('chat')[0];
  await sagaOnDisable(); const before = syncs; stale(); assert.equal(syncs, before);
  const result = JSON.parse(await manager.tools.get('Saga_ProposeLorecard').execute({ title: 'inactive', content: 'inactive' }));
  assert.equal(result.ok, false);
  await sagaOnEnable(); await sagaOnEnable();
  assert.equal(source.handlers.get('chat').size, 1); assert.equal(registered, 3);
});

await test('eventTypes fallback removes its handlers on disable', async () => {
  ctx.eventSource = null; ctx.eventTypes = {}; await sagaOnEnable();
  assert.equal(ctx.eventTypes.CHAT_CHANGED.length, 1); wireEvents(ctx); assert.equal(ctx.eventTypes.CHAT_CHANGED.length, 1);
  await sagaOnDisable(); assert.equal(ctx.eventTypes.CHAT_CHANGED.length, 0);
  await sagaOnEnable(); assert.equal(ctx.eventTypes.CHAT_CHANGED.length, 1);
});

await test('refused lifecycle backup prevents clean from resetting state and settings', async () => {
  const { sagaOnClean } = await import('../../src/extension/lifecycle.js');
  ctx.chatMetadata[MODULE_KEY].scene.location = 'preserve on refusal';
  ctx.extensionSettings[MODULE_KEY].debugMode = true;
  ctx.saveMetadata = () => Promise.resolve({ ok: false, error: 'backup refused' });
  ctx.sagaPersistence.saveState = ctx.saveMetadata;
  const result = await sagaOnClean(); assert.equal(result.ok, false);
  assert.equal(ctx.chatMetadata[MODULE_KEY].scene.location, 'preserve on refusal');
  assert.equal(ctx.extensionSettings[MODULE_KEY].debugMode, true);
});

if (failures.length) throw new Error(`${failures.length} lifecycle failures: ${failures.join('; ')}`);
console.log('Extension resource reliability passed.');
