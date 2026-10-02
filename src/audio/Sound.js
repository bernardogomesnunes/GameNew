/**
 * The game's sound: effects, ambience and music, through Web Audio.
 *
 * It began as a few tones made in code (a knock for a placed block, a
 * crunch for a broken one), and was heard as "awful … too high and don't
 * make a lot of sense in terms of representation of the action they are
 * meant for". So it is now three things (docs/plan-look-and-sound.md, 6):
 *
 *  - **Effects**, from recipes.js: every material placed, broken, dug at and
 *    walked on sounds like itself, and blows, swords, bows, doors, gates,
 *    water, lava, eating and drinking each have their own. A few takes of
 *    each are rendered the first time they're wanted and kept, and each play
 *    picks one and nudges its speed, so nothing repeats exactly.
 *  - **Ambience**: looping beds (wind, a stream, the sea, lava, the Stone
 *    Kingdom's hum, a cave) faded to whatever soundscape.js says the place
 *    and the hour call for, with birds, crickets, owls, frogs and drips
 *    scattered over them.
 *  - **Music**: sparse phrases on a pluck or a bell over a soft pad, with
 *    long silences between — darker on the dark path.
 *
 * Each goes through its own bus (effects, ambience, music) into a master,
 * so the settings have a slider for each; master at zero is the old Off.
 *
 * Browsers only let audio start from a click or a key, so nothing is made
 * until the first one (`unlock`). In Node there is no AudioContext at all:
 * every method is safe to call and does nothing, so the tests can drive the
 * game. On a phone, effects are capped at a handful at once — a symmetry
 * break of forty blocks plays one sound, not forty.
 */

import { render, renderLoop, renderInstrument, BASE_NOTE } from './recipes.js';
import { seeded, seedOf, RATE } from './synth.js';
import {
  ACTION_SOUNDS, CALLS, CALL_EVERY, BEDS, DEFAULT_LEVELS,
  busGains, pickAmbience, musicMood, musicPhrase, materialSound, swingSound,
} from './soundscape.js';

export { soundOf } from './soundscape.js';

/** Takes rendered of each effect: enough that a run of footsteps never repeats in an obvious pattern. */
const TAKES = 4;
/** Effects playing at once, at most. Past that a new one is dropped (phones). */
const MAX_VOICES = 12;
/** Ambient calls at once, at most. */
const MAX_CALLS = 3;
/** The same effect can't restart sooner than this (seconds): forty blocks broken at once are one crunch. */
const MIN_GAP = 0.035;
/** Blocks walked between footsteps — a little less when sprinting. */
const STEP_EVERY = 0.55;
/** How far off a sound can still be heard (blocks), and how fast it fades. */
const HEARING = 48, FALLOFF = 7;
/** Seconds for a bed to fade to a new level: a place changes gradually. */
const BED_FADE = 1.6;
/** A bed silent this long is stopped, so a phone isn't mixing loops at zero. */
const BED_IDLE = 20;
/** How long after the first click before the music first plays. */
const MUSIC_FIRST = 25;

export class Sound {
  constructor(levels = {}) {
    this.levels = { ...DEFAULT_LEVELS };
    this.setLevels(levels);
    this.ctx = null;
    this.buses = null;
    this.cache = new Map();
    this.voices = 0;
    this.calls = 0;
    this.lastPlayed = new Map();
    this.walked = 0;
    this.listener = null;
    this.beds = new Map();
    this.nextCall = {};
    this.nextPhrase = MUSIC_FIRST;
    this.rand = seeded(seedOf('sound'));
    // Counted for checking in a browser (you can't hear a test): what started, what was dropped.
    this.stats = { started: 0, dropped: 0, byKey: {} };
  }

  /** The master level, 0..1 — what the old single Volume slider set. */
  get volume() { return this.levels.volume; }

  /** Starts audio. Call from a real user gesture — a click or a key. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.();
      return;
    }
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    // A gentle limiter last, so a horn over a battle over a stream never clips.
    const limit = ctx.createDynamicsCompressor?.();
    const master = ctx.createGain();
    if (limit) {
      limit.threshold.value = -6; limit.knee.value = 6; limit.ratio.value = 8;
      limit.attack.value = 0.003; limit.release.value = 0.25;
      master.connect(limit).connect(ctx.destination);
    } else master.connect(ctx.destination);
    this.buses = { master, sfx: ctx.createGain(), ambience: ctx.createGain(), music: ctx.createGain() };
    for (const k of ['sfx', 'ambience', 'music']) this.buses[k].connect(master);
    this.applyGains(true);
    this.nextPhrase = ctx.currentTime + MUSIC_FIRST;
    // The commonest effects, made while nothing else is happening.
    const warm = ['click', 'step:grass', 'step:dirt', 'step:stone', 'place:stone', 'break:dirt', 'swing'];
    const idle = globalThis.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    const next = () => { const k = warm.shift(); if (!k) return; this.buffers(k); idle(next); };
    idle(next);
  }

  /** The master volume, 0..1 (0 is off). */
  setVolume(v) { this.setLevels({ volume: v }); }

  /** Any of { volume, sfx, ambience, music }, each 0..1. */
  setLevels(next = {}) {
    for (const k of Object.keys(DEFAULT_LEVELS)) {
      if (next[k] === undefined) continue;
      const v = Number(next[k]);
      this.levels[k] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_LEVELS[k];
    }
    this.applyGains();
  }

  applyGains(now = false) {
    if (!this.buses) return;
    const g = busGains(this.levels), t = this.ctx.currentTime;
    for (const k of ['master', 'sfx', 'ambience', 'music']) {
      if (now) this.buses[k].gain.value = g[k];
      else this.buses[k].gain.setTargetAtTime(g[k], t, 0.05);
    }
  }

  get ready() {
    return !!this.ctx && this.levels.volume > 0;
  }

  /** Where you are and which way you face, for how far off and to which side a sound is. */
  listen(x, z, yaw) {
    this.listener = { x, z, yaw };
  }

  /** The takes of a sound, made the first time it's asked for. */
  buffers(key) {
    let list = this.cache.get(key);
    if (list) return list;
    if (!this.ctx) return null;
    const make = (samples) => {
      if (!samples) return null;
      const b = this.ctx.createBuffer(1, samples.length, RATE);
      b.getChannelData(0).set(samples);
      return b;
    };
    if (key.startsWith('loop:')) list = [make(renderLoop(key.slice(5), seeded(seedOf(key))))];
    else if (key.startsWith('mus:')) list = [make(renderInstrument(key.slice(4), seeded(seedOf(key))))];
    else {
      const takes = key.startsWith('call:') ? 3 : TAKES;
      list = [];
      for (let i = 0; i < takes; i++) list.push(make(render(key, seeded(seedOf(`${key}#${i}`)))));
    }
    list = list.filter(Boolean);
    this.cache.set(key, list);
    return list;
  }

  /**
   * Plays an effect. `at` ({ x, z }) places it in the world: quieter with
   * distance and panned to its side. `rate` changes its speed (and pitch).
   * Returns whether it started.
   */
  play(key, { gain = 1, rate = 1, at = null, delay = 0, bus = 'sfx', jitter = 0.05, gap = MIN_GAP, pan = null } = {}) {
    if (!this.ready) return false;
    const ctx = this.ctx, now = ctx.currentTime;
    if (bus === 'sfx' && this.voices >= MAX_VOICES) { this.stats.dropped++; return false; }
    if (now - (this.lastPlayed.get(key) ?? -1) < gap) { this.stats.dropped++; return false; }
    if (at && this.listener) {
      const dx = at.x - this.listener.x, dz = at.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      if (d > HEARING) return false;
      gain *= 1 / (1 + d / FALLOFF);
      if (pan === null && d > 1) {
        const yaw = this.listener.yaw ?? 0;
        pan = Math.max(-0.8, Math.min(0.8, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d));
      }
    }
    const list = this.buffers(key);
    if (!list?.length) return false;
    this.lastPlayed.set(key, now);
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(this.rand() * list.length)];
    src.playbackRate.value = rate * (1 + (this.rand() * 2 - 1) * jitter);
    const g = ctx.createGain();
    g.gain.value = gain;
    let tailNode = src.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      tailNode = tailNode.connect(p);
    }
    tailNode.connect(this.buses[bus]);
    const counted = bus === 'sfx' ? 'voices' : bus === 'ambience' ? 'calls' : null;
    if (counted) this[counted]++;
    src.onended = () => {
      if (counted) this[counted]--;
      src.disconnect(); g.disconnect();
    };
    src.start(now + delay);
    this.stats.started++;
    this.stats.byKey[key] = (this.stats.byKey[key] ?? 0) + 1;
    return true;
  }

  // --- What the game does -----------------------------------------------------------------------

  place(material, at = null) { this.play(materialSound('place', material), { gain: 0.8, at }); }
  break(material, at = null) { this.play(materialSound('break', material), { gain: 0.9, at }); }
  /** A blow at a block that hasn't given yet — the pick going in. */
  dig(material) { this.play(materialSound('dig', material), { gain: 0.55, gap: 0.15 }); }

  /** A step on whatever is underfoot, every so often as you walk. */
  walk(distance, material, { sprint = false } = {}) {
    this.walked += distance;
    if (this.walked < STEP_EVERY * (sprint ? 1.25 : 1)) return;
    this.walked = 0;
    this.play(materialSound('step', material), { gain: sprint ? 0.5 : 0.4, jitter: 0.08 });
  }

  /** Coming down on your feet: a jump is a heavy step, a fall a thud. */
  land(material, speed = 8) {
    const hard = Math.min(1, Math.max(0, (speed - 6) / 10));
    this.walked = 0;
    this.play(materialSound(hard > 0.2 ? 'land' : 'step', material), { gain: 0.45 + 0.5 * hard });
  }

  splash() { this.play(ACTION_SOUNDS.splash, { gain: 0.7 }); }

  /** A door, a gate or a trapdoor swinging. `kind`: 'door', 'gate' or 'trapdoor'. */
  creak(open, kind = 'door') { this.play(swingSound(kind, open), { gain: 0.75 }); }
  chest() { this.play(ACTION_SOUNDS.chest, { gain: 0.7 }); }

  eat() { this.play(ACTION_SOUNDS.eat, { gain: 0.7 }); }
  drink() { this.play(ACTION_SOUNDS.drink, { gain: 0.7 }); }
  bucket(fill) { this.play(fill ? ACTION_SOUNDS.bucketFill : ACTION_SOUNDS.bucketPour, { gain: 0.7 }); }

  /** A soft, low tick for buttons — quiet under everything else. */
  click() { this.play(ACTION_SOUNDS.click, { gain: 0.3, jitter: 0.03, gap: 0.05 }); }
  /** An achievement, or a level. */
  chime() { this.play(ACTION_SOUNDS.chime, { gain: 0.5, jitter: 0 }); }

  /** Swinging at something. */
  swing() { this.play(ACTION_SOUNDS.swing, { gain: 0.5, jitter: 0.1 }); }
  /** Your blow landing: a blade's slash with a sword, a thump otherwise. */
  strike({ weapon = false, at = null } = {}) {
    this.play(ACTION_SOUNDS.swing, { gain: 0.35, jitter: 0.1 });
    this.play(weapon ? ACTION_SOUNDS.slash : ACTION_SOUNDS.blow, { gain: 0.8, at, delay: 0.06 });
  }
  /** A blow landing on you (the hurt itself comes from `hurt`). */
  blow(heavy = false, at = null) { this.play(heavy ? ACTION_SOUNDS.heavyBlow : ACTION_SOUNDS.blow, { gain: 0.8, at }); }
  /** Being hurt: a grunt — and lava's hiss with it. */
  hurt(cause) {
    if (cause === 'lava') this.play(ACTION_SOUNDS.sizzle, { gain: 0.6, gap: 0.4 });
    this.play(ACTION_SOUNDS.hurt, { gain: cause === 'lava' ? 0.45 : 0.7, gap: 0.25 });
  }
  /** Dying: the blow, and a low bell under it. */
  die() {
    this.play(ACTION_SOUNDS.heavyBlow, { gain: 0.9 });
    this.play(ACTION_SOUNDS.gong, { gain: 0.35, rate: 0.75, jitter: 0 });
  }
  /** A bow loosed — an archer's, somewhere near. */
  bow(at = null) { this.play(ACTION_SOUNDS.bow, { gain: 0.7, at, gap: 0.08 }); }
  arrowHit(at = null) { this.play(ACTION_SOUNDS.arrowHit, { gain: 0.6, at }); }

  horn() { this.play(ACTION_SOUNDS.horn, { gain: 0.8, jitter: 0 }); }
  gong() { this.play(ACTION_SOUNDS.gong, { gain: 0.8, jitter: 0 }); }
  rumble() { this.play(ACTION_SOUNDS.rumble, { gain: 1, jitter: 0 }); }
  boom(at = null) { this.play(ACTION_SOUNDS.boom, { gain: 0.9, at }); }
  catapult(at = null) { this.play(ACTION_SOUNDS.catapult, { gain: 0.8, at }); }
  chain() { this.play(ACTION_SOUNDS.chain, { gain: 0.7 }); }
  lift() { this.play(ACTION_SOUNDS.lift, { gain: 0.7 }); }

  /**
   * The old all-purpose knock, kept for anything still asking for it: a
   * material struck, `pitch` below 1 for something heavier.
   */
  hit(material, { gain = 0.5, pitch = 1 } = {}) {
    this.play(materialSound(pitch < 0.7 ? 'break' : 'place', material), { gain: Math.min(1, gain * 1.2), rate: Math.max(0.5, Math.min(1.5, pitch * 1.2)) });
  }

  // --- Ambience and music, every frame ----------------------------------------------------------

  /**
   * Brings the beds to what this place and hour sound like, scatters the
   * calls, and plays the next phrase of music when it's due. `place` is the
   * plain description listen.js makes.
   */
  tick(dt, place) {
    if (!this.ready || !place) return;
    const now = this.ctx.currentTime;
    const { beds, calls } = pickAmbience(place);
    this.where = place;
    this.targets = { beds, calls };
    let made = false;
    for (const name of BEDS) {
      const want = beds[name];
      let bed = this.beds.get(name);
      if (!bed && want > 0.01) {
        // One new loop a frame at most: making one is the costly part.
        if (made) continue;
        made = true;
        bed = this.startBed(name);
        if (!bed) continue;
      }
      if (!bed) continue;
      if (Math.abs(bed.want - want) > 0.005) {
        bed.want = want;
        bed.gain.gain.setTargetAtTime(want, now, BED_FADE);
      }
      bed.quietFor = want > 0.01 ? 0 : bed.quietFor + dt;
      if (bed.quietFor > BED_IDLE) this.stopBed(name);
    }
    for (const [kind, strength] of Object.entries(calls)) {
      if (strength < 0.02) { this.nextCall[kind] = null; continue; }
      const [lo, hi] = CALL_EVERY[kind];
      const wait = () => (lo + (hi - lo) * this.rand()) / Math.max(0.3, strength);
      if (this.nextCall[kind] == null) { this.nextCall[kind] = now + wait(); continue; }
      if (now < this.nextCall[kind]) continue;
      this.nextCall[kind] = now + wait();
      if (this.calls >= MAX_CALLS) continue;
      const list = CALLS[kind];
      // Somewhere off to one side, near or far.
      this.play(list[Math.floor(this.rand() * list.length)], {
        bus: 'ambience', gain: strength * (0.35 + 0.5 * this.rand()), pan: this.rand() * 1.4 - 0.7, jitter: 0.06, gap: 0,
      });
    }
    this.tickMusic(now, place);
  }

  startBed(name) {
    const [buffer] = this.buffers(`loop:${name}`) ?? [];
    if (!buffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.buses.ambience);
    // Each starts at a random point, so two loops never line up the same way.
    src.start(this.ctx.currentTime, this.rand() * buffer.duration);
    const bed = { src, gain, want: 0, quietFor: 0 };
    this.beds.set(name, bed);
    return bed;
  }

  stopBed(name) {
    const bed = this.beds.get(name);
    if (!bed) return;
    bed.src.stop();
    bed.src.disconnect(); bed.gain.disconnect();
    this.beds.delete(name);
  }

  /** The next phrase, when the silence after the last one is over. */
  tickMusic(now, place) {
    if (this.levels.music <= 0 || place.paused || now < this.nextPhrase) return;
    const mood = musicMood(place);
    const phrase = musicPhrase(mood, this.rand);
    for (const n of phrase.notes) {
      this.play(`mus:${n.inst}`, {
        bus: 'music', gain: n.vel, rate: 2 ** ((n.midi - BASE_NOTE) / 12), delay: n.t, jitter: 0, gap: 0,
      });
    }
    this.mood = mood;
    this.nextPhrase = now + phrase.length + phrase.rest;
  }

  /** What's going on, for checking in a browser: levels, voices, beds. */
  debug() {
    return {
      ready: this.ready,
      state: this.ctx?.state ?? 'none',
      gains: this.buses ? Object.fromEntries(Object.entries(this.buses).map(([k, b]) => [k, b.gain.value])) : null,
      voices: this.voices,
      calls: this.calls,
      beds: Object.fromEntries([...this.beds].map(([k, b]) => [k, b.want])),
      targets: this.targets ?? null,
      mood: this.mood ?? null,
      stats: this.stats,
      cached: [...this.cache.keys()],
    };
  }
}
