// IMP-13 and IMP-14 in a real page: a placed forge's panel is titled Forge
// and lists only forge recipes; the menu bench is titled Workbench again.
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
  const seen = await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Station panels', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { RECIPES } = await import('/src/config/recipes.js');
    game.ui.openBench('', 'forge');
    const title = document.querySelector('#bench-title')?.textContent;
    const tiles = [...document.querySelectorAll('#bench-list [data-craft], #bench-list .recipe')].length;
    const forgeRecipes = RECIPES.filter((r) => r.station === 'forge').length;
    const showAll = !!document.querySelector('#bench-all');
    game.ui.closeAllPanels();
    game.ui.openBench();
    const menuTitle = document.querySelector('#bench-title')?.textContent;
    return { title, tiles, forgeRecipes, showAll, menuTitle };
  });
  assert.equal(seen.title, 'Forge');
  assert.equal(seen.showAll, false, 'no way to every recipe from a station');
  assert.ok(seen.tiles > 0 && seen.tiles <= seen.forgeRecipes, `only forge recipes (${seen.tiles} of ${seen.forgeRecipes})`);
  assert.equal(seen.menuTitle, 'Bench');
  assert.deepEqual(errors, []);
  console.log(`PASS a placed forge is titled Forge and lists only its ${seen.tiles} recipes; the menu bench is the Bench`);
} finally { await browser?.close(); await server.close(); }
