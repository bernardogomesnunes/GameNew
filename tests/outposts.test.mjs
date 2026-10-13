import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { landmarksFor, PLACE_NAMES } from '../src/world/landmarks.js';
import { outpostDesign } from '../src/world/cities.js';
import { NEWS } from '../src/config/wanderers.js';
import { BLOCKS_BY_ID, isChest } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { LOOT } from '../src/duilt/Loot.js';
import { MOMENTS } from '../src/config/moments.js';

/** Backlog batch 2: "Stone Kingdom outposts: generated rarely, with very good loot." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const name = (id) => BLOCKS_BY_ID.get(id)?.name ?? '';

{
  let n = 0, far = true;
  for (const seed of [41, 2024, 7, 99]) {
    const gen = new ChunkGen({ seed });
    for (const o of landmarksFor(gen).filter((l) => l.kind === 'outpost')) {
      n++;
      if (Math.hypot(o.x - gen.biomes.centreX, o.z - gen.biomes.centreZ) < 450) far = false;
    }
  }
  ok(`rare: two a world, no more (${n} over four)`, n >= 6 && n <= 8);
  ok('far out, well past the old border', far);
  ok('named, in the news, with a moment', PLACE_NAMES.outpost && NEWS.outpost.every((l) => l.includes('{dir}')) && MOMENTS.found_outpost);
}

const d = outpostDesign(0.4);
const get = (() => { const m = new Map(d.blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id])); return (x, y, z) => m.get(`${x},${y},${z}`) ?? 0; })();
ok('a dark-brick wall round a yard', /Dark Brick/.test(name(get(0, 2, -9))) && /Dark Brick/.test(name(get(-9, 2, 0))));
ok('a gate south you can walk through', [0, 1].every((y) => !get(0, y, 9) && !get(-1, y, 9) && !get(1, y, 9)));
ok('four towers flying the black banner', [[-9, -9], [9, -9], [-9, 9], [9, 9]].every(([x, z]) => /Black Banner/.test(name(get(x, 8, z)))));
ok('a keep with a door, and two chests in it — the armoury', !get(0, 1, 3) && !get(0, 2, 3) && d.blocks.filter(([, , , id]) => isChest(id)).length === 2);
ok('the armoury: very good', LOOT.outpost.items.every(([id]) => ITEMS_BY_ID.has(id)) && ['diamond', 'ruby', 'sword_dark'].every((id) => LOOT.outpost.items.some(([i]) => i === id)) && LOOT.outpost.ring >= 0.15);

{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  const lm = { kind: 'outpost', x: 32, z: 32, y: 1, half: d.half, people: d.people };
  for (const [x, y, z, id] of d.blocks) world.setBlock(lm.x + x, lm.y + y, lm.z + z, id);
  let white = false;
  const w = new Wanderers({ world, rand: rng(4), kingdomHostile: () => white });
  w.populate(lm);
  const guards = w.list.filter((p) => p.kind === 'guard');
  ok('four of the Kingdom\'s guards', guards.length === 4);
  ok('they leave you be, as the Kingdom does', guards.every((g) => !w.hostileOf(g)));
  white = true;
  ok('but the White Ring is their enemy', guards.every((g) => w.hostileOf(g)));
  white = false;
  w.anger(lm);
  ok('and take from the armoury, and they all come', guards.every((g) => w.hostileOf(g)));
}
ok('taking from it is noticed', /l\.kind === 'outpost'/.test(game) && /The armoury is guarded/.test(game));

process.exit(f ? 1 : 0);
