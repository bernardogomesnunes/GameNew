// CRAFT3D-3 in a real page: a foundry with a crucible in it, load iron ore,
// it melts, hold Pour until the mould is full, an iron ingot in the bag.
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
  const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `artifacts/crafting/crucible-${name}.png`, timeout: 90_000 }); };
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Foundry', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    bag.add('iron_ore', 4);
    game.duilt.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    // A stone-brick foundry floor, clear of grass, as a built foundry has.
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      game.world.setBlock(at.x + dx, at.y - 1, at.z + dz, 329);
      for (let dy = 0; dy <= 2; dy++) game.world.setBlock(at.x + dx, at.y + dy, at.z + dz, 0);
    }
    game.world.setBlock(at.x, at.y, at.z, 531);
    await game.modelsLoaded;
    game.duilt.structures.structures.push({ id: 99901, type: 'foundry', valid: true, tier: 0, lastPaidAt: Date.now(),
      region: { minX: at.x - 3, maxX: at.x + 3, minY: at.y - 1, maxY: at.y + 3, minZ: at.z - 3, maxZ: at.z + 3 } });
    window.crucibleCheck = { bag, at, key: `${at.x},${at.y},${at.z}` };
    game.startCrucible(at);
  });
  await page.waitForSelector('.crucible-bar:not([hidden])');
  await page.locator('[data-load="smelt_iron"]').tap();
  assert.equal(await page.evaluate(() => crucibleCheck.bag.countOf('iron_ore')), 0, 'two batches went in');
  await shot('load');
  // Time passes in the world (the game's own tick runs it while playing).
  await page.evaluate(() => window.__game.duilt.crucibles.tick(45.1));
  await page.waitForSelector('[data-pour]:not([disabled])');
  await shot('molten');
  // A still of the pot tipped and the mould three-quarters full (not a pour: holding stays off).
  await page.evaluate(() => { window.__game.crucibleMachine.view.level = 0.75; });
  await shot('tilt');
  await page.evaluate(() => { window.__game.crucibleMachine.view.level = 0; });
  // Hold Pour until the mould is full, then let go.
  const pour = page.locator('[data-pour]');
  const box = await pour.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Let go inside the window, as a player watching the gauge would; the
  // headless browser is slow, so the release happens in the page itself.
  await page.waitForFunction(() => { const v = window.__game.crucibleMachine.view; if (v.level >= 0.93) { window.__game.crucibleMachine.bar.pour(false); return true; } return false; }, null, { timeout: 30_000, polling: 'raf' });
  await page.mouse.up();
  await shot('pour');
  const after = await page.evaluate(() => ({ ingots: crucibleCheck.bag.countOf('iron_ingot'), say: document.querySelector('.crucible-bar .counter-say').textContent }));
  await shot('done');
  assert.equal(after.ingots, 1, `an iron ingot in the bag (${after.say})`);
  // A hold released off the button still pours, and never sticks.
  await page.evaluate(() => window.__game.duilt.crucibles.tick(45.1));
  await page.waitForSelector('[data-pour]:not([disabled])');
  const p2 = await page.locator('[data-pour]').boundingBox(), m2 = await page.locator('[data-mould="coin"]').boundingBox();
  await page.mouse.move(p2.x + p2.width / 2, p2.y + p2.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__game.crucibleMachine.view.level > 0.2, null, { timeout: 30_000, polling: 'raf' });
  await page.mouse.move(m2.x + m2.width / 2, m2.y + m2.height / 2);
  await page.mouse.up();
  const stuck = await page.evaluate(() => ({ holding: window.__game.crucibleMachine.view.holding, level: window.__game.crucibleMachine.view.level, say: document.querySelector('.crucible-bar .counter-say').textContent }));
  assert.equal(stuck.holding, false, 'released off the button: not holding');
  assert.equal(stuck.level, 0);
  assert.match(stuck.say, /Too little|Poured|spilt/, 'it poured at the level reached');
  assert.deepEqual(errors, []);
  console.log('PASS in a foundry: iron ore loaded, melted, poured at the right moment, an iron ingot in the bag');
} finally { await browser?.close(); await server.close(); }
