import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLEEP_SECONDS, sleepAt, daySpan, wakesOn, DIM_MAX } from '../src/world/sleep.js';

/**
 * PLAY-8 (owner, 22 November): "There should be an animation of the avatar
 * sleeping in the bed for 10 sec to turn day." Timing is pure (world/sleep.js);
 * Game.sleep() must start it rather than jump the clock.
 */
const START = 0.9, TARGET = 0.32;
const at = (t, extra = {}) => sleepAt(t, { start: START, target: TARGET, ...extra });

assert.equal(SLEEP_SECONDS, 10);
assert.ok(Math.abs(daySpan(START, TARGET) - 0.42) < 1e-9, 'from 0.9 round midnight to 0.32 is 0.42 of a day');

// Starts at the start time, ends at morning after exactly 10 seconds.
assert.equal(at(0).time, START);
assert.equal(at(0).done, false);
assert.equal(at(9.99).done, false);
assert.equal(at(10).done, true);
assert.equal(at(10).time, TARGET);
assert.equal(at(25).time, TARGET, 'past the end it stays at morning');

// Monotonic through midnight: the advanced fraction only rises, never jumps.
let last = -1, biggest = 0;
for (let t = 0; t <= 10; t += 0.05) {
  const r = at(t);
  assert.ok(r.advanced >= last, `advanced fell at ${t}`);
  if (last >= 0) biggest = Math.max(biggest, r.advanced - last);
  last = r.advanced;
  assert.ok(r.time >= 0 && r.time < 1);
}
assert.ok(biggest < 0.42 * 0.05, 'no step over 5% of the span per 0.05 s');
assert.ok(Math.abs(last - 0.42) < 1e-3);
assert.ok(Math.abs(at(10).advanced - 0.42) < 1e-9);

// Early wake: the clock read at that moment is the one that stays.
const mid = at(4);
assert.ok(mid.time > START || mid.time < TARGET, 'partway is still in the night');
assert.equal(at(4).time, mid.time, 'deterministic, so a wake keeps it');
assert.equal(mid.done, false);

// Dim: clear at the ends, dimmer in the middle; steady when reduced.
assert.equal(at(0).dim, 0);
assert.equal(at(10).dim, 0);
assert.ok(at(5).dim > 0.4 && at(5).dim <= DIM_MAX + 0.1);
for (let t = 2; t <= 8; t += 0.1) assert.equal(at(t, { reduced: true }).dim, DIM_MAX, 'reduced motion holds the dim still');
assert.ok(new Set([2, 3, 4, 5].map((t) => at(t).dim)).size > 1, 'pulses otherwise');

// The avatar lies down at the start and is up again at the end.
assert.equal(at(0).lie, 0);
assert.equal(at(5).lie, 1);
assert.equal(at(10).lie, 0);

// Keys that wake.
const binds = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', down: 'ShiftLeft' };
for (const c of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft', 'Escape']) assert.ok(wakesOn(c, binds), c);
assert.ok(!wakesOn('KeyE', binds));

// Source: Place on a bed starts the sleep, and the sleep no longer jumps time.
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/game/GameInput.js', import.meta.url), 'utf8');
assert.match(game, /bedPart\(aimed\.block\)\) return void this\.sleep\(aimed\)/);
const body = game.slice(game.indexOf('  sleep(aimed) {'), game.indexOf('  /** The dark veil'));
assert.ok(body.includes('this.sleeping = {'), 'sleep() starts a sleep');
assert.ok(!/= MORNING;/.test(body), 'sleep() does not jump to morning');
assert.match(game, /if \(this\.sleeping && playing\) this\.tickSleep\(dt\)/, 'the clock is driven by tickSleep');
assert.match(game, /if \(this\.sleeping\) this\.player\.syncCamera\(\); else this\.player\.update\(dt\)/, 'input is paused');
assert.match(game, /wakesOn\(e\.code, this\.controls\.keys\)\) \{ this\.wake\(\)/, 'a movement key wakes');
assert.match(game, /Wake up/);
assert.match(game, /prefers-reduced-motion/);

console.log('sleep-play8: ok');
