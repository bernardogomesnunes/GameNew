// IMP-22 (owner, 8 November): "I'm being attacked by stone soldiers and I
// don't see them anywhere. Aurelion killed them right next to me." The
// strangers' view draws at most 64 people, and a round's attackers are
// added last to the list: near the Stone or Sky Kingdom, guards, traders and
// bandits took every place and the attackers were never drawn.
import assert from 'node:assert/strict';
import { strangersToDraw } from '../src/render/strangersToDraw.js';

const at = { x: 0, z: 0 };
const guards = Array.from({ length: 80 }, (_, i) => ({ id: i, kind: 'guard', x: 5 + i, z: 0 }));
const war = [{ id: 'w1', kind: 'bandit', war: true, x: 200, z: 0 }, { id: 'w2', kind: 'bandit', war: true, x: 2, z: 0 }];
const out = [];
const drawn = strangersToDraw([...guards, ...war], at, 64, out);
assert.equal(drawn.length, 64);
assert.ok(war.every((w) => drawn.includes(w)), 'the round\'s attackers are always drawn, near or far');
assert.ok(drawn.includes(guards[0]) && !drawn.includes(guards[79]), 'then the nearest of the rest');
console.log('PASS over the limit: attackers first, then the nearest');

const raider = { kind: 'bandit', raider: true, x: 300, z: 0 }, angry = { kind: 'bandit', angry: true, x: 300, z: 1 };
const d2 = strangersToDraw([...guards, raider, angry], at, 64, out);
assert.ok(d2.includes(raider) && d2.includes(angry), 'raiders and anyone angry at you too');
console.log('PASS raiders and the angry come before guards and traders');

const few = guards.slice(0, 10);
assert.equal(strangersToDraw(few, at, 64, out), few, 'under the limit: the list as it is, no copy');
console.log('PASS under the limit nothing changes');
