// Real UI and inventory, isolated from accounts and external services.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    // Verification snapshots can share their parent checkout's dependencies.
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Crafting checks', seed: 71823, silent: true });
    game.ui.hideBlocker();
    // A real finite bag in the harmless Creative scene: verify actual payments.
    const { Inventory } = await import('/src/items/Inventory.js');
    const { RECIPES_BY_ID } = await import('/src/config/recipes.js');
    const bag = new Inventory();
    game.duilt.inventory = bag;
    game.duilt.crafting.inventory = bag;
    window.craftCheck = { bag, recipes: RECIPES_BY_ID };
    // The check below supplies actual placed station blocks near the player.
    const p = game.player.position;
    const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
    window.craftCheck.origin = { x, y, z };
    for (const [dx, id] of [[1,380], [2,525], [3,524], [-1,341]]) game.world.setBlock(x+dx,y,z,id);
    game.duilt.structures.structures.push({ id: 98765, type: 'workshop', valid: true, tier: 0,
      region: { minX:x, maxX:x, minY:y, maxY:y, minZ:z, maxZ:z } });
  });

  // Early processing, all work steps, bulk payment and reusable tools.
  for (const id of ['cobblestone', 'stone_mill_stone_brick', 'marble', 'stone_white', 'stone_grey', 'stone_orange', 'dark_stone', 'dark_brick', 'sky_marble', 'bed', 'cabinet', 'table_oak', 'sword_wood', 'sword_iron', 'bow']) {
    await prepare(id, id === 'stone_white' ? 3 : 1);
    const button = page.locator(`[data-craft="${id}"][data-times="1"]`);
    await button.tap();
    const work = page.locator('.craft-work');
    assert.equal(await work.count(), 1, `${id}: work steps open`);
    const batches = id === 'stone_white' ? 3 : 1;
    await work.locator('[data-work-count]').fill(String(batches));
    await work.locator('[data-work-count]').dispatchEvent('input');
    assert.match(await work.locator('[data-work-summary]').textContent(), /Makes|Produces/);
    const before = await bagJSON();
    const steps = await page.evaluate(id => craftCheck.recipes.get(id).steps.length, id);
    for (let s = 0; s < steps; s++) {
      if (s < steps - 1) assert.equal(await bagJSON(), before, `${id}: no early payment`);
      await work.locator('[data-work-next]').tap();
    }
    assert.equal(await work.count(), 0);
    const result = await page.evaluate(({id,batches}) => {
      const r = craftCheck.recipes.get(id), bag = craftCheck.bag;
      return { made: bag.countOf(r.output.id), expected: r.output.count*batches,
        tools: (r.tools ?? []).every(t => bag.countOf(t) === 1),
        paid: Object.keys(r.inputs).every(part => bag.countOf(part) === 0) };
    }, {id,batches});
    assert.deepEqual(result, { made: result.expected, expected: result.expected, tools: true, paid: true }, id);
  }
  console.log('PASS touch crafting: every processing route, furniture, forged weapons, exact batch payments and reusable tools');

  await prepare('stone_white', 3);
  await page.locator('[data-craft="stone_white"][data-times="1"]').tap();
  const work = page.locator('.craft-work');
  await work.locator('[data-work-count]').fill('1.5');
  const beforeCancel = await bagJSON();
  await work.locator('[data-work-next]').tap();
  assert.match(await work.locator('[data-work-status]').textContent(), /whole batches/);
  assert.equal(await bagJSON(), beforeCancel);
  await work.locator('[data-work-count]').fill('3');
  await work.locator('[data-work-next]').tap();
  assert.equal(await work.locator('[data-work-count]').isDisabled(), true, 'Batch count is fixed once work starts');
  await work.locator('[data-work-cancel]').tap();
  assert.equal(await bagJSON(), beforeCancel, 'Cancel spends nothing');

  await page.locator('[data-craft="stone_white"][data-times="1"]').tap();
  await work.locator('[data-work-next]').tap();
  await page.evaluate(() => window.__game.ui.closePanel('panel-bench'));
  assert.equal(await work.count(), 0, 'Closing the panel cancels unfinished work');
  assert.equal(await bagJSON(), beforeCancel);
  console.log('PASS invalid quantities, cancellation and panel closure leave the bag intact');

  await prepare('sword_iron');
  await page.locator('[data-craft="sword_iron"][data-times="1"]').tap();
  await work.locator('[data-work-next]').tap();
  await page.evaluate(() => craftCheck.bag.remove('weapon_mold',1));
  const withoutTool = await bagJSON();
  await work.locator('[data-work-next]').tap();
  assert.match(await work.locator('[data-work-status]').textContent(), /Mold/);
  assert.equal(await bagJSON(), withoutTool);
  await page.evaluate(() => craftCheck.bag.add('weapon_mold',1));
  await page.evaluate(() => { window.__game.player.position.x += 100; });
  await work.locator('[data-work-next]').tap();
  assert.match(await work.locator('[data-work-status]').textContent(), /forge/);
  await page.evaluate(() => { window.__game.player.position.x -= 100; craftCheck.bag.remove('iron_ingot',1); });
  const withoutMaterial = await bagJSON();
  await work.locator('[data-work-next]').tap();
  assert.match(await work.locator('[data-work-status]').textContent(), /Needs|materials/i);
  assert.equal(await bagJSON(), withoutMaterial);
  console.log('PASS live station, tools and materials are rechecked during work');

  await prepare('stone_white', 3);
  await page.locator('[data-craft="stone_white"][data-times="3"]').tap();
  assert.equal(await work.locator('[data-work-count]').inputValue(), '3');
  await work.locator('[data-work-next]').tap();
  await page.evaluate(() => craftCheck.bag.remove('stone',1));
  const smallerBatch = await bagJSON();
  await work.locator('[data-work-next]').tap();
  assert.match(await work.locator('[data-work-status]').textContent(), /smaller batch/i);
  assert.equal(await bagJSON(), smallerBatch, 'A bulk job cannot silently finish fewer batches');
  await work.locator('[data-work-cancel]').tap();
  await page.evaluate(() => {
    for (let i=0;i<craftCheck.bag.size;i++) if (!craftCheck.bag.slots[i]) craftCheck.bag.slots[i]={id:'dirt',count:9999,wear:0};
  });
  const full = await bagJSON();
  await page.locator('[data-craft="stone_white"][data-times="1"]').tap();
  assert.equal(await work.count(), 0, 'A full bag cannot start work');
  assert.equal(await bagJSON(), full);
  console.log('PASS bulk shortages and full bags refuse without partial payment');

  // A panel detached by rerendering or a new world must not finish old work.
  await prepare('stone_white');
  await page.locator('[data-craft="stone_white"][data-times="1"]').tap();
  const beforeStale = await bagJSON();
  await page.evaluate(() => {
    const next = document.querySelector('[data-work-next]');
    const original = window.__game.duilt;
    window.__game.duilt = null;
    try { next.click(); next.click(); } finally { window.__game.duilt = original; }
  });
  assert.equal(await bagJSON(), beforeStale, 'Old work cannot craft into a world that was left');
  await page.evaluate(() => {
    const next = document.querySelector('[data-work-next]');
    window.__game.ui.duiltUI.renderBench();
    next.click(); next.click();
  });
  assert.equal(await bagJSON(), beforeStale, 'Detached work cannot spend materials');

  await page.locator('[data-craft="stone_white"][data-times="1"]').tap();
  const bounds = await work.locator('[data-work-next]').boundingBox();
  assert.ok(bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Phone controls fit and have a 44px tap target');
  const workBounds = await work.boundingBox();
  for (const selector of ['[data-work-count]', '[data-work-next]', '[data-work-cancel]']) {
    const box = await work.locator(selector).boundingBox();
    assert.ok(box.x >= workBounds.x && box.x+box.width <= workBounds.x+workBounds.width, `${selector} fits inside its work card`);
  }
  mkdirSync('artifacts/crafting', { recursive: true });
  await page.screenshot({ path: 'artifacts/crafting/phone-work.png' });
  await page.evaluate(() => { const next=document.querySelector('[data-work-next]'); for(let i=0;i<6;i++) next.click(); });
  assert.equal(await page.evaluate(() => craftCheck.bag.countOf('stone_white')),2, 'Repeated clicks finish exactly once');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log('PASS stale work, repeated taps and phone layout (isolated Chromium)');

  async function bagJSON() { return page.evaluate(() => JSON.stringify(craftCheck.bag.toJSON())); }
  async function prepare(id, batches = 1) {
    await page.evaluate(({id,batches}) => {
      const { bag, recipes } = craftCheck, r = recipes.get(id), game = window.__game;
      bag.slots.fill(null);
      for (const [part,n] of Object.entries(r.inputs)) bag.add(part,n*batches);
      for (const tool of r.tools ?? []) bag.add(tool,1);
      game.ui.openBench(r.name);
    }, {id,batches});
  }
} finally {
  await browser?.close();
  await server.close();
}
