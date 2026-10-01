import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { landmarksFor, PLACE_NAMES } from '../src/world/landmarks.js';
import { LOOT, lootFor } from '../src/duilt/Loot.js';
import { NEWS } from '../src/config/wanderers.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { ITEMS_BY_ID, isFood } from '../src/config/items.js';
import { isChest } from '../src/config/blocks.js';

/**
 * Playtest, P4. Asked for directly: "We need structures. Random temples and
 * ruins. Abandoned mines. And monuments. And all with a chest with goodies:
 * armour, weapons, food, and a super rare ring-crafting item."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const wanderers = readFileSync(new URL('../src/world/Wanderers.js', import.meta.url), 'utf8');
const map = readFileSync(new URL('../src/render/WorldMap.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

const KINDS = ['ruin', 'ruined_temple', 'mine', 'monument'];

// --- in every world ------------------------------------------------------------------------

{
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
  let overlap = false, dry = true, chests = true, seeds = 0;
  for (const seed of [3, 41, 777, 2024, 9001]) {
    const gen = new ChunkGen({ seed });
    const lms = landmarksFor(gen);
    seeds++;
    for (const l of lms) if (counts[l.kind] != null) counts[l.kind]++;
    for (const a of lms) {
      if (gen.waterLevelAt(a.x, a.z)) dry = false;
      if (counts[a.kind] != null && !a.blocks.some(([, , , id]) => isChest(id))) chests = false;
      for (const b of lms) if (a !== b && Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) < a.half + b.half + 2) overlap = true;
    }
  }
  ok(`ruins, forgotten temples, mines and monuments in every world (${KINDS.map((k) => `${counts[k]} ${k}`).join(', ')} over ${seeds})`,
    counts.ruin >= seeds * 3 && counts.ruined_temple >= seeds && counts.mine >= seeds && counts.monument >= seeds);
  ok('each with a chest', chests);
  ok('on dry land', dry);
  ok('and none built on top of another', !overlap);
  ok('the same places for the same seed', JSON.stringify(landmarksFor(new ChunkGen({ seed: 41 })).map((l) => [l.kind, l.x, l.z]))
    === JSON.stringify(landmarksFor(new ChunkGen({ seed: 41 })).map((l) => [l.kind, l.x, l.z])));
  ok('every one has a name', KINDS.every((k) => PLACE_NAMES[k]));
  // No wild tree grows over one, so you can see it from a distance.
  const gen = new ChunkGen({ seed: 41 });
  let trees = 0;
  for (const l of landmarksFor(gen)) {
    for (let x = l.x - l.half - 3; x <= l.x + l.half + 3; x++) for (let z = l.z - l.half - 3; z <= l.z + l.half + 3; z++) if (gen.treeAt(x, z)) trees++;
  }
  ok(`a clearing round each: no tree grows over it (${trees})`, trees === 0);
}

// --- what they are -------------------------------------------------------------------------------

{
  const gen = new ChunkGen({ seed: 2024 });
  const lms = landmarksFor(gen);
  const of = (kind) => lms.find((l) => l.kind === kind);
  const ids = (l) => new Set(l.blocks.map((b) => b[3]));
  ok('a ruin: worn walls, moss and a fallen pillar', ids(of('ruin')).has(22) && ids(of('ruin')).has(165) && ids(of('ruin')).has(8));
  ok('a forgotten temple: marble, dark stone, pillars and an altar with gold on it', [17, 156, 166, 159].every((id) => ids(of('ruined_temple')).has(id)));
  const mine = of('mine');
  const chest = mine.blocks.find((b) => isChest(b[3]));
  ok(`an abandoned mine: a shaft going down (${Math.min(...mine.blocks.map((b) => b[1]))} deep) with timber props and ore in its walls`,
    Math.min(...mine.blocks.map((b) => b[1])) <= -12 && ids(mine).has(4) && [38, 39, 40].some((id) => ids(mine).has(id)));
  ok('  and the miners\' chest at the bottom', chest[1] <= -10);
  const mon = of('monument');
  ok('a monument: an obelisk on a plinth, capped in gold', Math.max(...mon.blocks.map((b) => b[1])) >= 10 && ids(mon).has(156) && ids(mon).has(13));

  // Stamped into the real world, the chest is where it should be.
  const world = new World({ height: 128, gen });
  const l = of('ruin');
  const [dx, dy, dz, id] = l.blocks.find((b) => isChest(b[3]));
  for (let cx = (l.x - 8) >> 4; cx <= (l.x + 8) >> 4; cx++) for (let cz = (l.z - 8) >> 4; cz <= (l.z + 8) >> 4; cz++) world.getChunk(cx, cz);
  ok('stamped into the world as its chunk is made', world.getBlock(l.x + dx, l.y + dy, l.z + dz) === id);
}

// --- the goodies -------------------------------------------------------------------------------

{
  const all = KINDS.flatMap((k) => LOOT[k]?.items.map(([id]) => id) ?? []);
  ok('a loot table for each kind', KINDS.every((k) => LOOT[k]?.items.length >= 5));
  ok('armour in them', all.some((id) => ITEMS_BY_ID.get(id)?.wears));
  ok('weapons', all.some((id) => ITEMS_BY_ID.get(id)?.damage >= 6));
  ok('food', all.some((id) => isFood(id)));
  ok('and the new drinks', ['beer', 'kombucha', 'coffee'].every((id) => all.includes(id)));
  ok('every item real', all.every((id) => ITEMS_BY_ID.has(id)));
  ok('a ring ore: super rare', KINDS.every((k) => LOOT[k].ring > 0 && LOOT[k].ring <= 0.12));
  let rings = 0;
  for (let i = 0; i < 2000; i++) { const got = lootFor('ruin', i * 7, 40, i * 13, 99); if (got.sunstone || got.nightstone) rings++; }
  ok(`  about one ruin in twenty (${rings} in 2000)`, rings > 50 && rings < 160);
  ok('the chest you open rolls the table of the place it stands in', /const kind = near \? \(LOOT\[near\.kind\] \? near\.kind : 'camp'\) : 'cave'/.test(game));
}

// --- finding them ------------------------------------------------------------------------------

ok('nobody lives in them — no bandits spawn at a ruin', /if \(lm\.kind !== 'hermit' && lm\.kind !== 'camp'\) continue;/.test(wanderers));
ok('messengers bring news of each, with the way to go', KINDS.every((k) => NEWS[k]?.length >= 2 && NEWS[k].every((line) => line.includes('{dir}'))));
ok('walking up to one finds it', /this\.lookForPlaces\(dt\)/.test(game) && /this\.duilt\.discover\(lm\)/.test(game));
{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  ok('found once, not twice', g.discover({ kind: 'mine', x: 400, z: -30 }) && !g.discover({ kind: 'mine', x: 400, z: -30 }));
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('and remembered with the world', back.foundPlaces().length === 1 && back.foundPlaces()[0].x === 400 && back.foundPlaces()[0].kind === 'mine');
}
ok('what you have found is marked on the map', /places: duilt\?\.foundPlaces\(\)/.test(ui) && /for \(const p of places\)/.test(map));

process.exit(f ? 1 : 0);
