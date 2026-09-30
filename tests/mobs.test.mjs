import { World } from '../src/world/World.js';
import { Mobs } from '../src/world/Mobs.js';
import { MOBS, MOBS_BY_ID } from '../src/config/mobs.js';
import { BIOMES } from '../src/config/biomes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { hasGlyph } from '../src/config/glyphs.js';

/**
 * Phase 5a: wild animals and hunting. Animals turn up around you by biome,
 * wander and graze, keep off water and cliffs, run when hurt (or when you
 * get close, if they're skittish), and leave meat and hide behind.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3, GRASS = 1, WATER = 11;

/** Seeded, so every run of this file sees the same animals. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 160×160 of flat plains at y 0..4, standing surface y = 5. */
function plains() {
  const world = new World({ sizeX: 160, sizeZ: 160, height: 32 });
  for (let x = 0; x < 160; x++) for (let z = 0; z < 160; z++) {
    for (let y = 0; y < 4; y++) world.setBlock(x, y, z, STONE, { byHand: false });
    world.setBlock(x, 4, z, GRASS, { byHand: false });
  }
  return world;
}

const player = { x: 80, y: 5, z: 80 };

// --- the species table is sound ------------------------------------------------

const biomeIds = new Set(BIOMES.map((b) => b.id));
ok('every species lives in real biomes', MOBS.every((m) => m.biomes.length && m.biomes.every((b) => biomeIds.has(b))));
ok('every drop is a real item', MOBS.every((m) => Object.keys(m.drops).every((id) => ITEMS_BY_ID.has(id))));
ok('every land biome but the desert\'s sands has something big enough to eat',
  ['plains', 'forestOak', 'forestBirch', 'forestDark', 'mountains1', 'wetland'].every((b) => MOBS.some((m) => m.biomes.includes(b) && m.drops.raw_meat)));
ok('the ocean has nothing walking about in it', !MOBS.some((m) => m.biomes.includes('ocean')));
ok('the new items all have a glyph', ['raw_meat', 'cooked_meat', 'hide', 'wool', 'feather'].every((id) => hasGlyph(ITEMS_BY_ID.get(id)?.glyph)));
{
  const cook = RECIPES.find((r) => r.output.id === 'cooked_meat');
  ok('meat can be cooked by hand from Age 1 — no waiting for a kiln', cook?.station === 'hand' && cook.age === 1 && cook.inputs.raw_meat > 0);
  ok('and cooking is worth it: cooked feeds far more than raw',
    ITEMS_BY_ID.get('cooked_meat').feeds >= 4 * ITEMS_BY_ID.get('raw_meat').feeds);
}
ok('a tool hits harder than a fist', ['axe', 'pickaxe', 'shovel'].every((id) => ITEMS_BY_ID.get(id).damage > 1));

// --- spawning --------------------------------------------------------------------

{
  const world = plains();
  const mobs = new Mobs({ world, rand: rng(1) });
  for (let i = 0; i < 400; i++) mobs.tick(0.1, player);
  const alive = mobs.list.filter((m) => !m.dead);
  ok(`animals turn up on open plains (${alive.length})`, alive.length > 4);
  ok('never more than the cap', alive.length <= mobs.cap);
  ok('only plains species', alive.every((m) => MOBS_BY_ID.get(m.type).biomes.includes('plains')));
  ok('all standing on the grass, not in it or floating', alive.every((m) => Math.abs(m.y - 5) < 1e-6));
}

{
  const world = plains();
  const mobs = new Mobs({ world, rand: rng(2), avoid: (x, z) => Math.abs(x - 80) < 70 && Math.abs(z - 80) < 70 });
  for (let i = 0; i < 300; i++) mobs.trySpawn(player);
  ok('nothing spawns inside land it was told to avoid',
    mobs.list.every((m) => !(Math.abs(m.x - 80) < 70 && Math.abs(m.z - 80) < 70)));
}

{
  const world = plains();
  for (let x = 0; x < 160; x++) for (let z = 0; z < 160; z++) world.setBlock(x, 5, z, WATER, { byHand: false });
  const mobs = new Mobs({ world, rand: rng(3) });
  for (let i = 0; i < 300; i++) mobs.trySpawn(player);
  ok('nothing spawns on water', mobs.list.length === 0);
}

// --- getting about -----------------------------------------------------------------

{
  const world = plains();
  // A moat around a 12×12 island, and a pit two blocks from the island's edge
  // wouldn't matter: the moat alone is the test.
  for (let x = 60; x < 100; x++) for (let z = 60; z < 100; z++) {
    const inside = x >= 74 && x < 86 && z >= 74 && z < 86;
    if (!inside) world.setBlock(x, 4, z, WATER, { byHand: false });
  }
  const mobs = new Mobs({ world, rand: rng(4), cap: 0 });
  const spec = MOBS_BY_ID.get('sheep');
  for (let i = 0; i < 6; i++) mobs.list.push(mobs.make(spec, 76 + i * 1.5, 5, 80));
  const far = { x: 30, y: 5, z: 30 }; // out of scaring range, inside despawn range
  for (let i = 0; i < 3000; i++) mobs.tick(0.05, far);
  ok('grazing animals keep off the water around them',
    mobs.list.length === 6 && mobs.list.every((m) => m.x >= 74 && m.x < 86 && m.z >= 74 && m.z < 86));
}

{
  const world = plains();
  // A deep hole: nothing wanders into a ten-block drop.
  for (let x = 83; x < 90; x++) for (let z = 70; z < 90; z++) for (let y = 0; y < 5; y++) world.setBlock(x, y, z, 0, { byHand: false });
  const mobs = new Mobs({ world, rand: rng(5), cap: 0 });
  const spec = MOBS_BY_ID.get('cow');
  for (let i = 0; i < 5; i++) mobs.list.push(mobs.make(spec, 80.5, 5, 72 + i * 3));
  for (let i = 0; i < 3000; i++) mobs.tick(0.05, { x: 30, y: 5, z: 30 });
  ok('and off cliffs they couldn\'t climb back up', mobs.list.every((m) => m.y === 5));
}

{
  const world = plains();
  const mobs = new Mobs({ world, rand: rng(6), cap: 0 });
  const deer = mobs.make(MOBS_BY_ID.get('deer'), 84.5, 5, 80.5);
  const cow = mobs.make(MOBS_BY_ID.get('cow'), 76.5, 5, 80.5);
  mobs.list.push(deer, cow);
  const before = { deer: Math.hypot(deer.x - 80, deer.z - 80) };
  for (let i = 0; i < 20; i++) mobs.tick(0.05, player);
  ok('a deer bolts when you come close', deer.fleeFor > 0 && Math.hypot(deer.x - 80, deer.z - 80) > before.deer + 1);
  ok('a cow doesn\'t bother', cow.fleeFor <= 0);
}

{
  const world = plains();
  const mobs = new Mobs({ world, rand: rng(7), cap: 0 });
  const m = mobs.make(MOBS_BY_ID.get('sheep'), 80.5, 5, 80.5);
  mobs.list.push(m);
  for (let i = 0; i < 200; i++) mobs.tick(0.05, { x: 30, y: 5, z: 30 });
  ok('walking out of range forgets it', (() => { mobs.tick(0.05, { x: 80 + 200, y: 5, z: 80 }); return mobs.list.length === 0; })());
}

// --- hunting -------------------------------------------------------------------------

{
  const world = plains();
  const mobs = new Mobs({ world, rand: rng(8), cap: 0 });
  const spec = MOBS_BY_ID.get('deer');
  const m = mobs.make(spec, 84.5, 5, 80.5);
  mobs.list.push(m);

  const eye = { x: 80.5, y: 6.6, z: 80.5 };
  const toward = (() => { const dx = 4, dy = -0.8, dz = 0, l = Math.hypot(dx, dy, dz); return { x: dx / l, y: dy / l, z: dz / l }; })();
  const away = { x: -1, y: 0, z: 0 };
  const hitRay = mobs.pick(eye, toward, 7);
  ok('looking at it picks it', hitRay?.mob === m && hitRay.t > 3 && hitRay.t < 4.5);
  ok('looking away does not', mobs.pick(eye, away, 7) === null);
  ok('nor from beyond reach', mobs.pick(eye, toward, 2) === null);

  const first = mobs.hit(m, 3, 80.5, 80.5);
  ok('a blow hurts it and it runs', !first.killed && m.hp === spec.hp - 3 && m.fleeFor > 0 && m.hurt > 0);
  const second = mobs.hit(m, 3, 80.5, 80.5);
  ok('enough blows kill it', second.killed && m.dying > 0);
  const [lo, hi] = spec.drops.raw_meat;
  ok(`and it leaves meat in range (${second.drops.raw_meat})`, second.drops.raw_meat >= lo && second.drops.raw_meat <= hi);
  ok('a dying animal can\'t be picked again', mobs.pick(eye, toward, 7) === null);
  for (let i = 0; i < 20; i++) mobs.tick(0.05, player);
  ok('and it\'s gone once it has toppled', mobs.list.length === 0);
}

process.exit(f ? 1 : 0);
