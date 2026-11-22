// PLAY-8 in a real page: place a bed at night, sleep in it, screenshot the avatar
// in bed, wake early with a key, then sleep again and let it run to morning.
// Run: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/sleep-browser.mjs
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
  mkdirSync('docs/screens/sleep', { recursive: true });
  const shot = async (name) => { await page.waitForTimeout(800); await page.screenshot({ path: `docs/screens/sleep/${name}.png`, timeout: 90_000 }); };

  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Sleep', seed: 71823, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 3, y: Math.floor(p.y), z: Math.floor(p.z) + 3 };
    // A flat pad to put the bed on, clear above it.
    for (let dx = -2; dx <= 2; dx++) for (let dz = -3; dz <= 2; dz++) {
      game.world.setBlock(at.x + dx, at.y - 1, at.z + dz, 1);
      for (let dy = 0; dy < 3; dy++) game.world.setBlock(at.x + dx, at.y + dy, at.z + dz, 0);
    }
    game.world.setBlock(at.x, at.y, at.z, 193);      // foot
    game.world.setBlock(at.x, at.y, at.z - 1, 197);  // head, facing 0: towards -z
    game.remeshDirty?.();
    game.dayCycle.time = 0.0;
    window.bed = at;
  });
  const start = await page.evaluate(() => window.__game.dayCycle.time);
  await page.evaluate(() => { const b = window.bed; window.__ok = window.__game.sleep({ x: b.x, y: b.y, z: b.z, block: 193 }); });
  assert.equal(await page.evaluate(() => window.__ok), true, 'sleep starts');
  await page.waitForTimeout(3500);
  await shot('avatar-in-bed');
  const mid = await page.evaluate(() => ({ t: window.__game.dayCycle.time, sleeping: !!window.__game.sleeping }));
  assert.ok(mid.sleeping, 'still asleep after a few seconds');
  assert.ok(mid.t > start && mid.t < 0.32, `clock running on (${mid.t})`);
  // Early wake with a movement key: the time stays where it got to.
  await page.keyboard.press('KeyW');
  const woke = await page.evaluate(() => ({ t: window.__game.dayCycle.time, sleeping: !!window.__game.sleeping }));
  assert.equal(woke.sleeping, false, 'W wakes');
  assert.ok(woke.t >= mid.t && woke.t < 0.32, 'early wake keeps the time it got to');
  // Again, to the end.
  await page.evaluate(() => { const b = window.bed; window.__game.sleep({ x: b.x, y: b.y, z: b.z, block: 193 }); });
  await page.waitForFunction(() => !window.__game.sleeping, null, { timeout: 120_000 });
  const end = await page.evaluate(() => window.__game.dayCycle.time);
  assert.ok(Math.abs(end - 0.32) < 1e-6, `morning (${end})`);
  assert.deepEqual(errors, []);
  console.log('sleep-browser: ok');
} finally {
  await browser?.close();
  await server.close();
}
