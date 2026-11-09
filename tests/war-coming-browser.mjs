// Owner, 9 November, on the desktop: "not seeing the top indication that the
// warriors are coming. neither the distance as I had it in mobile." The war
// bar showed only while a round was being fought. Between rounds it now says
// which round comes next and when, on a desktop and a phone alike.
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
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
    await page.evaluate(async () => {
      const g = window.__game;
      g.newWorld({ mode: 'duilt', name: 'War', seed: 4242, silent: true }); g.ui.hideBlocker(); await g.modelsLoaded;
      const d = g.duilt; d.territory.age = 10;
      d.war.stage = 'waiting'; d.war.round = 3; d.war.due = d.days + 0.15;
    });
    await page.waitForFunction(() => !document.querySelector('#vital-war')?.hidden, null, { timeout: 10_000 });
    const between = await page.$eval('#vital-war', (el) => ({ text: el.textContent, w: el.getBoundingClientRect().width }));
    assert.match(between.text, /Round 3 comes in \d+ min \d\d s/, between.text);
    assert.ok(between.w > 40);
    // Then the round comes: the bar, the count and the distance.
    await page.evaluate(() => { const d = window.__game.duilt; d.war.stage = 'fighting'; });
    await page.waitForFunction(() => / left · \d+ m/.test(document.querySelector('#vital-war')?.textContent ?? ''), null, { timeout: 15_000 });
    const fighting = await page.$eval('#vital-war', (el) => el.textContent);
    assert.match(fighting, /Round 3 · \d+ of \d+ left · \d+ m/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${vp.width} wide: "${between.text}" between rounds, then "${fighting}"`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
