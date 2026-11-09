// IMP-37 (owner, 9 November): "soldiers from barracks and garrison should
// have order: defense which have then ready to defend the village, around
// the building, patrol (which has 1 of them patrol the village) and
// formation to call all of them to the front of the building. They are
// always gathering at the front now."
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders, DEFAULT_ORDER } from '../src/world/Defenders.js';

const world = new World({ sizeX: 96, sizeZ: 96, height: 32 });
for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) world.setBlock(x, 3, z, 3);
// The barracks: walls round x 40..47, z 40..47.
const region = { minX: 40, maxX: 47, minY: 4, maxY: 8, minZ: 40, maxZ: 47 };
for (let x = 40; x <= 47; x++) for (let z = 40; z <= 47; z++) if (x === 40 || x === 47 || z === 40 || z === 47) for (let y = 4; y < 8; y++) world.setBlock(x, y, z, 3);
const village = { minX: 20, maxX: 70, minZ: 25, maxZ: 65 };
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const d = new Defenders({ world, rand });
const b = { id: 1, type: 'barracks', region, valid: true, cap: 10 };
d.trained['1'] = { roster: ['warrior', 'swordsman', 'warrior', 'archer', 'warrior', 'swordsman'], queue: [], since: 0 };
const run = (seconds) => { for (let t = 0; t < seconds * 10; t++) d.tick(0.1, []); };
const sides = () => {
  const out = new Set();
  for (const s of d.soldiers) {
    if (s.post.z < region.minZ) out.add('front');
    else if (s.post.z > region.maxZ) out.add('back');
    else if (s.post.x < region.minX) out.add('left');
    else if (s.post.x > region.maxX) out.add('right');
  }
  return out;
};

// Defend, the default: posts on every side of the building.
assert.equal(DEFAULT_ORDER, 'defend');
d.sync([b], 0, village);
assert.equal(d.soldiers.length, 6);
assert.equal(d.orderOf(1), 'defend');
assert.ok(sides().size >= 3, `defend spreads them round the building (${[...sides()]})`);
run(40);
for (const s of d.soldiers) assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) <= 4.5, 'each stays near its own post');
console.log('PASS defend: posts spread round the building, each stays near its own');

// Formation: everyone in front of the building, standing still once there.
assert.ok(d.setOrder(1, 'formation'));
d.sync([b], 0, village);
assert.deepEqual([...sides()], ['front'], 'formation puts every post in front');
run(30);
for (const s of d.soldiers) assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) < 0.6, `in place (${s.x.toFixed(1)},${s.z.toFixed(1)} vs ${s.post.x},${s.post.z})`);
const at = d.soldiers.map((s) => [s.x, s.z]);
run(10);
d.soldiers.forEach((s, i) => assert.ok(Math.hypot(s.x - at[i][0], s.z - at[i][1]) < 0.01, 'they hold formation'));
console.log('PASS formation: all of them line up in front and stand still');

// Patrol: exactly one sword walks the village loop; the rest stand round the building.
assert.ok(d.setOrder(1, 'patrol'));
d.sync([b], 0, village);
const walkers = d.soldiers.filter((s) => s.patrol);
assert.equal(walkers.length, 1, 'one of them patrols');
assert.equal(walkers[0].unit, 'warrior', 'a sword, not the archer');
const w = walkers[0], corners = new Set();
let far = 0;
for (let t = 0; t < 2400; t++) {
  d.tick(0.1, []);
  corners.add(w.leg);
  far = Math.max(far, Math.hypot(w.x - 43.5, w.z - 43.5));
}
assert.ok(corners.size >= 6, `the patrol goes round the loop (${corners.size} legs)`);
assert.ok(far > 20, `it walks out across the village (${far.toFixed(1)} blocks out)`);
for (const s of d.soldiers.filter((x) => !x.patrol)) assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) <= 4.5, 'the others stay at the building');
console.log('PASS patrol: one walks round the village, the rest guard the building');

// The patrol fights what it meets out there.
const foe = { x: w.x + 3, y: 4, z: w.z, hp: 20, dead: false };
let struck = 0;
for (let t = 0; t < 60; t++) d.tick(0.1, [foe], { strike: () => struck++ });
assert.ok(struck > 0, 'the patrol strikes an enemy it meets far from the barracks');
console.log('PASS the patrol fights what it meets');

// Saved and loaded.
const back = new Defenders({ world, rand });
back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
assert.equal(back.orderOf(1), 'patrol');
assert.equal(back.setOrder(1, 'march'), false, 'unknown orders are refused');
console.log('PASS the order is saved');
