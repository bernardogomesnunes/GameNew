// IMP-22 (owner, 5 and 8 November): "I did not see any warrior", "I don't see
// them. Never did." A round is fought out of sight, some 40 blocks outside
// town. The war tracker says how many are left and points at the nearest.
import assert from 'node:assert/strict';
import { warTrack } from '../src/duilt/warTracker.js';

const band = [
  { x: 10, z: 0, hp: 12 },
  { x: 0, z: 30, hp: 12 },
  { x: -5, z: 0, hp: 0, dead: true },
  { x: 0, z: -3, done: true },
];
const at = { x: 0, z: 0 };

let t = warTrack(band, at, { x: 0, z: 1 });
assert.equal(t.left, 2, 'the dead and the gone are not counted');
assert.equal(t.total, 4);
assert.equal(Math.round(t.dist), 10, 'the nearest one standing');
// Looking along +z, something at +x is to the right: a quarter turn clockwise.
assert.ok(Math.abs(t.turn - (-Math.PI / 2)) < 1e-9 || Math.abs(t.turn - Math.PI / 2) < 1e-9);
const right = warTrack([{ x: 10, z: 0, hp: 1 }], at, { x: 0, z: -1 });
const left = warTrack([{ x: 10, z: 0, hp: 1 }], at, { x: 0, z: 1 });
assert.ok(Math.sign(right.turn) === -Math.sign(left.turn), 'turning round flips the side');
console.log('PASS the nearest attacker standing, how far, and which way from where you look');

t = warTrack([{ x: 0, z: 20, hp: 3 }], at, { x: 0, z: 1 });
assert.ok(Math.abs(t.turn) < 1e-9, 'straight ahead points up');
t = warTrack([{ x: 0, z: -20, hp: 3 }], at, { x: 0, z: 1 });
assert.ok(Math.abs(Math.abs(t.turn) - Math.PI) < 1e-9, 'behind points down');
console.log('PASS ahead points up, behind points down');

assert.equal(warTrack([], at, { x: 0, z: 1 }), null);
assert.equal(warTrack([{ x: 1, z: 1, dead: true }], at, { x: 0, z: 1 }), null, 'all beaten: nothing to show');
console.log('PASS no round, or all beaten: hidden');
