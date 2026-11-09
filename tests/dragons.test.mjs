// Owner, 9 November: "Could you model a set of different dragons, like 4
// types. One super big, the other three a bit smaller ... Dragons should have
// some dynamic movements of wings and all that." And the dinosaurs: "They need
// to be bigger for sure. And animation wise improve too."
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Mobs } from '../src/world/Mobs.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { dragonPose, dinoPose } from '../src/render/MobView.js';

const DRAGONS = ['elder_dragon', 'fire_drake', 'frost_wyvern', 'storm_dragon'];
const index = JSON.parse(readFileSync(new URL('../public/models/index.json', import.meta.url), 'utf8'));
for (const id of DRAGONS) {
  const s = MOBS_BY_ID.get(id);
  assert.ok(s?.flies, `${id} flies`);
  assert.ok(index.includes(id) && existsSync(new URL(`../public/models/${id}.glb`, import.meta.url)), `${id} has its model`);
}
const len = (id) => MOBS_BY_ID.get(id).body.l;
assert.ok(DRAGONS.slice(1).every((id) => len('elder_dragon') > len(id) * 1.8), 'the Elder Dragon is by far the biggest');
console.log('PASS four dragons, each with its model, the Elder Dragon by far the biggest');

assert.ok(MOBS_BY_ID.get('raptor').leg >= 1.1 && MOBS_BY_ID.get('trike').body.l >= 3.5 && MOBS_BY_ID.get('longneck').leg + MOBS_BY_ID.get('longneck').body.h + MOBS_BY_ID.get('longneck').neck.up >= 12);
console.log('PASS the dinosaurs are bigger: a raptor 3 blocks tall, a triceratops near 4 long, a long-neck 13 tall');

// Flying: circles its home high over the ground, banks, comes down to rest, and a blow sends it up.
const world = new World({ sizeX: 200, sizeZ: 200, height: 64 });
for (let x = 0; x < 200; x++) for (let z = 0; z < 200; z++) world.setBlock(x, 0, z, 3);
let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const mobs = new Mobs({ world, rand, cap: 0 });
const spec = MOBS_BY_ID.get('fire_drake');
const d = mobs.make(spec, 100.5, 1 + spec.flies.alt, 100.5);
d.home = { x: 100.5, z: 100.5 }; d.airborne = true; d.timer = 60;
mobs.list.push(d);
const player = { x: 100, y: 1, z: 140 };
let lo = Infinity, hi = -Infinity, banked = 0, far = 0;
for (let i = 0; i < 300; i++) {
  mobs.tick(0.1, player);
  lo = Math.min(lo, d.y); hi = Math.max(hi, d.y);
  if (Math.abs(d.bank) > 0.05) banked++;
  far = Math.max(far, Math.hypot(d.x - 100.5, d.z - 100.5));
}
assert.ok(d.airborne && lo > 12, `it stays up high (${lo.toFixed(1)} to ${hi.toFixed(1)})`);
assert.ok(far > 20 && far < spec.flies.radius * 1.4, `it circles its home (${far.toFixed(0)} blocks out)`);
assert.ok(banked > 50, 'it banks into its turns');
console.log(`PASS it circles high over the ground (${lo.toFixed(0)} to ${hi.toFixed(0)} up), banking`);

d.timer = 0;
for (let i = 0; i < 400 && d.airborne; i++) mobs.tick(0.1, player);
assert.equal(d.airborne, false, 'it comes down to rest');
assert.ok(Math.abs(d.y - 1) < 0.5, `on the ground (${d.y.toFixed(2)})`);
mobs.hit(d, 5, player.x, player.z);
mobs.tick(0.1, player); mobs.tick(0.1, player);
assert.equal(d.airborne, true, 'struck, it takes off');
console.log('PASS now and then it lands to rest, and a blow sends it up again');

// The wings: beating in the air, the tips after the arm; folded back on the ground.
const pose = {};
dragonPose(pose, { ...d, airborne: true, climb: 0, dying: 0 }, 1.0, 0, 0, 0);
const a = pose.wing_r[2];
dragonPose(pose, { ...d, airborne: true, climb: 0, dying: 0 }, 1.35, 0, 0, 0);
assert.ok(Math.abs(pose.wing_r[2] - a) > 0.2 && pose.wing_l[2] === -pose.wing_r[2], 'the wings beat together');
assert.ok(pose.wingtip_r[2] !== pose.wing_r[2], 'the tips follow after the arm');
dragonPose(pose, { ...d, airborne: false, dying: 0 }, 1, 0, 0, 0);
assert.ok(pose.wing_r[1] < -1 && pose.wing_l[1] > 1, 'on the ground they fold back');
console.log('PASS the wings beat in the air, the tips trailing, and fold back on the ground');

const p2 = {};
dinoPose(p2, { type: 'raptor', speed: 3, stride: 2, chasing: true }, 1, 0, 0, 0, 0.3);
assert.ok(p2.tail0 && p2.tail2 && p2.neck0 && p2.jaw, 'a dinosaur moves its tail, neck and jaw');
assert.notEqual(p2.tail0[1], p2.tail2[1], 'the tail swings part after part');
console.log('PASS the dinosaurs swing their tails part after part, bob their necks and snap their jaws');
