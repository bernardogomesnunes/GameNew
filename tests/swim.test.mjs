import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { PlayerController } from '../src/player/PlayerController.js';

/**
 * Reported directly: "I should float on water." Water was never collidable
 * (correct — you have to be able to swim into it) but nothing filled in
 * what happens once you're in it, so it acted exactly like air: falling
 * into a river meant falling through it to the riverbed.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

const WATER = 11, STONE = 3;
const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
// A stone floor at y=0, water filling y 1..10, air above it.
for (let x = 0; x < 32; x++) {
  for (let z = 0; z < 32; z++) {
    world.setBlock(x, 0, z, STONE);
    for (let y = 1; y <= 10; y++) world.setBlock(x, y, z, WATER);
  }
}
const camera = new THREE.Object3D();

// --- dropped underwater, buoyancy carries you back up -----------------------

{
  const p = new PlayerController(world, camera, { x: 16, y: 4, z: 16 });
  p.velocity.set(0, 0, 0);
  const startY = p.position.y;
  for (let i = 0; i < 60; i++) p.update(1 / 30);
  ok('the chest-deep check marks you as swimming', p.swimming);
  ok('and you never plummet to the riverbed', p.position.y > startY - 0.5);
  ok('buoyancy actually lifts you, unforced', p.position.y > startY);
}

// --- standing on dry ground beside water is not swimming ---------------------

{
  // A column of its own, cleared out and given a real dry floor — the shared
  // pool above fills every other column in this world, so this one has to be
  // taken back deliberately rather than assumed clear.
  for (let y = 0; y <= 10; y++) world.setBlock(21, y, 21, y === 3 ? STONE : 0);
  const p = new PlayerController(world, camera, { x: 21.5, y: 4.01, z: 21.5 });
  p.velocity.set(0, 0, 0);
  p.update(1 / 30);
  ok('standing on dry ground is not swimming', !p.swimming);
  ok('and normal ground physics still apply', p.grounded);
}

// --- falling in from above decelerates rather than free-falling to the floor -

{
  const p = new PlayerController(world, camera, { x: 16, y: 15, z: 16 }); // above the water
  p.velocity.set(0, 0, 0);
  let enteredAt = null;
  for (let i = 0; i < 90; i++) {
    p.update(1 / 30);
    if (enteredAt == null && p.swimming) enteredAt = { i, vy: p.velocity.y };
  }
  ok('falling toward the water starts as ordinary freefall', !!enteredAt && enteredAt.vy < -5);
  ok('and the fall visibly slows once submerged, rather than hitting the riverbed at full speed',
    p.velocity.y > enteredAt.vy);
  ok('settling somewhere above the stone floor, not through it', p.position.y > 1);
}

// --- diving and paddling up are both real, opposite controls ----------------

{
  const p = new PlayerController(world, camera, { x: 16, y: 8, z: 16 });
  p.velocity.set(0, 0, 0);
  p.keys.add('ControlLeft');
  for (let i = 0; i < 20; i++) p.update(1 / 30);
  const dived = p.velocity.y;
  p.keys.delete('ControlLeft');
  ok('holding the dive key drives you down', dived < -0.5);

  p.velocity.set(0, 0, 0);
  p.keys.add('Space');
  for (let i = 0; i < 20; i++) p.update(1 / 30);
  const rose = p.velocity.y;
  ok('holding the swim-up key drives you up, roughly mirroring the dive', rose > 0.5 && Math.abs(rose + dived) < 0.3);
}

// --- flying is never treated as swimming, even underwater -------------------

{
  const p = new PlayerController(world, camera, { x: 16, y: 4, z: 16 });
  p.flying = true;
  p.velocity.set(0, 0, 0);
  p.update(1 / 30);
  ok('flying takes priority over swimming — Creative flight is not slowed by water', !p.swimming);
}

process.exit(f ? 1 : 0);
