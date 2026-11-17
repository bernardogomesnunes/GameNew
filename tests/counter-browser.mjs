// CRAFT3D-1 and CRAFT-9 part 3 in a real page, on a phone: place a Carpenter's
// Table, open it, make an oak table with one held saw stroke, a tap and a
// drag; leave halfway and come back; then Make another with one stroke and one tap.
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
  const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `artifacts/crafting/counter-${name}.png`, timeout: 90_000 }); };
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
    await game.modelsLoaded;
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
  const K = () => page.evaluate(() => window.__game.duilt.counters.work(`${counterCheck.at.x},${counterCheck.at.y},${counterCheck.at.z}`));
  // Saw is held until the gauge is in the light band; the headless browser is
  // slow, so the release happens in the page itself, as the crucible's test does.
  const sawStroke = async () => {
    const box = await page.locator('[data-saw]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => { const m = window.__game.counterMachine; if (m.view.level >= 0.9) { m.hold(false); return true; } return false; }, null, { timeout: 30_000, polling: 'raf' });
    await page.mouse.up();
    await page.waitForFunction(() => window.__game.counterView.sawing === 0, null, { timeout: 30_000 });
  };
  // The action buttons: bottom centre, 56 px tall.
  const saw = await page.locator('[data-saw]').boundingBox(), leave = await page.locator('[data-leave]').boundingBox();
  assert.ok(saw.height >= 56 && leave.height >= 56, `action buttons are 56 px tall (${saw.height}, ${leave.height})`);
  assert.ok(Math.abs((saw.x + leave.x + leave.width) / 2 - 195) < 12, 'and sit in the middle');
  assert.ok(saw.y > 780 * 0.75, 'at the bottom');
  // A quick tap on Saw is too short: nothing is cut and nothing is spent.
  await page.locator('[data-saw]').tap();
  assert.equal((await K()).cut, 0);
  assert.equal(await page.evaluate(() => counterCheck.bag.countOf('planks')), 8);
  await sawStroke();
  assert.equal((await K()).cut, 2, 'one stroke cuts both parts of a table: the 4 legs and the top');
  assert.equal(await page.evaluate(() => counterCheck.bag.countOf('planks')), 4);
  await shot('cut');
  // Leave halfway, come back: the cut parts are still there.
  await page.locator('[data-leave]').tap();
  assert.equal(await page.evaluate(() => window.__game.counterView.active), false);
  await page.evaluate(() => window.__game.startCounter(counterCheck.at));
  assert.equal((await K()).cut, 2);
  const partOnScreen = async (i) => {
    const at = await page.evaluate((i) => { const m = window.__game.counterView.partMesh(i), a = m.getWorldPosition(m.position.clone()); return [a.x, a.y, a.z]; }, i);
    return screenOf(...at);
  };
  // A tap on the legs: they fly to their place.
  const legs = await partOnScreen(0);
  await page.touchscreen.tap(legs.x, legs.y);
  assert.deepEqual((await K()).fitted, [true, false], 'a tap fits the 4 legs');
  await shot('assemble');
  // The top is dragged and let go anywhere on the outline (owner, 16 November, phones).
  const from = await partOnScreen(1);
  const to = await page.evaluate(() => { const v = window.__game.counterView, c = v.group.position, b = v.slotOf(1); return [c.x, b.y, c.z + 0.1]; });
  const b = await screenOf(...to);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + b.x) / 2, (from.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => counterCheck.bag.countOf('table_oak') === 1, null, { timeout: 30_000 });
  await shot('done');
  // Make another: one stroke, one tap.
  await page.locator('[data-again]').tap();
  await sawStroke();
  await shot('again');
  await page.locator('[data-part="1"]').tap();
  await page.waitForFunction(() => counterCheck.bag.countOf('table_oak') === 2, null, { timeout: 30_000 });
  assert.equal(await page.evaluate(() => counterCheck.bag.countOf('planks')), 0);
  assert.deepEqual(errors, []);
  console.log("PASS at a placed Carpenter's Table on a phone: pick, one held saw stroke, tap the legs, drop the top anywhere on the outline, an oak table in the bag; leaving halfway keeps the parts; Make another takes one stroke and one tap");
} finally { await browser?.close(); await server.close(); }
