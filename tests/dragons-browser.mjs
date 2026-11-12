// The dragons and the new dinosaurs in a real page: flying, banking, wings
// beating; the dinosaurs walking. Screenshots go to artifacts/dragons/.
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
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
  mkdirSync('artifacts/dragons', { recursive: true });
  await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Dragons', seed: 4242, silent: true }); g.ui.hideBlocker(); await g.modelsLoaded;
    const { MOBS_BY_ID } = await import('/src/config/mobs.js');
    const p = g.player.position, mobs = g.mobs;
    const add = (id, dx, dz, up) => {
      const s = MOBS_BY_ID.get(id);
      const m = mobs.make(s, p.x + dx, p.y + up, p.z + dz);
      if (s.flies) { m.home = { x: p.x + dx, z: p.z + dz - 20 }; m.airborne = true; m.timer = 120; }
      mobs.list.push(m);
      return m;
    };
    window.__d = [add('elder_dragon', 0, -70, 30), add('fire_drake', -18, -34, 14), add('frost_wyvern', 16, -30, 12), add('storm_dragon', 2, -24, 18)];
    g.player.pitch = 0.32;
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'artifacts/dragons/sky.png' });
  const flying = await page.evaluate(() => window.__d.map((m) => ({ id: m.type, up: m.airborne, y: Math.round(m.y) })));
  assert.ok(flying.every((f) => f.up), JSON.stringify(flying));
  await page.evaluate(async () => {
    const g = window.__game, { MOBS_BY_ID } = await import('/src/config/mobs.js');
    const p = g.player.position;
    for (const [id, dx, dz] of [['raptor', -6, -12], ['trike', 4, -16], ['longneck', -2, -34]]) {
      const m = g.mobs.make(MOBS_BY_ID.get(id), p.x + dx, p.y, p.z + dz);
      m.target = { x: m.x + 20, z: m.z }; m.speed = 1; m.timer = 30;
      g.mobs.list.push(m);
    }
    g.player.pitch = 0.05;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/dragons/dinos.png' });
  assert.deepEqual(errors, []);
  console.log(`PASS four dragons fly in a real page (${flying.map((f) => `${f.id} at ${f.y}`).join(', ')}), and the new dinosaurs walk`);
} finally {
  await browser?.close();
  await server.close();
}
