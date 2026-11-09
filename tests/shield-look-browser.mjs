// IMP-23: the shield, seen in the bag, in your left hand, and on your avatar.
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
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120_000 });
  mkdirSync('artifacts/shield', { recursive: true });
  await page.evaluate(async () => {
    const g = window.__game;
    g.newWorld({ mode: 'duilt', name: 'Shield', seed: 4242, silent: true }); g.ui.hideBlocker(); await g.modelsLoaded;
    const d = g.duilt;
    for (const id of ['shield_wood', 'shield_iron', 'shield_diamond', 'sword_iron']) d.inventory.add(id, 1);
    d.wear(d.inventory.slots.findIndex((s) => s?.id === 'shield_iron'));
    d.inventory.select?.(d.inventory.slots.findIndex((s) => s?.id === 'sword_iron'));
    g.player.pitch = -0.15;
  });
  await page.waitForTimeout(1500);
  const shown = await page.evaluate(() => ({ left: window.__game.handView.left.visible, worn: window.__game.duilt.worn.offhand?.id }));
  assert.deepEqual(shown, { left: true, worn: 'shield_iron' }, 'the shield shows in your left hand');
  await page.screenshot({ path: 'artifacts/shield/first-person.png' });
  await page.evaluate(() => { const g = window.__game; g.player.view = 'front'; });
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__game.avatarView.shield.visible), true, 'and on your avatar');
  await page.screenshot({ path: 'artifacts/shield/third-person.png' });
  await page.evaluate(() => { const g = window.__game; g.player.view = 'first'; g.ui.openPanel('panel-bag'); });
  await page.waitForTimeout(800);
  assert.equal(await page.$$eval('[data-wear="offhand"]', (b) => b.length), 1, 'the bag has a Left hand slot');
  await page.screenshot({ path: 'artifacts/shield/bag.png' });
  assert.deepEqual(errors, []);
  console.log('PASS the shield shows in the bag, in your left hand and on your avatar');
} finally {
  await browser?.close();
  await server.close();
}
