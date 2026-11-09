// Owner, 9 November: Aurelion, if it flies after me in the Helix, "stays on
// the air even when I get back down". Left far behind, it is brought up
// beside you at your height; in the air it found no ground near its feet and
// never came down. Now it drops to the ground under it.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Guardian } from '../src/world/Guardian.js';

const world = new World({ sizeX: 200, sizeZ: 96, height: 64 });
for (let x = 0; x < 200; x++) for (let z = 0; z < 96; z++) world.setBlock(x, 0, z, 3);
world.recomputeSurface?.();
const g = new Guardian({ world, ring: 'white', home: { x: 20.5, y: 1, z: 40.5 } });
g.mode = 'follow';

// You fly off far and high: it is brought up beside you.
const flying = { x: 150.5, y: 40, z: 40.5 };
g.tick(0.05, flying, [], {});
assert.ok(Math.hypot(g.x - flying.x, g.z - flying.z) < 5, 'it is brought up beside you');
assert.ok(g.y < 2, `and stands on the ground, not in the air (y ${g.y.toFixed(1)})`);
console.log('PASS brought up beside you in the air, it comes down to the ground');

// Already floating (an old save, or brought up before this fix): it comes down too.
g.y = 30;
for (let i = 0; i < 10; i++) g.tick(0.05, { x: 152.5, y: 1, z: 40.5 }, [], {});
assert.ok(g.y < 2, `a guardian in the air comes down (y ${g.y.toFixed(1)})`);
console.log('PASS a guardian left in the air comes down when you land');

// Never up out of a cave: a roof over it is not where it should be.
for (let x = 140; x < 160; x++) for (let z = 35; z < 46; z++) world.setBlock(x, 6, z, 3);
g.x = 150.5; g.z = 40.5; g.y = 1;
for (let i = 0; i < 10; i++) g.tick(0.05, { x: 151.5, y: 1, z: 40.5 }, [], {});
assert.ok(g.y < 2, `under a roof it stays on the floor (y ${g.y.toFixed(1)})`);
console.log('PASS under a roof it stays where it is');
