import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { makePose, makeState, posePerson, traitsOf, GEAR_BOW, GEAR_SPEAR, GEAR_SWORD } from '../src/render/personPose.js';
import { AvatarView } from '../src/render/AvatarView.js';

/**
 * Owner: "improve their 3d model, animations" for every person, "include user
 * avatar please" — and the camera struggled beside many warriors, so no person
 * may cost more triangles than it did before the rework.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the models: no more triangles than before, the same bones ------------------------
/** Triangles per model on main before this work (12 a box). */
const BEFORE = {
  settler: 300, settler_1: 324, settler_2: 336, settler_3: 300, settler_4: 300, settler_5: 324,
  soldier: 120, archer: 180, footman: 132, swordsman: 144, bowman: 180, shield_guard: 108, crew: 108,
  hermit: 132, explorer: 216, messenger: 120, bandit: 156, citizen: 288, citizen_1: 312, citizen_2: 300, citizen_3: 312,
  merchant: 132, trader: 144, tribe: 180, city_guard: 108, rival_soldier: 108, rival_guard: 108, futurian: 72,
  guard: 108, warrior: 108, stone_archer: 180, king: 204, warlord: 144, sky_guard: 120, royal_guard: 132,
  sky_king: 216, seraph: 168, white_god: 204, dark_god: 216, shade: 144, sky_warrior: 252,
};
const glb = (id) => {
  const buf = readFileSync(new URL(`../public/models/${id}.glb`, import.meta.url));
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
};
const over = [], boneless = [];
let total = 0, was = 0;
for (const [id, budget] of Object.entries(BEFORE)) {
  const g = glb(id);
  const tris = g.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + g.accessors[p.indices].count / 3, 0), 0);
  total += tris; was += budget;
  if (tris > budget) over.push(`${id} ${tris} > ${budget}`);
  const names = new Set(g.nodes.map((n) => n.name));
  if (!['body', 'head', 'arm_l', 'arm_r', 'leg_l', 'leg_r'].every((b) => names.has(`${id}_${b}`)) || !names.has(id)) boneless.push(id);
}
ok(`all 41 people cost no more triangles than before (${total} now, ${was} then)${over.length ? ': ' + over.join(', ') : ''}`, !over.length && total < was);
ok(`each keeps its id and its six bones${boneless.length ? ': ' + boneless.join(', ') : ''}`, !boneless.length);
ok('the warriors of a war round are lighter than they were', ['warrior', 'guard', 'stone_archer', 'soldier', 'archer'].every((id) => {
  const g = glb(id);
  return g.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + g.accessors[p.indices].count / 3, 0), 0) < BEFORE[id];
}));

// --- how they move ------------------------------------------------------------------
const pose = makePose();
const st = (over = {}) => Object.assign(makeState(), over);
const plain = traitsOf('settler');
{
  const arrays = [pose.body, pose.head, pose.arm_l, pose.arm_r, pose.leg_l, pose.leg_r];
  const same = posePerson(pose, st({ phase: Math.PI / 2, stride: 1 }), plain);
  ok('a pose is written into the same arrays every frame', same === pose && arrays.every((a, i) => a === [pose.body, pose.head, pose.arm_l, pose.arm_r, pose.leg_l, pose.leg_r][i]));
  ok('walking: the legs swing opposite', pose.leg_l[0] > 0.4 && pose.leg_r[0] === -pose.leg_l[0]);
  ok('  each arm swings against the leg on its side', pose.arm_l[0] < -0.2 && pose.arm_r[0] > 0.2);
  ok('  the body leans into it and turns with the step, the head stays ahead', pose.body[0] < 0 && pose.body[1] !== 0 && Math.abs(pose.head[1] + pose.body[1]) < 1e-9);
  ok('  and the hips come down so the feet stay on the ground', pose.drop > 0.03 && pose.drop < 0.2);
  const walkLean = pose.body[0];
  posePerson(pose, st({ phase: Math.PI / 2, stride: 1, run: 1 }), plain);
  ok('running: a longer stride and more lean', pose.leg_l[0] > 0.75 && pose.body[0] < walkLean);
}
{
  posePerson(pose, st({ idle: true, now: 3 }), plain);
  const a = [pose.body[0], pose.head[1], pose.body[2]];
  posePerson(pose, st({ idle: true, now: 5.2 }), plain);
  ok('standing: legs straight and no drop', pose.leg_l[0] === 0 && pose.leg_r[0] === 0 && pose.drop === 0);
  ok('  breathing, shifting weight and looking about', a[0] !== pose.body[0] && a[1] !== pose.head[1] && a[2] !== pose.body[2] && Math.abs(pose.head[1]) < 0.4);
  posePerson(pose, st({ idle: true, now: 5.2, frozen: true }), plain);
  const frozen = pose.head[1];
  posePerson(pose, st({ idle: true, now: 9.9, frozen: true }), plain);
  ok('  frozen, they hold still', frozen === pose.head[1]);
}
{
  let top = 0, low = 9;
  for (let now = 0; now < 4; now += 0.05) { posePerson(pose, st({ tool: 'axe', now }), plain); top = Math.max(top, pose.arm_r[0]); low = Math.min(low, pose.arm_r[0]); }
  ok('at work: the tool goes up and comes down', top > 2 && low < 0.5);
}
{
  const sword = traitsOf('warrior'), spear = traitsOf('guard'), bow = traitsOf('stone_archer');
  ok('who carries what', sword.gear === GEAR_SWORD && spear.gear === GEAR_SPEAR && spear.shield && bow.gear === GEAR_BOW && traitsOf('seraph').winged);
  posePerson(pose, st({ attack: 0.3 }), sword);
  const up = pose.arm_r[0];
  posePerson(pose, st({ attack: 0.5 }), sword);
  ok('a sword blow: up overhead, then through with the body behind it', up > 2.3 && pose.arm_r[0] < 0 && pose.body[0] < -0.15 && pose.leg_l[0] > 0.1);
  posePerson(pose, st({ attack: 0.5 }), spear);
  ok('a spear is levelled, point first', pose.arm_r[0] < -1.2);
  posePerson(pose, st({ attack: 0.999 }), sword);
  ok('and the arm comes home', Math.abs(pose.arm_r[0] - 0.1) < 0.02);
  posePerson(pose, st({ windup: true }), sword);
  ok('a heavy blow winds up with both arms overhead', pose.arm_r[0] > 2.6 && pose.arm_l[0] > 2.6 && pose.body[0] > 0.1);
  posePerson(pose, st({ draw: 1 }), bow);
  ok('a bow drawn: the bow arm out level, side on, the head still on the target',
    Math.abs(pose.arm_r[0] - 1.5) < 0.01 && pose.arm_l[0] > 1.3 && pose.body[1] > 0.4 && Math.abs(pose.head[1] + pose.body[1]) < 1e-9);
  posePerson(pose, st({ hurt: 1 }), sword);
  ok('struck: thrown back, arms out', pose.body[0] > 0.25 && pose.arm_r[2] > 0.4 && pose.arm_l[2] < -0.4);
  posePerson(pose, st({ now: 1 }), traitsOf('seraph'));
  const beat = pose.wing_l[1];
  posePerson(pose, st({ now: 1.4 }), traitsOf('seraph'));
  ok('wings beat', beat !== pose.wing_l[1] && pose.wing_r[1] === -pose.wing_l[1]);
}
ok('the view poses people with it, and allocates no pose per person',
  /posePerson\(this\._pose, st, traits\)/.test(readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8'))
  && !/pose\.head = \[/.test(readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8')));

// --- you ----------------------------------------------------------------------------
{
  const view = new AvatarView(new THREE.Scene());
  const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, velocity: { x: 0, y: 0, z: 0 }, grounded: true };
  const opts = { look: {}, worn: { offhand: { id: 'shield_iron' } }, held: { itemId: 'sword_iron' }, visible: true };
  const run = (n, o = opts) => { for (let i = 0; i < n; i++) view.update(1 / 60, player, o); };
  run(30);
  const restL = view.arms[0].rotation.x, restR = view.arms[1].rotation.x, restY = view.group.position.y;
  ok('your avatar, standing: legs straight, the shield held before you', Math.abs(view.legs[0].hip.rotation.x) < 1e-6 && restL > 0.25 && view.shield.visible);
  view.block();
  run(8);
  ok('a blow caught on the shield throws it up', view.arms[0].rotation.x > restL + 0.3);
  run(40);
  view.strike();
  run(5);
  const wound = view.arms[1].rotation.x;
  run(8);
  ok('a strike: the arm goes up, then down and through with the body turning', wound > restR + 1 && view.arms[1].rotation.x < wound && view.torso.rotation.y !== 0);
  run(40);
  ok('and comes back to rest', Math.abs(view.arms[1].rotation.x - restR) < 0.02);
  player.velocity.z = -6.8;
  run(40);
  ok('running: it leans in and the hips bob', view.torso.rotation.x < -0.1 && view.legs[0].hip.rotation.x === -view.legs[1].hip.rotation.x);
  player.velocity.z = 0; player.velocity.y = 6; player.grounded = false;
  run(20);
  ok('a jump: legs apart, arms up and out', view.legs[0].hip.rotation.x > 0.3 && view.legs[1].hip.rotation.x < -0.15 && view.arms[1].rotation.z > 0.2);
  player.velocity.y = 0; player.grounded = true;
  run(3);
  ok('landing dips', view.group.position.y < restY - 0.01);
  run(60);
  run(20, { ...opts, held: { itemId: 'bow' }, draw: 1 });
  ok('a bow drawn: the arm out level along where you look, side on', Math.abs(view.arms[1].rotation.x - 1.5) < 0.05 && view.torso.rotation.y > 0.4 && view.arms[0].rotation.x > 1.3);
  ok('the armour slots, the hand and the shield are where the game looks for them',
    view.helm.isMesh && view.cuirass.isMesh && view.legs.every((l) => l.greave.isMesh && l.boot.isMesh) && view.held.parent === view.hand && view.hand.parent === view.arms[1] && view.shield.parent === view.arms[0]);
  // A friend's avatar has no velocity: it walks by how far it has come.
  const peer = new AvatarView(new THREE.Scene());
  const friend = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };
  for (let i = 0; i < 30; i++) { friend.position.z -= 4 / 60; peer.update(1 / 60, friend, { look: {}, visible: true }); }
  ok('a friend\'s avatar walks as it moves', Math.abs(peer.legs[0].hip.rotation.x) > 0.05);
}

console.log(f ? `${f} FAILED` : 'all passed');
process.exit(f ? 1 : 0);
