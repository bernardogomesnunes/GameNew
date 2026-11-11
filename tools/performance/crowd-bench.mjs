/**
 * A crowd, timed: 60 warriors and 40 animals round you, all converging on
 * the same few enemies — the case the owner reported ("the camera freezes
 * next to many warriors"). Prints milliseconds a tick, what a tick
 * allocates, and how many pairs of bodies stand in each other.
 *
 *   node tools/performance/crowd-bench.mjs            this checkout
 *   node tools/performance/crowd-bench.mjs --src=DIR  another checkout's src (to compare)
 *   node --expose-gc tools/performance/crowd-bench.mjs   also reports bytes a tick
 *
 * It runs on a checkout without world/bodies.js too (there it only moves
 * them), so the same script gives the number before and after.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const arg = process.argv.find((a) => a.startsWith('--src='));
const src = pathToFileURL(resolve(arg ? arg.slice(6) : new URL('../../src', import.meta.url).pathname) + '/').href;
const load = (path) => import(new URL(path, src).href);

const { World } = await load('world/World.js');
const { Mobs } = await load('world/Mobs.js');
const { Army } = await load('world/Army.js');
const { MOBS_BY_ID } = await load('config/mobs.js');
const bodies = await load('world/bodies.js').catch(() => null);

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

const SIZE = 192, TICKS = 3000, WARM = 600, DT = 1 / 60;
const world = new World({ sizeX: SIZE, sizeZ: SIZE, height: 32 });
for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) world.setBlock(x, 0, z, 3);
// Pillars to go round, the same every run.
const scatter = rng(7);
for (let i = 0; i < 260; i++) {
  const x = Math.floor(scatter() * SIZE), z = Math.floor(scatter() * SIZE);
  if (Math.hypot(x - 96, z - 96) < 4) continue;
  world.setBlock(x, 1, z, 3); world.setBlock(x, 2, z, 3);
}

const you = { x: 96.5, y: 1, z: 96.5 };
const armies = [new Army({ world, rand: rng(1) }), new Army({ world, rand: rng(2) })];
for (const a of armies) { a.swear(0); a.command('attack', you, 0); }
const enemies = [];
const place = rng(3);
for (let i = 0; i < 8; i++) enemies.push({ x: 92 + place() * 9, y: 1, z: 86 + place() * 6, dead: false, hp: 1e9 });

const mobs = new Mobs({ world, rand: rng(4), cap: 0 });
const kinds = ['cow', 'sheep', 'pig', 'chicken', 'deer', 'boar', 'goat', 'rabbit'];
for (let i = 0; i < 40; i++) {
  const m = mobs.make(MOBS_BY_ID.get(kinds[i % kinds.length]), 90 + place() * 13, 1, 98 + place() * 8);
  m.penId = 'bench'; // never forgotten
  mobs.list.push(m);
}

const crowd = bodies?.Crowd ? new bodies.Crowd() : null;
const who = { mobs: null, warriors: null, player: you };
const all = [];
const overlaps = () => {
  all.length = 0;
  for (const a of armies) for (const w of a.field) all.push(w);
  let n = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) < 0.45) n++;
  }
  return n;
};

const tick = () => {
  // The second army stands a little to one side, so 60 are out at once.
  armies[0].tick(DT, you, 0, enemies, {});
  armies[1].tick(DT, you, 0, enemies, {});
  mobs.tick(DT, you, { lure: true });
  if (crowd) {
    const t = performance.now();
    who.mobs = mobs.list;
    bodies.gatherCrowd(crowd, who);
    for (const w of armies[0].field) crowd.add(w);
    for (const w of armies[1].field) crowd.add(w);
    crowd.resolve(world);
    crowdMs += performance.now() - t;
  }
};
let crowdMs = 0;

for (let i = 0; i < WARM; i++) tick();
crowdMs = 0;
const times = new Float64Array(TICKS);
let overlapping = 0;
globalThis.gc?.();
const heap = process.memoryUsage().heapUsed;
const started = performance.now();
for (let i = 0; i < TICKS; i++) {
  const t = performance.now();
  tick();
  times[i] = performance.now() - t;
}
const total = performance.now() - started;
const crowdTotal = crowdMs;
const grown = process.memoryUsage().heapUsed - heap;
for (let i = 0; i < 200; i++) { tick(); overlapping += overlaps(); }
times.sort();
const out = {
  bodies: armies[0].field.length + armies[1].field.length + mobs.list.length + 1,
  crowd: !!crowd,
  msPerTick: +(total / TICKS).toFixed(4),
  // Of that, the pushing apart itself (the rest is everybody walking and thinking).
  crowdMsPerTick: crowd ? +(crowdTotal / TICKS).toFixed(4) : 0,
  p95: +times[Math.floor(TICKS * 0.95)].toFixed(4),
  worst: +times[TICKS - 1].toFixed(4),
  // Only meaningful with --expose-gc; without it a collection lands in the middle.
  bytesPerTick: globalThis.gc ? Math.round(grown / TICKS) : null,
  warriorPairsInOneAnother: +(overlapping / 200).toFixed(1),
};
console.log(JSON.stringify(out));
