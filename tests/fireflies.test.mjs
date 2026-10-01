import { readFileSync } from 'node:fs';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { Fireflies, SWARM, MAX_SWARMS } from '../src/world/Fireflies.js';
import { isSoil } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';

/**
 * Requested directly: "a mob called fireflies, that consist in dozens of
 * green neon dots that can show up at night."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const { world } = generateEndlessWorld({ seed: 42 });
const at = { x: world.centreX + 0.5, y: 80, z: world.centreZ + 0.5 };
world.ensureAround(at.x, at.z, 64);

{
  const ff = new Fireflies({ world, rand: rng(1) });
  for (let i = 0; i < 600; i++) ff.tick(0.05, at, 0);
  ok('none by day', ff.swarms.length === 0 && ff.level === 0);

  for (let i = 0; i < 600; i++) ff.tick(0.05, at, 1);
  ok(`at night they come out — ${ff.swarms.length} swarms, ${ff.count} lights`, ff.swarms.length >= 3 && ff.swarms.length <= MAX_SWARMS && ff.count >= 3 * SWARM);
  ok(`dozens to a swarm (${SWARM})`, SWARM >= 24 && ff.swarms.every((s) => s.dots.length === SWARM));
  ok('fully bright once it\'s dark', ff.level === 1);
  ok('each over grass or forest floor, never water',
    ff.swarms.every((s) => isSoil(world.getBlock(Math.floor(s.homeX), s.y - 1, Math.floor(s.homeZ)))));
  ok('round where you are', ff.swarms.every((s) => Math.hypot(s.x - at.x, s.z - at.z) < 48));

  const pts = [];
  ff.dots((x, y, z, glow) => pts.push({ x, y, z, glow }));
  ok('every light is somewhere real, a little over the ground', pts.length === ff.count && pts.every((p) => Number.isFinite(p.x + p.y + p.z)));
  ok('hovering, not buried', ff.swarms.every((s) => pts.length) && Math.min(...pts.map((p) => p.y)) > 0);
  ok('each blinking on its own — some bright, some dim', pts.some((p) => p.glow > 0.8) && pts.some((p) => p.glow < 0.3) && pts.every((p) => p.glow >= 0 && p.glow <= 1));
  const before = pts.map((p) => p.x).join();
  ff.tick(0.5, at, 1);
  const after = [];
  ff.dots((x) => after.push(x));
  ok('and drifting', after.join() !== before);

  // Catch some.
  const s = ff.swarms[0];
  const eye = { x: s.x, y: s.y + 1.4, z: s.z + 4 };
  const hit = ff.pick(eye, { x: 0, y: 0, z: -1 }, 7);
  ok('Break aimed at a swarm finds it', hit?.swarm === s && Math.abs(hit.t - 4) < 0.01);
  ok('nothing when you look away', ff.pick(eye, { x: 0, y: 0, z: 1 }, 7) === null);
  const n = s.dots.length;
  ff.catchFrom(s);
  ok('a catch takes a few of its lights', s.dots.length === n - 5);
  while (s.dots.length >= 6) ff.catchFrom(s);
  ff.tick(0.05, at, 1);
  ok('and a swarm caught down to a few scatters', !ff.swarms.includes(s));

  // Dawn.
  for (let i = 0; i < 40; i++) ff.tick(0.05, at, 0);
  ok('at dawn they fade rather than vanish', ff.level > 0 && ff.level < 1 && ff.swarms.length > 0);
  for (let i = 0; i < 100; i++) ff.tick(0.05, at, 0);
  ok('and are gone by day', ff.level === 0 && ff.swarms.length === 0);

  // Walk away.
  for (let i = 0; i < 400; i++) ff.tick(0.05, at, 1);
  ff.tick(0.05, { x: at.x + 500, y: 80, z: at.z }, 1);
  ok('swarms you leave behind are gone', ff.swarms.every((sw) => Math.hypot(sw.x - at.x - 500, sw.z - at.z) < 70));
}

// --- the lantern ----------------------------------------------------------------------

ok('fireflies are a thing you carry, with a mark of their own', ITEMS_BY_ID.get('fireflies')?.kind === 'raw' && !!GLYPHS.firefly);
ok('and what a Firefly Lantern is made with', RECIPES.find((r) => r.output.id === 'firefly_lantern').inputs.fireflies > 0);

// --- in the game ------------------------------------------------------------------------

ok('they come out with the dark of the real sky', /this\.fireflies\.tick\(dt, this\.player\.position, 1 - daylightAt\(this\.dayCycle\.time\)\.day\)/.test(game));
ok('drawn every frame', /this\.fireflyView\.update\(this\.fireflies\)/.test(game));
ok('Break on a swarm catches them, before anything behind', /if \(this\.catchFireflies\(hit\)\) return;\s*if \(this\.hitMob\(hit\)\) return;/.test(game) && /collect\(\{ fireflies: 1 \}\)/.test(game));
ok('pointed at, they\'re named', /setPersonHint\('Fireflies', 'hit to catch a few'\)/.test(game));

process.exit(f ? 1 : 0);
