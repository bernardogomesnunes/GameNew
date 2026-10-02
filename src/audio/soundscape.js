/**
 * What should be heard, decided in plain numbers: which material a block
 * sounds like, which sound each thing you do makes, what the place and the
 * hour sound like around you, what the music is doing, and how loud each
 * part is from the settings.
 *
 * Kept apart from Sound.js (which only plays things) so every decision can
 * be tested in Node, where there is no Web Audio at all.
 */

import { MATERIAL_NAMES, RECIPES } from './recipes.js';

// --- What a block sounds like ------------------------------------------------------------------

/**
 * Blocks whose look names their sound better than their `material` does.
 * `material` in blocks.js is what a tool cuts (a shovel digs sand, grass and
 * clay alike), which is the wrong grain for hearing: sand hisses, grass
 * rustles, clay thuds. So the glyph — what it's drawn as — decides first.
 */
const BY_GLYPH = {
  grass: 'grass', moss: 'grass', litter: 'grass',
  sand: 'sand', snow: 'snow',
  pane: 'glass', window: 'glass', crystal: 'glass',
  gold: 'metal', trim: 'metal', chain: 'metal', chandelier: 'metal', lantern: 'metal',
  rug: 'cloth', banner: 'cloth', tent: 'cloth', bed: 'cloth', dummy: 'cloth',
};
/** A few by name, where a glyph is shared with something that sounds different. */
const BY_NAME = { Gravel: 'gravel', 'Gold Ore': 'stone', Lava: 'lava', 'Flowing Lava': 'lava' };
/** And the rest by what it is made of. */
const BY_MATERIAL = { stone: 'stone', wood: 'wood', dirt: 'dirt', plant: 'plant' };

/** What a block sounds like: one of recipes.js's MATERIALS. */
export function soundOf(block) {
  if (!block) return 'dirt';
  if (BY_NAME[block.name]) return BY_NAME[block.name];
  if (block.glyph === 'water') return 'water';
  if (BY_GLYPH[block.glyph]) return BY_GLYPH[block.glyph];
  if (block.transparent && !block.material) return 'glass';
  return BY_MATERIAL[block.material] ?? 'stone';
}

/** The effect for an impact on a material: 'place', 'break', 'dig', 'step' or 'land'. */
export function materialSound(kind, material) {
  return `${kind}:${MATERIAL_NAMES.includes(material) ? material : 'dirt'}`;
}

/**
 * Every named thing the game does that makes a sound, and the effect it
 * plays. Sound.js has a method for each; tests check every one of these is
 * a real recipe, so an action can't quietly fall silent.
 */
export const ACTION_SOUNDS = {
  swing: 'swing', blow: 'blow', heavyBlow: 'heavyBlow', slash: 'slash', hurt: 'hurt',
  bow: 'bow', arrowHit: 'arrowHit', horn: 'horn',
  gong: 'gong', rumble: 'rumble', boom: 'boom', catapult: 'catapult', chain: 'chain', lift: 'lift',
  doorOpen: 'doorOpen', doorClose: 'doorClose', gateOpen: 'gateOpen', gateClose: 'gateClose',
  trapdoor: 'trapdoor', chest: 'chest',
  splash: 'splash', bucketFill: 'bucketFill', bucketPour: 'bucketPour', sizzle: 'sizzle',
  eat: 'eat', drink: 'drink', click: 'click', chime: 'chime',
};

/** Which effects each opening or shutting thing makes. */
export function swingSound(kind, open) {
  if (kind === 'trapdoor') return 'trapdoor';
  if (kind === 'gate') return open ? 'gateOpen' : 'gateClose';
  return open ? 'doorOpen' : 'doorClose';
}

// --- Loudness ------------------------------------------------------------------------------------

/** The settings' defaults for the three parts (the master is controls' `volume`). */
export const DEFAULT_LEVELS = { volume: 0.7, sfx: 0.8, ambience: 0.6, music: 0.45 };

/**
 * How loud each part sits under the others at full slider: effects are
 * what you're doing, so they lead; ambience is a bed under them; music is
 * the quietest thing in the mix.
 */
const TRIM = { sfx: 1, ambience: 0.55, music: 0.4 };

/**
 * Bus gains from the sliders. A slider is squared on its way to a gain,
 * so its travel feels even — half way sounds about half as loud, where a
 * straight line would put almost all the change at the bottom. Master at
 * zero is the old "Off": everything silent.
 */
export function busGains(levels = DEFAULT_LEVELS) {
  const v = (k) => {
    const x = Number(levels[k] ?? DEFAULT_LEVELS[k]);
    return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : DEFAULT_LEVELS[k];
  };
  const master = v('volume') ** 2;
  return {
    master,
    sfx: v('sfx') ** 2 * TRIM.sfx,
    ambience: v('ambience') ** 2 * TRIM.ambience,
    music: v('music') ** 2 * TRIM.music,
  };
}

// --- Ambience ------------------------------------------------------------------------------------

/** The looping beds (recipes.js's LOOPS) and the creatures scattered over them. */
export const BEDS = ['wind', 'gale', 'stream', 'sea', 'lava', 'hum', 'cave'];
export const CALLS = {
  birds: ['call:dove', 'call:cuckoo', 'call:warble', 'call:chirp', 'call:chirp'],
  crickets: ['call:cricket'],
  owls: ['call:owl'],
  frogs: ['call:frog'],
  drips: ['call:drip'],
};
/**
 * How often each kind calls at full strength: [shortest, longest] seconds
 * between calls. Sparse on purpose — a bird every few seconds is a
 * meadow; one every half second is an aviary.
 */
export const CALL_EVERY = { birds: [3, 9], crickets: [1.2, 3.5], owls: [14, 35], frogs: [4, 10], drips: [2, 6] };

/**
 * How alive each kind of country is, and how windy. Forests have the most
 * birds and the owls; the wetland has frogs; the desert and the mountains
 * are mostly wind; the ocean is waves.
 */
export const BIOME_LIFE = {
  plains: { wind: 0.45, birds: 0.7, crickets: 1, owls: 0.3 },
  forestOak: { wind: 0.3, birds: 1, crickets: 0.6, owls: 0.9 },
  forestBirch: { wind: 0.3, birds: 1, crickets: 0.6, owls: 0.8 },
  forestDark: { wind: 0.25, birds: 0.5, crickets: 0.5, owls: 1 },
  giantGrove: { wind: 0.25, birds: 0.8, crickets: 0.5, owls: 0.9 },
  desert: { wind: 0.65, birds: 0.1, crickets: 0.4, owls: 0 },
  wetland: { wind: 0.35, birds: 0.6, crickets: 0.7, owls: 0.4, frogs: 1 },
  mountains1: { wind: 0.75, birds: 0.3, crickets: 0.2, owls: 0.2 },
  mountains2: { wind: 0.8, birds: 0.25, crickets: 0.15, owls: 0.2 },
  ocean: { wind: 0.6, birds: 0.1, crickets: 0, owls: 0, sea: 0.8 },
};

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

/**
 * What a place sounds like at an hour: a target loudness 0..1 for each bed
 * and each kind of call. `place` is plain numbers (see listen.js):
 *
 *   day          0 night .. 1 full day (DayCycle's daylight)
 *   biome        a biome id
 *   water, lava  0..1, how much of it is near
 *   island       standing on the floating island
 *   kingdom      0..1, how far into the Stone Kingdom
 *   underground  0..1, how deep under the ground's surface
 *   paused       a menu is open: everything drops back
 */
export function pickAmbience(place = {}) {
  const day = clamp01(place.day ?? 1), night = 1 - day;
  const life = BIOME_LIFE[place.biome] ?? BIOME_LIFE.plains;
  const beds = Object.fromEntries(BEDS.map((b) => [b, 0]));
  const calls = Object.fromEntries(Object.keys(CALLS).map((c) => [c, 0]));
  const water = clamp01(place.water), lava = clamp01(place.lava);
  const kingdom = clamp01(place.kingdom), under = clamp01(place.underground);

  if (place.island) {
    // High up on the island: a gale with a whistle in it, and little else.
    beds.gale = 0.8;
    calls.birds = 0.25 * day;
    calls.owls = 0;
  } else {
    // A little calmer at night, the way the air settles after dusk.
    beds.wind = life.wind * (0.65 + 0.35 * day);
    beds.sea = life.sea ?? 0;
    calls.birds = life.birds * day;
    calls.crickets = life.crickets * night;
    calls.owls = life.owls * night;
    calls.frogs = ((life.frogs ?? 0) + water * 0.4) * night;
  }
  beds.stream = water * 0.8;
  beds.lava = lava * 0.8;
  // The Stone Kingdom: a low hum under everything, and fewer birds.
  beds.hum = kingdom * 0.7;
  calls.birds *= 1 - 0.6 * kingdom;

  // Underground, the outside fades and the cave takes over.
  if (under > 0) {
    const outside = 1 - 0.9 * under;
    for (const b of ['wind', 'gale', 'sea']) beds[b] *= outside;
    for (const c of ['birds', 'crickets', 'owls', 'frogs']) calls[c] *= outside;
    beds.cave = 0.7 * under;
    calls.drips = under;
  }

  const hush = place.paused ? 0.4 : 1;
  for (const k of BEDS) beds[k] = clamp01(beds[k]) * hush;
  for (const k of Object.keys(calls)) calls[k] = clamp01(calls[k]) * hush;
  return { beds, calls };
}

// --- Music ---------------------------------------------------------------------------------------

/**
 * The three moods. Day is a major pentatonic on D, plucked, unhurried;
 * night is a minor pentatonic, lower and slower; the dark path (the Black
 * Ring) is lower still, on a scale with a half step in it (D, E♭, F, A, B♭
 * — a Japanese in-sen), rung on a bell over a drone, with long silences.
 *
 *   root     MIDI note the scale starts from
 *   scale    semitones above the root
 *   range    scale steps the melody may wander, from the root
 *   inst     the melodic instrument; `pad` the held chord under it
 *   notes    how many notes in a phrase; `gap` seconds between them
 *   rest     seconds of silence after a phrase
 */
export const MOODS = {
  day: { root: 62, scale: [0, 2, 4, 7, 9], range: [-2, 7], inst: 'pluck', pad: 'pad', notes: [3, 6], gap: [0.45, 0.9], rest: [25, 50], vel: 0.55 },
  night: { root: 57, scale: [0, 3, 5, 7, 10], range: [-2, 6], inst: 'pluck', pad: 'pad', notes: [2, 5], gap: [0.8, 1.4], rest: [35, 65], vel: 0.42 },
  dark: { root: 50, scale: [0, 1, 5, 7, 8], range: [-1, 6], inst: 'bell', pad: 'pad', notes: [2, 4], gap: [1.2, 2], rest: [30, 60], vel: 0.45, drone: true },
};

/** Which mood: the dark path, whatever the hour; otherwise day or night. */
export function musicMood(place = {}) {
  if (place.darkPath) return 'dark';
  return clamp01(place.day ?? 1) < 0.35 ? 'night' : 'day';
}

/** The MIDI note `step` scale steps above a mood's root (negative goes below). */
export function noteOf(mood, step) {
  const { root, scale } = MOODS[mood];
  const octave = Math.floor(step / scale.length);
  return root + octave * 12 + scale[((step % scale.length) + scale.length) % scale.length];
}

/**
 * One phrase of music: a few notes wandering a step or two at a time and
 * coming home to a chord tone, over a soft held chord. Returns
 * { notes: [{ t, midi, vel, inst }], length, rest } — times in seconds.
 */
export function musicPhrase(mood, rand = Math.random) {
  const m = MOODS[mood] ?? MOODS.day;
  const r = (a, b) => a + (b - a) * rand();
  const count = Math.round(r(m.notes[0], m.notes[1]));
  const notes = [];
  // The chord first, an octave down: root and fifth, and the third by day.
  const chord = mood === 'day' ? [0, 2, 3] : [0, 3];
  for (const s of chord) notes.push({ t: 0, midi: noteOf(mood, s) - 12, vel: m.vel * 0.5, inst: m.pad });
  if (m.drone) notes.push({ t: 0, midi: m.root - 24, vel: m.vel * 0.6, inst: m.pad });
  let step = Math.floor(r(0, 3)), t = r(0.6, 1.4);
  for (let i = 0; i < count; i++) {
    if (i === count - 1) step = [0, 2, 4][Math.floor(r(0, 3))]; // home
    notes.push({ t, midi: noteOf(mood, step), vel: m.vel * r(0.75, 1), inst: m.inst });
    step = Math.max(m.range[0], Math.min(m.range[1], step + [-2, -1, -1, 1, 1, 2][Math.floor(r(0, 6))]));
    t += r(m.gap[0], m.gap[1]);
  }
  return { notes, length: t + 3, rest: r(m.rest[0], m.rest[1]) };
}

/** Every recipe key the game can ask for — what the tests walk. */
export function everySound() {
  const keys = new Set(Object.values(ACTION_SOUNDS));
  for (const m of MATERIAL_NAMES) for (const k of ['place', 'break', 'dig', 'step', 'land']) keys.add(materialSound(k, m));
  for (const list of Object.values(CALLS)) for (const k of list) keys.add(k);
  return [...keys];
}

/** Whether a key names a real recipe. */
export const isSound = (key) => !!RECIPES[key];
