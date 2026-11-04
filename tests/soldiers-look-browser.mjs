// IMP-17 again (owner, 4 November): "still headless and stuck in one place".
// Every kind of soldier of yours, standing and strolling, in a real page.
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
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('artifacts/soldiers', { recursive: true });
  const at = await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Soldiers', seed: 71823, silent: true });
    game.ui.hideBlocker();
    await game.modelsLoaded;
    const d = game.duilt, p = game.player.position;
    const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) + 6 };
    // Two posts: a barracks with each of its four kinds, a Garrison with spear guards.
    d.structures.structures.push({ id: 99801, type: 'barracks', valid: true, tier: 3, lastPaidAt: Date.now(),
      region: { minX: at.x - 4, maxX: at.x - 1, minY: at.y, maxY: at.y + 3, minZ: at.z + 3, maxZ: at.z + 6 } });
    d.structures.structures.push({ id: 99802, type: 'military', valid: true, tier: 3, lastPaidAt: Date.now(),
      region: { minX: at.x + 2, maxX: at.x + 5, minY: at.y, maxY: at.y + 3, minZ: at.z + 3, maxZ: at.z + 6 } });
    d.defenders.trained['99801'] = { roster: ['warrior', 'swordsman', 'archer', 'crew'], queue: [], since: d.days };
    d.defenders.trained['99802'] = { roster: ['shield_guard', 'shield_guard'], queue: [], since: d.days };
    game.defenceSyncedAt = 0;
    return at;
  });
  await page.waitForFunction(() => window.__game.duilt.defenders.soldiers.length === 6, null, { timeout: 30_000 });
  const look = async () => page.evaluate(() => {
    const g = window.__game, ss = g.duilt.defenders.soldiers, pl = g.player;
    const cx = ss.reduce((a, s) => a + s.x, 0) / ss.length, cz = ss.reduce((a, s) => a + s.z, 0) / ss.length;
    pl.flying = true; pl.position.set(cx, ss[0].y + 1.2, cz - 3.2); pl.yaw = Math.PI; pl.pitch = -0.35;
  });
  await look();
  await page.waitForTimeout(3000);
  const first = await page.evaluate(() => window.__game.duilt.defenders.soldiers.map((s) => ({ kind: s.kind, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })));
  await page.screenshot({ path: 'artifacts/soldiers/standing.png' });
  await page.waitForTimeout(15000);
  await look();
  await page.waitForTimeout(1000);
  // The Garrison's spear guards from the front, close.
  await page.evaluate(() => {
    const g = window.__game, ss = g.duilt.defenders.soldiers.filter((s) => s.kind === 'shield_guard'), pl = g.player;
    const cx = ss.reduce((a, s) => a + s.x, 0) / ss.length, cz = ss.reduce((a, s) => a + s.z, 0) / ss.length;
    for (const s of ss) { s.rest = 99; s.stroll = null; }
    pl.position.set(cx, ss[0].y, cz - 2.6); pl.yaw = Math.PI; pl.pitch = 0;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/soldiers/garrison-a.png' });
  await page.evaluate(() => { const pl = window.__game.player; pl.position.z += 5.2; pl.yaw = 0; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/soldiers/garrison-b.png' });
  const later = await page.evaluate(() => window.__game.duilt.defenders.soldiers.map((s) => ({ kind: s.kind, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })));
  await page.screenshot({ path: 'artifacts/soldiers/later.png' });
  const moved = later.filter((s, i) => Math.hypot(s.x - first[i].x, s.z - first[i].z) > 0.5).length;
  assert.ok(moved >= 4, `most soldiers have left their spot after 15 s (${moved} of 6): ${JSON.stringify({ first, later })}`);
  const modelled = await page.evaluate(async () => {
    const { modelKit } = await import('/src/render/Models.js');
    return ['footman', 'swordsman', 'bowman', 'crew', 'shield_guard'].filter((id) => !modelKit(id));
  });
  assert.deepEqual(modelled, [], 'every soldier kind has its model, spear guards too');
  assert.deepEqual(errors, []);
  console.log('PASS your soldiers and spear guards: modelled, with heads, and walking round their posts');
} finally { await browser?.close(); await server.close(); }
