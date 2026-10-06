import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { BIOMES } from '../src/config/biomes.js';
import { SANDSTONE, SANDSTONE_BRICK, SAND_PATH, WALLS, countsAs } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';
import { itemIcon } from '../src/config/cubes.js';
import { pathBoxes, PATH_TOP } from '../src/world/propShapes.js';
import { tileFor } from '../src/render/BlockTextures.js';

/**
 * Backlog batch 3, #33: "Desert blocks: sandstone, sandstone bricks, and a
 * sand path with rounded corners. They spawn in deserts."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const SAND = 6;

// --- the blocks ------------------------------------------------------------------------

{
  const ids = [SANDSTONE, SANDSTONE_BRICK, SAND_PATH, 336];
  const items = ids.map((id) => ITEM_FOR_BLOCK.get(id));
  ok(`sandstone, its bricks, a sand path and a sandstone wall: ${items.join(', ')}`, items.every((id) => ITEMS_BY_ID.has(id)));
  ok('each made at the bench from things that exist', items.every((id) => {
    const r = RECIPES.find((x) => x.output.id === id);
    return r && Object.keys(r.inputs).every((k) => ITEMS_BY_ID.has(k));
  }));
  ok('each has its mark and an icon', items.every((id) => GLYPHS[ITEMS_BY_ID.get(id).glyph] && (itemIcon(ITEMS_BY_ID.get(id)) ?? '').startsWith('<svg')));
  ok('the sandstone wall is one of the walls', WALLS.some((w) => w.id === 336));
  const a = tileFor(SANDSTONE), b = tileFor(SANDSTONE_BRICK), s = tileFor(SAND);
  const differ = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) > 16) n++; return n; };
  ok(`sandstone, its bricks and sand each look their own (${differ(a, b)}, ${differ(a, s)} pixels apart)`, differ(a, b) > a.length / 20 && differ(a, s) > a.length / 20);
  ok('sandstone brick counts as stone for a building', countsAs(SANDSTONE_BRICK) === 3);
}

// --- the path ----------------------------------------------------------------------------

{
  const alone = pathBoxes({});
  const corner = (boxes, x, z) => boxes.some((bx) => x >= bx.minX && x <= bx.maxX && z >= bx.minZ && z <= bx.maxZ);
  ok('on its own, a path is a patch with all four corners rounded off',
    [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]].every(([x, z]) => !corner(alone, x, z)) && corner(alone, 0.5, 0.5));
  ok('and stepped into the curve, not just notched', corner(alone, 0.15, 0.15) && !corner(alone, 0.05, 0.05));
  const run = pathBoxes({ px: 1, nx: 1 });
  ok('in a straight run it fills its cell edge to edge', [[0.02, 0.02], [0.98, 0.98], [0.02, 0.98]].every(([x, z]) => corner(run, x, z)));
  const bend = pathBoxes({ px: 1, pz: 1 });
  ok('at a bend only the outer corner rounds', !corner(bend, 0.02, 0.02) && corner(bend, 0.98, 0.98) && corner(bend, 0.98, 0.02) && corner(bend, 0.02, 0.98));
  ok('it sits a sixteenth under the ground beside it', alone.every((bx) => bx.maxY === PATH_TOP) && PATH_TOP === 0.9375);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(3, 1, 3, SAND_PATH);
  ok('you walk on it', w.collisionBoxAt(3, 1, 3).maxY === 1.9375);
  for (let x = 4; x <= 6; x++) w.setBlock(x, 1, 3, SAND_PATH);
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  // Ends: 3 boxes + 2 steps each; the middle two: 3 boxes each.
  ok(`a run of four joins up, rounded at the ends (${c.propMesh.geometry.attributes.position.count / 24} boxes)`,
    c.propMesh.geometry.attributes.position.count === (5 + 3 + 3 + 5) * 24);
}

// --- found in deserts ------------------------------------------------------------------------

{
  const DESERT = BIOMES.findIndex((b) => b.id === 'desert');
  let found = null;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const gen = new ChunkGen({ seed });
    for (let x = -3000; x <= 3000 && !found; x += 64) {
      for (let z = -3000; z <= 3000 && !found; z += 64) {
        if (gen.biomeIndexAt(x, z) === DESERT) found = { gen, x, z };
      }
    }
    if (found) break;
  }
  ok('a desert to look in', !!found);
  if (found) {
    const world = new World({ height: found.gen.height, gen: found.gen });
    let columns = 0, bedded = 0, outcrops = 0;
    for (let dx = -48; dx < 48; dx++) {
      for (let dz = -48; dz < 48; dz++) {
        const x = found.x + dx, z = found.z + dz;
        if (world.biomeIndex(x, z) !== DESERT) continue;
        const h = world.surfaceHeight(x, z), top = world.getBlock(x, h - 1, z);
        if (top !== SAND && top !== SANDSTONE) continue;
        columns++;
        if (top === SANDSTONE) outcrops++;
        else if (world.getBlock(x, h - 5, z) === SANDSTONE && world.getBlock(x, h - 2, z) === SAND) bedded++;
      }
    }
    ok(`under desert sand, three down, there's sandstone (${bedded} of ${columns} columns)`, columns > 500 && bedded > columns * 0.6);
    ok(`and here and there it breaks the surface (${outcrops} columns)`, outcrops > 0 && outcrops < columns * 0.4);
  }
}

process.exit(f ? 1 : 0);
