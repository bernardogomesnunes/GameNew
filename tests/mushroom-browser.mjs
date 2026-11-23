// PLAY-15 and PLAY-19 in a real page: place a Mushy Log, let ten game days pass,
// break it for 15 to 25 mushrooms; then cook one Cauldron meal and serve it.
// Run: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/mushroom-browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0], { timeout: 180_000 });
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });

  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Mushrooms', seed: 71823, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    game.duilt.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      game.world.setBlock(at.x + dx, at.y - 1, at.z + dz, 1);
      for (let dy = 0; dy <= 3; dy++) game.world.setBlock(at.x + dx, at.y + dy, at.z + dz, 0);
    }
    window.mush = { bag, at, key: `${at.x},${at.y},${at.z}` };
  });

  // --- a Mushy Log: placed, ten days, harvested ---
  const placed = await page.evaluate(() => {
    const { at } = window.mush, g = window.__game;
    g.duilt.days = 5;
    const ok = g.applyChanges([{ x: at.x, y: at.y, z: at.z, prev: 0, next: 562 }], { chargeResources: false });
    return { ok, block: g.world.getBlock(at.x, at.y, at.z), rec: g.duilt.mushyLogs.get(at.x, at.y, at.z), left: g.duilt.mushyLogs.daysLeft(at.x, at.y, at.z, 5) };
  });
  assert.equal(placed.block, 562, 'the Pale Mushy Log stands');
  assert.equal(placed.rec?.kind, 'pale'); assert.equal(placed.rec.at, 5); assert.equal(placed.left, 10);
  const stages = await page.evaluate(() => {
    const g = window.__game, { at } = window.mush, out = [];
    for (const day of [8, 9.5, 15]) { g.duilt.days = day; g.growCrops(1e6); out.push(g.world.getBlock(at.x, at.y, at.z)); }
    return out;
  });
  assert.deepEqual(stages, [562, 563, 564], 'bare on day 3, pinheads on day 4.5, ready on day 10');
  const hint = await page.evaluate(() => window.__game.mushyHint({ block: 564, ...window.mush.at }));
  assert.match(hint, /ready/);
  const got = await page.evaluate(() => {
    const g = window.__game, { at, bag } = window.mush;
    g.applyChanges([{ x: at.x, y: at.y, z: at.z, prev: 564, next: 0 }], { chargeResources: false });
    return { pale: bag.countOf('mushroom_pale'), log: bag.countOf('mushy_log_pale'), rec: g.duilt.mushyLogs.get(at.x, at.y, at.z), block: g.world.getBlock(at.x, at.y, at.z) };
  });
  assert.ok(got.pale >= 15 && got.pale <= 25, `15 to 25 pale mushrooms (${got.pale})`);
  assert.equal(got.log, 0); assert.equal(got.rec, null); assert.equal(got.block, 0);
  console.log(`PASS a Pale Mushy Log placed on day 5, ready on day 15, broken for ${got.pale} pale mushrooms and no log`);

  // --- the Cauldron: one meal ---
  await page.evaluate(() => {
    const g = window.__game, { at, bag } = window.mush;
    g.duilt.territory.age = 3; // Hunter's Stew is Age 2
    g.world.setBlock(at.x, at.y, at.z, 569);
    for (const [id, n] of Object.entries({ raw_meat: 2, vegetables: 1, potato: 1, dried_pale: 1 })) bag.add(id, n);
    g.startCauldron(at);
  });
  await page.waitForSelector('.crucible-bar:not([hidden]) [data-load="hunters_stew"]');
  await page.locator('[data-load="hunters_stew"]').click();
  assert.equal(await page.evaluate(() => window.mush.bag.countOf('raw_meat')), 0, 'the meat went into the pot');
  assert.equal(await page.locator('.crucible-bar [data-mould]').count(), 0, 'a cauldron has no ingot or coin mould');
  await page.evaluate(() => window.__game.duilt.cauldrons.tick(40.1));
  await page.waitForSelector('.crucible-bar [data-pour]:not([disabled])');
  const served = await page.evaluate(() => {
    const m = window.__game.cauldronMachine, v = m.view;
    v.holdPour(true); v.level = 1.0; m.bar.pour(false);
    return { stew: window.mush.bag.countOf('hunters_stew'), say: document.querySelector('.crucible-bar .counter-say').textContent };
  });
  assert.equal(served.stew, 2, `two Hunter's Stew in the bag (${served.say})`);
  console.log("PASS a Cauldron cooked Hunter's Stew in 40 s and served 2 into the bag");

  assert.deepEqual(errors, []);
} finally { await browser?.close(); await server.close(); }
