import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { layerFor } from '../src/render/BlockTextures.js';

/**
 * Reported with a picture: two turf blocks stacked, and the lower one's sides
 * still had the grass hanging over their top edge, under the block sitting on
 * it. A turf block with a solid block over it is drawn as dirt.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const GRASS = 1, DIRT = 2, STONE = 3, GLASS = 10;
const layersIn = (world) => {
  const chunk = world.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(world, chunk);
  const seen = new Map();
  for (const mesh of chunk.mesh.values()) {
    const L = mesh.geometry.attributes.layer.array;
    for (const l of L) seen.set(l, (seen.get(l) ?? 0) + 1);
  }
  return seen;
};
const tower = (...ids) => {
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  ids.forEach((id, i) => w.setBlock(6, 4 + i, 6, id));
  return layersIn(w);
};

const grassSide = layerFor(GRASS), dirt = layerFor(DIRT);
ok('turf and dirt are painted differently, so this can be told', grassSide !== dirt && dirt >= 0);
const one = tower(GRASS);
ok('one turf block on its own: grass sides, no dirt', one.has(grassSide) && !one.has(dirt));
const two = tower(GRASS, GRASS);
ok('two stacked: the lower one is drawn as dirt', two.has(dirt) && two.get(dirt) === 4 * 4 + 4);
ok('the top one keeps its grass sides', two.get(grassSide) === 4 * 4);
const capped = tower(GRASS, STONE);
ok('any solid block on top does the same', capped.has(dirt));
const glazed = tower(GRASS, GLASS);
ok('but not glass: light gets through', !glazed.has(dirt));

process.exit(f ? 1 : 0);
