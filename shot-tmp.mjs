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
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('docs/screens/craft9-part7', { recursive: true });
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Chain', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    bag.add('planks', 8);
    game.duilt.inventory = bag;
    game.duilt.crafting.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    game.world.setBlock(at.x, at.y, at.z, 341);
    game.remeshDirty?.();
    await game.modelsLoaded;
    game.startBench(at, 'wood_mill');
  });
  await page.waitForSelector('.bench-bar:not([hidden])');
  await page.locator('[data-pick]', { hasText: 'Plank Slab' }).first().tap();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screens/craft9-part7/closeup-wood-mill.png', timeout: 90_000 });
  console.log('bar', JSON.stringify(await page.evaluate(() => {
    const b = document.querySelector('.bench-bar').getBoundingClientRect();
    const c = document.querySelector('.chain-line'); const w = document.querySelector('[data-work]').getBoundingClientRect();
    return { bar: [b.top, b.bottom, b.width], chain: c?.textContent, chainBottom: c?.getBoundingClientRect().bottom, work: [w.top, w.height], scrollW: document.documentElement.scrollWidth };
  })));
  await page.locator('[data-leave]').tap();
  await page.evaluate(() => { const g = window.__game; g.ui.openPanel('panel-stats'); document.querySelector('#book-tab').click(); });
  await page.waitForSelector('[data-book="slab_plank"]', { state: 'attached' });
  await page.evaluate(() => document.querySelector('[data-book="slab_plank"]').scrollIntoView({ block: 'center' }));
  await page.locator('[data-book="slab_plank"]').tap();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#book-detail').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  console.log('book', await page.evaluate(() => document.querySelector('#book-detail').textContent.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'docs/screens/craft9-part7/recipe-book.png', timeout: 90_000 });
  console.log('errors', JSON.stringify(errors));
} finally {
  await browser?.close();
  await server.close();
}
