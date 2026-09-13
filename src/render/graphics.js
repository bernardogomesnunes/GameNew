/**
 * Graphics settings, and the controller that picks them when you don't.
 *
 * Every machine draws this differently, and the artifacts that matter — edges
 * that crawl, surfaces that trade places in the distance — are the ones a
 * screenshot cannot show and a test on one GPU cannot find. So rather than
 * guess at hardware that isn't here, the settings are exposed: someone seeing
 * a problem can change one thing at a time and say which one stopped it.
 *
 * Everything defaults to Auto, which is the adaptive behaviour: start at full
 * quality, measure the frame time, and give up resolution only if the device
 * genuinely cannot keep up. An explicit choice switches the controller off for
 * that setting and is remembered.
 */

const KEY = 'voxelgame:graphics';

/** Resolutions the automatic controller may settle on, lowest first. */
export const QUALITY_STEPS = [1, 1.25, 1.5, 2];

export const DEFAULTS = {
  resolution: 'auto',     // 'auto' | 1 | 1.25 | 1.5 | 2
  antialias: true,
  distance: 'auto',       // 'auto' | 'near' | 'far'
  smoothing: true,        // the adaptive controller; off pins the resolution
};

export const DISTANCES = {
  near: { fogFar: 120 },
  auto: null,             // decided by the device
  far: { fogFar: 260 },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch { /* a browser with storage blocked still gets to play */ }
}

/**
 * Trades resolution for frame rate while you play.
 *
 * Phones used to be handed a fixed half-resolution buffer on the assumption
 * that a phone is slow. A recent phone is not, and the assumption cost it a
 * crawling picture for nothing. So start high and measure.
 *
 * The gap between the two thresholds is what stops it oscillating: a machine
 * sitting exactly on the boundary settles at one step rather than flipping
 * between two, which would be its own kind of flicker.
 */
export class QualityController {
  constructor({ cap = 2, onChange }) {
    this.cap = cap;
    this.onChange = onChange;
    this.steps = QUALITY_STEPS.filter((q) => q <= cap);
    if (!this.steps.length) this.steps = [1];
    this.index = this.steps.length - 1;
    this.frameMs = null;
    this.lastChange = 0;
    this.enabled = true;
  }

  get resolution() {
    return this.steps[this.index];
  }

  /** Pins the resolution and stops adapting. Pass null to hand control back. */
  pin(resolution) {
    if (resolution == null) { this.enabled = true; return this.resolution; }
    this.enabled = false;
    const closest = this.steps.reduce((a, b) =>
      Math.abs(b - resolution) < Math.abs(a - resolution) ? b : a, this.steps[0]);
    this.index = this.steps.indexOf(closest);
    return this.resolution;
  }

  /** Call once a frame. Returns a new resolution when it decides to change. */
  tick(dtSeconds, now = performance.now()) {
    const ms = dtSeconds * 1000;
    this.frameMs = this.frameMs == null ? ms : this.frameMs * 0.94 + ms * 0.06;
    if (!this.enabled || this.steps.length < 2) return null;
    if (now - this.lastChange < 2500) return null;

    let next = this.index;
    if (this.frameMs > 26 && this.index > 0) next = this.index - 1;            // below ~38fps
    else if (this.frameMs < 15 && this.index < this.steps.length - 1) next = this.index + 1;
    if (next === this.index) return null;

    this.index = next;
    this.lastChange = now;
    this.onChange?.(this.resolution);
    return this.resolution;
  }

  get fps() {
    return this.frameMs ? Math.round(1000 / this.frameMs) : null;
  }
}
