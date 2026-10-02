/**
 * Every sound in the game, as a recipe for synth.js.
 *
 * A recipe takes a seeded random generator and returns samples. Sound.js
 * renders a few takes of each the first time it's wanted and keeps them, so
 * a footstep on grass costs one buffer playing, not a synthesis.
 *
 * Three kinds:
 *  - effects (`RECIPES`): one-off things you do or that happen to you —
 *    placing and breaking each material, footsteps on it, blows, a bow, a
 *    door, water, eating;
 *  - ambience (`LOOPS` and the calls in `RECIPES`): beds that loop with no
 *    seam (wind, a stream, the Stone Kingdom's hum), and creatures that are
 *    scattered over them now and then (birds, crickets, owls, frogs);
 *  - music (`INSTRUMENTS`): a pluck, a pad and a bell, each made once at A3
 *    and played at any pitch by speeding it up or slowing it down.
 */

import { Take, Biquad, Steep, seamless, RATE } from './synth.js';

/**
 * What each material sounds like when it's struck, as the pieces that make
 * it up. Lower than the old voices on purpose — the old stone was noise at
 * 2.6 kHz over a tone at 180–290 Hz; this one's grit sits at 1.2 kHz and its
 * ring in the low mids, so it reads as a solid knock rather than a tick.
 *
 *   click   a hard, very short transient (its lowpass in Hz, and how loud)
 *   modes   what rings after: [f, amp, decay seconds]
 *   noise   the body of the hit: a filtered noise burst
 *   grains  what crumbles off when it breaks (and crunches underfoot)
 *   thump   the low end: a falling sine
 *   rustle  leaves, grass, cloth
 *   step    how a footstep on it differs: which parts, how loud
 */
export const MATERIALS = {
  stone: {
    click: { f: 3200, gain: 0.35 },
    modes: [[330, 1, 0.03], [770, 0.55, 0.022], [1290, 0.3, 0.015], [2050, 0.1, 0.01]],
    noise: { f: 1150, q: 0.8, decay: 0.04, gain: 0.5 },
    grains: { f: 1500, q: 1.1, rate: 240, gain: 0.45, grain: 0.004 },
    thump: { f: 120, to: 70, decay: 0.05, gain: 0.45 },
    step: { modes: 0.15, grains: 0.4, thump: 0.5, noise: 0.45 },
  },
  wood: {
    click: { f: 2400, gain: 0.25 },
    modes: [[185, 1, 0.075], [420, 0.7, 0.05], [705, 0.4, 0.035], [1130, 0.18, 0.02]],
    noise: { f: 780, q: 1.3, decay: 0.035, gain: 0.3 },
    grains: { f: 1100, q: 1.3, rate: 80, gain: 0.4, grain: 0.006 },
    thump: { f: 100, to: 65, decay: 0.06, gain: 0.4 },
    step: { modes: 0.45, grains: 0, thump: 0.6, noise: 0.3 },
  },
  dirt: {
    click: { f: 900, gain: 0.2 },
    noise: { filter: 'lowpass', f: 520, q: 0.7, decay: 0.07, gain: 0.6 },
    grains: { f: 700, q: 0.8, rate: 320, gain: 0.45, grain: 0.004 },
    thump: { f: 85, to: 52, decay: 0.07, gain: 0.6 },
    step: { grains: 0.5, thump: 0.6, noise: 0.5 },
  },
  grass: {
    click: { f: 800, gain: 0.12 },
    noise: { filter: 'lowpass', f: 450, q: 0.7, decay: 0.06, gain: 0.45 },
    grains: { f: 800, q: 0.8, rate: 220, gain: 0.35, grain: 0.004 },
    thump: { f: 80, to: 50, decay: 0.06, gain: 0.45 },
    rustle: { f: 1100, q: 0.7, len: 0.16, gain: 0.3 },
    step: { grains: 0.4, thump: 0.5, noise: 0.5, rustle: 0.7 },
  },
  sand: {
    noise: { filter: 'lowpass', f: 900, q: 0.7, decay: 0.05, gain: 0.25 },
    grains: { f: 1000, q: 0.7, rate: 1500, gain: 0.36, grain: 0.002, shape: 'swell' },
    thump: { f: 80, to: 55, decay: 0.05, gain: 0.22 },
    step: { grains: 0.8, thump: 0.5, noise: 0.5 },
  },
  gravel: {
    click: { f: 1500, gain: 0.12 },
    noise: { f: 650, q: 0.8, decay: 0.04, gain: 0.3 },
    grains: { f: 950, q: 1.2, rate: 520, gain: 0.6, grain: 0.004 },
    thump: { f: 95, to: 60, decay: 0.05, gain: 0.35 },
    step: { grains: 0.8, thump: 0.5, noise: 0.4 },
  },
  snow: {
    noise: { filter: 'lowpass', f: 600, q: 0.7, decay: 0.05, gain: 0.3 },
    grains: { f: 900, q: 0.9, rate: 900, gain: 0.5, grain: 0.003, shape: 'swell' },
    thump: { f: 90, to: 55, decay: 0.05, gain: 0.25 },
    step: { grains: 0.9, thump: 0.5, noise: 0.5 },
  },
  plant: {
    noise: { filter: 'lowpass', f: 700, q: 0.7, decay: 0.04, gain: 0.15 },
    thump: { f: 110, to: 70, decay: 0.03, gain: 0.1 },
    rustle: { f: 1200, q: 0.6, len: 0.22, gain: 0.55 },
    step: { rustle: 0.7, thump: 0.5, noise: 0.5 },
  },
  cloth: {
    noise: { filter: 'lowpass', f: 450, q: 0.7, decay: 0.06, gain: 0.5 },
    thump: { f: 100, to: 65, decay: 0.05, gain: 0.25 },
    rustle: { f: 800, q: 0.6, len: 0.12, gain: 0.25 },
    step: { rustle: 0.6, thump: 0.5, noise: 0.5 },
  },
  glass: {
    click: { f: 4500, gain: 0.25 },
    modes: [[1650, 1, 0.12], [2650, 0.6, 0.09], [3900, 0.3, 0.06]],
    noise: { f: 2300, q: 1.5, decay: 0.02, gain: 0.18 },
    thump: { f: 140, to: 90, decay: 0.03, gain: 0.15 },
    step: { modes: 0.2, thump: 0.6, noise: 0.5 },
  },
  metal: {
    click: { f: 3500, gain: 0.25 },
    modes: [[260, 1, 0.35], [690, 0.6, 0.25], [1240, 0.38, 0.18], [1980, 0.22, 0.12], [2870, 0.1, 0.08]],
    noise: { f: 1400, q: 1, decay: 0.02, gain: 0.22 },
    thump: { f: 140, to: 90, decay: 0.04, gain: 0.3 },
    step: { modes: 0.2, thump: 0.6, noise: 0.5 },
  },
  water: {
    noise: { filter: 'lowpass', f: 1100, q: 0.7, decay: 0.1, gain: 0.45 },
    bubbles: 3,
    step: { noise: 0.6, bubbles: 1 },
  },
  lava: {
    noise: { filter: 'lowpass', f: 300, q: 0.7, decay: 0.2, gain: 0.55 },
    bubbles: 2, bubbleLow: true,
    sizzle: 0.08,
    step: { noise: 0.5, bubbles: 1 },
  },
};

/** The materials, by name — what tests and soundscape.js check against. */
export const MATERIAL_NAMES = Object.keys(MATERIALS);

/** A bubble: a short sine that rises as it bursts. */
function bubble(take, at, low = false, gain = 0.25) {
  const f = low ? take.r(110, 170) : take.r(320, 700);
  take.chirp({ at, len: take.r(0.03, 0.06), f, to: f * take.r(1.6, 2.3), gain, env: 'strike', decay: 0.02 });
}

/**
 * One impact on a material — the pieces of `MATERIALS[m]`, each scaled.
 * `kind` is 'place', 'break', 'dig', 'step' or 'land'.
 */
function impact(take, m, kind) {
  const v = MATERIALS[m];
  const step = kind === 'step' || kind === 'land' ? v.step : null;
  const part = (name) => (step ? (step[name] ?? 0) : 1) * (kind === 'land' ? 1.6 : kind === 'dig' ? 0.7 : 1);
  const lower = kind === 'break' ? 0.85 : kind === 'step' ? 0.95 : 1;

  if (v.click && part('noise')) take.noise({ filter: 'lowpass', f: v.click.f * lower, q: 0.7, gain: v.click.gain * part('noise'), decay: 0.003 });
  if (v.modes && part('modes')) take.modes({ modes: v.modes, gain: 0.35 * part('modes'), scale: lower * take.r(0.95, 1.05) });
  if (v.noise && part('noise')) {
    take.noise({ ...v.noise, f: v.noise.f * lower * take.r(0.9, 1.1), gain: v.noise.gain * part('noise'), decay: v.noise.decay * (step ? 0.7 : 1) });
  }
  if (v.thump && part('thump')) {
    const deep = kind === 'land' ? 0.75 : 1;
    take.thump({ f: v.thump.f * deep, to: v.thump.to * deep, decay: v.thump.decay * (kind === 'land' ? 1.6 : 1), gain: v.thump.gain * part('thump') });
  }
  if (v.rustle && part('rustle')) take.rustle({ ...v.rustle, len: v.rustle.len * (kind === 'break' ? 1.5 : step ? 0.7 : 1), gain: v.rustle.gain * part('rustle') });
  if (v.grains && part('grains')) {
    const len = kind === 'break' ? take.r(0.24, 0.34) : step ? take.r(0.06, 0.1) : 0.09;
    take.grains({ ...v.grains, at: kind === 'break' ? 0.01 : 0, len, f: v.grains.f * lower, rate: v.grains.rate * (step ? 0.6 : 1), gain: v.grains.gain * part('grains') });
  }
  if (v.bubbles) {
    const count = step ? (step.bubbles ?? 0) : kind === 'break' ? v.bubbles + 1 : v.bubbles;
    for (let i = 0; i < count; i++) bubble(take, take.r(0, 0.12), v.bubbleLow, 0.2);
  }
  if (v.sizzle && !step) take.noise({ f: 2200, q: 0.5, gain: v.sizzle, attack: 0.02, decay: 0.12 });

  // Breaking is more than a harder knock: something gives.
  if (kind === 'break') {
    if (m === 'wood') take.noise({ at: 0.005, f: 1700, q: 2, decay: 0.012, gain: 0.5 }); // the crack of a split
    if (m === 'glass') shatter(take);
    if (m === 'plant') take.noise({ at: 0.03, f: 1300, q: 2.5, decay: 0.01, gain: 0.3 }); // a stalk snapping
  }
}

/** Glass breaking: a spray of short, bright clinks over a burst. */
function shatter(take) {
  take.noise({ f: 1900, q: 0.6, decay: 0.07, gain: 0.35 });
  for (let i = 0; i < 14; i++) {
    const f = take.r(1500, 4200);
    take.modes({ at: take.r(0.01, 0.35), modes: [[f, 1, take.r(0.02, 0.06)], [f * 1.53, 0.4, 0.02]], gain: take.r(0.04, 0.12), jitter: 0 });
  }
}

/** How long each kind of impact takes to render — long enough for its tail. */
const LENGTHS = { place: 0.4, break: 0.6, dig: 0.3, step: 0.25, land: 0.4 };

/** A blow landing on a body: a low punch, felt more than heard. */
function blow(take, heavy = false, at = 0) {
  take.thump({ at, f: heavy ? 85 : 100, to: heavy ? 42 : 55, decay: heavy ? 0.11 : 0.07, gain: 0.9 });
  take.noise({ at, filter: 'lowpass', f: 380, decay: 0.05, gain: 0.6 });
  take.noise({ at, filter: 'lowpass', f: 1300, decay: 0.006, gain: 0.25 });
}

/** A war horn's blast: a brassy low note that swells, wavers and falls away. */
function blast(take, at, len, f0) {
  const s0 = Math.floor(at * RATE), n = Math.floor(len * RATE), out = take.out;
  // A brass tone: many harmonics, their top opened up by how hard it's blown.
  const flt = new Biquad('lowpass', 420, 0.9);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / RATE;
    const swell = Math.min(1, t / 0.3) * Math.min(1, (len - t) / 0.45);
    const scoop = 1 - 0.05 * Math.exp(-t / 0.08);
    const vib = 1 + (t > 0.4 ? 0.006 * Math.sin(2 * Math.PI * 4.6 * t) : 0);
    ph += (2 * Math.PI * f0 * scoop * vib) / RATE;
    let v = 0;
    for (let h = 1; h <= 12; h++) v += Math.sin(ph * h) / h ** 1.1;
    if ((i & 15) === 0) flt.set(300 + 900 * swell);
    out[s0 + i] += flt.run(v) * 0.35 * swell;
  }
  take.noise({ at, f: 800, q: 0.8, attack: 0.2, decay: len * 0.4, gain: 0.03 });
}

/** A metal chain shaking: a train of small, dark clinks. */
function rattle(take, at, len, count = 14, gain = 0.3) {
  for (let i = 0; i < count; i++) {
    const f = take.r(900, 1700);
    take.modes({ at: at + take.r(0, len), modes: [[f, 1, take.r(0.02, 0.05)], [f * 1.7, 0.4, 0.02], [f * 0.52, 0.5, 0.03]], gain: gain * take.r(0.3, 1), jitter: 0 });
  }
  take.noise({ at, f: 1200, q: 1, attack: 0.02, decay: len * 0.3, gain: gain * 0.15 });
}

/**
 * The effects. Each is (take) => void, with its length in seconds; the
 * material ones are generated below from MATERIALS.
 */
const EFFECTS = {
  // Combat.
  swing: [0.3, (t) => t.sweep({ len: t.r(0.17, 0.22), f: 260, peak: t.r(850, 1050), q: 1.5, gain: 0.55 })],
  blow: [0.3, (t) => blow(t)],
  heavyBlow: [0.4, (t) => blow(t, true)],
  slash: [0.45, (t) => {
    t.sweep({ len: 0.14, f: 300, peak: 1100, q: 1.6, gain: 0.45 });
    blow(t, false, 0.1);
    t.modes({ at: 0.1, modes: [[1050, 1, 0.07], [1730, 0.5, 0.05], [2480, 0.2, 0.03]], gain: 0.09 });
  }],
  hurt: [0.4, (t) => {
    blow(t, false);
    t.voice({ at: 0.01, len: 0.2, f: 150, to: 100, formants: [[560, 4, 1], [950, 5, 0.55], [2300, 6, 0.12]], gain: 0.35 });
  }],
  bow: [0.5, (t) => {
    t.pluck({ f: t.r(92, 104), len: 0.35, gain: 0.55, bright: 0.15, damp: 0.99 });
    t.sweep({ at: 0.02, len: 0.25, f: 350, peak: 950, q: 2, gain: 0.18 });
  }],
  arrowHit: [0.25, (t) => { t.modes({ modes: MATERIALS.wood.modes, gain: 0.25, scale: 1.2 }); t.noise({ filter: 'lowpass', f: 1500, decay: 0.006, gain: 0.3 }); }],
  horn: [2.9, (t) => { blast(t, 0, 0.75, 98); blast(t, 0.95, 1.85, 98); }],

  // Big events.
  gong: [3.5, (t) => {
    t.modes({ modes: [[110, 1, 1.4], [233, 0.6, 1.1], [389, 0.4, 0.8], [572, 0.25, 0.55], [801, 0.12, 0.35]], gain: 0.4, attack: 0.004, jitter: 0.005 });
    t.thump({ f: 70, to: 40, decay: 0.4, gain: 0.5 });
    t.noise({ filter: 'lowpass', f: 140, colour: 'brown', attack: 0.05, decay: 0.6, gain: 0.5 });
  }],
  rumble: [3, (t) => {
    t.noise({ filter: 'lowpass', f: 150, colour: 'brown', attack: 0.3, decay: 0.8, gain: 1 });
    t.thump({ f: 55, to: 32, decay: 0.5, gain: 0.7 });
    t.grains({ at: 0.2, len: 1.2, f: 600, q: 0.8, rate: 140, gain: 0.25 });
  }],
  boom: [1.2, (t) => {
    t.thump({ f: 75, to: 38, decay: 0.22, gain: 1 });
    t.noise({ filter: 'lowpass', f: 500, decay: 0.12, gain: 0.6 });
    t.grains({ at: 0.04, len: 0.6, f: 1300, q: 1.1, rate: 300, gain: 0.35 });
  }],
  catapult: [1, (t) => {
    t.creak({ len: 0.22, r0: 35, r1: 70, body: [[300, 6, 1], [640, 7, 0.5]], gain: 0.25 });
    t.modes({ at: 0.22, modes: MATERIALS.wood.modes, gain: 0.5, scale: 0.6 });
    t.thump({ at: 0.22, f: 80, to: 45, decay: 0.09, gain: 0.7 });
    t.sweep({ at: 0.25, len: 0.4, f: 200, peak: 650, q: 1.2, gain: 0.25 });
  }],
  chain: [0.9, (t) => rattle(t, 0, 0.5)],
  lift: [1.6, (t) => { rattle(t, 0, 1.1, 22, 0.18); t.sweep({ len: 1.3, f: 180, peak: 700, q: 1, gain: 0.3 }); }],

  // Doors, gates, chests.
  doorOpen: [0.7, (t) => {
    t.creak({ len: 0.45, r0: 38, r1: 85, body: [[300, 6, 1], [640, 7, 0.4], [1100, 8, 0.1]], gain: 0.35 });
    t.noise({ filter: 'lowpass', f: 1500, decay: 0.004, gain: 0.25 }); // the latch lifting
  }],
  doorClose: [0.7, (t) => {
    t.creak({ len: 0.22, r0: 75, r1: 40, body: [[360, 6, 1], [780, 7, 0.45]], gain: 0.28 });
    t.modes({ at: 0.22, modes: MATERIALS.wood.modes, gain: 0.55, scale: 0.75 });
    t.thump({ at: 0.22, f: 90, to: 55, decay: 0.07, gain: 0.7 });
    t.noise({ at: 0.22, filter: 'lowpass', f: 900, decay: 0.03, gain: 0.35 });
  }],
  gateOpen: [0.6, (t) => {
    t.creak({ len: 0.32, r0: 55, r1: 110, body: [[440, 6, 1], [900, 7, 0.35]], gain: 0.28 });
    t.modes({ modes: [[1500, 1, 0.025], [2300, 0.4, 0.015]], gain: 0.08 }); // the latch
  }],
  gateClose: [0.6, (t) => {
    t.creak({ len: 0.16, r0: 90, r1: 50, body: [[520, 6, 1], [1100, 7, 0.4]], gain: 0.22 });
    t.modes({ at: 0.16, modes: MATERIALS.wood.modes, gain: 0.35, scale: 1.1 });
    t.modes({ at: 0.18, modes: [[1450, 1, 0.03], [2200, 0.4, 0.02]], gain: 0.1 });
    t.thump({ at: 0.16, f: 110, to: 70, decay: 0.04, gain: 0.35 });
  }],
  trapdoor: [0.5, (t) => {
    t.modes({ modes: MATERIALS.wood.modes, gain: 0.45, scale: 0.85 });
    t.thump({ f: 95, to: 55, decay: 0.07, gain: 0.6 });
    t.noise({ filter: 'lowpass', f: 700, decay: 0.04, gain: 0.3 });
  }],
  chest: [0.6, (t) => {
    t.creak({ len: 0.3, r0: 45, r1: 80, body: [[420, 6, 1], [900, 7, 0.4]], gain: 0.22 });
    t.thump({ at: 0.28, f: 110, to: 70, decay: 0.04, gain: 0.3 });
  }],

  // Water and fire.
  splash: [0.9, (t) => {
    t.noise({ filter: 'lowpass', f: 1300, attack: 0.006, decay: 0.18, gain: 0.7 });
    t.noise({ f: 480, q: 0.7, attack: 0.01, decay: 0.3, gain: 0.35 });
    for (let i = 0; i < 6; i++) bubble(t, t.r(0.04, 0.5), false, t.r(0.1, 0.22));
  }],
  bucketFill: [0.6, (t) => {
    t.noise({ f: 650, q: 0.8, attack: 0.02, decay: 0.12, gain: 0.5 });
    for (let i = 0; i < 4; i++) bubble(t, t.r(0.05, 0.35), false, 0.2);
  }],
  bucketPour: [1, (t) => {
    t.rustle({ len: 0.8, f: 850, q: 0.6, gain: 0.6 });
    t.noise({ filter: 'lowpass', f: 500, attack: 0.1, decay: 0.25, gain: 0.3 });
    for (let i = 0; i < 6; i++) bubble(t, t.r(0.1, 0.7), false, 0.15);
  }],
  sizzle: [0.6, (t) => {
    t.noise({ f: 1500, q: 0.5, attack: 0.01, decay: 0.12, gain: 0.18 });
    t.grains({ len: 0.4, f: 1200, q: 1, rate: 120, gain: 0.35 });
    t.thump({ f: 140, to: 90, decay: 0.03, gain: 0.2 });
  }],

  // Eating and drinking.
  eat: [0.8, (t) => {
    for (const at of [0, 0.19, 0.39]) {
      t.grains({ at, len: 0.07, f: t.r(950, 1250), q: 1, rate: 600, gain: 0.5, grain: 0.003 });
      t.thump({ at, f: 140, to: 90, decay: 0.03, gain: 0.3 });
    }
  }],
  drink: [0.9, (t) => {
    for (const at of [0, 0.26, 0.52]) {
      t.chirp({ at, len: 0.08, f: t.r(170, 200), to: t.r(290, 340), gain: 0.4, env: 'strike', decay: 0.03 });
      t.noise({ at, filter: 'lowpass', f: 600, decay: 0.04, gain: 0.2 });
      t.thump({ at: at + 0.06, f: 90, to: 60, decay: 0.03, gain: 0.3 });
    }
  }],

  // Interface: a small, low, soft tick — asked for quieter and lower.
  click: [0.06, (t) => {
    t.noise({ filter: 'lowpass', f: 800, decay: 0.004, gain: 0.2 });
    t.chirp({ len: 0.03, f: 480, to: 380, gain: 0.25, env: 'strike', decay: 0.01 });
  }],
  // An achievement or a level: two soft plucked notes, a fifth apart.
  chime: [1.6, (t) => {
    t.pluck({ f: 293.7, len: 1.4, gain: 0.3, bright: 0.25, damp: 0.998 });
    t.pluck({ at: 0.13, f: 440, len: 1.3, gain: 0.25, bright: 0.25, damp: 0.998 });
  }],
};

/**
 * Ambient creatures and drips, scattered over the beds by Sound.js. Each is
 * kept low and soft: they are far away.
 */
const CALLS = {
  // A wood pigeon's "coo-COO-coo": low, breathy, unmistakably a bird.
  'call:dove': [1.9, (t) => {
    const f = t.r(470, 540);
    t.chirp({ len: 0.32, f: f * 1.05, to: f, gain: 0.35, harmonics: [1, 0.12], vibrato: 0.01, rateHz: 28 });
    t.chirp({ at: 0.42, len: 0.55, f: f * 1.12, to: f * 0.98, gain: 0.42, harmonics: [1, 0.12], vibrato: 0.012, rateHz: 28 });
    t.chirp({ at: 1.1, len: 0.3, f: f, to: f * 0.95, gain: 0.32, harmonics: [1, 0.12], vibrato: 0.01, rateHz: 28 });
    t.noise({ f: f * 2, q: 1.5, attack: 0.1, decay: 0.5, gain: 0.03 });
  }],
  // A cuckoo: two clear notes falling a third.
  'call:cuckoo': [1.1, (t) => {
    const f = t.r(640, 700);
    t.chirp({ len: 0.26, f, to: f * 0.98, gain: 0.35, harmonics: [1, 0.08] });
    t.chirp({ at: 0.36, len: 0.34, f: f * 0.82, to: f * 0.79, gain: 0.32, harmonics: [1, 0.08] });
  }],
  // A blackbird's phrase: a few fluting notes that glide, mid-range.
  'call:warble': [1.4, (t) => {
    let at = 0;
    const n = 4 + Math.floor(t.r(0, 4));
    for (let i = 0; i < n; i++) {
      const f = t.r(1100, 2100), len = t.r(0.06, 0.16);
      t.chirp({ at, len, f, to: f * t.r(0.8, 1.25), gain: t.r(0.12, 0.22), harmonics: [1, 0.15], vibrato: 0.02, rateHz: 35 });
      at += len + t.r(0.01, 0.07);
    }
  }],
  // Small birds in the hedge: two or three quick, quiet notes.
  'call:chirp': [0.6, (t) => {
    const n = 2 + Math.floor(t.r(0, 2));
    for (let i = 0; i < n; i++) {
      const f = t.r(1900, 2700);
      t.chirp({ at: i * t.r(0.1, 0.15), len: 0.05, f, to: f * t.r(0.7, 0.9), gain: 0.1 });
    }
  }],
  // A field cricket's chirp: a few pulses of one tone, lowered from the
  // real thing's 4–5 kHz so a night doesn't whine.
  'call:cricket': [2.2, (t) => {
    const f = t.r(2600, 3100);
    for (let c = 0; c < 4; c++) {
      for (let p = 0; p < 3; p++) t.chirp({ at: c * 0.5 + p * 0.032, len: 0.02, f, to: f * 0.99, gain: 0.12 });
    }
  }],
  // A tawny owl: "hoo … hu-hoooo", low and hollow.
  'call:owl': [2.4, (t) => {
    const f = t.r(380, 430);
    t.chirp({ len: 0.42, f: f * 1.02, to: f * 0.96, gain: 0.35, harmonics: [1, 0.06] });
    t.chirp({ at: 0.95, len: 0.12, f: f * 1.05, to: f, gain: 0.25, harmonics: [1, 0.06] });
    t.chirp({ at: 1.15, len: 0.85, f: f * 1.04, to: f * 0.9, gain: 0.32, harmonics: [1, 0.06], vibrato: 0.015, rateHz: 7 });
    t.noise({ f: f * 1.5, q: 1, attack: 0.1, decay: 0.4, gain: 0.02 });
  }],
  // A frog in the reeds: a voiced, rasping croak, twice.
  'call:frog': [0.9, (t) => {
    for (const at of [0, 0.42]) t.voice({ at, len: 0.24, f: t.r(26, 34), to: t.r(22, 28), formants: [[520, 4, 1], [1150, 5, 0.4]], gain: 1.4 });
  }],
  // A drip in a cave, with its echo.
  'call:drip': [0.9, (t) => {
    const f = t.r(650, 950);
    t.chirp({ len: 0.035, f, to: f * 2, gain: 0.35, env: 'strike', decay: 0.012 });
    t.echo([0.13, 0.27, 0.41], 0.4);
  }],
};

/**
 * Every effect's recipe, by key: the actions above and the calls, plus
 * `place:`, `break:`, `dig:`, `step:` and `land:` for every material.
 * (seconds, (take) => void).
 */
export const RECIPES = { ...EFFECTS, ...CALLS };
for (const m of MATERIAL_NAMES) {
  for (const kind of Object.keys(LENGTHS)) RECIPES[`${kind}:${m}`] = [LENGTHS[kind], (t) => impact(t, m, kind)];
}

/** Renders take `variant` of the effect `key`: samples at RATE. */
export function render(key, rand) {
  const recipe = RECIPES[key];
  if (!recipe) return null;
  const [seconds, build] = recipe;
  const take = new Take(seconds, rand);
  build(take);
  return toPeak(take.finish(), PEAKS[key.split(':')[0]] ?? PEAKS[key]);
}

/**
 * How loud each kind of effect peaks, so one material isn't twice as loud
 * as another just because of how its pieces happened to add up: a
 * footstep well under a block going in, a block going in under one
 * breaking, and the creatures all at one level for Sound.js to scale.
 */
const PEAKS = { step: 0.35, dig: 0.5, place: 0.65, break: 0.75, land: 0.6, call: 0.5, click: 0.3 };

/** Scales samples so their loudest is `peak` (left alone if no peak is given). */
function toPeak(samples, peak) {
  if (!peak) return samples;
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
  return samples;
}

/** Scales samples to an RMS loudness, never past `ceiling` at their peak. */
function toLoudness(samples, rms, ceiling = 0.95) {
  let e = 0, max = 0;
  for (let i = 0; i < samples.length; i++) { e += samples[i] ** 2; max = Math.max(max, Math.abs(samples[i])); }
  const now = Math.sqrt(e / samples.length);
  if (!now) return samples;
  const k = Math.min(rms / now, ceiling / max);
  for (let i = 0; i < samples.length; i++) samples[i] *= k;
  return samples;
}

/**
 * The beds ambience is built from: loops with no seam, each [seconds,
 * build]. Wind is deep noise whose filter and loudness follow slow gusts;
 * the island's gale is higher and whistles; a stream is water noise with
 * bubbles all through it; the Stone Kingdom hums on beating low tones
 * (frequencies chosen to repeat exactly in eight seconds).
 */
export const LOOPS = {
  wind: [12, (t, len) => gusts(t, len, { f: 220, depth: 320, gain: 0.6, speed: 1, whistle: 0.03, hiss: 0.06 })],
  gale: [10, (t, len) => gusts(t, len, { f: 320, depth: 700, gain: 0.75, speed: 2.2, whistle: 0.1, q: 1.1, hiss: 0.12 })],
  stream: [6, (t, len) => {
    t.rustle({ len, f: 850, q: 0.6, gain: 0.3 });
    t.noise({ filter: 'lowpass', f: 420, len, attack: 0.5, decay: 1e9, gain: 0.25 });
    for (let at = 0; at < len - 0.1; at += t.r(0.02, 0.08)) bubble(t, at, false, t.r(0.03, 0.1));
  }],
  sea: [12, (t, len) => {
    // Two waves to a loop: noise that swells, brightens and falls back.
    const n = Math.floor(len * RATE), out = t.out;
    const lp = new Steep('lowpass', 300, 0.7);
    const src = t.noiseSource('brown'), hiss = t.noiseSource();
    for (let i = 0; i < n; i++) {
      const s = ((1 - Math.cos((2 * Math.PI * i) / (RATE * 6))) / 2) ** 1.6;
      if ((i & 31) === 0) lp.set(180 + 900 * s);
      out[i] += lp.run(src() * 0.7 + hiss() * 0.3 * s) * (0.25 + 0.75 * s) * 0.7;
    }
  }],
  lava: [6, (t, len) => {
    t.noise({ filter: 'lowpass', f: 160, colour: 'brown', len, attack: 0.5, decay: 1e9, gain: 0.7 });
    for (let at = 0; at < len - 0.2; at += t.r(0.15, 0.45)) bubble(t, at, true, t.r(0.15, 0.35));
    for (let at = 0; at < len - 0.1; at += t.r(0.2, 0.6)) t.noise({ at, filter: 'lowpass', f: 1500, decay: 0.004, gain: t.r(0.05, 0.15) });
  }],
  hum: [8, (t, len) => {
    const n = Math.floor(len * RATE), out = t.out;
    const tones = [[55, 0.5], [55.25, 0.4], [82.5, 0.25], [110.125, 0.15], [165, 0.06]];
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const [f, a] of tones) v += Math.sin((2 * Math.PI * f * i) / RATE) * a;
      out[i] += v * 0.5;
    }
    t.noise({ filter: 'lowpass', f: 120, colour: 'brown', len, attack: 0.5, decay: 1e9, gain: 0.15 });
  }],
  cave: [8, (t, len) => {
    t.noise({ filter: 'lowpass', f: 110, colour: 'brown', len, attack: 0.5, decay: 1e9, gain: 0.6 });
    t.noise({ f: 300, q: 2, len, attack: 0.5, decay: 1e9, gain: 0.04 });
  }],
};

/** Wind: noise whose filter and loudness follow a few slow, unrelated waves. */
function gusts(t, len, { f, depth, gain, speed, whistle, q = 0.7, hiss: airy = 0.1 }) {
  const n = Math.floor(len * RATE), out = t.out;
  const waves = [0.06, 0.11, 0.23].map((hz) => [hz * speed, t.r(0, Math.PI * 2)]);
  const g = (time) => waves.reduce((s, [hz, ph]) => s + Math.sin(2 * Math.PI * hz * time + ph), 0) / 6 + 0.5;
  const body = new Steep('bandpass', f, q);
  const howl = new Biquad('bandpass', f * 2, 9);
  const src = t.noiseSource('brown'), hiss = t.noiseSource();
  let gust = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      gust = g(i / RATE);
      body.set(f + depth * gust);
      howl.set((f + depth * gust) * 1.6);
    }
    const x = src() * (1 - airy) + hiss() * airy;
    out[i] += (body.run(x) * (0.3 + 0.7 * gust) + howl.run(hiss()) * whistle * gust * gust) * gain;
  }
}

/** Renders a loop with no seam. */
export function renderLoop(name, rand) {
  const loop = LOOPS[name];
  if (!loop) return null;
  const [seconds, build] = loop;
  // Every bed at one loudness: soundscape.js's numbers then mean the same for each.
  return toLoudness(seamless(seconds, Math.min(1.5, seconds / 4), rand, build), 0.12);
}

/**
 * The music's instruments, each made once at A3 (220 Hz) and moved to any
 * note by playback rate. Soft and dark on purpose: a warm pluck, a pad that
 * breathes in and out, and — for the dark path — a low bell.
 */
export const BASE_NOTE = 57; // A3, in MIDI
export const INSTRUMENTS = {
  pluck: [3, (t) => {
    t.pluck({ f: 220, len: 2.9, gain: 0.5, bright: 0.3, damp: 0.9985 });
    t.chirp({ len: 2.6, f: 220, to: 220, gain: 0.12, env: 'strike', decay: 0.7 });
  }],
  pad: [6, (t) => {
    const n = Math.floor(6 * RATE), out = t.out;
    const lp = new Steep('lowpass', 650, 0.6);
    const detune = [1, 1.0035, 0.9968];
    const ph = detune.map(() => t.r(0, 1));
    for (let i = 0; i < n; i++) {
      const time = i / RATE;
      const env = Math.min(1, time / 1.8) * Math.min(1, (6 - time) / 2.2);
      let v = 0;
      for (let k = 0; k < detune.length; k++) {
        ph[k] = (ph[k] + (220 * detune[k]) / RATE) % 1;
        v += (1 - 2 * Math.abs(2 * ph[k] - 1)) * 0.5 + (1 - 2 * ph[k]) * 0.15; // triangle with a little saw
      }
      out[i] += lp.run(v) * 0.22 * env;
    }
  }],
  bell: [4, (t) => {
    t.modes({ modes: [[220, 1, 1.1], [220 * 2.76, 0.35, 0.6], [220 * 5.4, 0.1, 0.3], [110, 0.3, 1.4]], gain: 0.4, attack: 0.003, jitter: 0 });
  }],
};

export function renderInstrument(name, rand) {
  const inst = INSTRUMENTS[name];
  if (!inst) return null;
  const take = new Take(inst[0], rand);
  inst[1](take);
  return toPeak(take.finish(0.9), 0.7);
}
