import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { bodyFits, BODY_HALF } from '../src/world/Mobs.js';

/**
 * Reported from a phone: "Can't run in mobile, and pvp is almost
 * impossible: the NPCs don't look like entities and they cross some blocks.
 * When I hit a bandit they run and I can't [catch them] on mobile. Locked
 * one in a hole and when I beat them they go out of the hole."
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { PlayerController } = await import('../src/player/PlayerController.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8');

const flat = (size = 64, floorY = 0) => {
  const world = new World({ sizeX: size, sizeZ: size, height: 32 });
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) for (let y = 0; y <= floorY; y++) world.setBlock(x, y, z, 3);
  return world;
};

// --- running on a phone ----------------------------------------------------------------------------

{
  const world = flat();
  const speedOf = (stick, sprint) => {
    const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 32.5, y: 1, z: 32.5 });
    for (let i = 0; i < 20; i++) p.update(1 / 60);
    p.externalMove.z = stick; p.stickSprint = sprint;
    for (let i = 0; i < 10; i++) p.update(1 / 60);
    return Math.hypot(p.velocity.x, p.velocity.z);
  };
  const walk = speedOf(1, false), run = speedOf(1, true);
  ok(`the stick pushed right out runs (${walk.toFixed(1)} → ${run.toFixed(1)} blocks a second)`, run > walk * 1.4);
  // Asked for directly: "remove the toast about running".
  ok('Game runs you when the stick says so, with no toast about it', /onMove: \(x, z, run = false\) => \{/.test(game) && /this\.player\.stickSprint = !!run;/.test(game) && !/title: 'Running'/.test(game));
  const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 32.5, y: 10, z: 32.5 });
  p.flying = true; p.stickSprint = true; p.externalMove.z = 1;
  const y0 = p.position.y;
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  ok('flying, a pushed stick goes faster, never down', Math.abs(p.position.y - y0) < 0.01 && Math.hypot(p.velocity.x, p.velocity.z) > 10);
}

// --- bodies, not ghosts ----------------------------------------------------------------------------

{
  const world = flat();
  for (let y = 1; y <= 3; y++) world.setBlock(20, y, 20, 3);  // a pillar
  world.setBlock(30, 1, 30, 3);                              // a step
  ok('half a person can\'t stand in a wall', !bodyFits(world, 20 + 1 + BODY_HALF - 0.1, 20.5, 1) && bodyFits(world, 21 + BODY_HALF + 0.05, 20.5, 1));
  ok('but a corner over a step doesn\'t stop them climbing it', bodyFits(world, 29.9, 30.5, 1));

  // A bandit walking past the pillar's corner never puts any of itself in it.
  const w = new Wanderers({ world, rand: rng(1) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const b = w.person('bandit', 18.5, 1, 18.6, { home: { x: 18.5, z: 18.6 } });
  w.list.push(b);
  let clipped = 0;
  for (let i = 0; i < 400; i++) {
    b.target = { x: 22.6, z: 22.4 }; b.speed = 2; b.timer = 99;
    w.move(b, 0.05);
    if (!bodyFits(world, b.x, b.z, b.y)) clipped++;
  }
  ok(`walking round a corner, it goes round it, not through (${clipped} frames inside the stone)`, clipped === 0 && Math.hypot(b.x - 22.6, b.z - 22.4) < 1.5);

  ok('you can\'t walk through anyone you can fight, nor they through you', /this\.player\.update\(dt\);\s*this\.keepApart\(\);/.test(game) && /keepApart\(\) \{[\s\S]{0,900}this\.player\.moveAndCollide\(ux \* overlap/.test(game));
  ok('and every figure has a shadow on the ground under it', /this\.shadows = new THREE\.InstancedMesh/.test(view) && /place\(this\.shadows, 0, 0\.03, 0\)/.test(view));
}

// --- trapped in a hole, it stays there ----------------------------------------------------------------

{
  // A hole two deep, one across, in a floor at y 2: the bandit's feet at y 1.
  const world = flat(64, 2);
  world.setBlock(32, 2, 32, 0); world.setBlock(32, 1, 32, 0);
  const w = new Wanderers({ world, rand: rng(2), hostile: () => true });
  w.untilMessenger = w.untilExplorer = 1e9;
  const b = w.person('bandit', 32.5, 1, 32.5, { home: { x: 32.5, z: 32.5 } });
  w.list.push(b);
  const you = { x: 32.5, y: 3, z: 31.2 };
  let highest = b.y;
  for (let i = 0; i < 6; i++) {
    w.hit(b, 1, you.x, you.z);
    for (let k = 0; k < 20; k++) { w.tick(0.05, you); highest = Math.max(highest, b.y); }
  }
  ok(`beaten in a hole, it stays in the hole (feet never above ${highest.toFixed(2)})`, highest < 1.5 && Math.floor(b.x) === 32 && Math.floor(b.z) === 32);
  // And a hit never knocks anyone up a step.
  const world2 = flat(64, 1);
  world2.setBlock(32, 1, 32, 0); // one deep
  const w2 = new Wanderers({ world: world2, rand: rng(3) });
  const c = w2.person('bandit', 32.5, 1, 32.5, { home: { x: 32.5, z: 32.5 } });
  w2.list.push(c);
  for (let i = 0; i < 10; i++) w2.hit(c, 1, 32.5, 31.2);
  ok('a blow never knocks anyone up out of a hole', c.y === 1 && Math.floor(c.z) === 32);
}

process.exit(f ? 1 : 0);
