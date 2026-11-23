// PLAY-13 chunk 1: the mood rules, with no world around them.
import assert from 'node:assert/strict';
import { MOOD_DAY } from '../src/config/mood.js';
import { dailyRate, step, bandOf, plainBand, newMood, loadMood, shouldLeave } from '../src/duilt/Mood.js';

const DAY = MOOD_DAY;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const pastGrace = () => ({ ...newMood(100), idleFor: 3 * DAY });

// Run a person for up to maxDays in 10 s steps; returns days when `until` first holds.
function daysUntil(person, ctx, until, maxDays = 30) {
  for (let t = 0; t < maxDays * DAY; t += 10) {
    step(person, 10, ctx);
    if (until(person)) return (t + 10) / DAY;
  }
  return null;
}

// The four rate totals.
assert.equal(dailyRate(newMood(), { hungry: false, hasJob: true }), 10);
assert.equal(dailyRate(pastGrace(), { hungry: false, hasJob: false }), -10);
assert.equal(dailyRate(newMood(), { hungry: true, hasJob: true }), -20);
assert.equal(dailyRate(pastGrace(), { hungry: true, hasJob: false }), -40);
console.log('PASS the four daily rate totals: +10, -10, -20, -40');

// Grace: 3 days without a job count as 0 for the job term.
{
  const p = newMood(70);
  assert.equal(dailyRate(p, { hungry: false, hasJob: false }), 5, 'fed, no job, in grace: food only');
  for (let i = 0; i < 3 * DAY / 10; i++) step(p, 10, { hungry: false, hasJob: false });
  near(p.mood, 85, 0.01, 'three days of grace, fed');
  assert.equal(dailyRate(p, { hungry: false, hasJob: false }), -10, 'grace over');
  const h = newMood(70);
  step(h, DAY, { hungry: true, hasJob: false });
  near(h.mood, 45, 0.01, 'hunger counts from the first day, grace or not');
}
console.log('PASS grace: 3 days without a job cost nothing, hunger always counts');

// A step that straddles the end of grace splits at the day.
{
  const a = newMood(60), b = newMood(60);
  step(a, 4 * DAY, { hungry: false, hasJob: false });
  for (let i = 0; i < 4 * DAY / 10; i++) step(b, 10, { hungry: false, hasJob: false });
  near(a.mood, b.mood, 0.01, 'one big step equals many small');
}
console.log('PASS one long step equals many short ones');

// Bumps.
{
  const p = newMood(50);
  step(p, 1, { hungry: true, hasJob: true });
  const before = p.mood;
  step(p, 1, { hungry: false, hasJob: true });
  near(p.mood - before, 10 + 10 / DAY, 0.01, 'fed after hungry: +10');
  const q = pastGrace(); q.mood = 50;
  step(q, 1, { hungry: false, hasJob: true });
  near(q.mood, 60, 0.05, 'job after being jobless past grace: +10');
  assert.equal(q.idleFor, 0, 'idle counter resets');
  const r = newMood(50);
  step(r, 1, { hungry: false, hasJob: true });
  near(r.mood, 50, 0.05, 'job inside grace: no bump');
}
console.log('PASS bumps: fed again +10, job after grace +10, none inside grace');

// Clamp.
{
  const p = newMood(99);
  step(p, 5 * DAY, { hungry: false, hasJob: true });
  assert.equal(p.mood, 100);
  const q = newMood(5);
  step(q, 5 * DAY, { hungry: true, hasJob: false });
  assert.equal(q.mood, 0);
}
console.log('PASS mood clamps to 0..100');

// Hysteresis.
assert.equal(plainBand(40), 'grumbling');
assert.equal(plainBand(39.9), 'angry');
assert.equal(bandOf(39.9, 'grumbling'), 'angry', 'falls at the lower edge');
assert.equal(bandOf(40.1, 'angry'), 'angry', 'does not climb at 40.1');
assert.equal(bandOf(44.9, 'angry'), 'angry', 'still angry at 44.9');
assert.equal(bandOf(45, 'angry'), 'grumbling', 'climbs at 45');
assert.equal(bandOf(65, 'grumbling'), 'content');
assert.equal(bandOf(62, 'grumbling'), 'grumbling');
assert.equal(bandOf(25, 'furious'), 'angry');
assert.equal(bandOf(24, 'furious'), 'furious');
assert.equal(bandOf(80, null), 'content');
console.log('PASS hysteresis: fall at 40, climb at 45 (and 20/25, 60/65)');

// Timings table, to 0.1 day.
{
  const ctx = { hungry: true, hasJob: true };
  const at = (start, ctxs, id, from) => {
    const p = newMood(start);
    if (from) Object.assign(p, from);
    return daysUntil(p, ctxs, (x) => x.band === id);
  };
  near(at(100, ctx, 'grumbling'), 2.05, 0.1, 'unfed, job, 100: grumbling');
  near(at(100, ctx, 'angry'), 3.05, 0.1, 'angry');
  near(at(100, ctx, 'furious'), 4.05, 0.1, 'furious');
  near(at(70, ctx, 'grumbling'), 0.55, 0.1, 'unfed, job, 70: grumbling');
  near(at(70, ctx, 'angry'), 1.55, 0.1, 'angry');
  near(at(70, ctx, 'furious'), 2.55, 0.1, 'furious');
  const leave = (start, ctxs, from) => {
    const p = newMood(start); if (from) Object.assign(p, from);
    return daysUntil(p, ctxs, shouldLeave);
  };
  near(leave(100, ctx), 5.05, 0.1, 'unfed, job, 100: leaves day 5');
  near(leave(70, ctx), 3.55, 0.1, 'unfed, job, 70: leaves day 3.5');
  const jobless = { hungry: false, hasJob: false };
  near(at(70, jobless, 'grumbling'), 5.5, 0.1, 'fed newcomer, no job: grumbling');
  near(at(70, jobless, 'angry'), 7.5, 0.1, 'angry');
  near(at(70, jobless, 'furious'), 9.5, 0.1, 'furious');
  near(leave(70, jobless), 10.5, 0.1, 'leaves');
  const worst = { hungry: true, hasJob: false };
  const old = { idleFor: 3 * DAY };
  near(at(100, worst, 'grumbling', old), 1.0, 0.1, 'unfed, no job, grace over: grumbling');
  near(at(100, worst, 'angry', old), 1.5, 0.1, 'angry');
  near(at(100, worst, 'furious', old), 2.0, 0.1, 'furious');
  near(leave(100, worst, old), 3.0, 0.1, 'leaves day 3');
}
console.log('PASS the timings table rows to 0.1 day');

// Furious counter resets when mood climbs out.
{
  const p = newMood(10); p.band = 'furious';
  step(p, DAY / 2, { hungry: false, hasJob: true });
  assert.ok(p.furiousFor > 0 || p.band !== 'furious');
  const q = newMood(10); step(q, DAY * 0.5, { hungry: true, hasJob: true });
  assert.ok(!shouldLeave(q));
  q.mood = 60; step(q, 1, { hungry: false, hasJob: true });
  assert.equal(q.furiousFor, 0);
}
console.log('PASS the furious counter resets when mood recovers');

// Load defaults.
{
  const old = loadMood({ hungry: false });
  assert.equal(old.mood, 80);
  assert.equal(old.idleFor, 0);
  assert.equal(old.said, null);
  const saved = loadMood({ mood: 33.3, idleFor: 1200, furiousFor: 50, said: 'angry' });
  assert.equal(saved.band, 'angry');
  assert.equal(saved.said, 'angry');
  assert.equal(loadMood({ mood: 'x', said: 'weird' }).said, null);
}
console.log('PASS load defaults: missing mood is 80, idleFor 0, said null');
