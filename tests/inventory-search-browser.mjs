// Real inventory input, slot interactions and panel geometry; localhost only.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [width, height, touch] of [[1440,900,false], [390,780,true], [360,640,true], [844,390,true]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__game && !window.__game.booting
      && document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120_000 });
    await page.evaluate(() => {
      const g = window.__game;
      g.newWorld({ mode: 'creative', name: 'Inventory search check', seed: 71823, silent: true });
      g.ui.refreshForMode(); g.ui.hideBlocker();
      g.duilt.inventory.slots = Array.from({ length: 120 }, () => ({ id: 'stone', count: 1, wear: 0 }));
      g.duilt.inventory.slots[16] = null;
      g.duilt.inventory.slots[70] = { id: 'sword_iron', count: 1, wear: 0 };
      g.ui.duiltUI.panels.open('panel-bag');
    });
    const panel = page.locator('#panel-bag > .panel');
    const search = page.getByRole('searchbox', { name: 'Search inventory' });
    await search.waitFor({ state: 'visible', timeout: 3000 });
    const initialHeight = (await panel.boundingBox()).height;
    for (const query of ['stone', '  IRON SWORD  ', 'no-such-item', '']) {
      await search.fill(query);
      assert.ok(Math.abs((await panel.boundingBox()).height - initialHeight) <= 1, `${width}x${height}: height changed for ${query}`);
      assert.equal(await search.evaluate(input => document.activeElement === input), true, 'Typing keeps focus');
      if (query.includes('IRON')) {
        assert.equal(await page.locator('#bag-grid [data-slot]').count(), 1);
        assert.equal(await page.locator('#bag-grid [data-slot="70"]').count(), 1);
        assert.equal(await page.locator('#bag-loadout').isVisible(), false);
      }
      if (query === 'no-such-item') assert.match(await page.locator('#bag-grid').innerText(), /No items match/i);
    }
    // Filtered results must manipulate the original slot, even far down the bag.
    await search.fill('iron sword');
    await page.locator('#bag-grid [data-slot="70"]').click();
    await search.fill('');
    await page.locator('#bag-grid [data-slot="16"]').click();
    assert.deepEqual(await page.evaluate(() => ({ moved: window.__game.duilt.inventory.slots[16]?.id,
      original: window.__game.duilt.inventory.slots[70] })), { moved: 'sword_iron', original: null });
    await search.fill('no-such-item');
    const searchBox = await search.boundingBox();
    const emptyMessage = await page.locator('#bag-grid .bag-empty').boundingBox();
    assert.ok(searchBox.y >= 0 && searchBox.y + searchBox.height <= height, 'Search remains in view');
    assert.ok(emptyMessage.y >= 0 && emptyMessage.y + emptyMessage.height <= height, 'Results remain in view');
    mkdirSync('artifacts/performance', { recursive: true });
    // The picture is a review artifact. Under a busy CI runner the software
    // renderer has taken over 30 seconds to hand it over (PR #268), so it gets
    // longer than Playwright's default before the run fails on it.
    await page.screenshot({ path: `artifacts/performance/inventory-search-${width}x${height}.png`, timeout: 90_000 });
    assert.deepEqual(errors, []);
    console.log(`PASS inventory search, fixed panel height, no results and real slot move at ${width}x${height}`);
    await page.close();
  }
} finally { await browser?.close(); await server.close(); }
