// PLAY-11 chunk B: the Factory's Lines section in a real page, at phone and
// desktop size. Screenshots go to docs/screens/play-11/.
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('docs/screens/play-11', { recursive: true });
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Factory', seed: 71811, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const d = game.duilt, p = game.player.position;
    d.territory.setAge(10);
    d.war.stage = 'won';
    const at = { x: Math.floor(p.x), y: Math.floor(p.y) + 20, z: Math.floor(p.z) + 6 };
    const region = { minX: at.x, maxX: at.x + 9, minY: at.y, maxY: at.y + 4, minZ: at.z, maxZ: at.z + 9 };
    // Workbench, Planing Bench, Stone Mill and Mason's Bench on the floor.
    [529, 527, 380, 538].forEach((id, i) => game.world.setBlock(at.x + 2 + i * 2, at.y + 1, at.z + 2, id));
    const put = (type, r) => {
      const s = { id: d.structures.nextId++, type, region: r, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null, excludes: [], tier: 0 };
      d.structures.structures.push(s);
      d.structures.storeFor(s);
      return s;
    };
    const factory = put('factory', region);
    const shed = put('storehouse', { minX: at.x + 12, maxX: at.x + 14, minY: at.y, maxY: at.y + 3, minZ: at.z, maxZ: at.z + 3 });
    shed.store.add('wood', 40);
    shed.store.add('stone', 2);
    window.factoryCheck = { id: factory.id };
  });
  const open = () => page.evaluate(() => {
    const g = window.__game, s = g.duilt.structures.structures.find((x) => x.id === window.factoryCheck.id);
    g.ui.openBuilding(s, g.buildingActions(s));
  });
  const noSideScroll = async (label) => {
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth,
      panel: Math.max(0, ...[...document.querySelectorAll('#panel-building .factory-lines, #panel-building .factory-lines *')].map((e) => e.getBoundingClientRect().right)) }));
    assert.ok(w.doc <= w.win, `${label}: page scrolls sideways (${w.doc} > ${w.win})`);
    assert.ok(w.panel <= w.win + 1, `${label}: something sticks out of the screen (${w.panel} > ${w.win})`);
  };
  const row = (st) => page.textContent(`[data-factory-line="${st}"]`);

  await open();
  await page.waitForSelector('#building-body .factory-lines');
  const stations = await page.$$eval('[data-factory-line]', (els) => els.map((e) => e.dataset.factoryLine));
  assert.deepEqual(stations, ['workbench', 'planing_bench', 'stone_mill', 'masons_bench'], 'one row per machine kind, in panel order');
  assert.match(await page.textContent('.factory-lines'), /0 of 6 running/);
  console.log('PASS one row per machine kind inside');

  assert.ok(await page.$('[data-factory-search="workbench"]'), 'the Workbench row has a search box');
  assert.ok(await page.$('[data-factory-search="masons_bench"]'), "the Mason's Bench row has one too (24 recipes)");
  assert.ok(!await page.$('[data-factory-search="planing_bench"]'), 'the Planing Bench row (3 recipes) has none');
  await page.fill('[data-factory-search="workbench"]', 'torch');
  const opts = await page.$$eval('[data-factory-pick="workbench"] option', (os) => os.map((o) => o.textContent));
  assert.ok(opts.length >= 2 && opts.length < 10 && opts.slice(1).every((t) => /torch/i.test(t)), `the search narrows the picker (${opts.join(' | ')})`);
  console.log('PASS the Workbench search narrows its picker');

  await page.selectOption('[data-factory-pick="planing_bench"]', 'bench_planks');
  await page.waitForFunction(() => /Running/.test(document.querySelector('[data-factory-line="planing_bench"]')?.textContent ?? ''));
  const pr = await row('planing_bench');
  // 12 a building day, shown a game day at PRODUCTION_PACE (0.2), as every building panel does.
  assert.match(pr, /2\.4 oak planks a day/, pr);
  assert.match(await page.textContent('.factory-lines'), /1 of 6 running/);
  console.log('PASS the picker sets bench_planks: "2.4 oak planks a day", Running');

  await page.selectOption('[data-factory-pick="stone_mill"]', 'stone_mill_stone_brick');
  await page.waitForFunction(() => /Waiting for/.test(document.querySelector('[data-factory-line="stone_mill"]')?.textContent ?? ''));
  assert.match(await row('stone_mill'), /Waiting for 4 stone \(2 in stores\)/);
  console.log('PASS a line short of stone says what it waits for');

  const picked = await page.evaluate(() => window.__game.duilt.factoryLines(window.factoryCheck.id).rows.map((r) => r.recipe));
  assert.deepEqual(picked, [null, 'bench_planks', 'stone_mill_stone_brick', null]);
  const takenText = await page.$eval('[data-factory-pick="workbench"]', (s) => [...s.options].find((o) => o.value === 'planks')?.textContent ?? '');
  await page.fill('[data-factory-search="workbench"]', 'planks');
  const taken = await page.$eval('[data-factory-pick="workbench"]', (s) => { const o = [...s.options].find((x) => x.value === 'planks'); return o && { t: o.textContent, d: o.disabled }; });
  assert.ok(taken?.d && /Planing Bench line makes this/.test(taken.t), `planks are greyed on the Workbench (${takenText} / ${taken?.t})`);
  console.log('PASS a recipe another line makes is greyed with the reason');

  await page.fill('[data-factory-search="workbench"]', '');
  const small = await page.$$eval('.factory-line select, .factory-line input', (els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h < 43.5));
  assert.deepEqual(small, [], 'pickers and search boxes are 44px tall or more');
  await page.locator('.factory-lines').scrollIntoViewIfNeeded();
  await noSideScroll('phone');
  await page.screenshot({ path: 'docs/screens/play-11/factory-phone.png' });

  await page.setViewportSize({ width: 1280, height: 800 });
  await open();
  await page.waitForSelector('#building-body .factory-lines');
  await page.locator('.factory-lines').scrollIntoViewIfNeeded();
  await noSideScroll('desktop');
  await page.screenshot({ path: 'docs/screens/play-11/factory-desktop.png' });
  console.log('PASS screenshots at 390x844 and 1280x800');

  assert.deepEqual(errors, []);
  console.log('PASS no page errors');
} finally {
  await browser?.close();
  await server.close();
}
