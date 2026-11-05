// IMP-17 again (owner, 4 November): soldiers "seem stuck in one place, they
// don't move naturally". Six in a parade line with the barracks wall behind
// them: each walks a good part of the time, wanders round several spots,
// and a blocked walk does not leave them standing for long.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders } from '../src/world/Defenders.js';

const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 3, z, 3);
// The barracks wall, right behind the line.
for (let x = 20; x < 44; x++) for (let y = 4; y < 8; y++) world.setBlock(x, y, 31, 3);
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const d = new Defenders({ world, rand });
for (let i = 0; i < 6; i++) d.soldiers.push(d.person('footman', { x: 28 + i, y: 4, z: 30 }, '1', 'warrior'));

const walked = d.soldiers.map(() => 0), cells = d.soldiers.map(() => new Set());
const last = d.soldiers.map((s) => [s.x, s.z]);
let longestStill = d.soldiers.map(() => 0), still = d.soldiers.map(() => 0);
const STEP = 0.1, SECONDS = 180;
for (let t = 0; t < SECONDS / STEP; t++) {
  d.tick(STEP, []);
  d.soldiers.forEach((s, i) => {
    const moved = s.x !== last[i][0] || s.z !== last[i][1];
    if (moved) { walked[i] += STEP; still[i] = 0; } else { still[i] += STEP; longestStill[i] = Math.max(longestStill[i], still[i]); }
    last[i] = [s.x, s.z];
    cells[i].add(`${Math.floor(s.x)},${Math.floor(s.z)}`);
    assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) <= 8.5, 'they stay round their post');
  });
}
const share = walked.map((w) => w / SECONDS);
assert.ok(share.every((f) => f >= 0.4), `each walks at least 40% of the time (${share.map((f) => f.toFixed(2)).join(' ')})`);
assert.ok(cells.every((c) => c.size >= 12), `each goes round at least 12 spots (${cells.map((c) => c.size).join(' ')})`);
assert.ok(longestStill.every((l) => l <= 6.5), `nobody stands more than 6 s at a time (${longestStill.map((l) => l.toFixed(1)).join(' ')})`);
console.log('PASS a parade line of six patrols round its post: walking, many spots, short rests');
