import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import {
  WOOD_SETS, WALLS, BLOCKS_BY_ID, PLACEABLE_BLOCKS, isGate, isOpenGate, swungGate, isTrapdoor, isOpenTrapdoor,
  swungTrapdoor, trapdoorOnFace, doorPart, doorBlock, turned, facingOf, countsAs, mirrored,
} from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { inspect } from '../src/structures/validate.js';

/**
 * Backlog batch 3, #23–26: walls for every stone, and fences, gates, doors
 * and trapdoors for every wood. Each works the way oak's always has, keeps
 * its own wood through every swing and turn, and counts as oak's for what a
 * building needs.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const [OAK, ...MORE] = WOOD_SETS;
ok('three woods: oak, white and dark', WOOD_SETS.map((s) => s.key).join() === 'oak,white,dark');

// --- each is something you can make and hold -----------------------------------------

const PIECES = ['planks', 'fence', 'gate', 'door', 'trapdoor'];
for (const set of MORE) {
  const items = PIECES.map((k) => ITEM_FOR_BLOCK.get(set[k]));
  ok(`${set.key}: ${items.join(', ')}`, items.every((id) => ITEMS_BY_ID.has(id)));
  ok(`${set.key}: each made at the bench, from things that exist`, items.every((id) => {
    const r = RECIPES.find((x) => x.output.id === id);
    return r && Object.keys(r.inputs).every((k) => ITEMS_BY_ID.has(k));
  }));
  ok(`${set.key}: planks from its own logs, the rest from its own planks`,
    RECIPES.find((r) => r.output.id === ITEM_FOR_BLOCK.get(set.planks)).inputs[ITEM_FOR_BLOCK.get(set.log)] > 0
    && items.slice(1).every((id) => RECIPES.find((r) => r.output.id === id).inputs[ITEM_FOR_BLOCK.get(set.planks)] > 0));
  ok(`${set.key}: each has an icon`, items.every((id) => (itemIcon(ITEMS_BY_ID.get(id)) ?? '').startsWith('<svg')));
  ok(`${set.key}: each is in the blocks you can put down`, PIECES.every((k) => PLACEABLE_BLOCKS.some((b) => b.id === set[k])));
  ok(`${set.key}: shaped like oak's`, ['fence', 'gate', 'gateOpen', 'door', 'trapdoor', 'trapdoorOpen', 'trapdoorLow']
    .every((k) => BLOCKS_BY_ID.get(set[k]).shape === BLOCKS_BY_ID.get(OAK[k]).shape));
  ok(`${set.key}: and not oak's colour`, BLOCKS_BY_ID.get(set.door).color !== BLOCKS_BY_ID.get(OAK.door).color);
}

// --- swinging and turning keep the wood -------------------------------------------------

for (const set of MORE) {
  ok(`${set.key} gate swings open and shut`, isGate(set.gate) && swungGate(set.gate) === set.gateOpen && isOpenGate(set.gateOpen) && swungGate(set.gateOpen) === set.gate);
  ok(`${set.key} gate open picks up as the gate`, ITEM_FOR_BLOCK.get(set.gateOpen) === ITEM_FOR_BLOCK.get(set.gate));
  ok(`${set.key} trapdoor opens, shuts and lies low, every facing`, [0, 1, 2, 3].every((d) => {
    const shut = turned(set.trapdoor, d), open = swungTrapdoor(shut);
    return isTrapdoor(shut) && isOpenTrapdoor(open) && open >= set.trapdoorOpen && open <= set.trapdoorOpen + 3
      && facingOf(open) === d && swungTrapdoor(open) === shut && swungTrapdoor(open, { low: true }) === set.trapdoorLow + d;
  }));
  ok(`${set.key} trapdoor goes on the face you point at`, trapdoorOnFace(set.trapdoor, { y: 1 }) === set.trapdoorLow
    && trapdoorOnFace(set.trapdoor, { y: -1 }) === set.trapdoor && trapdoorOnFace(set.trapdoor, { x: 1 }) === set.trapdoorOpen + 3);
  const part = doorPart(set.door);
  ok(`${set.key} door is a door, its own`, part && part.base === set.door && doorBlock({ ...part, open: true, facing: 2 }) === set.door + 10);
  ok(`${set.key} door turns and mirrors as itself`, doorPart(turned(set.door, 3)).base === set.door && doorPart(mirrored(turned(set.door, 1), { flipX: true })).base === set.door);
  ok(`${set.key} door's top half gives nothing back; the bottom gives the door`,
    ITEM_FOR_BLOCK.get(doorBlock({ ...part, top: true })) == null && ITEM_FOR_BLOCK.get(doorBlock({ ...part, open: true })) === ITEM_FOR_BLOCK.get(set.door));
}
ok('oak is just as it was', doorBlock({ open: true }) === 77 && swungGate(48) === 49 && swungTrapdoor(168) === 172);

// --- what a building counts ------------------------------------------------------------

{
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  const dark = WOOD_SETS[2], white = WOOD_SETS[1];
  for (let x = 1; x <= 4; x++) w.setBlock(x, 1, 1, dark.fence);
  w.setBlock(5, 1, 1, dark.gateOpen);
  w.setBlock(6, 1, 1, white.planks);
  w.setBlock(7, 1, 1, white.door + 9);
  const ctx = inspect(w, { minX: 0, maxX: 8, minY: 0, maxY: 3, minZ: 0, maxZ: 3 });
  ok('a pen fenced in dark wood has its fence and its gate', ctx.countOf([47, 48, 49]) === 5 && ctx.countOf([48, 49]) === 1);
  ok('white planks count as planks; a white door as a door', ctx.countOf(7) === 1 && ctx.countOf(69 + 9) === 1);
  ok('countsAs leaves oak and everything else alone', countsAs(47) === 47 && countsAs(3) === 3);
  ok('the game swings any wood\'s gate', /isGate\(id\) \|\| !!doorPart\(id\)/.test(game) && /swungGate\(c\.block\)/.test(game));
}

// --- drawn the same as oak ---------------------------------------------------------------

{
  const verts = (fence) => {
    const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
    for (let x = 2; x <= 5; x++) w.setBlock(x, 1, 2, fence);
    w.setBlock(6, 1, 2, 161);
    const c = w.getChunk(0, 0);
    new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
    return c.propMesh.geometry.attributes.position.count;
  };
  ok(`a dark fence joins up like an oak one (${verts(WOOD_SETS[2].fence)} vertices)`, verts(WOOD_SETS[2].fence) === verts(47));
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(2, 1, 2, WOOD_SETS[1].fence);
  ok('nothing climbs a white fence either', w.collisionBoxAt(2, 1, 2).maxY === 2.5);
}

// --- walls -------------------------------------------------------------------------------

{
  const items = WALLS.map((w) => ITEM_FOR_BLOCK.get(w.id));
  ok(`a wall for every stone: ${WALLS.length}`, WALLS.length === 12 && items.every((id) => ITEMS_BY_ID.has(id)));
  ok('each laid at the bench from its own stone', items.every((id) => {
    const r = RECIPES.find((x) => x.output.id === id);
    return r && Object.keys(r.inputs).every((k) => ITEMS_BY_ID.get(k)?.block != null);
  }));
  ok('the new ones count as stone wall for a building', WALLS.slice(4).every((w) => countsAs(w.id) === 162));
}

process.exit(f ? 1 : 0);
