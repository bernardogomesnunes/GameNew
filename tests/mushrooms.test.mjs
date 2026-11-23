import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { BIOMES } from '../src/config/biomes.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID, isFood } from '../src/config/items.js';
import { boxesFor } from '../src/world/propShapes.js';
import { TRADERS, CITY_TRADERS } from '../src/config/traders.js';

/** PLAY-14: three mushrooms, wild in forests (docs/design/play-14-21.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const KINDS = [['mushroom_red', 565, 'Red Mushroom'], ['mushroom_lilac', 566, 'Lilac Mushroom'], ['mushroom_pale', 567, 'Pale Mushroom']];

for (const [id, block, name] of KINDS) {
  const it = ITEMS_BY_ID.get(id);
  ok(`${name}: a raw item that is not food, placing block ${block}`, it?.kind === 'raw' && !isFood(id) && it.block === block);
  ok(`${name}: the block shares the name`, BLOCKS_BY_ID.get(block)?.name === name && it.name === name);
  const n = boxesFor(BLOCKS_BY_ID.get(block).shape).length;
  ok(`${name}: a shape of 6 to 8 boxes (${n})`, n >= 6 && n <= 8);
  const w = new World({ sizeX: 8, sizeZ: 8, height: 16 });
  w.setBlock(2, 0, 2, 1); w.setBlock(2, 1, 2, block);
  ok(`${name}: you walk through it`, w.collisionBoxAt(2, 1, 2) === null);
}
ok('red has 8 boxes, lilac and pale 6', boxesFor('mushroom_red').length === 8 && boxesFor('mushroom_lilac').length === 6 && boxesFor('mushroom_pale').length === 6);

// --- scatter ----------------------------------------------------------------
{
  const gen = new ChunkGen({ seed: 41, height: WORLD_HEIGHT });
  const found = {};
  for (let x = -400; x < 400; x += 2) for (let z = -400; z < 400; z += 2) {
    const b = BIOMES[gen.biomeIndexAt(x, z)];
    const sc = b.scatter?.length ? gen.scatterAt(x, z, b.surface.top) : 0;
    if (sc >= 565 && sc <= 567) (found[b.id] ??= new Set()).add(sc);
  }
  const has = (b, ...ids) => ids.every((i) => found[b]?.has(i));
  ok('Oak Forest scatters red and pale', has('forestOak', 565, 567) && !found.forestOak.has(566));
  ok('Birch Forest scatters pale only', has('forestBirch', 567) && found.forestBirch.size === 1);
  ok('Dark Forest scatters lilac and red', has('forestDark', 566, 565) && !found.forestDark.has(567));
  ok('none in plains, desert or mountains', Object.keys(found).every((k) => k.startsWith('forest')));

  // Hemp keeps its columns: its entry is still the first one.
  const hempIdx = (id) => BIOMES.find((b) => b.id === id).scatter.findIndex((s) => s.block === 340);
  ok('hemp is still the first scatter entry in plains and birch', hempIdx('plains') === 0 && hempIdx('forestBirch') === 0);
  let hemp = 0;
  for (let x = -200; x < 200; x++) for (let z = -200; z < 200; z++) {
    const b = BIOMES[gen.biomeIndexAt(x, z)];
    if ((b.id === 'plains' || b.id === 'forestBirch') && gen.scatterAt(x, z, 1) === 340) hemp++;
  }
  ok(`hemp still scatters (${hemp} columns on a fixed seed)`, hemp > 20);
}

// --- breaking one ------------------------------------------------------------
{
  const world = new World({ sizeX: 8, sizeZ: 8, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.onBlocksBroken([{ x: 1, y: 1, z: 1, prev: 565, next: 0 }]);
  ok('breaking 565 gives 1 Red Mushroom', g.inventory.countOf('mushroom_red') === 1);
}

// --- nobody sells one ---------------------------------------------------------
{
  const sold = [...TRADERS, ...CITY_TRADERS].flatMap((t) => [...t.goods, ...(t.rare ?? []), ...(t.buys ?? [])]).map((g) => g[0]);
  ok('no trader sells or buys a mushroom', !sold.some((id) => id.startsWith('mushroom_') || id.startsWith('dried_')));
}

process.exit(f ? 1 : 0);
