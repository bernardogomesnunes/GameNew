#!/usr/bin/env node
/**
 * Pictures of the showcase world, for judging a change to how the game
 * looks (docs/plan-look-and-sound.md, section 1).
 *
 * Opens the showcase (Game.openShowcase — world/showcase.js) in a phone-sized
 * browser, stands at every camera spot by day, at dusk and at night, and
 * writes one PNG per spot and time, plus an index.html that lays them all
 * out side by side. Run it before a change and after it, into two folders,
 * and compare the same file names.
 *
 *   node tools/showcase-shots.mjs --out /tmp/shots/before
 *   node tools/showcase-shots.mjs --out /tmp/shots/after --group main --times day,night
 *   node tools/showcase-shots.mjs --list
 *
 * Options:
 *   --out DIR          where the pictures go (made if missing). Required.
 *   --url URL          use a dev server that's already running (it needs
 *                      window.__game, so `npx vite`, not a build). Without
 *                      it, a Vite dev server is started from this checkout
 *                      on --port and stopped at the end.
 *   --port N           port for that server (default 5199).
 *   --group G          'main' (the overview, the rows, the figures, the
 *                      kingdoms and a forest — the set worth taking every
 *                      time), 'buildings' (one close picture per building),
 *                      or 'all' (default).
 *   --spots a,b        only these spot ids (see --list); overrides --group.
 *   --times t,u        any of day, dusk, night (default all three).
 *   --size WxH         viewport (default 390x780, a phone held upright).
 *   --no-labels        leave out the name labels.
 *   --hud              keep the on-screen controls in the picture.
 *   --hand             keep your hand and what it holds in the picture.
 *   --list             print the spots and stop.
 *
 * Chromium: CHROMIUM_PATH if set, else /opt/pw-browsers/chromium-1194 if
 * it's there, else Playwright's own. WebGL runs on SwiftShader, so it's
 * slow — a full run is a few minutes; --group main or --spots for less.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

const { SHOWCASE_SPOTS, SHOWCASE_TIMES } = await import(join(root, 'src/world/showcase.js'));

if (args.list) {
  for (const s of SHOWCASE_SPOTS) console.log(`${s.id.padEnd(28)} ${s.group.padEnd(10)} ${s.name}`);
  process.exit(0);
}
if (!args.out) {
  console.error('Usage: node tools/showcase-shots.mjs --out DIR [--group main|buildings|all] [--spots a,b] [--times day,dusk,night] [--url URL] [--list]');
  process.exit(2);
}

const wanted = args.spots ? args.spots.split(',') : SHOWCASE_SPOTS
  .filter((s) => !args.group || args.group === 'all' || s.group === args.group).map((s) => s.id);
const unknown = wanted.filter((id) => !SHOWCASE_SPOTS.some((s) => s.id === id));
if (unknown.length) { console.error(`No such spot: ${unknown.join(', ')} (see --list)`); process.exit(2); }
const times = (args.times ?? 'day,dusk,night').split(',');
const badTime = times.filter((t) => !(t in SHOWCASE_TIMES));
if (badTime.length) { console.error(`No such time: ${badTime.join(', ')} (${Object.keys(SHOWCASE_TIMES).join(', ')})`); process.exit(2); }
const [width, height] = (args.size ?? '390x780').split('x').map(Number);
const out = resolve(args.out);
mkdirSync(out, { recursive: true });

let server = null;
let url = args.url;
if (!url) {
  const { createServer } = await import(join(root, 'node_modules/vite/dist/node/index.js'));
  const port = Number(args.port ?? 5199);
  // No hot reload: an edit saved mid-run would reload the page out from under it.
  server = await createServer({ root, logLevel: 'error', server: { port, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  url = `http://localhost:${port}/`;
}

const { chromium } = await import(join(root, 'node_modules/playwright/index.mjs'));
const bundled = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(bundled) ? bundled : undefined);
const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const shots = [];
try {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  // Anything run in the page gets a deadline, so a hang is an error rather than forever.
  const ev = (fn, arg, ms = 60_000) => Promise.race([
    page.evaluate(fn, arg),
    new Promise((_, no) => setTimeout(() => no(new Error(`timed out after ${ms} ms`)), ms)),
  ]);
  const frames = (n) => ev((count) => new Promise((done) => {
    let k = 0;
    const step = () => (++k >= count ? done() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  }), n);

  const started = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60_000 });
  const opened = await ev(({ labels, hud, hand }) => {
    const g = window.__game;
    g.ui.hideBlocker();
    const ok = g.openShowcase();
    g.ui.closeAllPanels();
    g.player.view = 'first';
    g.showcase.labels = labels;
    // No controls, and no outline round the block in the middle of the screen.
    if (!hud) {
      document.getElementById('ui-root').style.visibility = 'hidden';
      const hover = g.updateHover.bind(g);
      g.updateHover = () => { hover(); g.hoverBox.visible = false; };
    }
    if (!hand) g.handView.update = () => { g.handView.group.visible = false; };
    return ok;
  }, { labels: !args['no-labels'], hud: !!args.hud, hand: !!args.hand }, 120_000);
  if (!opened) throw new Error('The showcase did not open (no site for it in this world?)');
  console.log(`showcase open in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  for (const id of wanted) {
    const began = Date.now();
    const there = await ev((spot) => window.__game.showcaseSpot(spot, { settle: true }), id, 180_000);
    if (!there) { console.warn(`skipped ${id}: this world has no such place`); continue; }
    for (const t of times) {
      // All in one go in the page, because every round trip to a page
      // drawing on SwiftShader is slow: set the hour, let two frames run
      // (the lights follow the clock, anyone at a kingdom arrives), make
      // whatever is still missing, and draw. The picture is read straight
      // off the canvas unless the controls are wanted in it too.
      const file = `${id}-${t}.png`;
      const png = await ev(async ({ when, grab }) => {
        const g = window.__game;
        g.showcaseTime(when);
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        g.finishLoading();
        if (!grab) return null;
        g.renderer.render(g.scene, g.camera);
        return g.renderer.domElement.toDataURL('image/png');
      }, { when: t, grab: !args.hud }, 180_000);
      if (png) writeFileSync(join(out, file), Buffer.from(png.split(',')[1], 'base64'));
      else { await frames(1); await page.screenshot({ path: join(out, file), timeout: 120_000 }); }
      shots.push({ id, t, file });
      console.log(`${file}  ${((Date.now() - began) / 1000).toFixed(1)}s`);
    }
  }
} finally {
  await browser.close();
  await server?.close();
}

// A contact sheet: one row per spot, one column per time.
const names = new Map(SHOWCASE_SPOTS.map((s) => [s.id, s.name]));
const rows = [...new Set(shots.map((s) => s.id))].map((id) => `
  <tr><th>${id}<br><small>${escape(names.get(id) ?? '')}</small></th>${times.map((t) => {
    const s = shots.find((x) => x.id === id && x.t === t);
    return `<td>${s ? `<a href="${s.file}"><img src="${s.file}" loading="lazy"></a>` : ''}</td>`;
  }).join('')}</tr>`).join('');
writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Showcase</title>
<style>body{font:13px system-ui;background:#16181d;color:#ddd;margin:16px}table{border-collapse:collapse}
th{text-align:left;vertical-align:top;padding:6px;max-width:160px}td{padding:4px}img{width:195px;display:block}</style>
<table><tr><th></th>${times.map((t) => `<th>${t}</th>`).join('')}</tr>${rows}</table>`);
console.log(`${shots.length} pictures in ${out}`);
// Done: don't wait on whatever handle the browser or server left open.
process.exit(0);

function parseArgs(list) {
  const o = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['list', 'no-labels', 'hud', 'hand'].includes(key)) o[key] = true;
    else o[key] = list[++i];
  }
  return o;
}

function escape(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
