// Local-only integration check: no .env, accounts, or external requests.
// The storehouse's "Won't take from deliveries" chips stay hidden until the fold is pressed.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')),
  null, { timeout: 120_000 });
  await page.evaluate(() => {
    const g = window.__game;
    g.newWorld({ mode: 'creative', name: 'Store routing check', seed: 7, silent: true });
    g.ui.refreshForMode();
    g.ui.hideBlocker();
    const reg = g.duilt.structures;
    const s = { id: reg.nextId++, type: 'storehouse', region: { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 },
      valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null, excludes: ['stone', 'wood'] };
    reg.structures.push(s);
    g.ui.openStore(s);
  });
  const fold = page.locator('#btn-store-routing');
  const chips = page.locator('#store-routing-chips');
  assert.equal(await fold.getAttribute('aria-expanded'), 'false', 'fold starts shut');
  assert.equal(await chips.isVisible(), false, 'chips hidden until the fold is pressed');
  assert.match(await page.locator('#store-routing-count').textContent(), /^2 refused$/);
  await fold.click();
  assert.equal(await fold.getAttribute('aria-expanded'), 'true');
  assert.equal(await chips.isVisible(), true, 'chips show once opened');
  assert.ok(await chips.locator('[data-route]').count() > 0, 'chips are rendered');
  await fold.click();
  assert.equal(await chips.isVisible(), false, 'chips hide again');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal scroll');
  assert.deepEqual(errors, []);
  console.log('PASS store routing fold');
} finally {
  await browser?.close();
  await server.close();
}
