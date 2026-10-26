// An isolated local-only browser: never load .env or contact a live account.
// Uses the development-only game handle to exercise the real placement and
// persistence paths without flaky pointer-lock aiming in headless Chromium.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
  .headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
// Vite's development client needs its local websocket; deployed scripts do not.
const server = await createServer({
  configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false, headers: {
    'Content-Security-Policy': policy.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:*")
      .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
  } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errors = [];
  const modules = [];
  page.on('request', (request) => modules.push(new URL(request.url()).pathname));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.protocol === 'blob:' || url.protocol === 'data:' ? route.continue() : route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), { timeout: 120_000 });
  assert.equal(modules.includes('/src/ui/Story.js'), false, 'Story artwork loads only when played');
  assert.equal(modules.includes('/src/render/WorldMap.js'), false, 'Full map loads only when opened');
  await page.evaluate(async () => {
    const { TerrainWorkerQueue } = await import('/src/world/TerrainWorkerQueue.js');
    const game = window.__game;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { queue.dispose(); reject(new Error('Terrain worker did not finish')); }, 30_000);
      const queue = new TerrainWorkerQueue(game.world, { onChunk: (chunk) => {
        clearTimeout(timeout);
        queue.dispose();
        if (chunk.data.length && chunk.surface.length === 256 && chunk.biomes.length === 256) resolve();
        else reject(new Error('Terrain worker returned incomplete buffers'));
      } });
      if (!queue.available || !queue.request(78, 79)) {
        clearTimeout(timeout); queue.dispose(); reject(new Error('Browser terrain worker is unavailable'));
      }
    });
  });
  const placed = await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Browser smoke', seed: 71823, silent: true });
    const x = Math.floor(game.player.position.x) + 4;
    const z = Math.floor(game.player.position.z);
    const y = Math.min(200, Math.floor(game.player.position.y) + 5);
    const previous = game.world.getBlock(x, y, z);
    game.selectedBlockId = previous === 1 ? 2 : 1;
    game.selectedItemId = null;
    const raycast = game.raycast;
    try {
      game.raycast = () => ({ x, y: y - 1, z, placeX: x, placeY: y, placeZ: z, block: 1, normal: { x: 0, y: 1, z: 0 } });
      game.placeBlock();
    } finally { game.raycast = raycast; }
    const block = game.world.getBlock(x, y, z);
    if (block === previous) throw new Error('The real placement path did not change the world');
    if (!await game.saveAndWait()) throw new Error('Saving the local world failed');
    return { id: game.worldId, x, y, z, block };
  });
  // Navigation may stop workers immediately. The lifecycle checkpoint must
  // retain an edit made after the last confirmed background save.
  placed.block=await page.evaluate(({x,y,z,block})=>{
    const next=block===1?2:1;window.__game.world.setBlock(x,y,z,next);return next;
  },placed);
  await page.reload();
  await page.waitForFunction(() => window.__game && !window.__game.booting && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), { timeout: 120_000 });
  const restored = await page.evaluate(async ({ id, x, y, z }) => {
    const game = window.__game;
    if (!await game.openWorld(id)) throw new Error('Saved world did not reopen');
    return { id: game.worldId, block: game.world.getBlock(x, y, z), local: game.worldIsLocal };
  }, placed);
  assert.equal(restored.id, placed.id);
  assert.equal(restored.block, placed.block, 'Placed block must survive a full page reload');
  assert.equal(restored.local, true);
  // Reject malformed game records through the real file picker/callback,
  // before changing the open world or its local/account destination.
  const beforeImport = await page.evaluate(() => {
    window.__importWorldBefore = window.__game.world;
    return { id: window.__game.worldId, local: window.__game.worldIsLocal };
  });
  for (const duilt of [{herd:{}}, {mounts:[null]}, {trains:[{cars:0,head:0,trail:[null,null]}]}]) {
    await importText(JSON.stringify({ format:'voxel-sandbox-world', version:2, mode:'duilt', name:'Invalid',
      player:{x:1,y:2,z:1}, world:{sizeX:16,sizeZ:16,height:16,chunks:[{cx:0,cz:0,rle:[0,4096]}]}, duilt }));
    const state = await page.evaluate(() => ({ id: window.__game.worldId, local: window.__game.worldIsLocal,
      sameWorld: window.__game.world === window.__importWorldBefore }));
    assert.deepEqual(state, { ...beforeImport, sameWorld: true }, 'Rejected import must preserve the open world');
  }
  const exported = await page.evaluate(async () => {
    const { buildWorldPayload } = await import('/src/storage/WorldExport.js');
    return JSON.stringify(buildWorldPayload({ ...window.__game.saveState(), templates: [], name: 'Import check' }));
  });
  await importText(exported);
  const imported = await page.evaluate(({ x, y, z }) => ({ id: window.__game.worldId, name: window.__game.worldName,
    local: window.__game.worldIsLocal, block: window.__game.world.getBlock(x,y,z) }), placed);
  assert.notEqual(imported.id, placed.id, 'Import creates its own world identity');
  assert.equal(imported.name, 'Import check');
  assert.equal(imported.local, true);
  assert.equal(imported.block, placed.block, 'A real export remains importable');
  let releaseStory;
  const storyGate = new Promise(resolve => { releaseStory = resolve; });
  await page.route('**/src/ui/Story.js*', async route => { await storyGate; await route.continue(); }, { times: 1 });
  await page.evaluate(() => {
    const ui = window.__game.ui;
    window.__cancelledStory = ui.story.play([{ art: 'sky', text: 'Cancelled story' }]);
    ui.panels.close('story');
  });
  releaseStory();
  await page.evaluate(() => window.__cancelledStory);
  assert.equal(await page.evaluate(() => window.__game.ui.story.open), false, 'A cancelled lazy story must not reopen');
  await page.evaluate(() => {
    const ui = window.__game.ui;
    ui.toast({ kind: 'xp', title: '<img src=x onerror="throw 1">', body: '<script>throw 2</script>' });
    const toast = ui.q('#toast-stack').lastElementChild;
    if (toast.querySelector('img,script') || !toast.textContent.includes('<img')) throw new Error('Toast text was interpreted as HTML');
    ui.setPersonHint('<img src=x>', '<b>working</b>');
    if (ui.q('#building-hint').querySelector('img') || !ui.q('#building-hint').textContent.includes('<img')) throw new Error('Person hint was interpreted as HTML');
    const getTemplates = ui.cb.getTemplates;
    try {
      ui.cb.getTemplates = () => [{ id: '" onclick="throw 1', name: '<img src=x>', size: 1, blockCount: 1, distinctTypes: 1 }];
      ui.refreshTemplateList();
      const list = ui.q('#template-list');
      if (list.querySelector('img,[onclick]') || !list.textContent.includes('<img')) throw new Error('Saved design text was interpreted as HTML');
    } finally { ui.cb.getTemplates = getTemplates; }
    ui.story.play([{ art: 'sky', text: 'Lazy story smoke' }], { onDone: () => { window.__storyDone = true; } });
  });
  await page.waitForFunction(() => document.querySelector('#story .story-text')?.textContent === 'Lazy story smoke');
  await page.evaluate(() => window.__game.ui.panels.close('story'));
  await page.waitForFunction(() => window.__storyDone);
  assert.equal(modules.includes('/src/ui/Story.js'), true, 'Story art loads when played');
  let releaseMap;
  const mapGate = new Promise(resolve => { releaseMap = resolve; });
  await page.route('**/src/render/WorldMap.js*', async route => { await mapGate; await route.continue(); }, { times: 1 });
  await page.evaluate(() => {
    const ui = window.__game.ui;
    ui.openPanel('panel-map');
    ui.panels.close('panel-map');
  });
  releaseMap();
  await page.waitForFunction(() => window.__game.ui.mapModule);
  assert.equal(await page.evaluate(() => !!window.__game.ui.mapView), false, 'A closed lazy map must not install a stale view');
  await page.evaluate(() => window.__game.ui.openPanel('panel-map'));
  await page.waitForFunction(() => window.__game.ui.q('#map-scale').textContent.includes('blocks'));
  assert.equal(modules.includes('/src/render/WorldMap.js'), true, 'Full map loads when opened');
  await page.evaluate(() => window.__game.ui.panels.close('panel-map'));
  assert.deepEqual(await page.evaluate(() => window.__cspViolations), [], 'Local assets must work under the security policy');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log('PASS browser smoke: lazy assets, load, place, save, reopen, rejected imports preserve world, valid export imports (local-only Chromium)');

  async function importText(text) {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.evaluate(() => {
      window.__importFinished = false;
      window.__game.ui.cb.onImportWorld().finally(() => { window.__importFinished = true; });
    });
    const chooser = await chooserPromise;
    await chooser.setFiles({ name:'check.voxworld.json', mimeType:'application/json', buffer:Buffer.from(text) });
    await page.waitForFunction(() => window.__importFinished, null, { timeout: 60_000 });
  }
} finally {
  await browser?.close();
  await server.close();
}

