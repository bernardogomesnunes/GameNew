// VIL-1: soldiers sleep in their barracks at night and wake for an enemy.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders } from '../src/world/Defenders.js';
import { BED, BED_HEAD } from '../src/config/blocks.js';

const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 3, z, 3);
// A barracks hall: floor at y 3, open inside (no walls needed for the test), one bed facing +x.
const region = { minX: 20, maxX: 28, minY: 4, maxY: 8, minZ: 20, maxZ: 28 };
world.setBlock(22, 4, 24, BED + 1);
world.setBlock(23, 4, 24, BED_HEAD + 1);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const d = new Defenders({ world, rand });
d.regions = new Map([['1', region]]);
const a = d.person('footman', { x: 30, y: 4, z: 30 }, '1', 'warrior');
const b = d.person('footman', { x: 31, y: 4, z: 30 }, '1', 'warrior');
d.soldiers.push(a, b);

d.dark = true;
for (let t = 0; t < 400; t++) d.tick(0.1, []);
assert.ok(a.bunk?.asleep && b.bunk?.asleep, 'both asleep');
assert.equal(a.lie, 1);
assert.notEqual(a.bunk.key, b.bunk.key, 'two soldiers, two bunks');
const inBed = [a, b].filter((s) => s.bunk.key === '22,4,24');
assert.equal(inBed.length, 1, 'one takes the bed, the other the floor');
assert.ok(Math.abs(inBed[0].y - 4.54) < 0.01, 'on the bed sheet');
console.log('PASS soldiers sleep in barracks bunks');

const was = { x: a.x, z: a.z };
for (let t = 0; t < 100; t++) d.tick(0.1, []);
assert.deepEqual({ x: a.x, z: a.z }, was, 'they stay in bed');
console.log('PASS they stay put all night');

// An enemy within range wakes them.
d.tick(0.1, [{ x: a.post.x + 3, y: 4, z: a.post.z, hp: 5, dead: false }]);
assert.ok(!a.bunk && a.lie === 0, 'woken by an enemy');
console.log('PASS an enemy wakes them');

// Dawn: everyone is up.
d.dark = false;
for (let t = 0; t < 20; t++) d.tick(0.1, []);
assert.ok(!a.bunk && !b.bunk && !a.lie && !b.lie, 'up at dawn');
console.log('PASS they get up at dawn');
