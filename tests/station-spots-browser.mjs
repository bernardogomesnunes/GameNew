// IMP-15 in a real page: at a placed forge, put logs in, see the bar move,
// and take dark logs out; the forge's tiles are spots, not work steps.
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
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Spots', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    bag.add('wood', 10);
    game.duilt.inventory = bag;
    game.duilt.crafting.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    game.world.setBlock(at.x, at.y, at.z, 525);
    window.spotCheck = { bag, at };
    game.ui.openBench('', 'forge', at);
  });
  assert.equal(await page.locator('#bench-title').textContent(), 'Forge');
  assert.ok(await page.locator('[data-spot-put="wood_dark"]').count() === 1, 'dark logs are put in, not made in steps');
  assert.equal(await page.locator('[data-craft="wood_dark"]').count(), 0);
  await page.locator('[data-spot-put="wood_dark"]').tap();
  const after = await page.evaluate(() => ({ wood: spotCheck.bag.countOf('wood'), spot: window.__game.duilt.stationWork.spot(`${spotCheck.at.x},${spotCheck.at.y},${spotCheck.at.z}`) }));
  assert.equal(after.wood, 0, 'two batches of five logs went in');
  assert.equal(after.spot.batches, 2);
  assert.ok(await page.locator('[data-spot-bar]').count() === 1, 'a bar for the one in work');
  mkdirSync('artifacts/crafting', { recursive: true });
  await page.evaluate(() => document.querySelector('[data-spot] h4')?.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: 'artifacts/crafting/forge-spots.png', timeout: 90_000 });
  // Time passes (the game's own tick), and the panel updates itself.
  await page.evaluate(() => window.__game.duilt.stationWork.tick(65));
  await page.waitForSelector('[data-spot-take]', { timeout: 10_000 });
  await page.locator('[data-spot-take]').tap();
  assert.equal(await page.evaluate(() => spotCheck.bag.countOf('dark_wood')), 8, 'eight dark logs out');
  assert.deepEqual(errors, []);
  console.log('PASS at a placed forge: logs go in, a bar runs, dark logs come out and are taken');
} finally { await browser?.close(); await server.close(); }
