// Owner, 9 November: after a relaunch "it won't open the world ... it stays
// on 10 per cent of the bar". Opening a world asks "This world is open
// somewhere else" (Game.takeWorldSession, while the loading screen shows),
// and the question was drawn under the loading screen, out of sight. It now
// steps the loading screen aside while it asks (loadingAside).
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const { loadingShow } = await import('/src/ui/loading.js');
    loadingShow('Opening your world…');
    // takeWorldSession, as when the world was open elsewhere a moment ago.
    const g = window.__game;
    const fake = { readWorldSession: async () => ({ session_id: 'other-tab-1234', device: 'iPhone, Safari', seen_at: new Date().toISOString() }),
      claimWorldSession: async () => true, touchWorldSession: async () => true, releaseWorldSession: async () => true };
    const { WorldSession } = await import('/src/storage/WorldSession.js');
    g.worldSession = new WorldSession({ transport: fake });
    g.cloud = g.cloud ?? { transport: fake };
    window.__answer = null;
    g.takeWorldSession('w1').then((v) => { window.__answer = v; });
  });
  await page.waitForTimeout(300);
  const top = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el?.closest('.confirm-backdrop') ? 'confirm' : el?.closest('#loading') ? 'loading' : el?.id || el?.className;
  });
  assert.equal(top, 'confirm', 'the question shows over the loading screen');
  await page.click('.confirm-card [data-yes]');
  await page.waitForFunction(() => window.__answer !== null);
  assert.equal(await page.evaluate(() => window.__answer), true, 'and can be answered');
  assert.equal(await page.evaluate(() => document.getElementById('loading')?.style.visibility), '', 'the loading screen comes back after');
  console.log('PASS a question asked while a world opens shows over the loading screen, and can be answered');
} finally {
  await browser?.close();
  await server.close();
}
