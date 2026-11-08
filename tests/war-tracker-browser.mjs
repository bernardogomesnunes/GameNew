// IMP-22 in a real page: a round on, the HUD says how many are left and
// points at the nearest attacker; beaten, it goes.
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
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  mkdirSync('artifacts/war', { recursive: true });
  await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'War', seed: 71823, silent: true });
    g.ui.hideBlocker();
    await new Promise((r) => setTimeout(r, 3000));
    const d = g.duilt;
    d.war.round = 2; d.war.stage = 'fighting'; d.war.atWar = true;
    g.sendRound();
    // Face the nearest of them.
    const p = g.player.position, b = g.wanderers.warParty.band[0];
    g.player.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z));
  });
  await page.waitForSelector('#vital-war:not([hidden])', { timeout: 30_000 });
  const ahead = await page.evaluate(() => ({ text: document.querySelector('#vital-war .war-text').textContent, arrow: document.querySelector('#vital-war .war-arrow').style.transform }));
  assert.match(ahead.text, /^Round 2 · 4 of 4 left · \d+ m$/, ahead.text);
  const deg = (t) => Number(/rotate\((-?\d+)deg\)/.exec(t)[1]);
  assert.ok(Math.abs(deg(ahead.arrow)) <= 20, `facing them, the arrow points up (${ahead.arrow})`);
  assert.equal(await page.evaluate(() => document.querySelector('#vital-war .war-bar i').style.width), '100%', 'a new round: the bar is full');
  await page.waitForFunction(() => !document.querySelector('#toast-stack .toast'), null, { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: 'artifacts/war/tracker.png' });
  await page.evaluate(() => { window.__game.player.yaw += Math.PI; });
  await page.waitForFunction(() => Math.abs(Number(/rotate\((-?\d+)deg\)/.exec(document.querySelector('#vital-war .war-arrow').style.transform)[1])) >= 160, null, { timeout: 15_000 });
  // Two beaten: the count goes down.
  await page.evaluate(() => { const band = window.__game.wanderers.warParty.band; band[0].hp = 0; band[0].dead = true; band[1].hp = 0; band[1].dead = true; });
  await page.waitForFunction(() => / 2 of 4 left /.test(document.querySelector('#vital-war .war-text').textContent), null, { timeout: 15_000 });
  // IMP-27: the bar empties as they fall (full at the start, half with 2 of 4 left).
  assert.equal(await page.evaluate(() => document.querySelector('#vital-war .war-bar i').style.width), '50%', 'two of four down: the bar is half full');
  // All beaten: the round ends and the tracker goes.
  await page.evaluate(() => { for (const p of window.__game.wanderers.warParty.band) { p.hp = 0; p.dead = true; } });
  await page.waitForSelector('#vital-war', { state: 'hidden', timeout: 30_000 });
  assert.deepEqual(errors, []);
  console.log('PASS a round on: how many are left and an arrow to the nearest; beaten, it goes');
} finally { await browser?.close(); await server.close(); }
