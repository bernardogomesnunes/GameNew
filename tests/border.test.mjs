import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * The border has to be a wall, not a rule.
 *
 * Blocking only the edits meant you could walk off your land and discover it
 * by finding that nothing you tried out there worked. These check that the
 * land actually holds you in, that it does not interfere inside, and that
 * editing beyond it is still refused.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera();

// --- you cannot walk out, from any side, in any world ------------------------

let escapes = 0, stuckInside = 0;
for (let seed = 1; seed <= 12; seed++) {
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed });
  const g = new DuiltGame({ world, scene, bus: null });
  const b = g.territory.bounds();
  const p = new PlayerController(world, cam, origin.spawn);
  p.setBounds(b);
  p.flying = true;
  // Well clear of every hill, so the only thing that can stop us is the border.
  const sky = world.height - 4;

  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    p.position.set(origin.spawn.x, sky, origin.spawn.z);
    for (let i = 0; i < 300; i++) p.moveAndCollide(dx * 0.4, 0, dz * 0.4);
    const out = p.position.x < b.minX || p.position.x > b.maxX + 1
             || p.position.z < b.minZ || p.position.z > b.maxZ + 1;
    if (out) escapes++;
  }

  // and moving a little inside must still work
  p.position.set((b.minX + b.maxX) / 2, sky, (b.minZ + b.maxZ) / 2);
  const before = p.position.x;
  for (let i = 0; i < 6; i++) p.moveAndCollide(0.4, 0, 0);
  if (p.position.x - before < 2) stuckInside++;
}
ok(`nobody escapes their land (${escapes} escapes in 48 attempts)`, escapes === 0);
ok(`movement inside the border is unaffected (${stuckInside} stuck)`, stuckInside === 0);

// --- the sandbox keeps the whole world --------------------------------------

{
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 3 });
  const p = new PlayerController(world, cam, origin.spawn);
  p.setBounds(null);
  p.flying = true;
  p.position.set(origin.spawn.x, world.height - 4, origin.spawn.z);
  const before = p.position.x;
  for (let i = 0; i < 100; i++) p.moveAndCollide(0.4, 0, 0);
  ok('with no border set the player roams freely', p.position.x - before > 30);
}

// --- editing beyond it is still refused -------------------------------------

{
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 5 });
  const g = new DuiltGame({ world, scene, bus: null });
  const b = g.territory.bounds();
  ok('inside your land is editable', g.canEditAt(b.minX + 3, b.minZ + 3).ok);
  ok('one block past the border is not', !g.canEditAt(b.minX - 1, b.minZ + 3).ok);
  ok('and it says why', /outside your land/i.test(g.canEditAt(b.maxX + 1, b.minZ).reason));
}

// --- the wall moves with the land -------------------------------------------

{
  const { world } = generateDuiltWorld({ sizeX: 256, sizeZ: 256, height: 64, seed: 9 });
  const g = new DuiltGame({ world, scene, bus: null });
  const before = g.territory.bounds();
  g.territory.advance();
  const after = g.territory.bounds();
  ok(`claiming the next ring widens the land (${before.maxX - before.minX + 1} to ${after.maxX - after.minX + 1})`,
    after.maxX - after.minX > before.maxX - before.minX);
}

process.exit(f ? 1 : 0);
