// CRAFT3D-3, Task 1: one shared close-up for every machine (the Counter, the
// Crucible...): opens over a block, hides the HUD, and ends cleanly.
import assert from 'node:assert/strict';
import { CloseUp } from '../src/render/CloseUp.js';

const classes = new Set();
const uiRoot = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
let ended = 0;
const log = [];
const machine = (name) => ({ start: (key, at) => log.push(`${name} start ${key}`), end: () => log.push(`${name} end`), update() {}, barEl: null });
const c = new CloseUp({ uiRoot, onEnd: () => ended++ });

assert.equal(c.active, false);
const a = machine('counter');
c.open(a, '1,2,3', { x: 1, y: 2, z: 3 });
assert.equal(c.active, true);
assert.equal(c.machine, a);
assert.ok(classes.has('at-machine'));
assert.deepEqual(log, ['counter start 1,2,3']);
console.log('PASS opening a machine starts it and hides the HUD');

c.open(machine('crucible'), '4,5,6', { x: 4, y: 5, z: 6 });
assert.deepEqual(log.slice(1), ['counter end', 'crucible start 4,5,6']);
assert.equal(ended, 1, 'the first one was closed first');
console.log('PASS opening another closes the first');

c.close();
assert.equal(c.active, false);
assert.equal(c.machine, null);
assert.ok(!classes.has('at-machine'));
assert.equal(ended, 2);
c.close();
assert.equal(ended, 2, 'closing twice ends once');
console.log('PASS closing ends the machine, shows the HUD, and is safe twice');
