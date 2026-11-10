import assert from 'node:assert/strict';
import { UIManager } from '../src/ui/UIManager.js';

// IMP-25 (owner, 10 November): next to a lot of warriors "game freezes my
// camera". A tap that threw left the look zone thinking a finger was still
// down, and every later drag or tap on the view was ignored until a reload.
const handlers = {};
const zone = { addEventListener: (type, fn) => { handlers[type] = fn; } };
let drags = 0, taps = 0;
const ui = { q: () => zone, cb: {
  onTap: () => { taps++; if (taps === 1) throw new Error('a busy fight'); return 'place'; },
  onLookDrag: () => { drags++; },
  onBreakTap: () => {},
} };
UIManager.prototype.bindLookSurface.call(ui);
const touch = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
const fire = (type, changed, touches = []) => handlers[type]({ type, changedTouches: changed, touches, preventDefault() {} });

fire('touchstart', [touch(1, 100, 100)], [touch(1, 100, 100)]);
assert.throws(() => fire('touchend', [touch(1, 100, 100)]), /busy fight/);
fire('touchstart', [touch(2, 100, 100)], [touch(2, 100, 100)]);
fire('touchmove', [touch(2, 160, 100)], [touch(2, 160, 100)]);
fire('touchend', [touch(2, 160, 100)]);
assert.ok(drags > 0, 'the view still turns after a tap that threw');
console.log('PASS a tap that throws does not freeze the camera');

// A finger whose touchend never came: a new finger takes over.
drags = 0;
fire('touchstart', [touch(3, 100, 100)], [touch(3, 100, 100)]);
fire('touchstart', [touch(4, 100, 100)], [touch(4, 100, 100)]);
fire('touchmove', [touch(4, 160, 100)], [touch(4, 160, 100)]);
assert.ok(drags > 0, 'a lost touchend does not freeze the camera');
console.log('PASS a lost touchend does not freeze the camera');
