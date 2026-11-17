// CRAFT-9 part 4 in a real page: a Mason's Bench placed in the world, its
// close-up, three chisel taps on the chalk marks make 6 stone walls. Desktop
// (Space and a click on the picture) and a phone (the action button), with
// screenshots in docs/screens/craft9-part4/.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = 'docs/screens/craft9-part4';
const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false,
    fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
let browser;

async function open(context, name) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__game && !window.__game.booting
    && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('ld-gone')), null, { timeout: 120_000 });
  const shot = async (what) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${name}-${what}.png`, timeout: 90_000 }); };
  await page.evaluate(async () => {
    const game = window.__game;
    game.newWorld({ mode: 'creative', name: 'Mason', seed: 71823, silent: true });
    game.ui.hideBlocker();
    const { Inventory } = await import('/src/items/Inventory.js');
    const bag = new Inventory();
    bag.add('stone', 6); bag.add('cobblestone', 3);
    game.duilt.inventory = bag;
    game.duilt.crafting.inventory = bag;
    const p = game.player.position;
    const at = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) - 3 };
    for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 4; dz++) for (let dy = 0; dy <= 2; dy++) game.world.setBlock(at.x + dx, at.y + dy, at.z + dz, 0);
    game.world.setBlock(at.x, at.y, at.z, 538);
    game.rebuildAllChunks?.();
    // Stand back from it, looking at it a little from above.
    game.player.position.set(at.x + 1.9, at.y, at.z + 2.4);
    game.player.yaw = Math.atan2(1.4, 1.9);
    game.player.pitch = -0.38;
    game.player.syncCamera?.();
    window.masonCheck = { bag, at };
    await game.modelsLoaded;
  });
  return { page, errors, shot };
}

try {
  await server.listen();
  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // Desktop: Space taps, and so does a click on the picture.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, errors, shot } = await open(context, 'desktop');
    await shot('block');
    await page.evaluate(() => window.__game.startBench(masonCheck.at, 'masons_bench'));
    await page.waitForSelector('.bench-bar:not([hidden])');
    await page.locator('[data-pick="mason_wall_stone"]').click();
    await shot('closeup');
    const work = await page.locator('[data-work]').boundingBox();
    assert.ok(work.height >= 56, `the action button is 56 px tall (${work.height})`);
    const vw = page.viewportSize().width;
    assert.ok(Math.abs(work.x + work.width / 2 - vw / 2) < 8, 'the action button sits in the middle');
    assert.match(await page.locator('[data-work]').textContent(), /Chisel \(tap\)/);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__game.benchMachine.taps), 2);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.chisel-mark.done').length), 2);
    assert.equal(await page.evaluate(() => masonCheck.bag.countOf('stone')), 6, 'nothing spent before the third tap');
    await shot('two-taps');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => masonCheck.bag.countOf('wall_stone')), 6, 'three taps: 6 stone walls');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/desktop-made.png` });
    // A click on the picture taps too.
    for (let i = 0; i < 3; i++) await page.mouse.click(640, 300);
    assert.equal(await page.evaluate(() => masonCheck.bag.countOf('wall_stone')), 12, 'three clicks: 6 more');
    assert.match(await page.locator('.bench-bar .counter-say').textContent(), /Made 6 stone walls\./);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__game.closeUp.active), false);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS desktop: Space and clicks tap the chalk marks; the third makes 6 stone walls');
  }

  // Phone: the action button, under the thumb.
  {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const { page, errors, shot } = await open(context, 'iphone13');
    await shot('block');
    await page.evaluate(() => window.__game.startBench(masonCheck.at, 'masons_bench'));
    await page.waitForSelector('.bench-bar:not([hidden])');
    await page.locator('[data-pick="mason_wall_cobble"]').tap();
    await shot('closeup');
    const work = await page.locator('[data-work]').boundingBox();
    const vp = page.viewportSize();
    assert.ok(work.height >= 56 && work.y + work.height <= vp.height, 'the button is 56 px tall and on screen');
    await page.locator('[data-work]').tap();
    await shot('one-tap');
    await page.locator('[data-work]').tap();
    await page.locator('[data-work]').tap();
    assert.equal(await page.evaluate(() => masonCheck.bag.countOf('wall_cobble')), 6);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/iphone13-made.png` });
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS iPhone 13: three taps on Chisel make 6 cobblestone walls');
  }
} finally { await browser?.close(); await server.close(); }
