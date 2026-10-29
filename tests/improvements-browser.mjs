// Actual building UI, training/evolution and guardian integration. Local only.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.IMPROVEMENTS_HARDWARE ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const g = window.__game;
    await g.newWorld({ mode: 'duilt', name: 'Military improvements check', seed: 4242, silent: true });
    if (!await g.prepareFeatures(['war'])) throw new Error('War runtime unavailable');
    g.renderer.setAnimationLoop(null);
    g.duilt.territory.setAge(8);
    // Fixture supplies paid gear without spending hours expanding the bag.
    while (g.duilt.inventory.slots.length < 512) g.duilt.inventory.slots.push(null);
    const { DESIGN_FOR_STRUCTURE } = await import('/src/config/starterDesigns.js');
    const floor = Math.floor(g.player.position.y), homeX = Math.floor(g.player.position.x), homeZ = Math.floor(g.player.position.z);
    window.__militaryPosts = [];
    for (const [i, type] of ['barracks', 'military'].entries()) {
      const design = DESIGN_FOR_STRUCTURE.get(type), ox = homeX + i * 28, oz = homeZ;
      for (let x = ox - 4; x < ox + design.extent.x + 5; x++) for (let z = oz - 7; z < oz + design.extent.z + 4; z++) {
        for (let y = floor - 2; y <= floor + 25; y++) g.world.setBlock(x, y, z, y < floor ? 3 : 0);
      }
      // Beds in the old starter design are decorative; omit them altogether.
      for (const b of design.blocks) if (b.type < 193 || b.type > 200) g.world.setBlock(ox + b.dx, floor + b.dy, oz + b.dz, b.type);
      const s = { id: 8000 + i, type, region: { minX: ox, maxX: ox + design.extent.x,
        minY: floor - 1, maxY: floor + design.extent.y, minZ: oz, maxZ: oz + design.extent.z },
        valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, excludes: [], tier: 0 };
      g.duilt.structures.structures.push(s); window.__militaryPosts.push(s);
    }
    window.__topUpMilitary = () => {
      for (const id of ['planks','cobblestone','coin','iron_ingot','lantern','chest','stone','window','pillar_stone',
        'gold_trim','banner_white','devotion','weapon_rack','training_dummy','fruit','sword_stone']) {
        g.duilt.inventory.add(id, Math.max(0, 400 - g.duilt.inventory.countOf(id)));
      }
    };
    g.ui.refreshForMode(); g.ui.hideBlocker();
  });
  for (const index of [0, 1]) for (const [tier, capacity] of [[0, 10], [1, 20], [2, 40]]) {
    await page.evaluate(index => {
      window.__topUpMilitary(); const g = window.__game, s = window.__militaryPosts[index];
      g.ui.openBuilding(s, g.buildingActions(s));
    }, index);
    if (tier) {
      await page.locator('#building-body [data-evolve]').click();
      await page.waitForFunction(({ index, tier }) => window.__militaryPosts[index].tier === tier, { index, tier });
    }
    const result = await page.evaluate(({ index, capacity }) => {
      const g = window.__game, d = g.duilt, s = window.__militaryPosts[index];
      const unit = index ? 'shield_guard' : 'warrior';
      while (d.defenders.barracks(s.id).roster.length + d.defenders.barracks(s.id).queue.length < capacity) {
        window.__topUpMilitary(); const r = d.trainSoldier(s, unit); if (!r.ok) throw new Error(r.reason);
      }
      const before = JSON.stringify(d.inventory.toJSON()), full = d.trainSoldier(s, unit);
      if (JSON.stringify(d.inventory.toJSON()) !== before) throw new Error('Full post charged for an extra order');
      d.days += 10;
      d.defenders.sync(window.__militaryPosts.map(p => ({ ...p, cap: [10,20,40][p.tier] })), d.days);
      g.ui.openBuilding(s, g.buildingActions(s));
      g.defenderView.update(d.defenders.people);
      g.renderer.render(g.scene, g.camera);
      return { full, trained: d.defenders.barracks(s.id).roster.length,
        active: d.defenders.soldiers.filter(p => p.post.of === String(s.id)).length };
    }, { index, capacity });
    assert.equal(result.full.ok, false); assert.match(result.full.reason, /Full/);
    assert.equal(result.trained, capacity); assert.equal(result.active, capacity);
    assert.match(await page.locator('#building-body').innerText(), new RegExp(`${capacity} of ${capacity}`, 'i'));
    console.log(`PASS ${index ? 'Garrison' : 'Barracks'} Evolve/train/full UI at capacity ${capacity}`);
  }
  mkdirSync('artifacts/performance', { recursive: true });
  for (const [width, height] of [[1440,900],[390,780],[844,390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { const g=window.__game;g.ui.panels.close('panel-building');g.ui.openPanel('panel-buildings'); });
    assert.ok(await page.locator('#buildings-list .building-title strong').count());
    assert.equal(await page.locator('#buildings-list .building-icon').count(), 0);
    const names = await page.locator('#buildings-list .building-title strong').allTextContents();
    assert.ok(names.every(name => !/\p{Extended_Pictographic}/u.test(name)));
    assert.ok(await page.locator('#buildings-list .building-card').evaluateAll(cards => cards.every(card =>
      card.getBoundingClientRect().right <= innerWidth + 1 && card.getBoundingClientRect().left >= 0)));
    await page.screenshot({ path: `artifacts/performance/improvements-buildings-${width}x${height}.png` });
    console.log(`PASS text-only building cards fit ${width}x${height}`);
  }
  const hud = await page.evaluate(() => {
    const u=window.__game.ui.duiltUI, d=window.__game.duilt;
    d.health.value=20;u.renderHealth();const box=document.querySelector('#vital-health'),heart=box.firstElementChild;
    const start=performance.now();for(let i=0;i<1000;i++)u.renderHealth();
    const same=heart===box.firstElementChild,ms=performance.now()-start;
    d.health.value=13;u.renderHealth();
    return {same,ms,full:box.querySelectorAll('.heart.full').length,half:box.querySelectorAll('.heart.half').length};
  });
  assert.equal(hud.same,true);assert.equal(hud.full,6);assert.equal(hud.half,1);
  console.log(`PASS unchanged health HUD retains actual DOM nodes across 1000 calls (${hud.ms.toFixed(2)} ms), damage redraws immediately`);
  const combat = await page.evaluate(async () => {
    const { Guardian } = await import('/src/world/Guardian.js');
    const g = window.__game, home = { ...g.player.position };
    const guardian = g.duilt.guardian = new Guardian({ world: g.world, ring: 'white', home }); guardian.mode = 'stay';
    const near = g.wanderers.person('bandit', home.x + 2, home.y, home.z);
    const target = g.wanderers.person('bandit', home.x + 6, home.y, home.z);
    target.hp = 7; g.wanderers.list.push(near, target);
    g.arrowHit({ damage: 1, x: home.x, z: home.z, vx: 1, vz: 0 }, { kind: 'bandit', person: target });
    for (let i = 0; i < 150 && !target.dead; i++) g.tickGuardian(0.1);
    return { killed: !!target.dead, ignored: !near.dead && near.hp > 0 };
  });
  assert.deepEqual(combat, { killed: true, ignored: true });
  assert.deepEqual(errors, []);
  console.log('PASS actual game guardian finishes arrow-hit enemy in stay mode before nearer bandit');
} finally { await browser?.close(); await server.close(); }
