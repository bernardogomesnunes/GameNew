// PLAY-12: the War Hall pop-up in a real page. Company cards, four order
// buttons, the March picker and Back, no horizontal scroll at 360 and 1280
// wide. Screenshots go to docs/screens/play-12/ (deviceScaleFactor 1).
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
const SHOTS = 'docs/screens/play-12';
mkdirSync(SHOTS, { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, width, height, mobile] of [['phone', 390, 844, true], ['small', 360, 740, true], ['desktop', 1280, 800, false]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__game && !window.__game.booting
      && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
    await page.evaluate(async () => {
      const game = window.__game;
      game.newWorld({ mode: 'battle', name: 'War', seed: 71823, silent: true });
      game.ui.hideBlocker();
      await game.modelsLoaded;
      const d = game.duilt, p = game.player.position;
      const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) + 6 };
      const box = (dx, dz) => ({ minX: at.x + dx, maxX: at.x + dx + 3, minY: at.y, maxY: at.y + 3, minZ: at.z + dz, maxZ: at.z + dz + 3 });
      const mk = (id, type, tier, region) => d.structures.structures.push({ id, type, valid: true, tier, lastPaidAt: Date.now(), region });
      mk(99801, 'barracks', 1, box(-12, 3));
      mk(99802, 'military', 0, box(-6, 3));
      mk(99803, 'war_hall', 0, box(0, 3));
      mk(99804, 'armoury', 0, box(6, 3));
      d.defenders.trained['99801'] = { roster: ['swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'archer', 'archer', 'archer', 'archer'], queue: [], since: d.days };
      d.defenders.trained['99802'] = { roster: ['shield_guard', 'shield_guard', 'shield_guard'], queue: [], since: d.days };
      d.research.arms_iron = true; d.research.fletching = true;
      d.age = 10;
      game.defenceSyncedAt = 0;
    });
    const open = (id) => page.evaluate((i) => {
      const g = window.__game, s = g.duilt.structures.structures.find((x) => x.id === i);
      g.ui.openBuilding(s, g.buildingActions(s));
    }, id);
    const noSideScroll = async (label) => {
      const m = await page.evaluate(() => {
        const panel = document.querySelector('#panel-building .panel');
        return { doc: document.documentElement.scrollWidth, win: window.innerWidth, panel: panel?.scrollWidth, panelBox: panel?.clientWidth };
      });
      assert.ok(m.doc <= m.win, `${name} ${label}: the page scrolls sideways (${m.doc} > ${m.win})`);
      assert.ok(m.panel <= m.panelBox, `${name} ${label}: the pop-up scrolls sideways (${m.panel} > ${m.panelBox})`);
    };

    // The War Hall's list.
    await open(99803);
    await page.waitForSelector('.company-card');
    assert.equal(await page.$$eval('.company-card', (c) => c.length), 2, `${name}: a card for each company`);
    assert.equal(await page.$$eval('.company-card:first-child .company-orders button', (b) => b.length), 4, `${name}: four order buttons`);
    assert.match(await page.$eval('.company-card:first-child', (c) => c.textContent), /Barracks 1 · Drill Hall/, `${name}: name and level`);
    assert.match(await page.$eval('.company-card:first-child', (c) => c.textContent), /6 swordsmen, 4 archers/, `${name}: counts by unit`);
    assert.match(await page.$eval('.company-card:last-child', (c) => c.textContent), /Garrison 1/, `${name}: the Garrison is a company`);
    if (mobile) {
      const h = await page.$eval('.company-card:first-child .company-orders button', (b) => b.getBoundingClientRect().height);
      assert.ok(h >= 44, `${name}: order buttons are 44 px tall (${h})`);
    }
    await noSideScroll('list');
    await page.screenshot({ path: `${SHOTS}/war-hall-${name}.png` });
    console.log(`PASS ${name}: War Hall cards`);

    // An order from the hall reaches the building.
    await page.click('.company-card:first-child [data-company-order$=":patrol"]');
    await page.waitForFunction(() => window.__game.duilt.defenders.orderOf(99801) === 'patrol');
    await page.waitForSelector('.company-card');
    assert.match(await page.$eval('.company-card:first-child .company-state', (c) => c.textContent), /Patrol/, `${name}: the card says the order`);
    console.log(`PASS ${name}: an order from the hall sets the company's order`);

    // March: the picker opens, Back returns.
    await page.click('.company-card:first-child [data-march-open]');
    await page.waitForSelector('.march-picker');
    assert.equal(await page.$$eval('.rival-pick', (r) => r.length), 3, `${name}: three rivals`);
    await noSideScroll('picker');
    await page.screenshot({ path: `${SHOTS}/war-hall-march-${name}.png` });
    await page.click('[data-march-back]');
    await page.waitForSelector('.company-card');
    assert.equal(await page.$$eval('.march-picker', (r) => r.length), 0, `${name}: Back closes the picker`);
    console.log(`PASS ${name}: the picker opens and Back returns`);

    // Send one.
    await page.click('.company-card:first-child [data-march-open]');
    await page.waitForSelector('.march-picker');
    await page.click('[data-march-send$=":0"]');
    await page.waitForFunction(() => window.__game.duilt.defenders.marches.length === 1);
    await page.waitForSelector('.company-card.away');
    assert.match(await page.$eval('.company-card.away .company-state', (c) => c.textContent), /Marching to .+: arrives in \d+ min/, `${name}: the card says where and when`);
    await noSideScroll('away');
    await page.screenshot({ path: `${SHOTS}/war-hall-away-${name}.png` });
    console.log(`PASS ${name}: Send puts the company on the march`);

    // The barracks says so, and the Armoury shows what it has learnt.
    await open(99801);
    await page.waitForSelector('.march-away');
    assert.match(await page.$eval('.march-away', (e) => e.textContent), /On the march/, `${name}: the barracks says On the march`);
    await open(99804);
    await page.waitForSelector('.armoury-learnt');
    assert.match(await page.$eval('.armoury-learnt', (e) => e.textContent), /Learnt: Iron Arms, Fletching/, `${name}: the Armoury lists what is learnt`);
    await noSideScroll('armoury');
    await page.screenshot({ path: `${SHOTS}/armoury-${name}.png` });
    console.log(`PASS ${name}: the barracks and the Armoury`);

    assert.deepEqual(errors, [], `${name}: no page errors`);
    await ctx.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
