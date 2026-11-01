// CRAFT3D-1 in a real page: place a counter, open it, make an oak table by
// sawing 5 parts and dragging each onto the outline; leave halfway and come back.
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
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('artifacts/crafting', { recursive: true });
  const shot = async (name) => { await page.waitForTimeout(150); await page.screenshot({ path: `artifacts/crafting/counter-${name}.png`, timeout: 90_000 }); };
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Counter', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    bag.add('planks', 8); bag.add('carpentry_saw', 1);
    game.duilt.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    game.world.setBlock(at.x, at.y, at.z, 530);
    game.remeshDirty?.();
    window.counterCheck = { bag, at };
    game.startCounter(at);
  });
  await page.waitForSelector('.counter-bar:not([hidden])');
  await shot('pick');
  await page.locator('[data-piece="table_oak"]').tap();
  // A screen point on the canvas for a scene point.
  const screenOf = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__game, v = new (g.camera.position.constructor)(x, y, z).project(g.camera);
    const r = g.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }, [x, y, z]);
  for (let i = 0; i < 2; i++) { await page.locator('[data-saw]').tap(); await page.waitForFunction(() => window.__game.counterView.sawing === 0, null, { timeout: 30_000 }); }
  await shot('cut');
  // Leave halfway, come back: the two cut parts are still there.
  await page.locator('[data-leave]').tap();
  assert.equal(await page.evaluate(() => window.__game.counterView.active), false);
  await page.evaluate(() => window.__game.startCounter(counterCheck.at));
  assert.equal(await page.evaluate(() => window.__game.duilt.counters.work(`${counterCheck.at.x},${counterCheck.at.y},${counterCheck.at.z}`).cut), 2);
  for (let i = 0; i < 3; i++) { await page.locator('[data-saw]').tap(); await page.waitForFunction(() => window.__game.counterView.sawing === 0, null, { timeout: 30_000 }); }
  // Drag each part, with the mouse, from where it lies to its place.
  for (let i = 0; i < 5; i++) {
    const [from, to] = await page.evaluate((i) => {
      const v = window.__game.counterView, m = v.partMesh(i);
      const a = m.getWorldPosition(m.position.clone()), b = v.slotOf(i);
      return [[a.x, a.y, a.z], [b.x, b.y, b.z]];
    }, i);
    const a = await screenOf(...from), b = await screenOf(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    if (i === 2) await shot('assemble');
    await page.mouse.up();
  }
  await page.waitForTimeout(200);
  await shot('done');
  const made = await page.evaluate(() => counterCheck.bag.countOf('table_oak'));
  assert.equal(made, 1, 'an oak table in the bag');
  assert.deepEqual(errors, []);
  console.log('PASS at a placed counter: pick, saw five parts, drag them into place, an oak table in the bag; leaving halfway keeps the parts');
} finally { await browser?.close(); await server.close(); }
