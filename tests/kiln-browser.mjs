// CRAFT-9 part 6 in a real page: a kiln with a Kiln Oven in it. Load clay,
// it fires, hold Draw until the tray reaches the mouth, two brick in the bag.
// Run on a desktop (Space holds Draw) and on an iPhone 13 (the 56 px button
// is held). Screenshots go to docs/screens/craft9-part6/. Software WebGL draws
// a 1280 x 800 frame in about a second, so the waits are long.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = 'docs/screens/craft9-part6';
const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync(OUT, { recursive: true });
  for (const [name, options] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['iphone13', devices['iPhone 13']]]) {
    const page = await browser.newPage(options);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(server.resolvedUrls.local[0], { timeout: 180_000 });
    await page.waitForFunction(() => window.__game && !window.__game.booting
      && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
    const shot = async (what, wait = 3000) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${what}-${name}.png`, timeout: 90_000 }); };
    await page.evaluate(async () => {
      const game = window.__game;
      game.newWorld({ mode: 'creative', name: 'Kiln', seed: 71823, silent: true });
      game.ui.hideBlocker();
      const { Inventory } = await import('/src/items/Inventory.js');
      const bag = new Inventory();
      bag.add('clay', 3);
      game.duilt.inventory = bag;
      const p = game.player.position;
      // The oven 3 ahead along -z; you stand on its -z side, facing its door.
      const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) - 3 };
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        game.world.setBlock(at.x + dx, at.y - 1, at.z + dz, 329);
        for (let dy = 0; dy <= 3; dy++) game.world.setBlock(at.x + dx, at.y + dy, at.z + dz, 0);
      }
      game.world.setBlock(at.x, at.y, at.z, 539);
      game.remeshDirty?.();
      await game.modelsLoaded;
      game.duilt.structures.structures.push({ id: 99902, type: 'kiln', valid: true, tier: 0, lastPaidAt: Date.now(),
        region: { minX: at.x - 3, maxX: at.x + 3, minY: at.y - 1, maxY: at.y + 3, minZ: at.z - 3, maxZ: at.z + 3 } });
      game.player.position.set(at.x + 0.5, at.y, at.z - 1.8);
      game.player.yaw = Math.PI; game.player.pitch = -0.32;
      game.player.syncCamera?.();
      window.kilnCheck = { bag, at, key: `${at.x},${at.y},${at.z}` };
    });
    await shot('block', 12_000);
    await page.evaluate(() => window.__game.startKilnOven(kilnCheck.at));
    await page.waitForSelector('.kiln-bar:not([hidden])');
    await page.locator('[data-load="brick"]').click();
    assert.equal(await page.evaluate(() => kilnCheck.bag.countOf('clay')), 0, `${name}: three batches went in`);
    await shot('closeup-firing');
    await page.evaluate(() => window.__game.duilt.kilnOvens.tick(20.1));
    await page.waitForSelector('.kiln-bar [data-pour]:not([disabled])');
    // The action button: bottom centre of the bar, 56 px tall.
    const btn = await page.locator('.kiln-bar [data-pour]').boundingBox(), bar = await page.locator('.kiln-bar').boundingBox();
    const vw = page.viewportSize().width;
    assert.ok(btn.height >= 55.5, `${name}: Draw is ${btn.height} px tall`);
    assert.ok(Math.abs(btn.x + btn.width / 2 - vw / 2) < 2, `${name}: Draw is centred`);
    assert.ok(bar.y + bar.height - (btn.y + btn.height) < 16, `${name}: Draw is at the bottom of the bar`);
    assert.ok(bar.y + bar.height <= page.viewportSize().height, `${name}: the bar fits the screen`);
    await page.evaluate(() => { window.__game.kilnMachine.view.level = 0.75; });
    await shot('closeup-draw');
    await page.evaluate(() => { window.__game.kilnMachine.view.level = 0; });
    const release = () => page.waitForFunction(() => { const v = window.__game.kilnMachine.view; if (v.level >= 0.95) { window.__game.kilnMachine.bar.pour(false); return true; } return false; }, null, { timeout: 240_000, polling: 50 });
    if (name === 'desktop') {
      // Space holds Draw; the page lets go in the window (the headless browser is slow).
      await page.keyboard.down('Space');
      await release();
      await page.keyboard.up('Space');
    } else {
      await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
      await page.mouse.down();
      await release();
      await page.mouse.up();
    }
    const after = await page.evaluate(() => ({ brick: kilnCheck.bag.countOf('brick'), say: document.querySelector('.kiln-bar .counter-say').textContent, holding: window.__game.kilnMachine.view.holding }));
    assert.equal(after.brick, 2, `${name}: two brick in the bag (${after.say})`);
    assert.equal(after.holding, false);
    await shot('closeup-drawn');
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}: in a kiln, clay loaded, fired, drawn in the window, two brick in the bag`);
    await page.close();
  }
} finally { await browser?.close(); await server.close(); }
