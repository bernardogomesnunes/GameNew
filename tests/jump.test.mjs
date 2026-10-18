import { readFileSync } from 'node:fs';
import * as THREE from 'three';

/** Reported directly: "Jump is not working properly, I have to click multiple times to jump when I'm next to blocks". */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, pointerLockElement: null };
const { World } = await import('../src/world/World.js');
const { PlayerController } = await import('../src/player/PlayerController.js');

const STONE = 3, dt = 1 / 60;
/** On a stone floor at y 9, a block to step up onto at z 15, standing still a moment. */
const setUp = () => {
  const w = new World({ sizeX: 32, sizeZ: 32, height: 40 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) w.setBlock(x, 9, z, STONE);
  for (let x = 0; x < 32; x++) w.setBlock(x, 10, 15, STONE);
  const pl = new PlayerController(w, new THREE.PerspectiveCamera(), { x: 16.5, y: 10, z: 17.5 });
  for (let i = 0; i < 60; i++) pl.update(dt);
  return pl;
};
const steps = (pl, n) => { let peak = pl.position.y; for (let i = 0; i < n; i++) { pl.update(dt); peak = Math.max(peak, pl.position.y); } return peak; };

{
  const pl = setUp();
  const y0 = pl.position.y;
  pl.requestJump();
  ok('standing, one tap jumps', steps(pl, 20) > y0 + 0.8);
}
{
  // A tap that comes a moment before you land still jumps once you're down.
  const pl = setUp();
  const y0 = pl.position.y;
  pl.requestJump();
  steps(pl, 33); // up and nearly back down: a jump is about 38 frames
  ok('(still in the air when tapped)', !pl.grounded && pl.position.y > y0);
  pl.requestJump();
  let jumped = false;
  for (let i = 0; i < 30 && !jumped; i++) { pl.update(dt); if (pl.velocity.y > 5) jumped = true; }
  ok('a tap just before landing jumps on landing', jumped);
}
{
  // The frame the tap lands in, you're off the ground (a step, a wall): it waits.
  const pl = setUp();
  pl.grounded = false;
  pl.airTime = 1;
  const y0 = pl.position.y;
  pl.requestJump();
  ok('a tap in a frame you count as off the ground still jumps', steps(pl, 30) > y0 + 0.8);
}
{
  const pl = setUp();
  const y0 = pl.position.y;
  pl.requestJump();
  steps(pl, 20);
  pl.requestJump(); // mid-air: no second jump
  const peak = steps(pl, 40);
  ok('no jumping again in mid-air', peak < y0 + 1.4);
}
{
  // Pushing into a block a full block high with the Jump button held: up and over it.
  const pl = setUp();
  pl.yaw = 0; // facing -z, towards the block
  pl.externalMove = { x: 0, z: 1 };
  pl.jumpHeld = true;
  steps(pl, 120);
  ok('holding Jump while walking into a block climbs it', pl.position.z < 15.5);
  pl.externalMove = { x: 0, z: 0 };
  let jumps = 0, wasUp = false;
  for (let i = 0; i < 180; i++) { pl.update(dt); const up = pl.velocity.y > 5; if (up && !wasUp) jumps++; wasUp = up; }
  ok(`held, it keeps jumping each time you land (${jumps} in 3 s)`, jumps >= 4);
  pl.jumpHeld = false;
  steps(pl, 60);
  jumps = 0;
  for (let i = 0; i < 120; i++) { pl.update(dt); if (pl.velocity.y > 5) jumps++; }
  ok('let go, it stops', jumps === 0);
}
{
  // Walking off an edge, a tap just after still jumps.
  const pl = setUp();
  pl.position.set(16.5, 11, 15.5); // on the block
  steps(pl, 30);
  pl.yaw = Math.PI; // facing +z, off the block's far side… z 16 onwards is the floor a block down
  pl.externalMove = { x: 0, z: 1 };
  let left = -1;
  for (let i = 0; i < 120 && left < 0; i++) { pl.update(dt); if (!pl.grounded) left = i; }
  pl.requestJump();
  pl.update(dt);
  ok('a tap a frame after walking off an edge still jumps', left >= 0 && pl.velocity.y > 5);
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok("the phone's Jump button, held, holds the jump", /this\.player\.jumpHeld = held && !this\.player\.flying;/.test(game));

process.exit(f ? 1 : 0);
