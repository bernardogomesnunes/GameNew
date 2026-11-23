// PLAY-22/23 chunk D: sell by hand and set, list and cancel a standing order,
// in a real page at phone and desktop size. Screenshots go to docs/screens/play-22-23/.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('docs/screens/play-22-23', { recursive: true });
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Selling', seed: 71823, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const d = game.duilt, p = game.player.position;
    const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) + 6 };
    const box = (dx) => ({ minX: at.x + dx, maxX: at.x + dx + 3, minY: at.y, maxY: at.y + 3, minZ: at.z, maxZ: at.z + 3 });
    const put = (type, dx, extra = {}) => {
      const s = { id: d.structures.nextId++, type, region: box(dx), valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null, tier: 0, ...extra };
      d.structures.structures.push(s);
      d.structures.storeFor(s);
      return s;
    };
    const market = put('market', 0), shed = put('storehouse', 6);
    d.inventory.add('coin', 5);
    d.inventory.add('stone', 40);
    d.inventory.add('fruit', 12);
    shed.store.add('stone', 120);
    window.sellCheck = { marketId: market.id, shedId: shed.id };
  });
  const state = () => page.evaluate(() => {
    const d = window.__game.duilt;
    return { coins: d.inventory.countOf('coin'), stone: d.sellStock('stone'), bagStone: d.inventory.countOf('stone'),
      orders: d.sellOrders(window.sellCheck.marketId).length };
  });
  const open = () => page.evaluate(() => window.__game.ui.openTrader({ trader: 'stonemonger', marketId: window.sellCheck.marketId }));
  const noSideScroll = async (label) => {
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth,
      panel: Math.max(0, ...[...document.querySelectorAll('#panel-trade, #panel-trade *')].map((e) => e.getBoundingClientRect().right)) }));
    assert.ok(w.doc <= w.win, `${label}: page scrolls sideways (${w.doc} > ${w.win})`);
    assert.ok(w.panel <= w.win + 1, `${label}: something sticks out of the screen (${w.panel} > ${w.win})`);
  };

  await open();
  await page.waitForSelector('[data-trade-tab="sell"]');
  assert.equal(await page.getAttribute('[data-trade-tab="buy"]', 'aria-pressed'), 'true', 'Buy is the tab to start on');
  await page.tap('[data-trade-tab="sell"]');
  await page.waitForSelector('[data-sell="stone"]');
  assert.equal(await page.getAttribute('[data-trade-tab="sell"]', 'aria-pressed'), 'true');
  console.log('PASS Sell tab opens');
  assert.match(await page.textContent('#trade-coins'), /Grub has 20 of 20 left today/);
  assert.match(await page.textContent('[data-sell-tile="stone"]'), /You have 40 \+ 120 in storehouses \(5 lots\)/);
  assert.ok(await page.$('[data-sell-max="stone"]') && await page.$('[data-repeat="stone"]'), '×N and Repeat on a held tile');
  const small = await page.evaluate(() => [...document.querySelectorAll('#panel-trade button')]
    .filter((b) => b.offsetParent && !b.closest('[hidden]') && b.textContent.trim()).map((b) => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }))
    .filter((b) => b.h < 43.5 || b.w < 43.5));
  assert.deepEqual(small, [], 'touch targets of 44px or more');
  await noSideScroll('phone sell tab');
  await page.screenshot({ path: 'docs/screens/play-22-23/sell-tab-phone.png' });

  // Sell one lot: stone down by a lot, coins up.
  const before = await state();
  await page.tap('[data-sell="stone"]');
  await page.waitForFunction((n) => window.__game.duilt.sellStock('stone') < n, before.stone);
  const after = await state();
  const lot = 32;
  assert.equal(before.stone - after.stone, lot, 'one lot of stone left');
  assert.equal(after.coins - before.coins, 3, 'stone pays 3 coins a lot');
  assert.match(await page.textContent('#trade-coins'), /Grub has 17 of 20 left today/);
  console.log(`PASS sold one lot: stone ${before.stone} to ${after.stone}, coins ${before.coins} to ${after.coins}`);

  // Repeat: form, save, listed.
  await page.tap('[data-repeat="stone"]');
  await page.waitForSelector('.order-form');
  assert.match(await page.textContent('[data-order-summary]'), /= 32 stone, 3 coins/);
  await page.tap('[data-lots-step="1"]');
  assert.match(await page.textContent('[data-order-summary]'), /= 64 stone, 6 coins/);
  await page.tap('[data-every="2"]');
  assert.equal(await page.getAttribute('[data-every="2"]', 'aria-pressed'), 'true');
  const formSmall = await page.evaluate(() => [...document.querySelectorAll('.order-form button')].map((b) => b.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).length);
  assert.equal(formSmall, 0, 'form buttons are 44px or more');
  await noSideScroll('phone repeat form');
  await page.screenshot({ path: 'docs/screens/play-22-23/repeat-form-phone.png' });
  await page.tap('[data-order-save]');
  await page.waitForSelector('.order-row');
  assert.match(await page.textContent('.trade-orders'), /\(1 of 2\)/);
  assert.match(await page.textContent('.order-row'), /64 stone every 2 days to Grub/);
  assert.equal((await state()).orders, 1);
  await noSideScroll('phone orders list');
  await page.screenshot({ path: 'docs/screens/play-22-23/orders-phone.png' });
  console.log('PASS a Repeat order is set and listed');

  // Desktop size.
  await page.setViewportSize({ width: 1280, height: 800 });
  await open();
  await page.tap('[data-trade-tab="sell"]');
  await page.waitForSelector('.order-row');
  await noSideScroll('desktop sell tab');
  await page.screenshot({ path: 'docs/screens/play-22-23/sell-tab-desktop.png' });
  await page.locator('.trade-orders').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screens/play-22-23/orders-desktop.png' });

  // Cancel it.
  await page.tap('[data-order-cancel]');
  await page.waitForFunction(() => !document.querySelector('.order-row'));
  assert.match(await page.textContent('.trade-orders'), /\(0 of 2\)/);
  assert.equal((await state()).orders, 0);
  console.log('PASS the order is cancelled');

  // The market's own panel lists orders too.
  await page.evaluate(() => { const d = window.__game.duilt; d.addSellOrder(window.sellCheck.marketId, 'stonemonger', 'fruit', 1, 1); });
  await page.evaluate(() => { const g = window.__game, s = g.duilt.structures.structures.find((x) => x.id === window.sellCheck.marketId); g.ui.openBuilding(s, g.buildingActions(s)); });
  await page.waitForSelector('#building-body .order-row');
  assert.match(await page.textContent('#building-body'), /Talk to a trader to add one/);
  console.log('PASS the market panel lists its orders');

  assert.deepEqual(errors, []);
  console.log('PASS no page errors');
} finally {
  await browser?.close();
  await server.close();
}
