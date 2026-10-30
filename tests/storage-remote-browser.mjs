// Local-only integration check: no .env, accounts, or external requests.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')),
  null, { timeout: 120_000 });
  await page.evaluate(() => {
    const g = window.__game;
    g.newWorld({ mode: 'creative', name: 'Storage Remote browser check', seed: 71823, silent: true });
    g.ui.refreshForMode();
    g.ui.hideBlocker();
    g.duilt.inventory.slots[0] = { id: 'storage_remote', count: 1, wear: 0 };
    g.ui.buildHotbar();
  });
  const remote = page.locator('#hotbar [data-item="storage_remote"]');
  assert.equal(await remote.count(), 1, 'Remote is visible and selectable in the hotbar');
  assert.ok(await remote.locator('svg path').count(), 'Remote has its native 3D inventory icon');
  await remote.click({ force: true });
  await page.evaluate(() => {
    const g = window.__game;
    g.player.view = 'first';
    g.updateYou(0, true);
  });
  assert.equal(await page.evaluate(() => window.__game.handView.key), 'storage_remote');
  assert.equal(await page.evaluate(() => window.__game.handView.item.visible), true);
  mkdirSync('artifacts/performance', { recursive: true });
  await page.screenshot({ path: 'artifacts/performance/storage-remote-held.png' });
  await page.evaluate(() => {
    window.__restoreRemoteRaycast = window.__game.raycast;
    window.__game.raycast = () => null;
  });
  await page.locator('#look-zone').tap();
  const opened = await page.evaluate(() => {
    const g = window.__game;
    try {
      g.setPlacing(true);
      g.tickPlacing(performance.now() + 5000);
      return { selected: g.selectedItemId, repeating: g.placing, directory: g.ui.duiltUI.storesDirectory };
    } finally { g.raycast = window.__restoreRemoteRaycast; delete window.__restoreRemoteRaycast; }
  });
  assert.deepEqual(opened, { selected: 'storage_remote', repeating: false, directory: true });
  await page.locator('#panel-stores').waitFor({ state: 'visible' });
  assert.match(await page.locator('#stores-list').innerText(), /Build a store or granary/);
  // Directory buttons must still open the actual existing shelf/transfer UI.
  await page.evaluate(async () => {
    const { Inventory } = await import('/src/items/Inventory.js');
    const g = window.__game, store = new Inventory({ slots: 4 });
    store.add('stone', 12);
    const x = Math.floor(g.player.position.x), z = Math.floor(g.player.position.z), y = Math.floor(g.player.position.y);
    g.duilt.structures.structures.push({ id: 9876, type: 'storehouse', valid: false, store,
      region: { minX: x, maxX: x + 2, minY: y, maxY: y + 2, minZ: z, maxZ: z + 2 }, tier: 0 });
    g.ui.duiltUI.renderStores();
  });
  await page.locator('[data-open-store="9876"]').click();
  await page.locator('#panel-store').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#store-grid [data-store-slot]').count(), 4);
  assert.equal(await page.evaluate(() => window.__game.ui.duiltUI.store.id), 9876);
  assert.deepEqual(errors, [], 'No browser errors');
  console.log('PASS Storage Remote hotbar selection, sky touch use, no hold repetition, empty directory, and opening actual shelves');
} finally {
  await browser?.close();
  await server.close();
}
