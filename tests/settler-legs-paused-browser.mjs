// IMP-16 again (owner, 4 November): "the villagers stop with the legs wrong".
// With a panel open the game waits, and the villagers' view was only redrawn
// while playing: whoever was mid-stride stayed mid-stride until you closed it.
// Now they finish their step and stand straight while you look at a panel.
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
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Legs', seed: 4242, silent: true });
    g.ui.hideBlocker();
    await g.modelsLoaded;
    const d = g.duilt, pp = g.player.position, x0 = Math.floor(pp.x), z0 = Math.floor(pp.z), y0 = Math.floor(pp.y);
    const reg = (dx, dz) => ({ minX: x0 + dx, maxX: x0 + dx + 3, minY: y0, maxY: y0 + 3, minZ: z0 + dz, maxZ: z0 + dz + 3 });
    d.structures.structures.push({ id: 99701, type: 'house', valid: true, tier: 0, lastPaidAt: Date.now(), region: reg(-8, 4) });
    d.structures.structures.push({ id: 99702, type: 'farm', valid: true, tier: 0, lastPaidAt: Date.now(), region: reg(6, 4) });
    d.settlers.arrive = () => null;
    for (let i = 0; i < 6; i++) d.settlers.people.push({ id: 9000 + i, name: 'Walker ' + i, x: x0 + i - 3 + 0.5, z: z0 + 3.5, y: y0, homeId: 99701, workId: 99702, target: null, wait: 0, atWork: false, hungry: false });
  });
  // Wait until someone is mid-stride, then open the bag.
  await page.waitForFunction(() => window.__game.duilt.settlers.people.some((p) => (p._stride ?? 0) > 0.5 && Math.abs(Math.sin(p._walk * 5)) > 0.5), null, { timeout: 60_000, polling: 'raf' });
  await page.evaluate(() => window.__game.ui.openPanel('panel-bag'));
  assert.equal(await page.evaluate(() => window.__game.phase), 'paused');
  // A few redraws later, everyone stands straight.
  const frames = await page.evaluate(() => new Promise((done) => { let n = 0; const f = () => (++n < 25 ? requestAnimationFrame(f) : done(n)); requestAnimationFrame(f); }));
  const legs = await page.evaluate(() => window.__game.duilt.settlers.people.map((p) => +(Math.sin((p._walk ?? 0) * 5) * 0.6 * (p._stride ?? 0)).toFixed(3)));
  assert.ok(legs.every((s) => Math.abs(s) < 0.05), `after ${frames} frames paused, legs straight: ${legs.join(' ')}`);
  assert.deepEqual(errors, []);
  console.log('PASS with a panel open, walking villagers finish their step and stand with straight legs');
} finally { await browser?.close(); await server.close(); }
