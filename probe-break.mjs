import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('#blocker:not([hidden])');
await page.click('[data-new]'); await page.click('[data-kind="creative"]');
await page.click('[data-next]'); await page.click('[data-create]');
await page.waitForTimeout(2500);

// Stand in the air looking down at solid ground, so there is always something
// under the crosshair to eat.
await page.evaluate(() => {
  const g = window.__game;
  const x = 60, z = 60;
  let y = g.world.height - 1;
  while (y > 0 && !g.world.isSolid(x, y, z)) y--;
  g.player.flying = true;
  g.player.position.set(x + 0.5, y + 4, z + 0.5);
  g.player.pitch = -1.45;             // as near straight down as the clamp allows
  g.player.yaw = 0;
  g.player.syncCamera();
});
await page.waitForTimeout(400);

// Count everything in the neighbourhood, not one guessed column — the ray does
// not land exactly under the feet.
const solidUnder = () => page.evaluate(() => {
  const g = window.__game;
  let n = 0;
  for (let x = 54; x <= 66; x++) for (let z = 54; z <= 66; z++)
    for (let y = 0; y < g.world.height; y++) if (g.world.isSolid(x, y, z)) n++;
  return n;
});

// Count the swings, not the holes: a hole dug straight down walks out of reach
// after a few blocks, which measures REACH rather than the repeat.
await page.evaluate(() => {
  const g = window.__game;
  g.__swings = 0;
  const real = g.breakBlock.bind(g);
  g.breakBlock = (...a) => { g.__swings++; return real(...a); };
});
const swings = () => page.evaluate(() => window.__game.__swings);

console.log('--- one click ---');
let before = await solidUnder();
await page.evaluate(() => { window.__game.primaryAction(); });
await page.waitForTimeout(600);
console.log(`  blocks in the column: ${before} -> ${await solidUnder()} (one click should take one)`);

console.log('\n--- holding for 1.5s ---');
before = await solidUnder();
await page.evaluate(() => { window.__game.__swings = 0; window.__game.primaryAction(); window.__game.setBreaking(true); });
await page.waitForTimeout(1500);
const n = await swings();
const during = await solidUnder();
await page.evaluate(() => window.__game.setBreaking(false));
await page.waitForTimeout(500);
const after = await solidUnder();
console.log(`  ${before} -> ${during} while held (${before - during} broken), ${after} after release`);
console.log(`  swings in 1.5s of holding: ${n} (one immediate, then ~7 at the set rate)`);
console.log(`  stops on release: ${during === after}`);

// A quick click must stay a single block.
await page.evaluate(() => { window.__game.__swings = 0; window.__game.primaryAction(); window.__game.setBreaking(true); });
await page.waitForTimeout(150);
await page.evaluate(() => window.__game.setBreaking(false));
await page.waitForTimeout(400);
console.log(`  a 150ms click swings ${await swings()} time(s) — a click is still one block`);

console.log('\n--- a panel opening mid-hold stops it ---');
before = await solidUnder();
await page.evaluate(() => { window.__game.setBreaking(true); });
await page.waitForTimeout(400);
await page.evaluate(() => window.__game.ui.openPanel('panel-stats'));
await page.waitForTimeout(1200);
const held = await solidUnder();
await page.evaluate(() => { window.__game.ui.closeAllPanels(); window.__game.setBreaking(false); });
console.log(`  ${before} -> ${held}; breaking flag now ${await page.evaluate(() => window.__game.breaking)}`);

console.log('\n--- the selector must not repeat ---');
await page.evaluate(() => { window.__game.selectorTool.active = true; window.__game.setBreaking(true); });
console.log('  with the selector on, breaking =', await page.evaluate(() => window.__game.breaking));
await page.evaluate(() => { window.__game.selectorTool.active = false; });

console.log('\n--- glyphs are drawn on the swatches ---');
const g = await page.evaluate(() => {
  const slots = [...document.querySelectorAll('.hotbar-slot')];
  return {
    slots: slots.length,
    withGlyph: slots.filter(s => s.querySelector('.swatch svg.glyph')).length,
    sample: slots.slice(0, 3).map(s => s.dataset.name + ':' + (s.querySelector('.glyph path')?.getAttribute('d')?.slice(0, 12) ?? 'none')),
    inkVaries: new Set(slots.map(s => s.querySelector('.glyph')?.getAttribute('stroke'))).size,
  };
});
console.log(' ', JSON.stringify(g));
console.log('\n  label now reads:', JSON.stringify(await page.evaluate(() => [
  document.querySelector('#hotbar-name').textContent,
  document.querySelector('#hotbar-note').textContent])));
await page.screenshot({ path: '/tmp/claude-0/probe/glyph-hotbar.png' });
console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
