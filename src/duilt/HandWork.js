import { SETTLERS } from '../config/settlers.js';

/**
 * WORK-2: working a building yourself, before villagers come.
 *
 * Four small games, one per kind of building: chop wood at a forest, chip
 * stone at a quarry, pick ore at a mine, hoe a farm. Each is a marker that
 * sweeps a bar; tap in the lit window to land a swing. A round is SWINGS
 * swings, and each landed swing makes one item of what the building makes
 * (picked in the building's own proportions: wood 6 to leaves 1 to fruit 1
 * at a forest). The building then rests.
 *
 * The rest is what keeps it fair: it lasts as long as a worker, with their
 * bonus, would take to make the same number of swings' worth of items. The
 * forest is the exception on yield: each round gives at least 5 logs. Hand work is never
 * faster than a villager at that building, and it is refused while a
 * villager works there.
 */
export const SWINGS = 3;
/** Shortest rest after a round, in seconds, even for a round with no hit. */
export const MIN_REST = 5;

/** Each game: the building it works, its verb, how fast the marker moves (bar lengths a second) and how wide the window is (share of the bar). */
export const HAND_GAMES = {
  // Owner, 27 November: "Each one should give at least 5 logs." A round with
  // a hit gives 2 logs a hit, never fewer than 5, on top of any leaves or fruit.
  forest: { id: 'wood', verb: 'Chop', title: 'Chop wood', tool: 'axe', speed: 0.8, width: 0.24, hint: 'Tap Chop when the marker is in the lit notch.', logs: { perHit: 2, min: 5 } },
  quarry: { id: 'quarry', verb: 'Chip', title: 'Chip stone', tool: 'pickaxe', speed: 0.95, width: 0.2, hint: 'Tap Chip when the marker is on the crack.' },
  mine: { id: 'mine', verb: 'Pick', title: 'Pick ore', tool: 'pickaxe', speed: 1.05, width: 0.18, hint: 'Tap Pick when the marker is on the seam.' },
  farm: { id: 'farm', verb: 'Hoe', title: 'Work the soil', tool: 'hoe', speed: 0.7, width: 0.26, hint: 'Tap Hoe when the marker is over the row.' },
};

/** The game for a building type, or null when it has none. */
export const gameFor = (type) => HAND_GAMES[type] ?? null;

/** Where the marker is on the bar (0 to 1) `t` seconds in: it sweeps there and back. */
export function markerAt(t, speed) {
  const p = (((t * speed) % 2) + 2) % 2;
  return p <= 1 ? p : 2 - p;
}

/** A fresh window centre for a swing, kept inside the bar. `rand` gives 0 to 1. */
export function nextTarget(width, rand = Math.random) {
  return width / 2 + rand() * (1 - width);
}

/** Whether a tap with the marker at `pos` lands in the window around `target`. */
export const landed = (pos, target, width) => Math.abs(pos - target) <= width / 2;

/**
 * The state of everyone's hand work: how long each building rests, and the
 * weighted pick that decides which item a landed swing makes.
 *
 * `produces(s)` the goods table one cycle of building `s` makes now ({} for
 * none), `cycleSeconds(s)` how many real seconds that cycle takes,
 * `staffed(s)` whether a villager works there, `deliver(payload)` puts goods
 * in a store or the bag and says whether they fit.
 */
export class HandWork {
  constructor({ produces, cycleSeconds, staffed = () => false, deliver }) {
    Object.assign(this, { produces, cycleSeconds, staffed, deliver });
    /** structure id -> { left: seconds of rest, credit: { item: n } } */
    this.state = new Map();
  }

  /** Seconds a worker would take for one item at `s`, bonus counted. */
  secondsPerItem(s) {
    const total = Object.values(this.produces(s)).reduce((n, v) => n + v, 0);
    if (!(total > 0)) return Infinity;
    return this.cycleSeconds(s) / (total * (1 + SETTLERS.workBonus));
  }

  left(s) {
    return Math.ceil(this.state.get(s.id)?.left ?? 0);
  }

  /** { ok, reason, left, game } whether `s` can be worked by hand now. */
  status(s) {
    const game = gameFor(s?.type);
    if (!game || !s.valid) return { ok: false, reason: 'Nothing to work by hand here.', game: null };
    if (this.staffed(s)) return { ok: false, reason: 'A villager works here.', game };
    if (!Object.keys(this.produces(s)).length) return { ok: false, reason: s.type === 'farm' ? 'Sow a seed in the farm first.' : 'It makes nothing yet.', game };
    const left = this.left(s);
    if (left > 0) return { ok: false, reason: 'Resting.', left, game };
    return { ok: true, left: 0, game };
  }

  /**
   * A round is done with `hits` landed swings (0 to SWINGS). Makes that many
   * items and starts the rest. Returns { ok, made, left } or { ok:false, reason }.
   */
  finish(s, hits) {
    const st = this.status(s);
    if (!st.ok) return { ok: false, reason: st.reason };
    const n = Math.max(0, Math.min(SWINGS, Math.floor(hits) || 0));
    const table = this.produces(s);
    const entry = this.state.get(s.id) ?? { left: 0, credit: {} };
    const total = Object.values(table).reduce((t, v) => t + v, 0);
    const credit = { ...entry.credit };
    const made = {};
    for (let i = 0; i < n; i++) {
      for (const [id, v] of Object.entries(table)) credit[id] = (credit[id] ?? 0) + v;
      const pick = Object.keys(table).reduce((a, b) => (credit[b] > credit[a] ? b : a));
      credit[pick] -= total;
      made[pick] = (made[pick] ?? 0) + 1;
    }
    const logs = gameFor(s.type)?.logs;
    if (logs && n > 0) {
      // The log is whatever the forest grows most of: oak, white or dark wood.
      const log = Object.keys(table).reduce((a, b) => (table[b] > table[a] ? b : a));
      made[log] = Math.max(logs.min, logs.perHit * n);
    }
    if (n > 0 && !this.deliver(made)) return { ok: false, reason: 'No room for it in your bag or a storehouse.' };
    const left = Math.max(MIN_REST, Math.round(n * this.secondsPerItem(s)));
    this.state.set(s.id, { left, credit });
    return { ok: true, made, left };
  }

  tick(dt) {
    if (!(dt > 0)) return;
    for (const [id, e] of this.state) if (e.left > 0) e.left = Math.max(0, e.left - dt);
  }

  /** Forget buildings that are gone (`alive(id)`). */
  prune(alive) {
    for (const id of [...this.state.keys()]) if (!alive(id)) this.state.delete(id);
  }

  toJSON() {
    return [...this.state].map(([id, e]) => ({ id, left: Math.round(e.left), credit: { ...e.credit } }));
  }

  loadJSON(list) {
    this.state.clear();
    for (const e of Array.isArray(list) ? list : []) {
      if (!Number.isSafeInteger(e?.id) || !Number.isFinite(e.left)) continue;
      const credit = {};
      for (const [k, v] of Object.entries(e.credit ?? {})) if (Number.isFinite(v)) credit[k] = v;
      this.state.set(e.id, { left: Math.max(0, Math.min(e.left, 3600)), credit });
    }
  }
}
