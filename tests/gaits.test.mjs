import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBS, MOBS_BY_ID } from '../src/config/mobs.js';
import { GAITS, gaitPose, beastPose, dinoPose, makePose, legWave, strideLength } from '../src/render/mobGaits.js';

/**
 * Owner, 11 November: "improve their 3d model, animations", for every animal
 * and creature, and then the dinosaurs too. The models are rebuilt
 * (tools/mobs/fauna.py, dinos.py); this checks how they move (render/mobGaits.js).
 */

// Every animal that isn't a dinosaur or a dragon has a gait; so do the guardians and the war beast.
const chained = ['raptor', 'trike', 'longneck'];
for (const m of MOBS) if (!m.flies && !chained.includes(m.id)) assert.ok(GAITS[m.id], `${m.id} has a gait`);
for (const id of ['moon_cow', 'aurelion', 'umbra', 'warbeast']) assert.ok(GAITS[id], `${id} has a gait`);
console.log('PASS every animal, guardian and the war beast has a gait');

// A leg goes back steadily on the ground and comes forward quicker in the air.
assert.equal(legWave(0), 1);
assert.ok(Math.abs(legWave(0.6) + 1) < 1e-9 && Math.abs(legWave(0.999) - 1) < 0.01);
assert.ok(Math.abs(legWave(0.3)) < 1e-9 && Math.abs(legWave(0.8)) < 1e-9, 'half way back at 0.3, half way forward again at 0.8');
console.log('PASS a leg spends 60% of a stride on the ground');

const state = (o) => ({ p: 0, moving: true, running: false, size: 1.5, t: 2, grazing: false, chasing: false, look: 0, nod: 0, ...o });
const pose = makePose();

// Walk: four beats, no two feet together. Trot: the diagonals together. Gallop: hind pair, then fore pair.
gaitPose(pose, GAITS.cow, state({ p: 0.1 }));
const walk = ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'].map((k) => pose[k][0]);
assert.equal(new Set(walk.map((v) => v.toFixed(4))).size, 4, 'a walking cow puts down one foot at a time');
gaitPose(pose, GAITS.cow, state({ p: 0.1, running: true }));
assert.equal(pose.leg_fl[0], pose.leg_br[0]);
assert.equal(pose.leg_fr[0], pose.leg_bl[0]);
assert.notEqual(pose.leg_fl[0], pose.leg_fr[0], 'a trotting cow moves its diagonal pairs together');
let top = 0;
for (let i = 0; i < 20; i++) { gaitPose(pose, GAITS.horse, state({ p: i / 20, running: true, size: 1.65 })); top = Math.max(top, pose.lift); }
assert.ok(top > 0.15, `a galloping horse leaves the ground (${top.toFixed(2)})`);
gaitPose(pose, GAITS.horse, state({ p: 0.3, running: true }));
assert.ok(pose.neck[0] < -0.1 && pose.tail[0] < -0.5 && pose.ears[0] > 0.3, 'its neck out, its tail streaming, its ears back');
console.log('PASS a walk is four beats, a trot is diagonal pairs, a gallop leaves the ground');

// The rabbit hops: both hind feet together, up and over.
gaitPose(pose, GAITS.rabbit, state({ p: 0.35 }));
assert.equal(pose.leg_bl[0], pose.leg_br[0]);
assert.ok(pose.lift > 0.15, 'a rabbit is off the ground mid-hop');
gaitPose(pose, GAITS.rabbit, state({ p: 0.9 }));
assert.equal(pose.lift, 0, 'and down between hops');
console.log('PASS the rabbit hops');

// The chicken: two legs in turn, the head held back then thrust forward each step; wings out at a run.
gaitPose(pose, GAITS.chicken, state({ p: 0.3 }));
assert.ok(pose.leg_l[0] !== pose.leg_r[0]);
const held = pose.neck[0];
gaitPose(pose, GAITS.chicken, state({ p: 0.49 }));
assert.ok(Math.abs(pose.neck[0] - held) > 0.1 && Math.abs(pose.head[0] + pose.neck[0] * 0.9) < 1e-9, 'the head bobs, and stays level');
gaitPose(pose, GAITS.chicken, state({ p: 0.3, running: true }));
assert.ok(pose.wing_r[2] > 0 && pose.wing_l[2] === -pose.wing_r[2], 'wings out at a run');
console.log('PASS the chicken struts, bobs its head and flaps');

// Grazing: the neck goes down (a negative turn about x lowers the nose), and nothing walks.
for (const id of ['cow', 'deer', 'goat', 'sheep', 'horse']) {
  gaitPose(pose, GAITS[id], state({ moving: false, grazing: true, t: 1 }));
  assert.ok(pose.neck[0] < -0.8, `${id} lowers its neck to graze (${pose.neck[0].toFixed(2)})`);
  assert.ok(Math.abs(pose.leg_fl[0]) === 0);
}
console.log('PASS grazing lowers the neck');

// The basilisk's tail swings part after part; its jaw opens downwards.
gaitPose(pose, GAITS.basilisk, state({ p: 0.2, chasing: true, t: 0.2 }));
assert.ok(new Set([pose.tail[1], pose.tail1[1], pose.tail2[1], pose.tail3[1]]).size === 4);
assert.ok(pose.jaw[0] < 0);
console.log('PASS the basilisk crawls, its tail in four parts, its jaw snapping');

// Out in the world the stride follows the ground covered; nothing is allocated per frame.
const cow = MOBS_BY_ID.get('cow');
const m = { type: 'cow', speed: cow.walk, stride: 0.3 };
beastPose(pose, m, cow, 1, 0, 0, 0);
const arrays = Object.values(pose).filter(Array.isArray);
const before = pose.leg_fl[0];
m.stride += strideLength('walk', cow.leg, cow.walk) / 2;
beastPose(pose, m, cow, 1, 0, 0, 0);
assert.ok(Math.abs(pose.leg_fl[0] - before) > 0.1, 'half a stride on, the leg has moved');
assert.ok(Object.values(pose).filter(Array.isArray).every((a, i) => a === arrays[i]), 'the same arrays, written in place');
console.log('PASS the stride keeps pace with the ground, and the pose is reused');

// The dinosaurs, reviewed: grazing lowers the neck, the jaw opens downwards, a running raptor leans in.
const d = {};
dinoPose(d, { type: 'trike', speed: 0, stride: 0, grazing: true }, 1, 0, 0, 0, 0, MOBS_BY_ID.get('trike'));
assert.ok(d.neck0[0] < -0.3 && d.neck1[0] < -0.2, 'a grazing triceratops lowers its head');
dinoPose(d, { type: 'longneck', speed: 0, stride: 0, grazing: true }, 1, 0, 0, 0, 0, MOBS_BY_ID.get('longneck'));
assert.ok(d.neck0[0] < -0.6, 'and a long-neck its neck');
const rap = MOBS_BY_ID.get('raptor');
dinoPose(d, { type: 'raptor', speed: rap.run, stride: 1, chasing: true }, 1.1, 0, 0, 0, 0, rap);
assert.ok(d.body[0] < -0.1 && d.neck0[0] < -0.1 && d.jaw[0] <= 0 && d.leg_l[0] !== d.leg_r[0], 'a raptor runs leaning in, neck out');
dinoPose(d, { type: 'trike', speed: 1, stride: 0.7 }, 1, 0, 0, 0, 0, MOBS_BY_ID.get('trike'));
assert.equal(new Set(['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'].map((k) => d[k][0].toFixed(4))).size, 4, 'a triceratops walks four beats');
console.log('PASS the dinosaurs graze head down, walk four beats and run leaning in');

// The models: the bones the game moves are all there.
const src = readFileSync(new URL('../tools/mobs/beasts.py', import.meta.url), 'utf8') + readFileSync(new URL('../tools/mobs/fauna.py', import.meta.url), 'utf8');
for (const b of ['leg_fl', 'leg_br', 'leg_l', "'neck'", "'head'", "'tail'", "'ears'", "'jaw'", 'wing_l', 'tail3', 'crystal']) assert.ok(src.includes(b), `the models have ${b}`);
console.log('all passed');
