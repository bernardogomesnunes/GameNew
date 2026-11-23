import { MOOD, BANDS, MOOD_DAY } from '../config/mood.js';

/**
 * Villager mood, as pure rules. No world, no bus: Settlers feeds in whether a
 * person is hungry and has a job, and reads back mood and band.
 *
 * A person carries: mood (0 to 100), idleFor (seconds without a job),
 * furiousFor (seconds Furious), band, said (lowest band announced), and
 * wasHungry (hunger at the last step, for the "fed again" bump).
 */

const clamp = (v) => Math.max(MOOD.min, Math.min(MOOD.max, v));
export const bandRank = (id) => BANDS.findIndex((b) => b.id === id);
const GRACE = MOOD.graceDays * MOOD_DAY;

/** Band for a mood with no history. */
export function plainBand(mood) {
  return (BANDS.find((b) => mood >= b.from) ?? BANDS[BANDS.length - 1]).id;
}

/**
 * Band with hysteresis. A person falls into a band at its lower edge and
 * climbs out of it only `hysteresis` points above, so 39.9 then 40.1 does not
 * flip every frame.
 */
export function bandOf(mood, previous = null) {
  const plain = plainBand(mood);
  if (!previous || bandRank(plain) >= bandRank(previous)) return plain;
  const held = plainBand(mood - MOOD.hysteresis);
  return bandRank(held) < bandRank(previous) ? held : previous;
}

/**
 * Mood change per game day. ctx: { hungry, hasJob }. Inside the grace period
 * a missing job costs nothing and earns nothing.
 */
export function dailyRate(person, ctx) {
  const food = ctx.hungry ? MOOD.perDay.hungry : MOOD.perDay.fed;
  const work = ctx.hasJob ? MOOD.perDay.job : (person.idleFor ?? 0) >= GRACE ? MOOD.perDay.idle : 0;
  return food + work;
}

/** A fresh person's mood fields. */
export function newMood(mood = MOOD.arrivalMood) {
  return { mood, idleFor: 0, furiousFor: 0, band: plainBand(mood), said: null, wasHungry: false };
}

/** Mood fields for a person loaded from a save that may predate mood. */
export function loadMood(p) {
  const mood = Number.isFinite(p.mood) ? clamp(p.mood) : MOOD.legacyMood;
  return {
    mood,
    idleFor: Number.isFinite(p.idleFor) && p.idleFor > 0 ? p.idleFor : 0,
    furiousFor: Number.isFinite(p.furiousFor) && p.furiousFor > 0 ? p.furiousFor : 0,
    said: typeof p.said === 'string' && bandRank(p.said) >= 0 ? p.said : null,
    band: plainBand(mood),
    wasHungry: !!p.hungry,
  };
}

/**
 * Advances one person by dt seconds. ctx: { hungry, hasJob }.
 * Returns { band, from } where from is the band before the step.
 */
export function step(person, dt, ctx) {
  const from = person.band ?? plainBand(person.mood);
  if (!(dt > 0)) return { band: from, from };

  let bumps = 0;
  if (person.wasHungry && !ctx.hungry) bumps += MOOD.bump.fed;
  person.wasHungry = !!ctx.hungry;

  if (ctx.hasJob) {
    if ((person.idleFor ?? 0) >= GRACE) bumps += MOOD.bump.job;
    person.idleFor = 0;
  }

  // Split the step where the grace period ends, so the rate changes on the day.
  let left = dt, delta = 0;
  while (left > 1e-9) {
    const idle = person.idleFor ?? 0;
    let part = left;
    if (!ctx.hasJob && idle < GRACE) part = Math.min(left, GRACE - idle);
    delta += dailyRate(person, ctx) * part / MOOD_DAY;
    if (!ctx.hasJob) person.idleFor = idle + part;
    left -= part;
  }

  person.mood = clamp(person.mood + delta + bumps);
  person.band = bandOf(person.mood, from);
  person.furiousFor = person.band === 'furious' ? (person.furiousFor ?? 0) + dt : 0;
  return { band: person.band, from };
}

/** Whether a person has been Furious long enough to leave. */
export const shouldLeave = (person) => (person.furiousFor ?? 0) >= MOOD.furiousDaysToLeave * MOOD_DAY;

/** The worse of two band ids; null counts as nothing. */
export const worseBand = (a, b) => (a == null ? b : b == null ? a : bandRank(a) >= bandRank(b) ? a : b);
