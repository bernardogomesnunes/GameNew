// The two loading screens on a phone (owner, 17 November): starting the game
// shows a night sky; opening a world shows daylight and ground growing up
// behind the bar until it fills the screen. Screenshots in docs/screens/loading.
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
  mkdirSync('docs/screens/loading', { recursive: true });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('#loading');
  const start = await page.evaluate(() => ({
    world: document.querySelector('#loading').classList.contains('ld-world'),
    canvas: !!document.querySelector('#loading canvas'),
    bg: getComputedStyle(document.querySelector('#loading')).backgroundImage,
  }));
  assert.equal(start.world, false, 'the start screen is not the world screen');
  assert.equal(start.canvas, false, 'no ground on the start screen');
  assert.match(start.bg, /radial-gradient/, 'night sky on the start screen');
  await page.screenshot({ path: 'docs/screens/loading/start.png' });
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });

  // The ground at set points of the bar, for the screenshots.
  await page.waitForFunction(() => !document.querySelector('#loading'), null, { timeout: 10_000 });
  for (const pct of [20, 55]) {
    await page.evaluate(async (pct) => {
      const m = await import('/src/ui/loading.js');
      if (pct === 20) m.loadingShow('Opening your world…', { world: true });
      m.loadingProgress(pct, 'Opening your world…');
    }, pct);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/screens/loading/world-${pct}.png` });
  }
  await page.evaluate(async () => (await import('/src/ui/loading.js')).loadingDone());
  await page.waitForFunction(() => !document.querySelector('#loading'), null, { timeout: 10_000 });

  // Making a world: the world screen, with the ground.
  await page.evaluate(() => {
    const game = window.__game;
    window.__done = game.withLoading('Building the world…', () => { game.newWorld({ mode: 'creative', name: 'Ground', seed: 4242, silent: true }); });
  });
  const shots = [];
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('#loading');
      const c = root?.querySelector('canvas.ld-grow');
      if (!root || !c) return null;
      const ctx = c.getContext('2d');
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let filled = 0;
      for (let k = 3; k < data.length; k += 4) if (data[k] > 0) filled++;
      return { world: root.classList.contains('ld-world'), pct: Number(root.getAttribute('aria-valuenow')), filled: filled / (c.width * c.height) };
    });
    if (!s) break;
    shots.push(s);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.__done);
  console.log(shots.map((s) => `${s.pct}%:${Math.round(s.filled * 100)}`).join(' '));
  assert.ok(shots.length > 0, 'the world screen came up');
  assert.ok(shots.every((s) => s.world), 'opening a world uses the world screen');
  assert.ok(shots.at(-1).filled > shots[0].filled, 'the ground grew');
  assert.ok(Math.max(...shots.map((s) => s.filled)) > 0.9, 'the ground nearly fills the screen by the end');
  await page.waitForFunction(() => !document.querySelector('#loading'), null, { timeout: 10_000 });
  assert.deepEqual(errors, []);
  console.log('PASS start screen is night with no ground; opening a world grows the ground to fill the screen');
} finally {
  await browser?.close();
  await server.close();
}
