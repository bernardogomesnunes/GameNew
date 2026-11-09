// Owner, 9 November: "The progress bar of the forge only loads if I close it
// and open it." The game waits while a panel is open, and the stations' work
// only went on while playing. Now it goes on under an open panel.
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
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  const started = await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Forge', seed: 71823, silent: true });
    g.ui.hideBlocker();
    const { StationWork } = await import('/src/duilt/StationWork.js');
    const recipe = StationWork.recipesAt('forge')[0];
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    for (const [id, n] of Object.entries(recipe.inputs)) bag.add(id, n * 2);
    for (const id of recipe.tools ?? []) bag.add(id, 1);
    g.duilt.inventory = bag; g.duilt.stationWork.bag = () => bag;
    const r = g.duilt.stationWork.put('s:test', recipe.id, 1);
    g.ui.openPanel('panel-bag');
    return { ok: r.ok, reason: r.reason, progress: g.duilt.stationWork.spot('s:test')?.progress ?? null };
  });
  assert.ok(started.ok, started.reason);
  assert.equal(await page.evaluate(() => window.__game.phase), 'paused', 'a panel open: the game waits');
  await page.waitForFunction((p0) => (window.__game.duilt.stationWork.spot('s:test')?.progress ?? 0) > p0 + 0.01, started.progress, { timeout: 30_000 });
  assert.deepEqual(errors, []);
  console.log('PASS with a panel open, the forge works on and its bar moves');
} finally { await browser?.close(); await server.close(); }
