import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120000 });
  let release, requested;
  const requestedPromise = new Promise(resolve => { requested = resolve; });
  await page.route('**/runtime/SkyRuntime.js', async route => {
    requested();
    await new Promise(resolve => { release = resolve; });
    await route.continue();
  });
  const original = await page.evaluate(() => {
    const game = window.__game;
    const id = game.worldId;
    window.__opening = game.newWorld({ mode: 'creative', name: 'Superseded', silent: true });
    return { id, stillOriginal: game.worldId === id, loading: game.featureLoading };
  });
  await requestedPromise;
  assert.equal(original.stillOriginal, true);
  assert.equal(original.loading, true);
  const replacement = await page.evaluate(() => {
    const game = window.__game;
    game.newWorld({ mode: 'duilt', name: 'Latest world', silent: true });
    return game.worldId;
  });
  release();
  assert.equal(await page.evaluate(() => window.__opening), false);
  assert.deepEqual(await page.evaluate(() => ({ id: window.__game.worldId, name: window.__game.worldName, sandbox: window.__game.duilt.sandbox })),
    { id: replacement, name: 'Latest world', sandbox: false });
  await page.evaluate(async () => {
    await window.__game.newWorld({ mode: 'creative', name: 'Ready now', silent: true });
    if (!window.__game.duilt.sandbox) throw new Error('The cancelled import could not be reused');
    window.__game.travelTo('sky');
  });
  const sky = await page.evaluate(() => {
    const game = window.__game, at = game.world.gen.skyCache;
    return { planned: at?.count > 0, distance: Math.hypot(game.player.position.x - at.x, game.player.position.z - at.z) };
  });
  assert.equal(sky.planned, true);
  assert.ok(sky.distance < 160);
  assert.deepEqual(errors, []);
  console.log('PASS browser lazy world: pending loads preserve the world, cancelled loads cannot replace it, and a later Sky teleport works');

  const offline = await browser.newPage();
  await offline.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  let attempts = 0;
  await offline.route('**/runtime/SkyRuntime.js', route => ++attempts === 1 ? route.abort('failed') : route.continue());
  await offline.goto(server.resolvedUrls.local[0]);
  await offline.waitForFunction(() => window.__game && document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120000 });
  const failed = await offline.evaluate(async () => {
    const game = window.__game, id = game.worldId;
    const result = await game.newWorld({ mode: 'creative', name: 'Retry world', silent: true });
    return { result, preserved: game.worldId === id, failure: game.featureFailure };
  });
  assert.deepEqual(failed, { result: false, preserved: true, failure: true });
  const recovered = await offline.evaluate(async () => {
    const game = window.__game;
    const result = await game.newWorld({ mode: 'creative', name: 'Retry world', silent: true });
    return { result: result !== false, name: game.worldName };
  });
  assert.deepEqual(recovered, { result: true, name: 'Retry world' });
  console.log('PASS browser failed optional import preserves the current world and can be retried after the connection recovers');
} finally { await browser?.close(); await server.close(); }
