import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { once } from 'node:events';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Use an installed Playwright, or point SAGA_PLAYWRIGHT_PATH at its index.mjs.
const { chromium } = await import(process.env.SAGA_PLAYWRIGHT_PATH
  ? pathToFileURL(process.env.SAGA_PLAYWRIGHT_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/scripts/serve-visual-smoke.mjs', '--port=0'], {
  cwd: fileURLToPath(new URL('../..', import.meta.url)), windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/tests\/browser\/visual-smoke.html/);
      if (match) resolve(match[0]);
    });
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Harness server exited: ${code}`)));
  });
  let executablePath = process.env.SAGA_CHROME_PATH;
  if (!executablePath && process.platform === 'win32') {
    for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
      try { await access(candidate); executablePath = candidate; break; } catch { /* Try the next browser. */ }
    }
  }
  browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__sagaSmokeReady === true);
  await page.evaluate(async () => {
    const panel = await import('/src/loredecks/loredeck-library-panel.js');
    const { getDefaultState } = await import('/src/state/constants.js');
    const state = getDefaultState();
    const library = ['alpha', 'beta'].map(packId => ({ packId, title: packId, type: 'custom', stats: { entryCount: 2 } }));
    const registry = { packs: Object.fromEntries(library.map(pack => [pack.packId, pack])), folders: [], deckPlacements: [] };
    state.loredeckStack = [{ packId: 'alpha', enabled: true }];
    panel.configureLoredeckLibraryPanel({
      getState: () => state, getLoredeckLibrary: () => library,
      getLoredeckLibraryRegistry: () => registry, getLoredeckStack: () => state.loredeckStack,
      getCanonLoreDatabaseSync: () => ({ loredecks: [] }),
      getSettings: () => ({ experienceMode: 'advanced' }),
      selectLoredeckForDetails: id => { state.lorePanel.selectedLoredeckId = id; },
      getLoredeckDefinition: id => library.find(pack => pack.packId === id),
    });
    panel.openLoredeckLibraryWindow();
    window.libraryFixture = { panel, state, library, registry };
  });
  await page.waitForSelector('.saga-loredeck-library-deck-card[data-pack-id="beta"]');
  await page.evaluate(() => {
    window.previousStack = document.querySelector('.saga-loredeck-library-pane-stack');
    window.previousList = document.querySelector('.saga-loredeck-library-hierarchy-list');
  });
  await page.locator('.saga-loredeck-library-deck-card[data-pack-id="beta"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const selection = await page.evaluate(() => ({
    stackPreserved: window.previousStack === document.querySelector('.saga-loredeck-library-pane-stack'),
    listPreserved: window.previousList === document.querySelector('.saga-loredeck-library-hierarchy-list'),
    title: document.querySelector('.saga-loredeck-library-detail-title')?.textContent,
  }));
  assert.equal(selection.title, 'beta');
  assert.equal(selection.listPreserved, true);
  assert.equal(selection.stackPreserved, true, 'Selecting a deck must preserve the unchanged active-stack pane.');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.saga-loredeck-library-header-actions button')]
    .find(button => button.textContent === 'Export Selected')?.disabled), false,
    'Targeted selection refresh must also enable actions for the current selection.');
  assert.deepEqual(errors, []);
  console.log('Browser selection preserves the Library and active-stack DOM.');

  const stackRefresh = await page.evaluate(async () => {
    const overlay = document.querySelector('.saga-loredeck-library-overlay');
    const { panel, state } = window.libraryFixture;
    state.loredeckStack.push({ packId: 'beta', enabled: true });
    panel.refreshLoredeckLibraryAfterStackMutation();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return {
      overlayPreserved: overlay === document.querySelector('.saga-loredeck-library-overlay'),
      activeCards: document.querySelectorAll('.saga-loredeck-library-stack-card').length,
    };
  });
  assert.equal(stackRefresh.activeCards, 2);
  assert.equal(stackRefresh.overlayPreserved, true, 'A stack change must refresh affected panes without rebuilding the overlay.');
  console.log('Stack mutations preserve the overlay.');

  const largeLibrary = await page.evaluate(() => {
    const { panel, state, library, registry } = window.libraryFixture;
    state.loredeckStack = [];
    state.lorePanel.selectedLoredeckId = '';
    panel.setLoredeckLibraryBulkSelection([]);
    library.splice(0, library.length, ...Array.from({ length: 1000 }, (_, i) => ({
      packId: `deck-${String(i).padStart(4, '0')}`, title: `Deck ${String(i).padStart(4, '0')}`,
      type: 'custom', stats: { entryCount: i },
    })));
    registry.packs = Object.fromEntries(library.map(pack => [pack.packId, pack]));
    const start = performance.now();
    panel.renderLoredeckLibraryOverlay();
    const initialRows = document.querySelectorAll('.saga-loredeck-library-deck-card').length;
    const initialMs = performance.now() - start;
    panel.setLoredeckLibraryBulkSelection(['deck-0999'], 'deck-0999');
    document.querySelector('.saga-loredeck-library-deck-card').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    return { initialRows, initialMs, fullRangeSelected: document.querySelector('.saga-loredeck-library-title-meta').textContent.includes('1000 selected') };
  });
  console.log('Large Library initial render:', JSON.stringify(largeLibrary));
  assert(largeLibrary.initialRows > 0 && largeLibrary.initialRows < 1000,
    'A large Library must show useful rows first and yield before constructing every card.');
  assert.equal(largeLibrary.fullRangeSelected, true, 'Range selection must include logical rows that are still waiting to render.');
  await page.waitForFunction(() => document.querySelectorAll('.saga-loredeck-library-deck-card').length === 1000);
  assert.deepEqual(errors, []);
  console.log('Large Library renders completely in bounded batches.');

  const scroll = await page.evaluate(async () => {
    const list = document.querySelector('.saga-loredeck-library-hierarchy-list');
    list.scrollTop = 20000;
    const before = list.scrollTop;
    window.libraryFixture.panel.renderLoredeckLibraryOverlay({ preserveScroll: true });
    await new Promise(resolve => {
      const wait = () => document.querySelector('.saga-loredeck-library-hierarchy-list').hasAttribute('aria-busy') ? setTimeout(wait, 10) : resolve();
      wait();
    });
    return { before, after: document.querySelector('.saga-loredeck-library-hierarchy-list').scrollTop };
  });
  assert.equal(scroll.after, scroll.before, 'Batched refreshes must restore scroll even beyond the first batch.');
  console.log('Batched refresh preserves deep scroll position.');

  const cancelled = await page.evaluate(async () => {
    const { panel } = window.libraryFixture;
    panel.renderLoredeckLibraryOverlay();
    const oldList = document.querySelector('.saga-loredeck-library-hierarchy-list');
    const before = oldList.querySelectorAll('.saga-loredeck-library-deck-card').length;
    panel.closeLoredeckLibraryWindow();
    await new Promise(resolve => setTimeout(resolve, 30));
    return { before, after: oldList.querySelectorAll('.saga-loredeck-library-deck-card').length, busy: oldList.hasAttribute('aria-busy') };
  });
  assert.equal(cancelled.after, cancelled.before, 'Closing the Library must cancel pending row work.');
  assert.equal(cancelled.busy, false);
  console.log('Closing the Library cancels pending batches.');



  await page.evaluate(() => {
    const { panel, registry, library } = window.libraryFixture;
    library.splice(0);
    registry.packs = {};
    registry.deckPlacements = [];
    registry.folders = [{ id: 'empty-root', title: 'Empty Root' }, ...Array.from({ length: 1000 }, (_, i) => ({
      id: `empty-child-${i}`, parentId: 'empty-root', title: `Empty Child ${i}`,
    }))];
    panel.renderLoredeckLibraryOverlay();
  });
  await page.locator('.saga-loredeck-library-inline-folder-row[data-folder-id="empty-root"] .saga-loredeck-library-folder-disclosure').click();
  await page.waitForFunction(() => document.querySelectorAll('.saga-loredeck-library-inline-folder-row').length === 1);
  const expandedFolders = await page.evaluate(() => {
    document.querySelector('.saga-loredeck-library-inline-folder-row[data-folder-id="empty-root"] .saga-loredeck-library-folder-disclosure').click();
    return document.querySelectorAll('.saga-loredeck-library-inline-folder-row').length;
  });
  assert(expandedFolders < 1001, 'Large expansions must also yield when the children are empty folders.');
  await page.waitForFunction(() => document.querySelectorAll('.saga-loredeck-library-inline-folder-row').length === 1001);
  assert.deepEqual(errors, []);
  console.log('Large empty-folder expansions use bounded batches.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const { panel, registry, library, state } = window.libraryFixture;
    state.lorePanel.selectedLoredeckId = '';
    panel.setLoredeckLibraryBulkSelection([]);
    library.push({ packId: 'filtered-deck', title: 'Filtered Deck', type: 'custom' });
    registry.packs = { 'filtered-deck': library[0] };
    registry.folders = [{ id: 'filter-folder', title: 'Filter Folder' }];
    registry.deckPlacements = [{ deckId: 'filtered-deck', folderId: 'filter-folder' }];
    panel.renderLoredeckLibraryOverlay();
    document.querySelector('.saga-loredeck-library-inline-folder-row[data-folder-id="filter-folder"]').click();
  });
  await page.waitForSelector('.saga-loredeck-library-folder-details');
  await page.locator('.saga-loredeck-library-view .saga-loredeck-select-button').click();
  await page.locator('.saga-loredeck-library-view .saga-loredeck-select-option[data-value="custom"]').click();
  await page.waitForFunction(() => !document.querySelector('.saga-loredeck-library-folder-details'));
  assert.deepEqual(errors, []);
  console.log('View changes clear details for the old folder selection.');
} finally {
  await browser?.close();
  const exited = once(server, 'exit');
  server.kill();
  await exited;
}
