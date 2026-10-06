import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { SLABS, slabOnFace, slabMerge, slabPart, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { boxesFor } from '../src/world/propShapes.js';
import { castVoxelRay } from '../src/interaction/VoxelRaycast.js';

/**
 * Backlog batch 3, #6: "Place in the bottom or top half of a block, by where
 * you point. A slab on a slab of the same kind becomes a full block."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const duilt = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');

const [STONE_SLAB, PLANK_SLAB] = SLABS;
const UP = { x: 0, y: 1, z: 0 }, DOWN = { x: 0, y: -1, z: 0 }, SIDE = { x: 1, y: 0, z: 0 };

// --- which half ---------------------------------------------------------------------

ok('on top of a block, a slab lies at the bottom of its cell', slabOnFace(27, UP) === 27);
ok('under a block, it hangs at the top', slabOnFace(27, DOWN) === STONE_SLAB.top);
ok('on a side, the half you pointed at', slabOnFace(27, SIDE, 0.8) === STONE_SLAB.top && slabOnFace(27, SIDE, 0.2) === 27);
ok('anything else is as it was', slabOnFace(3, DOWN) === 3);
ok('the top half is a state of the slab: it picks up as the slab, and isn\'t in the bag on its own',
  SLABS.every((s) => ITEM_FOR_BLOCK.get(s.top) === ITEM_FOR_BLOCK.get(s.id) && !PLACEABLE_BLOCKS.some((b) => b.id === s.top)));
ok('slabPart knows both halves', slabPart(STONE_SLAB.top)?.top === true && slabPart(28)?.top === false && slabPart(3) == null);

// --- two make a whole -----------------------------------------------------------------

ok('a slab on a bottom slab of its kind makes the full block', slabMerge(27, 27, UP) === 3 && slabMerge(28, 28, UP) === 7);
ok('a slab under a top slab of its kind, too', slabMerge(27, STONE_SLAB.top, DOWN) === 3);
ok('from the side, into its open half', slabMerge(28, 28, SIDE, 0.7) === 7 && slabMerge(28, PLANK_SLAB.top, SIDE, 0.3) === 7);
ok('not into the half that\'s already full', slabMerge(28, 28, SIDE, 0.3) == null && slabMerge(27, 27, DOWN) == null);
ok('not a different kind', slabMerge(27, 28, UP) == null);
ok('the game makes the whole block for the one slab', /slabMerge\(this\.placedBlock\(type\), hit\.block, hit\.normal, upFace\)/.test(game)
  && /next: whole, item/.test(game) && /c\.item \?\? ITEM_FOR_BLOCK\.get\(c\.next\)/.test(duilt));
ok('and puts a slab in the half you pointed at', /slabOnFace\(.*hit\.normal, upFace\)/.test(game));

// --- shape, standing, drawing --------------------------------------------------------------

{
  const top = boxesFor('slab_top');
  ok('a top slab fills the top half of its cell', top.length === 1 && top[0].minY === 0.5 && top[0].maxY === 1);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(2, 1, 2, STONE_SLAB.top);
  const box = w.collisionBoxAt(2, 1, 2);
  ok('it\'s solid only up there: walked under, stood on', box.minY === 1.5 && box.maxY === 2);
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  ok('and it\'s drawn', c.propMesh.geometry.attributes.position.count === 24);
}

// --- in stone's own texture ---------------------------------------------------------------

{
  // Asked for directly: "Stone slabs are not looking like stone now they should."
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(2, 1, 2, 27);
  w.setBlock(4, 1, 2, 29);
  w.setBlock(6, 1, 2, 47); // a fence stays a plain prop
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  const geo = c.propMesh.geometry, mats = c.propMesh.material;
  const group = geo.groups.find((gr) => gr.materialIndex === 3);
  const full = w.getChunk(0, 0);
  ok('slabs and stairs are drawn with the blocks\' own textured material', !!group && mats[3] !== mats[0] && mats[3].vertexColors);
  const layer = geo.attributes.layer.array, idx = geo.index.array;
  const used = new Set();
  for (let k = group.start; k < group.start + group.count; k++) used.add(layer[idx[k]]);
  const { layerFor } = await import('../src/render/BlockTextures.js');
  ok(`in stone's tile (${[...used].join(', ')})`, used.size === 1 && used.has(layerFor(3)));
  ok('a fence is still a plain prop', geo.groups.find((gr) => gr.materialIndex === 0).count > 0 && !!full);
}

// --- where the ray met the face ----------------------------------------------------------

{
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(5, 2, 5, 3);
  const hit = castVoxelRay(w, { x: 2.5, y: 2.8, z: 5.5 }, { x: 1, y: 0, z: 0 });
  ok(`the ray says where on the face it hit (y ${hit.point.y.toFixed(2)}, ${(hit.point.y - hit.y).toFixed(2)} up the side)`,
    Math.abs(hit.point.x - 5) < 1e-9 && Math.abs(hit.point.y - 2.8) < 1e-9 && hit.normal.x === -1);
}

process.exit(f ? 1 : 0);
