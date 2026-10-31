// IMP-17: soldiers stood still at their post. With nothing to fight they now
// stroll round it like villagers, rest between walks, and stay close by.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders } from '../src/world/Defenders.js';

const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 3, z, 3);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const d = new Defenders({ world, rand });
const s = d.person('footman', { x: 30, y: 4, z: 30 }, '1', 'warrior');
d.soldiers.push(s);

let farthest = 0, moves = 0, lastX = s.x, lastZ = s.z, stillFrames = 0;
for (let t = 0; t < 120 / 0.1; t++) {
  d.tick(0.1, []);
  const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
  farthest = Math.max(farthest, away);
  if (s.x !== lastX || s.z !== lastZ) moves++; else stillFrames++;
  lastX = s.x; lastZ = s.z;
}
assert.ok(farthest > 1, `they leave the post (farthest ${farthest.toFixed(2)})`);
assert.ok(farthest <= 5.2, `they stay near it (farthest ${farthest.toFixed(2)})`);
assert.ok(moves > 50 && stillFrames > 50, 'they both walk and rest');
console.log('PASS idle soldiers stroll round their post and rest between walks');

s.x = s.post.x + 12; s.stroll = null; s.rest = 0;
for (let t = 0; t < 200; t++) d.tick(0.1, []);
assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) < 5.2, 'back near the post after being drawn away');
console.log('PASS drawn away by a fight, they walk back to their post');
