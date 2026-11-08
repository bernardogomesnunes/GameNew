// Owner, 8 November: "They should raid my city, not die 40 blocks out. They
// should come and attack my soldiers." Your soldiers defend round their
// post: they meet what comes within 16 blocks of it, and archers shoot from
// where they stand. Nothing of yours walks out 40 blocks to meet them.
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders, SOLDIER } from '../src/world/Defenders.js';

const world = new World({ sizeX: 128, sizeZ: 128, height: 32 });
for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) world.setBlock(x, 3, z, 3);
let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const make = (unit, kind) => {
  const d = new Defenders({ world, rand });
  const s = d.person(kind, { x: 60, y: 4, z: 60 }, '1', unit);
  d.soldiers.push(s);
  return { d, s };
};

// An attacker 25 blocks out: nobody goes to meet it.
for (const [unit, kind] of [['warrior', 'footman'], ['archer', 'bowman']]) {
  const { d, s } = make(unit, kind);
  const far = { x: 60.5, y: 4, z: 85.5, hp: 99 };
  let shots = 0;
  for (let i = 0; i < 300; i++) d.tick(0.05, [far], { strike: () => {}, shot: () => shots++ });
  for (let i = 0; i < 40; i++) d.flyArrows?.(0.05, { shot: () => shots++ });
  assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) <= 8.2, `${unit}: stays round its post (${Math.hypot(s.x - s.post.x, s.z - s.post.z).toFixed(1)} out)`);
  assert.equal(shots, 0, `${unit}: nothing hits it 25 blocks out`);
}
console.log('PASS an attacker 25 blocks out: nobody walks out to it, nothing hits it');

// Within 16: the warrior goes for it.
{
  const { d, s } = make('warrior', 'footman');
  const near = { x: 60.5, y: 4, z: 72.5, hp: 99 };
  let blows = 0;
  for (let i = 0; i < 200; i++) d.tick(0.05, [near], { strike: () => blows++ });
  assert.ok(blows > 0, 'the warrior fights what comes within 16 blocks');
}
// Within range: the archer shoots from where it stands.
{
  const { d, s } = make('archer', 'bowman');
  const near = { x: 60.5, y: 4, z: 79.5, hp: 99 };
  let loosed = 0;
  const loose = d.loose.bind(d);
  d.loose = (...a) => { loosed++; return loose(...a); };
  for (let i = 0; i < 200; i++) d.tick(0.05, [near], {});
  assert.ok(loosed > 0, 'the archer shoots what comes within range');
  assert.ok(Math.hypot(s.x - s.post.x, s.z - s.post.z) <= 3, 'without walking out to it');
}
console.log('PASS within 16 the warrior fights; within range the archer shoots from its post');
assert.ok(SOLDIER.range <= 16 && SOLDIER.leash <= 22, `${SOLDIER.range} and ${SOLDIER.leash}`);
