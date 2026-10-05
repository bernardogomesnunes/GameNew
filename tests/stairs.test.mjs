import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Reported directly: "when placing the stairs I can't walk on them, still
 * needing to jump. And also they have the issue with geometry not rendering
 * the black beneath or in the back."
 *
 * The first was PlayerController: horizontal movement was a flat yes/no, so
 * a stair's half-height hitbox stopped you exactly like a wall. It steps up
 * now — half a block onto anything, a whole block from one stair to the next
 * since a stair's hitbox is flat. The second was ChunkMesher: a stair or slab
 * hid its neighbour's face as if it filled the whole cell, so the part of
 * the wall above it had nothing drawn and you saw straight through.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

const STONE = 3, SLAB = 27, STAIR = 29;

function flatWorld() {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, STONE);
  return world;
}

/** Walks forward (-z) for `frames`; returns the player and the highest it got. */
function walk(world, frames, at = { x: 16.5, y: 1, z: 20.5 }) {
  const p = new PlayerController(world, new THREE.Object3D(), at);
  p.update(1 / 60); // settle onto the ground
  p.keys.add('KeyW');
  let peak = p.position.y;
  for (let i = 0; i < frames; i++) {
    p.update(1 / 60);
    peak = Math.max(peak, p.position.y);
  }
  p.peak = peak;
  return p;
}

// --- a single stair or slab is walked onto -------------------------------------

for (const [name, id, top] of [['stair', STAIR, 2], ['slab', SLAB, 1.5]]) {
  const world = flatWorld();
  world.setBlock(16, 1, 18, id);
  const p = walk(world, 50);
  ok(`walking into a ${name} lifts you onto it (peak y ${p.peak.toFixed(2)})`, Math.abs(p.peak - top) < 1e-6);
  ok(`and carries you on past it (z ${p.position.z.toFixed(2)})`, p.position.z < 17);
}

// --- a flight of stairs is climbed without a jump -------------------------------

{
  const world = flatWorld();
  world.setBlock(16, 1, 18, STAIR);
  world.setBlock(16, 1, 17, STONE); world.setBlock(16, 2, 17, STAIR);
  world.setBlock(16, 1, 16, STONE); world.setBlock(16, 2, 16, STONE); world.setBlock(16, 3, 16, STAIR);
  for (let z = 15; z >= 2; z--) for (let y = 1; y <= 3; y++) world.setBlock(16, y, z, STONE);
  const p = walk(world, 120);
  ok(`three stairs up to a landing, no jump (ended at y ${p.position.y.toFixed(2)})`, Math.abs(p.position.y - 4) < 1e-6);
  ok('and on along the landing', p.position.z < 15);
  ok('the camera trails a step and catches up rather than snapping', p.stepLag < 0.01);
}

// --- a full block is still a jump ----------------------------------------------

{
  const world = flatWorld();
  world.setBlock(16, 1, 18, STONE);
  const p = walk(world, 60);
  ok('a full cube still stops you', p.position.y === 1 && p.position.z > 18.5);
}

{
  const world = flatWorld();
  world.setBlock(16, 1, 18, STONE);
  world.setBlock(16, 2, 18, STAIR);
  const p = walk(world, 60);
  ok('a stair sitting on a block is two blocks up — still a jump', p.position.y === 1 && p.position.z > 18.5);
}

{
  const world = flatWorld();
  world.setBlock(16, 1, 18, SLAB);
  world.setBlock(16, 2, 18, STONE); world.setBlock(16, 3, 18, STONE); // no headroom above it
  const p = walk(world, 60);
  ok('no step up into a gap too low to stand in', p.position.y === 1 && p.position.z > 18.5);
}

{
  const world = flatWorld();
  world.setBlock(16, 1, 18, SLAB);
  const p = new PlayerController(world, new THREE.Object3D(), { x: 16.5, y: 1.3, z: 20.5 });
  p.flying = true;
  p.keys.add('KeyW');
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  ok('flying never auto-steps', p.position.z > 18.5);
}

// --- a stair or slab doesn't hide its neighbour's face --------------------------

{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(8, 1, 8, STONE);
  world.setBlock(8, 0, 9, STONE);
  world.setBlock(8, 1, 9, SLAB); // in front of the stone's +z face, on the other stone
  const scene = { add() {}, remove() {} };
  const mesher = new ChunkMesher(scene);
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const facesAt = (test) => {
    let n = 0;
    for (const m of chunk.mesh.values()) {
      const P = m.geometry.attributes.position.array, N = Float32Array.from(m.geometry.attributes.normal.array, (v) => v / 127);
      for (let q = 0; q < P.length; q += 12) if (test(P.subarray(q, q + 12), N.subarray(q, q + 3))) n++;
    }
    return n;
  };
  const front = facesAt((P, N) => N[2] === 1 && P[2] === 9 && P[0] >= 8 && P[0] <= 9 && P[1] >= 1 && P[1] <= 2);
  ok('the stone behind a slab still draws the face the slab only half covers', front === 1);
  const under = facesAt((P, N) => N[1] === 1 && P[1] === 1 && P[0] >= 8 && P[0] <= 9 && P[2] >= 9 && P[2] <= 10);
  ok('the block under the slab keeps its top face too (the slab hides it anyway)', under === 1);
}

process.exit(f ? 1 : 0);
