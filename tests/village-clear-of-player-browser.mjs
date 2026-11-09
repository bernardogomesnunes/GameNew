// Owner, 8 and 9 November: placing a village in Age 9 kept failing with
// "protected land", and after IMP-34 with "You are standing where it would
// be built". The village is 26 blocks wide and was centred where you aim, so
// aiming at ground nearby put you inside it. It now slides forward, clear of you.
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
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
  const results = await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Village', seed: 4242, silent: true });
    g.ui.hideBlocker();
    await g.modelsLoaded;
    const d = g.duilt;
    d.territory.age = 10;
    d.grantCreativeKit?.();
    for (const it of (await import('/src/config/items.js')).ITEMS) d.inventory.add(it.id, 20000);
    const toasts = [];
    const show = g.ui.toast.bind(g.ui);
    g.ui.toast = (o) => { toasts.push(o); return show(o); };
    g.player.pitch = -0.9; // ground about 3 blocks ahead
    const out = [];
    for (let k = 0; k < 4; k++) {
      g.player.yaw = (k * Math.PI) / 2;
      toasts.length = 0;
      for (const j of [...d.jobs.builds]) if (j.state === 'queued') d.jobs.cancelBuild(j.id);
      g.stampStarter('village');
      const job = d.jobs.builds.filter((j) => j.state === 'queued').at(-1), p = g.player.position, r = job?.region;
      out.push({ toast: toasts[0] && `${toasts[0].title} | ${toasts[0].body}`, inside: r ? p.x >= r.minX && p.x <= r.maxX + 1 && p.z >= r.minZ && p.z <= r.maxZ + 1 : null });
    }
    return out;
  });
  for (const r of results) {
    assert.match(r.toast ?? '', /Starter village is going up/, r.toast);
    assert.equal(r.inside, false, 'you stand outside its outline');
  }
  console.log(`PASS aimed 3 blocks ahead, facing each of 4 ways, the village goes up clear of you`);
  assert.deepEqual(errors, []);
  console.log('PASS no page errors');
} finally {
  await browser?.close();
  await server.close();
}
