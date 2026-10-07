import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { BLOCKS, BLOCKS_BY_ID, shapeOf, lightOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { boxesFor } from '../src/world/propShapes.js';

/**
 * Phase 4: real dynamic light, real half-height collision, and furniture as
 * recoloured 3D prop shapes.
 *
 * ChunkMesher/PropRenderer themselves need a browser to actually draw
 * anything, so what's checked here is everything under that: the block
 * registry's new `shape`/`light` fields, World's shape-aware collision boxes
 * and light tracking, and PlayerController actually snapping to a half-height
 * hitbox instead of a whole block.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

const STONE = 3;
const LANTERN = 26, SLAB_STONE = 27, STAIRS_STONE = 29, CHAIR_OAK = 33, RUG_GREEN = 37;

// --- the registry itself --------------------------------------------------

{
  ok('a lantern casts real light', !!lightOf(LANTERN)?.color);
  ok('an ordinary block casts none', lightOf(STONE) === null);
  ok('a stone slab is shaped', shapeOf(SLAB_STONE) === 'slab');
  ok('stairs are shaped', shapeOf(STAIRS_STONE) === 'stair');
  ok('a chair is shaped', shapeOf(CHAIR_OAK) === 'chair');
  ok('a rug is shaped', shapeOf(RUG_GREEN) === 'rug');
  ok('an ordinary block defaults to cube', shapeOf(STONE) === 'cube');
  ok('every shaped block has real prop geometry registered', BLOCKS.filter((b) => b.shape).every((b) => boxesFor(b.shape).length > 0));
  ok('every new block id is unique', new Set(BLOCKS.map((b) => b.id)).size === BLOCKS.length);
  ok('every new block places freely — Duilt gates by recipe, not by unlock', BLOCKS.filter((b) => b.id >= 26).every((b) => b.unlock === null));
}

// --- items and recipes agree with the blocks they place -------------------

{
  // Ore (38-40), the two extra forests' wood (41-44), Lava (45) and Dark
  // Moss (46), and the giant grove's Forest Floor (147): all gathered or mined, not made at a workshop — the same way
  // Wood and Leaves themselves carry no recipe either, just below this
  // loop's own id >= 26 cutoff so they were never in it to begin with.
  // The rarer rocks (235-238) are mined from their layers, not made, and
  // so is coal ore (379).
  const NATURAL = new Set([38, 39, 40, 41, 42, 43, 44, 45, 46, 147, 191, 192, 235, 236, 237, 238, 379]);
  // A block that's only another one in a different state (an open gate) has
  // no item of its own — see blocks.js's `stateOf`.
  const newBlockIds = BLOCKS.filter((b) => b.id >= 26 && b.stateOf == null).map((b) => b.id);
  for (const id of newBlockIds) {
    const item = [...ITEMS_BY_ID.values()].find((i) => i.block === id);
    ok(`block ${BLOCKS_BY_ID.get(id).name} has an item that places it`, !!item);
    // Crops are grown from seeds saved from a harvest, not made either.
    if (item && !NATURAL.has(id) && !BLOCKS_BY_ID.get(id).crop) {
      const recipe = RECIPES.find((r) => r.output.id === item.id);
      ok(`${item.name} is craftable`, !!recipe);
    }
  }
}

// --- World: shape-aware collision boxes ------------------------------------

{
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  world.setBlock(0, 0, 0, STONE);
  world.setBlock(1, 0, 0, SLAB_STONE);
  world.setBlock(2, 0, 0, CHAIR_OAK);
  world.setBlock(3, 0, 0, RUG_GREEN);
  world.setBlock(4, 0, 0, STAIRS_STONE);

  const cube = world.collisionBoxAt(0, 0, 0);
  ok('a full block collides top to bottom of its cell', cube.minY === 0 && cube.maxY === 1);
  ok('World.isCollidable still answers a plain yes/no for a full block', world.isCollidable(0, 0, 0));

  const slab = world.collisionBoxAt(1, 0, 0);
  ok('a slab only collides up to half height', slab.minY === 0 && slab.maxY === 0.5);

  const chair = world.collisionBoxAt(2, 0, 0);
  ok('a chair collides like a slab — sit height, not full height', chair.minY === 0 && chair.maxY === 0.5);

  ok('a rug has no collision box at all', world.collisionBoxAt(3, 0, 0) === null);
  ok('and World.isCollidable agrees it is not collidable', !world.isCollidable(3, 0, 0));

  const stair = world.collisionBoxAt(4, 0, 0);
  ok('stairs fill their whole cell, and say they are stairs so you walk up them', stair.minY === 0 && stair.maxY === 1 && stair.stair === true);

  ok('below the world is still always solid', world.isCollidable(0, -1, 0));
  ok('air still has no box', world.collisionBoxAt(5, 0, 0) === null);
}

// --- World: setBlock keeps `lights` in step ---------------------------------

{
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  ok('a fresh world tracks no lights', world.lights.size === 0);
  world.setBlock(2, 3, 2, LANTERN);
  ok('placing a lantern registers it', world.lights.size === 1);
  const entry = [...world.lights.values()][0];
  ok('at the right position', entry.x === 2 && entry.y === 3 && entry.z === 2);
  ok('carrying its own light config', entry.light.color === lightOf(LANTERN).color);

  world.setBlock(2, 3, 2, STONE);
  ok('breaking it un-registers it', world.lights.size === 0);

  world.setBlock(5, 1, 5, LANTERN);
  const saved = JSON.parse(JSON.stringify(world.serialize()));
  const back = World.deserialize(saved);
  ok('a reloaded world finds the lantern again without ever calling setBlock', back.lights.size === 1);
}

// --- PlayerController: actually snaps to a half-height surface -------------

{
  const world = new World({ sizeX: 8, sizeZ: 8, height: 16 });
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) world.setBlock(x, 0, z, STONE);
  world.setBlock(3, 1, 3, SLAB_STONE);
  const camera = new THREE.Object3D();

  const p = new PlayerController(world, camera, { x: 3.5, y: 5, z: 3.5 });
  p.velocity.set(0, 0, 0);
  for (let i = 0; i < 90; i++) p.update(1 / 30);
  ok('landing on a slab settles at its half-height surface, not a full block up',
    p.grounded && Math.abs(p.position.y - 1.5) < 0.01);
}

{
  const world = new World({ sizeX: 8, sizeZ: 8, height: 16 });
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) world.setBlock(x, 0, z, STONE);
  world.setBlock(3, 1, 3, RUG_GREEN);
  const camera = new THREE.Object3D();

  const p = new PlayerController(world, camera, { x: 3.5, y: 5, z: 3.5 });
  p.velocity.set(0, 0, 0);
  for (let i = 0; i < 90; i++) p.update(1 / 30);
  ok('a rug never collides — you settle on the real floor underneath it',
    p.grounded && Math.abs(p.position.y - 1) < 0.01);
}

process.exit(f ? 1 : 0);
