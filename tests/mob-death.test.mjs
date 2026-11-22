// PLAY-4 (owner, 22 November): a hit was too quick to see and a killed
// animal vanished at once. The red lasts half a second; a kill topples,
// lies red, then shrinks away with a puff over 1.4 seconds.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HURT_FLASH, DYING_TIME, TOPPLE, FADE_AT, hurtFlash, deathPose } from '../src/world/mobDeath.js';

test('a hit shows red for half a second, strongest at the blow', () => {
  assert.equal(HURT_FLASH, 0.5);
  assert.equal(hurtFlash(HURT_FLASH), 0.85);
  assert.ok(hurtFlash(0.25) > 0.4);
  assert.equal(hurtFlash(0), 0);
});

test('a kill topples first, then lies whole and red', () => {
  assert.equal(deathPose(0), null);
  const start = deathPose(DYING_TIME);
  assert.equal(start.roll, 0);
  assert.equal(start.scale, 1);
  const down = deathPose(DYING_TIME - TOPPLE);
  assert.ok(Math.abs(down.roll - Math.PI / 2) < 1e-9, 'on its side');
  assert.equal(down.scale, 1, 'still whole');
  assert.ok(down.flash > 0.4, 'still red');
  assert.equal(down.fading, false);
});

test('then shrinks into the ground and is gone at the end', () => {
  const fading = deathPose(DYING_TIME - FADE_AT - 0.01);
  assert.ok(fading.fading && fading.scale < 1 && fading.scale > 0.9);
  const end = deathPose(0.001);
  assert.ok(end.scale < 0.01);
  assert.ok(end.sink > 0.29);
  assert.ok(DYING_TIME >= 1.2, 'long enough to see');
});
