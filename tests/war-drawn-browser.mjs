// IMP-22 in a real page (owner, 8 November: "I'm being attacked by stone
// soldiers and I don't see them anywhere"): with a kingdom's worth of guards
// about, a round's attackers are still drawn.
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
  await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'War', seed: 71823, silent: true });
    g.ui.hideBlocker();
    await g.modelsLoaded;
    await new Promise((r) => setTimeout(r, 3000));
    const w = g.wanderers, p = g.player.position;
    // A kingdom's guards, standing still at their posts, nearer than the round.
    for (let i = 0; i < 80; i++) w.list.push(w.person('guard', p.x + 10 + (i % 10), p.y, p.z + 10 + Math.floor(i / 10), { still: true, home: { x: p.x, z: p.z } }));
    g.duilt.war.round = 2; g.duilt.war.stage = 'fighting'; g.duilt.war.atWar = true;
    g.sendRound();
  });
  await page.waitForTimeout(2000);
  const drawn = await page.evaluate(() => { const c = window.__game.wanderView.crowds.byId; return { bandits: c.get('bandit')?.n ?? 0, guards: c.get('guard')?.n ?? 0, band: window.__game.wanderers.warParty.band.length }; });
  assert.equal(drawn.bandits, drawn.band, `every attacker drawn (${JSON.stringify(drawn)})`);
  assert.equal(drawn.bandits + drawn.guards, 64, 'the rest of the 64 places go to the nearest guards');
  assert.deepEqual(errors, []);
  console.log('PASS 80 guards about, and every attacker of the round is still drawn');
} finally { await browser?.close(); await server.close(); }
