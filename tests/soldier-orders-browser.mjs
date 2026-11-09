// IMP-37: the barracks pop-up gives its soldiers an order (Defend, Patrol,
// Formation), and they move to match in a real page.
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
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('artifacts/soldiers', { recursive: true });
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Orders', seed: 71823, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const d = game.duilt, p = game.player.position;
    const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) + 6 };
    d.structures.structures.push({ id: 99801, type: 'barracks', valid: true, tier: 3, lastPaidAt: Date.now(),
      region: { minX: at.x - 4, maxX: at.x - 1, minY: at.y, maxY: at.y + 3, minZ: at.z + 3, maxZ: at.z + 6 } });
    d.defenders.trained['99801'] = { roster: ['warrior', 'swordsman', 'warrior', 'archer', 'warrior'], queue: [], since: d.days };
    game.defenceSyncedAt = 0;
  });
  await page.waitForFunction(() => window.__game.duilt.defenders.soldiers.length === 5, null, { timeout: 30_000 });
  const open = () => page.evaluate(() => {
    const g = window.__game, s = g.duilt.structures.structures.find((x) => x.id === 99801);
    g.ui.openBuilding(s, g.buildingActions(s));
  });
  await open();
  await page.waitForSelector('[data-soldier-order]');
  const pressed = () => page.$eval('.soldier-order.on', (b) => b.dataset.soldierOrder);
  assert.equal(await pressed(), 'defend', 'Defend is the order to start with');
  await page.screenshot({ path: 'artifacts/soldiers/orders-panel.png' });
  for (const order of ['formation', 'patrol', 'defend']) {
    await page.click(`[data-soldier-order="${order}"]`);
    await page.waitForFunction((o) => document.querySelector('.soldier-order.on')?.dataset.soldierOrder === o, order);
    const st = await page.evaluate(() => {
      const d = window.__game.duilt.defenders;
      return { order: d.orderOf(99801), patrol: d.soldiers.filter((s) => s.patrol).length, hold: d.soldiers.filter((s) => s.hold).length };
    });
    assert.equal(st.order, order);
    assert.equal(st.patrol, order === 'patrol' ? 1 : 0, `${order}: patrollers`);
    assert.equal(st.hold, order === 'formation' ? 5 : 0, `${order}: holding formation`);
    console.log(`PASS the ${order} button sets the order (${JSON.stringify(st)})`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS no page errors');
} finally {
  await browser?.close();
  await server.close();
}
