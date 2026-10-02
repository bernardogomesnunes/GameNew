/**
 * The game's sounds, worked out sample by sample.
 *
 * Asked for directly: "the sounds we have now are awful tbh they are too high
 * and don't make a lot of sense in terms of representation of the action
 * they are meant for." The old ones were one band of noise and one tone per
 * material, pitched in the 2–5 kHz range where the ear is most sensitive —
 * every action came out as the same bright tick in a different key.
 *
 * Recordings would have been the first choice (docs/plan-look-and-sound.md,
 * section 6), but no CC0 library could be reached from where the game was
 * built, so these are made the way a foley artist thinks about a sound
 * rather than the way a synthesiser does: what is hit, what it is made of,
 * and what it does after. A stone block is a hard click, a few short
 * resonances in the low mids and grit crumbling off; wood is a hollow knock
 * whose modes ring longer; earth is a low thud and soil falling; sand is a
 * dense soft hiss of grains; glass rings high but briefly; metal clangs low
 * and long. Each is built from a handful of physical pieces — filtered noise
 * bursts, damped modes, showers of tiny grains, a falling sine thump,
 * plucked strings and a stick-slip creak — and everything sits an octave
 * or more below where the old sounds were.
 *
 * Pure: plain numbers in, a Float32Array out. Nothing here needs Web Audio,
 * so Node tests can render any sound and measure it, and Sound.js only has
 * to wrap the samples in an AudioBuffer. Every render is seeded, so a sound's
 * variants are the same every time the game loads — a few takes of each, the
 * way a sound library has several recordings of one footstep.
 */

/**
 * Samples a second. Low on purpose: nothing here needs content above 12 kHz
 * (the point is that it is lower), it halves the work and the memory of a
 * 44.1 kHz render, and the browser resamples for free on playback.
 */
export const RATE = 24000;

/** A small seeded random generator (mulberry32): the same takes on every load. */
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string to a seed, so 'step:grass' take 2 always comes out the same. */
export function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * One second-order filter (the Audio EQ Cookbook's lowpass, highpass and
 * bandpass), stepped one sample at a time so its frequency can move.
 */
export class Biquad {
  constructor(type, f, q = 0.707, rate = RATE) {
    this.type = type;
    this.rate = rate;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }

  set(f, q = this.q) {
    this.q = q;
    const w = (2 * Math.PI * Math.min(Math.max(f, 10), this.rate * 0.45)) / this.rate;
    const c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // bandpass, 0 dB at the peak
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0; this.a2 = (1 - al) / a0;
  }

  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Two of the same filter in a row: twice as steep a slope. One biquad's
 * skirts let enough hiss through above its band that everything still
 * sounded bright — the very complaint — so noise goes through a pair.
 */
export class Steep {
  constructor(type, f, q = 0.707, rate = RATE) {
    this.a = new Biquad(type, f, q, rate);
    this.b = new Biquad(type, f, q, rate);
  }

  set(f, q) { this.a.set(f, q); this.b.set(f, q); }

  run(x) { return this.b.run(this.a.run(x)); }
}

/** Attack, then an exponential fall — the shape of nearly everything struck. */
const strike = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
/** How long until a decay is inaudible (about -60 dB). */
const tail = (attack, decay) => attack + decay * 7;
/** A smooth rise and fall over a length — a swish, a gust, a bird's note. */
const hump = (t, len) => (t <= 0 || t >= len ? 0 : Math.sin((Math.PI * t) / len) ** 2);

/**
 * A take: one sound being built. Each method adds a physical piece of it to
 * the same buffer, at a time in seconds.
 */
export class Take {
  constructor(seconds, rand) {
    this.out = new Float32Array(Math.max(1, Math.ceil(seconds * RATE)));
    this.rand = rand;
  }

  /** A random number in [a, b). */
  r(a = 0, b = 1) { return a + (b - a) * this.rand(); }

  /** Noise: white, or 'brown' (deep, for rumble and wind). */
  noiseSource(colour) {
    if (colour !== 'brown') return () => this.rand() * 2 - 1;
    let b = 0;
    return () => {
      b = (b + 0.02 * (this.rand() * 2 - 1)) / 1.02;
      return b * 3.5;
    };
  }

  /**
   * A burst of filtered noise — the grit of stone, the thud of earth, the
   * hiss of water. `to` sweeps the filter as it goes.
   */
  noise({ at = 0, filter = 'bandpass', f, to = f, q = 0.8, gain = 0.5, attack = 0.001, decay = 0.05, len, colour }) {
    const total = len ?? tail(attack, decay);
    const s0 = Math.floor(at * RATE), n = Math.floor(total * RATE);
    const flt = new Steep(filter, f, q);
    const src = this.noiseSource(colour);
    const out = this.out;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / RATE;
      if (to !== f && (i & 15) === 0) flt.set(f * (to / f) ** (t / total));
      out[s0 + i] += flt.run(src()) * gain * strike(t, attack, decay);
    }
  }

  /**
   * Damped resonances: what rings after a knock. A wooden block's modes sit
   * low and close together and last a while; stone's are short; metal's are
   * spread out (inharmonic) and long.
   */
  modes({ at = 0, modes, gain = 0.5, scale = 1, jitter = 0.03, attack = 0.0006 }) {
    const s0 = Math.floor(at * RATE);
    const out = this.out;
    for (const [f0, amp, decay] of modes) {
      const f = f0 * scale * (1 + this.r(-jitter, jitter));
      const phase = this.r(0, Math.PI * 2);
      const n = Math.floor(tail(attack, decay) * RATE);
      const w = (2 * Math.PI * f) / RATE;
      for (let i = 0; i < n && s0 + i < out.length; i++) {
        out[s0 + i] += Math.sin(w * i + phase) * amp * gain * strike(i / RATE, attack, decay);
      }
    }
  }

  /**
   * A falling sine: the low body of an impact, felt more than heard — a
   * blow, a block landing, a footstep's heel.
   */
  thump({ at = 0, f = 90, to = f * 0.6, decay = 0.06, gain = 0.5, attack = 0.002 }) {
    const s0 = Math.floor(at * RATE), n = Math.floor(tail(attack, decay) * RATE);
    const out = this.out;
    let ph = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / RATE;
      const freq = to + (f - to) * Math.exp(-t / (decay * 0.8));
      ph += (2 * Math.PI * freq) / RATE;
      out[s0 + i] += Math.sin(ph) * gain * strike(t, attack, decay);
    }
  }

  /**
   * A shower of tiny noise grains through one filter: soil crumbling, sand
   * hissing, gravel crunching, snow packing. `rate` is grains a second at
   * the start; `shape` says how that changes ('fall', 'swell' or 'even').
   */
  grains({ at = 0, len = 0.2, rate = 300, f = 1200, q = 1, gain = 0.4, grain = 0.003, shape = 'fall', filter = 'bandpass' }) {
    const n = Math.floor((len + grain * 2) * RATE);
    const tmp = new Float32Array(n);
    let t = 0;
    while (t < len) {
      const density = shape === 'swell' ? 0.15 + hump(t, len) : shape === 'even' ? 1 : Math.exp((-3 * t) / len);
      t += -Math.log(1 - this.rand() * 0.999) / Math.max(1, rate * density);
      if (t >= len) break;
      const amp = this.r(0.2, 1) ** 2;
      const g = Math.floor(grain * this.r(0.5, 1.5) * RATE);
      const start = Math.floor(t * RATE);
      for (let i = 0; i < g && start + i < n; i++) tmp[start + i] += (this.rand() * 2 - 1) * amp * Math.sin((Math.PI * i) / g);
    }
    const flt = new Steep(filter, f, q);
    const s0 = Math.floor(at * RATE), out = this.out;
    for (let i = 0; i < n && s0 + i < out.length; i++) out[s0 + i] += flt.run(tmp[i]) * gain;
  }

  /**
   * Leaves, grass and cloth: noise whose loudness flutters a hundred times
   * a second, inside a rise and fall.
   */
  rustle({ at = 0, len = 0.2, f = 1500, q = 0.7, gain = 0.3 }) {
    const s0 = Math.floor(at * RATE), n = Math.floor(len * RATE);
    const flt = new Steep('bandpass', f, q);
    const out = this.out;
    let am = 0, target = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      if (i % 90 === 0) target = this.r(0, 1) ** 2;
      am += (target - am) * 0.02;
      out[s0 + i] += flt.run(this.rand() * 2 - 1) * am * gain * hump(i / RATE, len) * 2;
    }
  }

  /**
   * A swish: noise whose filter rises to `peak` and falls back as it passes
   * — a sword, an arrow, a gust, a lift going up.
   */
  sweep({ at = 0, len = 0.2, f = 300, peak = 1000, q = 1.4, gain = 0.4 }) {
    const s0 = Math.floor(at * RATE), n = Math.floor(len * RATE);
    const flt = new Steep('bandpass', f, q);
    const out = this.out;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / RATE, h = hump(t, len);
      if ((i & 15) === 0) flt.set(f + (peak - f) * Math.sqrt(h));
      out[s0 + i] += flt.run(this.rand() * 2 - 1) * gain * h;
    }
  }

  /**
   * A plucked string (Karplus–Strong): a bowstring's twang, and the music's
   * soft plucks. `bright` is how much of the pluck's top survives.
   */
  pluck({ at = 0, f = 110, len = 1, gain = 0.5, bright = 0.5, damp = 0.996 }) {
    const p = Math.max(2, Math.round(RATE / f));
    const line = new Float32Array(p);
    let lp = 0;
    for (let i = 0; i < p; i++) { lp += (this.rand() * 2 - 1 - lp) * bright; line[i] = lp; }
    const s0 = Math.floor(at * RATE), n = Math.floor(len * RATE), out = this.out;
    let k = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const next = (k + 1) % p;
      const v = line[k];
      line[k] = 0.5 * (line[k] + line[next]) * damp;
      out[s0 + i] += v * gain * Math.min(1, (n - i) / (RATE * 0.02));
      k = next;
    }
  }

  /**
   * A tone that glides from `f` to `to`, in a rise and fall: birdsong, an
   * owl, a bubble. `harmonics` adds overtones; `vibrato` wobbles it.
   */
  chirp({ at = 0, len = 0.1, f = 1000, to = f, gain = 0.3, harmonics = [1], vibrato = 0, rateHz = 6, env = 'hump', decay = len / 3 }) {
    const s0 = Math.floor(at * RATE), n = Math.floor(len * RATE), out = this.out;
    let ph = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / RATE;
      const freq = f * (to / f) ** (t / len) * (1 + vibrato * Math.sin(2 * Math.PI * rateHz * t));
      ph += (2 * Math.PI * freq) / RATE;
      let v = 0;
      for (let h = 0; h < harmonics.length; h++) v += Math.sin(ph * (h + 1)) * harmonics[h];
      const e = env === 'strike' ? strike(t, 0.003, decay) : hump(t, len);
      out[s0 + i] += v * gain * e;
    }
  }

  /**
   * Wood rubbing on wood or iron on iron: a door's creak. A train of tiny
   * slips whose rate rises or falls (`r0` to `r1` a second), each one
   * ringing the door's body (`body`: resonances as [f, q, gain]).
   */
  creak({ at = 0, len = 0.4, r0 = 40, r1 = 80, body = [[380, 6, 1], [820, 7, 0.5]], gain = 0.4 }) {
    const n = Math.floor(len * RATE);
    const tmp = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      ph += (r0 + (r1 - r0) * (t / len)) * (1 + this.r(-0.25, 0.25)) / RATE;
      if (ph >= 1) { ph -= 1; tmp[i] = this.r(0.4, 1); }
    }
    const s0 = Math.floor(at * RATE), out = this.out;
    for (const [f, q, g] of body) {
      const flt = new Biquad('bandpass', f, q);
      // A lone click barely rings a narrow band (its peak is about the
      // filter's bandwidth), so each resonance is brought back up to full.
      const ring = 0.5 * (2 * q) / Math.sin((2 * Math.PI * f) / RATE);
      for (let i = 0; i < n && s0 + i < out.length; i++) out[s0 + i] += flt.run(tmp[i]) * g * gain * ring * hump(i / RATE, len) ** 0.5;
    }
  }

  /**
   * A voiced sound: pulses at `f` falling to `to`, through formants (each
   * [f, q, gain]) — a grunt, a frog's croak.
   */
  voice({ at = 0, len = 0.2, f = 140, to = 100, formants = [[600, 4, 1], [1000, 5, 0.5]], gain = 0.3 }) {
    const n = Math.floor(len * RATE);
    const tmp = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      ph += (f * (to / f) ** (t / len)) / RATE;
      if (ph >= 1) ph -= 1;
      tmp[i] = (1 - 2 * ph) * 0.7 + (this.rand() * 2 - 1) * 0.08;
    }
    const s0 = Math.floor(at * RATE), out = this.out;
    for (const [ff, q, g] of formants) {
      const flt = new Biquad('bandpass', ff, q);
      for (let i = 0; i < n && s0 + i < out.length; i++) out[s0 + i] += flt.run(tmp[i]) * g * gain * hump(i / RATE, len) ** 0.6;
    }
  }

  /** Echoes, for a cave or a hall: taps at `times` seconds, each `fb` quieter. */
  echo(times = [0.11, 0.23], fb = 0.35) {
    const out = this.out;
    for (let k = times.length - 1; k >= 0; k--) {
      const d = Math.floor(times[k] * RATE), g = fb ** (k + 1);
      for (let i = out.length - 1; i >= d; i--) out[i] += out[i - d] * g;
    }
  }

  /** Done: no DC, a soft fade at the end, and never past full scale. */
  finish(peak = 0.95) {
    const out = this.out;
    const hp = new Biquad('highpass', 28, 0.7);
    for (let i = 0; i < out.length; i++) out[i] = hp.run(out[i]);
    const fade = Math.min(out.length, Math.floor(0.006 * RATE));
    for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
    let max = 0;
    for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
    if (max > peak) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
    return out;
  }
}

/**
 * A loop with no seam: renders `seconds` plus a crossfade, then folds the
 * extra back over the start so the last sample runs into the first.
 */
export function seamless(seconds, cross, rand, build) {
  const take = new Take(seconds + cross, rand);
  build(take, seconds + cross);
  const raw = take.finish(0.95);
  const n = Math.floor(seconds * RATE), c = Math.floor(cross * RATE);
  const out = raw.slice(0, n);
  for (let i = 0; i < c; i++) {
    const k = i / c;
    out[i] = raw[i] * Math.sqrt(k) + raw[n + i] * Math.sqrt(1 - k);
  }
  return out;
}

// --- Measuring ---------------------------------------------------------------------------------

/**
 * Where a sound's energy sits, in Hz: the spectral centroid, from a plain
 * DFT over the loudest stretch. What "too high" means, as a number — the
 * tests and the in-browser check both use it to show the new sounds are
 * lower than the old ones and that the materials differ.
 */
export function centroid(samples, rate = RATE, size = 2048) {
  // A window no longer than the sound, or the window's own shape decides the answer.
  while (size > 256 && size > samples.length) size >>= 1;
  let best = 0, bestE = -1;
  for (let s = 0; s + size <= Math.max(size, samples.length); s += size >> 1) {
    let e = 0;
    for (let i = 0; i < size; i++) e += (samples[s + i] ?? 0) ** 2;
    if (e > bestE) { bestE = e; best = s; }
  }
  const bins = size >> 1;
  let num = 0, den = 0;
  // A Hann-windowed DFT at a quarter of the bins is plenty for a centroid.
  for (let k = 1; k < bins; k += 2) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * k) / size;
    for (let i = 0; i < size; i++) {
      const v = (samples[best + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
      re += v * Math.cos(w * i); im -= v * Math.sin(w * i);
    }
    const mag = Math.hypot(re, im);
    num += mag * ((k * rate) / size); den += mag;
  }
  return den ? num / den : 0;
}

/** Root-mean-square loudness of a whole sound. */
export function loudness(samples) {
  let e = 0;
  for (let i = 0; i < samples.length; i++) e += samples[i] * samples[i];
  return Math.sqrt(e / Math.max(1, samples.length));
}
