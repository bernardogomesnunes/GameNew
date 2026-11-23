// PLAY-13: the Town panel and a thought bubble in a real browser, at phone and desktop size.
// Screenshots go to docs/screens/play-13/ when PLAY13_SHOTS=1.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const SHOTS = process.env.PLAY13_SHOTS === '1';
const OUT = new URL('../docs/screens/play-13/', import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const server = await createServer({ configFile: false, envDir: false, define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') }, server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [label, viewport, mobile] of [['390x844', { width: 390, height: 844 }, true], ['1280x800', { width: 1280, height: 800 }, false]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120000 });
    await page.evaluate(() => {
      const game = window.__game;
      game.newWorld({ mode: 'creative', seed: 71823, silent: true });
      game.ui.hideBlocker();
      const d = game.duilt;
      d.settlers.tick = () => {};
      const p = game.player.position, x = Math.floor(p.x) + 4, z = Math.floor(p.z) + 4, y = game.world.surfaceHeight(x, z);
      d.structures.structures.push({ id: 99881, type: 'work_hall', valid: true, tier: 0, locked: true, region: { minX: x - 12, maxX: x - 8, minY: y, maxY: y + 4, minZ: z - 12, maxZ: z - 8 } });
      d.structures.structures.push({ id: 99880, type: 'house', valid: true, tier: 0, locked: true, region: { minX: x + 8, maxX: x + 12, minY: y, maxY: y + 4, minZ: z + 8, maxZ: z + 12 } });
      const dir = game.player.lookDirection?.() ?? { x: 0, z: -1 };
      const mk = (id, name, mood, band, hungry, idleFor, workId, at) => {
        const px = p.x + dir.x * at + (id - 2) * 1.2, pz = p.z + dir.z * at;
        return { id, name, colour: 0x4f7fbf, homeId: 99880, workId, x: px, z: pz, y: game.world.surfaceHeight(Math.floor(px), Math.floor(pz)), target: null, wait: 99, atWork: false, hp: 10, hungry, mood, band, idleFor, furiousFor: band === 'furious' ? 300 : 0, said: band === 'content' ? null : band, wasHungry: hungry };
      };
      d.settlers.people = [
        mk(1, 'Ana', 92, 'content', false, 0, 99881, 5),
        mk(2, 'Bram', 14, 'furious', true, 0, null, 5),
        mk(3, 'Cira', 33, 'angry', false, 4 * 900, null, 5),
        mk(4, 'Dov', 52, 'grumbling', false, 0, null, 5),
      ];
      window.__calls = () => { game.renderer.info.reset?.(); };
      d.settlers.hasJob = (q) => q.workId != null;
      game.ui.duiltUI.renderVitals();
    });
    // The counter dot and its tooltip.
    const dot = await page.evaluate(() => ({ hidden: document.querySelector('#people-dot').hidden, band: document.querySelector('#people-dot').dataset.band, title: document.querySelector('#vital-people').title }));
    assert.equal(dot.hidden, false);
    assert.equal(dot.band, 'furious');
    assert.match(dot.title, /Bram is furious: no food\. Tap to see your people\./);

    // A bubble is in the scene for each of the three unhappy villagers, as one draw call.
    const bubbles = await page.evaluate(async () => {
      const game = window.__game;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const mesh = game.settlerView.bubbles;
      game.renderer.info.autoReset = false; game.renderer.info.reset();
      game.renderer.render(game.scene, game.camera);
      const withBubbles = game.renderer.info.render.calls;
      mesh.visible = false;
      game.renderer.info.reset();
      game.renderer.render(game.scene, game.camera);
      const without = game.renderer.info.render.calls;
      mesh.visible = true;
      game.renderer.info.autoReset = true;
      return { count: mesh.count, withBubbles, without };
    });
    assert.equal(bubbles.count, 3);
    assert.equal(bubbles.withBubbles - bubbles.without, 1, 'bubbles cost one draw call');
    if (SHOTS) {
      await page.evaluate(() => { const g = window.__game; g.camera.lookAt?.(g.duilt.settlers.people[1].x, g.duilt.settlers.people[1].y + 1.5, g.duilt.settlers.people[1].z); });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}bubbles-${label}.png` });
    }

    // Tap the counter: nobody is feedable (no food), so the first tap says so; open the panel directly too.
    await page.evaluate(() => window.__game.ui.openPanel('panel-town'));
    await page.locator('#panel-town').waitFor({ state: 'visible' });
    const rows = await page.locator('.town-row').evaluateAll((els) => els.map((e) => e.querySelector('.town-name').textContent));
    assert.deepEqual(rows, ['Bram', 'Cira', 'Dov', 'Ana']);
    assert.match(await page.locator('#town-head').textContent(), /^Town mood 48\. 2 angry, 1 leaving\.$/);
    const scroll = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth, panel: (() => { const p = document.querySelector('#panel-town .panel'); return p.scrollWidth - p.clientWidth; })() }));
    assert.ok(scroll.w <= scroll.c, `no horizontal page scroll (${scroll.w} > ${scroll.c})`);
    assert.ok(scroll.panel <= 0, 'no horizontal scroll inside the panel');
    const tall = await page.locator('.town-actions button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    assert.ok(tall.length >= 3 && tall.every((h) => h >= 44), 'buttons are 44 px tall');
    if (SHOTS) await page.screenshot({ path: `${OUT}town-${label}.png` });

    // Give food with no food: a toast, still hungry.
    await page.evaluate(() => { const s = window.__game.duilt.settlers; s.realMeal = s.nextMeal; s.nextMeal = () => null; });
    await page.locator('[data-town-food]').first().click();
    assert.equal(await page.evaluate(() => window.__game.duilt.settlers.hungry), 1);
    // With food: Bram eats.
    await page.evaluate(() => { const s = window.__game.duilt.settlers; s.nextMeal = s.realMeal; s.inventory.add('fruit', 3); });
    await page.locator('[data-town-food]').first().click();
    assert.equal(await page.evaluate(() => window.__game.duilt.settlers.hungry), 0);

    // Find work opens the Work Hall pop-up, whose rows carry the mood dot.
    await page.locator('[data-town-work]').first().click();
    await page.locator('#panel-building [data-work-hall]').waitFor({ state: 'visible' });
    assert.ok(await page.locator('#panel-building .mood-dot').count() >= 4);
    if (SHOTS) await page.screenshot({ path: `${OUT}work-hall-${label}.png` });
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(`PASS ${label}: dot, bubble (1 draw call), Town panel rows, Give food, Find work`);
  }
} finally {
  await browser?.close();
  await server.close();
}
