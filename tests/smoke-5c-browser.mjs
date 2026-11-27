// Smoke test of the features merged on 27 November, in a real page: forests,
// villager sleep and asks, explorer gifts, fruit in pots, the wizard, staffed
// buildings, hand work and villager levels. Any page error or console error fails it.
// Run: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/smoke-5c-browser.mjs
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && new URL(m.location()?.url || 'http://127.0.0.1').hostname === '127.0.0.1') errors.push(m.text()); });
  await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto(server.resolvedUrls.local[0], { timeout: 180_000 });
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });

  const out = await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Smoke', seed: 71823, silent: true });
    g.ui.hideBlocker();
    await g.modelsLoaded;
    const d = g.duilt, R = {};
    // Fast-forward: tick the game with a fixed step and no drawing (software rendering runs at 1 fps).
    const ff = (secs, dt = 0.1) => {
      const render = g.renderer.render, delta = g.clock.getDelta;
      g.renderer.render = () => {}; g.clock.getDelta = () => dt;
      try { for (let t = 0; t < secs; t += dt) g.tick(); } finally { g.renderer.render = render; g.clock.getDelta = delta; }
    };
    const toasts = [];
    g.bus.on('toast', (x) => toasts.push(`${x.title} | ${x.body ?? ''}`));
    const p = g.player.position, x = Math.floor(p.x) + 6, z = Math.floor(p.z) + 6, y = Math.floor(p.y);
    window.home = { x: p.x, y: p.y, z: p.z };
    for (let dx = -3; dx <= 40; dx++) for (let dz = -3; dz <= 20; dz++) {
      g.world.setBlock(x + dx, y - 1, z + dz, 1);
      for (let dy = 0; dy < 14; dy++) g.world.setBlock(x + dx, y + dy, z + dz, 0);
    }
    const mk = (id, type, ox, oz) => { const s = { id, type, valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null, tier: 0, region: { minX: x + ox, maxX: x + ox + 4, minY: y, maxY: y + 3, minZ: z + oz, maxZ: z + oz + 4 } }; d.structures.structures.push(s); return s; };
    const house = mk(9002, 'house', 0, 0), farm = mk(9001, 'farm', 12, 0); mk(9003, 'work_hall', 6, 8);
    g.world.setBlock(x + 1, y, z + 2, 194); g.world.setBlock(x + 2, y, z + 2, 198);
    d.territory.age = 3;

    // Villager: sleeps at night, asks, takes the gift, takes a weapon, has a level.
    d.settlers.arrive();
    const ana = d.settlers.people[0];
    g.dayCycle.time = 0; ff(40);
    R.sleep = ana.sleep ? `${ana.sleep.kind}/${ana.sleep.state}` : null;
    g.dayCycle.time = 0.4; ff(5);
    R.awake = !ana.sleep;
    ana.nextAsk = 0.05; ff(1);
    R.ask = ana.ask?.item ?? null;
    R.bubbles = g.settlerView.bubbles.count;
    d.inventory.add(ana.ask.item, 1); d.inventory.add('sword_iron', 1);
    g.ui.openPanel('panel-town');
    R.row = document.querySelector('.town-row')?.innerText.replace(/\n+/g, ' / ');
    document.querySelector('[data-town-gift]').click();
    R.asked = ana.ask;
    document.querySelector('[data-town-arm]').click();
    R.weapon = ana.weapon;
    g.ui.closeAllPanels();
    // Staffed building.
    R.farmPanel = (() => { g.ui.openBuilding(farm, g.buildingActions(farm)); return document.querySelector('#panel-building').innerText; })();
    g.ui.closeAllPanels();
    return Object.assign(R, { toasts, farmId: farm.id, houseId: house.id });
  });
  assert.match(out.sleep, /^bed\/asleep$/, 'villager sleeps in the bed at night');
  assert.ok(out.awake, 'villager is up at dawn');
  assert.ok(out.ask && out.bubbles >= 1, 'an ask starts and shows a bubble');
  assert.match(out.row, /Wants .*\(\d days? left\)/, 'Town panel says what they want');
  assert.equal(out.asked, null, 'Give ends the ask');
  assert.equal(out.weapon, 'sword_iron', 'Give weapon arms the villager');
  assert.match(out.row, /Level 1 of 10/, 'Town panel shows the level');
  assert.match(out.farmPanel, /Makes nothing until a villager works here|villager works here/, 'building says if it is staffed');
  console.log('PASS villagers: sleep, ask bubble, Wants X, Give, level line, Give weapon');

  // Explorer, fruit, forests.
  const more = await page.evaluate(async () => {
    const g = window.__game, d = g.duilt, R = {};
    const { ITEMS_BY_ID } = await import('/src/config/items.js');
    const { BIOMES } = await import('/src/config/biomes.js');
    const { cropBlock } = await import('/src/config/crops.js');
    const { LOG_SIDE_BASE } = await import('/src/config/blocks.js');
    const gen = g.world.gen;
    const p = g.player.position;
    const lines = [];
    const orig = g.ui.toast.bind(g.ui);
    g.ui.toast = (t) => { lines.push(`${t.title} | ${t.body ?? ''}`); return orig(t); };
    let ex = null; for (let i = 0; i < 40 && !ex; i++) ex = g.wanderers.sendExplorer(p); // null while the ground 70 blocks away is not loaded
    g.talkTo({ who: 'explorer', person: ex }); g.talkTo({ who: 'explorer', person: ex });
    R.explorer = lines.filter((l) => /From the /.test(l)).join(' ; ');
    // Fruit: acorns from oak leaves, roots from crops, pot and seed through placement, growth, picking.
    const x = Math.floor(p.x) + 3, y = Math.floor(p.y), z = Math.floor(p.z) + 3;
    for (const k of ['carrot', 'lettuce', 'broccoli']) g.applyChanges([{ x, y, z: z + 10, prev: cropBlock(k, 3), next: 0 }], { chargeResources: false });
    R.dbg = { free: d.inventory.slots.filter((q) => !q).length, n: d.inventory.slots.length, veg: d.inventory.countOf('vegetables') };
    R.roots = ['carrot_root', 'lettuce_root', 'broccoli_root'].map((r) => d.inventory.countOf(r));
    for (let i = 0; i < 150; i++) g.applyChanges([{ x: x + (i % 5), y: y + 8, z: z - 3, prev: 5, next: 0 }], { chargeResources: false });
    R.acorns = d.inventory.countOf('acorn');
    d.inventory.add('plant_pot', 1); d.inventory.add('seeds_apple', 1);
    const place = (item, tx, ty, tz) => {
      g.selectedBlockId = ITEMS_BY_ID.get(item).block; g.selectedItemId = item;
      const rc = g.raycast;
      try { g.raycast = () => ({ x: tx, y: ty, z: tz, placeX: tx, placeY: ty + 1, placeZ: tz, block: g.world.getBlock(tx, ty, tz), normal: { x: 0, y: 1, z: 0 } }); g.placeBlock(); } finally { g.raycast = rc; }
    };
    place('plant_pot', x, y - 1, z); place('seeds_apple', x, y, z);
    const rec = d.fruitPlants.get(x, y + 1, z);
    R.planted = !!rec;
    rec.at = d.days - 6; g.growCrops(1e6);
    R.height = [0, 1, 2, 3].filter((i) => g.world.getBlock(x, y + 1 + i, z) !== 0).length;
    const before = d.inventory.countOf('apple');
    R.picked = g.pickFruitPlant(x, y + 1, z); R.apples = d.inventory.countOf('apple') - before;
    // Forest: mushrooms and fallen logs where the world is made.
    let at = null;
    for (let r = 0; r < 400 && !at; r += 16) for (let a = 0; a < 8; a++) {
      const fx = Math.round(Math.cos(a * 0.785) * r), fz = Math.round(Math.sin(a * 0.785) * r);
      if (/^forest/.test(BIOMES[gen.biomeIndexAt(fx, fz)].id)) { at = { x: fx, z: fz }; break; }
    }
    R.forest = at;
    p.set(at.x, 120, at.z);
    return R;
  });
  await page.waitForTimeout(6000);
  const forest = await page.evaluate(async () => {
    const g = window.__game, { LOG_SIDE_BASE } = await import('/src/config/blocks.js');
    const p = g.player.position, cx = Math.floor(p.x), cz = Math.floor(p.z);
    let mush = 0, logs = 0;
    for (let x = cx - 80; x < cx + 80; x++) for (let z = cz - 80; z < cz + 80; z++) {
      const h = g.world.gen.heightAt(x, z);
      for (let y = h - 1; y <= h + 2; y++) { const b = g.world.getBlock(y === h - 1 ? x : x, y, z); if (b >= 565 && b <= 567) mush++; if (b >= LOG_SIDE_BASE && b < LOG_SIDE_BASE + 6) logs++; }
    }
    return { mush, logs };
  });
  assert.match(more.explorer, /From .*: .*\./, 'explorer gift names a region');
  assert.ok(more.acorns >= 1, `acorns drop from oak leaves (${more.acorns})`);
  console.log(JSON.stringify(more.dbg));
  assert.deepEqual(more.roots, [1, 1, 1], 'each crop gives a root');
  assert.ok(more.planted && more.height === 4 && more.picked && more.apples >= 2, 'pot, seed, growth to 4 blocks, picking');
  assert.ok(forest.mush > 0 && forest.logs > 0, `forest has mushrooms and fallen logs (${forest.mush}, ${forest.logs})`);
  console.log('PASS explorer region gift, acorns, roots, Plant Pot to apples, forest mushrooms and logs');

  // Wizard, wand, shop, cauldron, potion timer, hat; staffed buildings, hand work and old-world grace.
  const wiz = await page.evaluate(async () => {
    const g = window.__game, d = g.duilt, R = {};
    const ff = (secs, dt = 0.1) => {
      const render = g.renderer.render, delta = g.clock.getDelta;
      g.renderer.render = () => {}; g.clock.getDelta = () => dt;
      try { for (let t = 0; t < secs; t += dt) g.tick(); } finally { g.renderer.render = render; g.clock.getDelta = delta; }
    };
    const { DESIGN_FOR_STRUCTURE } = await import('/src/config/starterDesigns.js');
    const { MAGIC_CAULDRON } = await import('/src/config/blocks.js');
    const des = DESIGN_FOR_STRUCTURE.get('wizard_hut');
    g.player.position.set(window.home.x, window.home.y, window.home.z); g.player.velocity?.set?.(0, 0, 0);
    const p = g.player.position, ox = Math.floor(p.x) - 20, oy = Math.floor(p.y), oz = Math.floor(p.z) - 8;
    for (let dx = -8; dx <= des.extent.x + 8; dx++) for (let dz = -14; dz <= des.extent.z + 8; dz++) {
      g.world.setBlock(ox + dx, oy - 1, oz + dz, 1);
      for (let dy = 0; dy < des.extent.y + 4; dy++) g.world.setBlock(ox + dx, oy + dy, oz + dz, 0);
    }
    for (const b of des.blocks) g.world.setBlock(ox + b.dx, oy + b.dy, oz + b.dz, b.type);
    R.claim = d.claim({ minX: ox, maxX: ox + des.extent.x, minY: oy, maxY: oy + des.extent.y, minZ: oz, maxZ: oz + des.extent.z }, 'wizard_hut').ok;
    ff(5);
    R.arrived = d.magic.active && !!g.wanderers.list.find((q) => q.kind === 'wizard');
    g.talkTo({ who: 'wizard', person: g.wanderers.list.find((q) => q.kind === 'wizard') });
    R.tabs = [...document.querySelectorAll('#wizard-tabs button')].map((b) => b.textContent);
    d.inventory.add('coin', 100);
    document.querySelector('[data-wiz-tab="shop"]').click();
    document.querySelector('[data-wiz-buy="seeds_apple"]').click();
    R.seed = d.inventory.countOf('seeds_apple');
    document.querySelector('[data-wiz-tab="quests"]').click();
    d.inventory.add('mushroom_red', 3); d.inventory.add('leaves', 30);
    document.querySelector('[data-wiz-hand]').click();
    R.wand = d.inventory.countOf('wizard_wand');
    document.querySelector('[data-wiz-tab="recipes"]').click();
    g.ui.closeAllPanels();
    // Wand: a bolt at a training target.
    const T = d.magic.targets[1];
    g.selectedItemId = 'wizard_wand'; g.selectedBlockId = null;
    p.set(T.x + 0.5, T.y + 1, T.z + 4); g.player.yaw = 0;
    g.player.pitch = Math.atan2((T.y + 0.5) - g.player.eyePosition().y, 4.5);
    const pts = d.magic.points; g.lastCastAt = 0; g.castWand(); ff(1.5, 0.05);
    R.castPoints = d.magic.points - pts;
    // Cauldron: moonwater at the station panel.
    const cx = Math.floor(p.x) + 2, cy = Math.floor(p.y), cz = Math.floor(p.z) + 2;
    g.world.setBlock(cx, cy - 1, cz, 1); g.world.setBlock(cx, cy, cz, MAGIC_CAULDRON);
    d.inventory.add('water', 1); d.inventory.add('mushroom_pale', 1);
    g.ui.openBench('', 'magic_cauldron', { x: cx, y: cy, z: cz, block: MAGIC_CAULDRON });
    document.querySelector('[data-spot-put="moonwater"]').click();
    ff(70);
    d.stationWork.take(`${cx},${cy},${cz}`); // the panel redraws on its own timer, not during a fast-forward
    R.moonwater = d.inventory.countOf('moonwater');
    g.ui.closeAllPanels();
    // Potion timer in the HUD, and the hat.
    d.inventory.add('potion_speed', 1);
    g.selectedItemId = 'potion_speed'; g.drinkSelected(); ff(1);
    R.chip = document.querySelector('#vital-boosts .boost')?.innerText ?? null;
    d.inventory.add('wizard_hat', 1);
    R.hat = d.wear(d.inventory.slots.findIndex((s) => s?.id === 'wizard_hat')).ok && d.wearsHat();
    // Old world: no staffed mark gives the grace and one notice.
    const j = JSON.parse(JSON.stringify(d.toJSON())); delete j.staffedWork; delete j.workGraceUntil;
    const seen = []; g.bus.on('toast', (x) => seen.push(x.title));
    d.loadJSON(j); ff(2);
    R.grace = d.workGrace; R.graceToast = seen.filter((t) => t === 'Buildings will need workers').length;
    // Hand work at a forest (no worker): a round of three swings.
    const f = { id: 9100, type: 'forest', valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null, tier: 0, region: { minX: ox, maxX: ox + 4, minY: oy, maxY: oy + 3, minZ: oz - 12, maxZ: oz - 8 } };
    d.structures.structures.push(f);
    d.inventory.add('axe', 1);
    g.ui.openBuilding(f, g.buildingActions(f));
    const go = document.querySelector('[data-hand-go]');
    R.hand = !!go;
    if (go) { go.click(); for (let i = 0; i < 3; i++) go.click(); }
    R.rest = document.querySelector('[data-hand]')?.innerText.replace(/\n+/g, ' ') ?? '';
    R.overflow = document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    return R;
  });
  assert.ok(wiz.claim && wiz.arrived, 'Wizard\'s Hut claimed and the wizard arrives');
  assert.deepEqual(wiz.tabs, ['Talk', 'Shop', 'Quests', 'Recipes']);
  assert.equal(wiz.seed, 1, 'the shop sells a seed');
  assert.equal(wiz.wand, 1, 'the first quest gives the wand');
  assert.ok(wiz.castPoints >= 1, 'a cast scores Magic points');
  assert.ok(wiz.moonwater >= 1, 'the cauldron brews moonwater');
  assert.match(wiz.chip, /\d:\d\d/, 'a potion shows a timer');
  assert.ok(wiz.hat, 'the hat goes on');
  assert.ok(wiz.grace && wiz.graceToast === 1, 'old world: grace and one notice');
  assert.ok(wiz.hand && /Resting/.test(wiz.rest), `hand work round ends in a rest (${wiz.rest})`);
  assert.ok(wiz.overflow, 'no sideways scroll at 390 px');
  console.log('PASS wizard, shop, wand, cauldron, potion timer, hat, grace notice, hand work');

  assert.deepEqual(errors, []);
  console.log('smoke-5c-browser: ok');
} finally {
  await browser?.close();
  await server.close();
}
