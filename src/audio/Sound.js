/**
 * The game's sounds, made rather than loaded.
 *
 * Requested directly with the controls settings ("sound"), and there was
 * none at all to turn up or down. These are short synthesised effects — a
 * knock for a placed block, a crunch for a broken one, footsteps, a splash —
 * built from noise and tones with the Web Audio API, so there are no files to
 * fetch and nothing to wait for. Each material sounds like itself: stone
 * knocks high and hard, earth thuds low, wood somewhere between, leaves and
 * cloth rustle.
 *
 * Browsers only let audio start from a click or a key, so nothing is made
 * until the first one (`unlock`). Everything goes through one gain node, the
 * volume the settings control.
 */

/** How each material sounds: a filtered noise burst and an optional knock. */
const VOICES = {
  stone: { noise: 2600, q: 1.2, knock: 180, decay: 0.09 },
  wood: { noise: 1400, q: 1.6, knock: 120, decay: 0.12 },
  dirt: { noise: 700, q: 0.8, knock: 70, decay: 0.14 },
  plant: { noise: 3800, q: 0.6, knock: null, decay: 0.1 },
  glass: { noise: 5200, q: 4, knock: 900, decay: 0.08 },
};
const STEP_EVERY = 0.55; // blocks walked between footsteps

export class Sound {
  constructor({ volume = 0.7 } = {}) {
    this.volume = volume;
    this.ctx = null;
    this.out = null;
    this.walked = 0;
  }

  /** Starts audio. Call from a real user gesture — a click or a key. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.volume;
    this.out.connect(this.ctx.destination);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out) this.out.gain.value = this.volume;
  }

  get ready() {
    return !!this.ctx && this.volume > 0;
  }

  /** A short burst of filtered noise, and a pitched knock under it. */
  hit(material, { gain = 0.5, pitch = 1, length = 1 } = {}) {
    if (!this.ready) return;
    const v = VOICES[material] ?? VOICES.dirt;
    const t = this.ctx.currentTime;
    const decay = v.decay * length;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = v.noise * pitch;
    filter.Q.value = v.q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(filter).connect(env).connect(this.out);
    src.start(t, Math.random() * 0.3);
    src.stop(t + decay + 0.02);

    if (v.knock) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(v.knock * pitch * 1.6, t);
      osc.frequency.exponentialRampToValueAtTime(v.knock * pitch, t + decay * 0.6);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(gain * 0.6, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.8);
      osc.connect(og).connect(this.out);
      osc.start(t);
      osc.stop(t + decay);
    }
  }

  place(material) { this.hit(material, { gain: 0.45, pitch: 1 }); }
  break(material) { this.hit(material, { gain: 0.55, pitch: 0.8, length: 1.6 }); }

  /** A step on whatever is underfoot, every so often as you walk. */
  walk(distance, material) {
    this.walked += distance;
    if (this.walked < STEP_EVERY) return;
    this.walked = 0;
    this.hit(material, { gain: 0.14, pitch: 0.9 + Math.random() * 0.2, length: 0.7 });
  }

  splash() {
    if (!this.ready) return;
    this.hit('plant', { gain: 0.35, pitch: 0.35, length: 3 });
  }

  /** A door or a gate swinging. */
  creak(open) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(open ? 190 : 150, t);
    osc.frequency.linearRampToValueAtTime(open ? 150 : 110, t + 0.18);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(f).connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.24);
    this.hit('wood', { gain: 0.3, pitch: open ? 1.1 : 0.9 });
  }

  eat() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) setTimeout(() => this.hit('plant', { gain: 0.25, pitch: 0.5, length: 0.8 }), i * 110);
  }

  /** A soft tick for buttons. */
  click() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 880;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

/** What a block sounds like, from its material. */
export function soundOf(block) {
  if (!block) return 'dirt';
  if (block.transparent && !block.material) return 'glass';
  return block.material ?? 'stone';
}
