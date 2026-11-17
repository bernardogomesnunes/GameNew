import { partsFor, isPatterned, COST, FURNITURE } from '../config/furnitureParts.js';
import { itemName } from '../config/items.js';

/**
 * CRAFT3D-1, CRAFT-9: the Carpenter's Table's rules (the block was called the
 * Counter, and keeps the id `counter`). Furniture is made only here: pick a
 * piece, one saw stroke cuts every part (the planks are paid then), fit each
 * of its 4 parts at most onto the outline, carve patterned pieces with the
 * chisel, take it. "Make another" starts the same piece again, and one fit
 * then places every part.
 *
 * Each placed table keeps its own work by its position ("x,y,z"), saved
 * with the world. Nothing here draws or reads the world: render/CounterView.js
 * draws it, and Game says which tables still stand (prune).
 */
/** The save's shape: 2 since a piece has 4 parts at most and one cut. */
const SAVE_VERSION = 2;
const SAW = 'carpentry_saw', CHISEL = 'carpentry_chisel';

export class Counters {
  /**
   * @param bag      () => the Inventory to pay from and give to
   * @param deliver  (payload) => whether a storehouse took it (StructureRegistry.deliver)
   */
  constructor({ bag, deliver = () => false }) {
    this.bag = bag;
    this.deliver = deliver;
    /** key → { item, cut, fitted: boolean[], carved, paid, quick } */
    this.counters = new Map();
    /** key → the piece last finished there, for "Make another". Not saved. */
    this.last = new Map();
  }

  /** What is on the counter at `key`, with `done` worked out, or null. */
  work(key) {
    const w = this.counters.get(key);
    return w ? { ...w, fitted: [...w.fitted], done: this.done(w) } : null;
  }

  done(w) {
    return w.fitted.length > 0 && w.fitted.every(Boolean) && (!isPatterned(w.item) || w.carved);
  }

  /**
   * Starts `itemId` on an empty table. Costs nothing until the cut.
   * `quick` (Make another): one fit places every part.
   */
  choose(key, itemId, { quick = false } = {}) {
    if (!FURNITURE.includes(itemId)) return { ok: false, reason: "That is not made at a Carpenter's Table." };
    const w = this.counters.get(key);
    if (w && (w.paid || w.cut > 0)) return { ok: false, reason: `Finish the ${itemName(w.item).toLowerCase()} first, or break the table.` };
    this.counters.set(key, { item: itemId, cut: 0, fitted: partsFor(itemId).map(() => false), carved: false, paid: false, quick: !!quick });
    return { ok: true };
  }

  /** Puts away a piece that was picked and not yet sawn (nothing was paid). */
  unchoose(key) {
    const w = this.counters.get(key);
    if (!w || w.paid || w.cut > 0) return false;
    this.counters.delete(key);
    return true;
  }

  /** The piece last finished at `key`, or null. */
  lastMade(key) {
    return this.last.get(key) ?? null;
  }

  /** Make another: the piece last finished here again, every part placed by one fit. */
  again(key) {
    const item = this.lastMade(key);
    return item ? this.choose(key, item, { quick: true }) : { ok: false, reason: 'Pick a piece first.' };
  }

  /** Whether the cut can be made, and why not. */
  canCut(key) {
    const w = this.counters.get(key);
    if (!w) return { ok: false, reason: 'Pick a piece first.' };
    if (w.cut >= w.fitted.length) return { ok: false, reason: 'Every part is cut.' };
    return this.ready(w.item, !w.paid);
  }

  /** Whether the bag has the tools (and, before paying, the planks) for `itemId`. */
  ready(itemId, paying = true) {
    const bag = this.bag();
    const tools = [SAW, ...(isPatterned(itemId) ? [CHISEL] : [])].filter((id) => bag.countOf(id) < 1);
    if (tools.length) return { ok: false, reason: `Keep a ${tools.map((id) => itemName(id)).join(' and a ')} in your bag.` };
    if (paying) {
      const missing = Object.entries(bag.missing(COST.get(itemId)));
      if (missing.length) return { ok: false, reason: `Needs ${missing.map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`).join(' and ')}.` };
    }
    return { ok: true };
  }

  /** The one saw stroke: every part comes off, and the planks are paid. */
  cut(key) {
    const can = this.canCut(key);
    if (!can.ok) return can;
    const w = this.counters.get(key);
    if (!w.paid) {
      if (!this.bag().spend(COST.get(w.item))) return { ok: false, reason: 'Your bag changed. Try again.' };
      w.paid = true;
    }
    w.cut = w.fitted.length;
    return { ok: true, parts: w.cut };
  }

  /**
   * Part `part` goes into its place in the outline. Only once the piece is
   * cut. On a piece made again (quick), every part goes in with it.
   */
  fit(key, part) {
    const w = this.counters.get(key);
    if (!w || !Number.isInteger(part) || part < 0 || part >= w.cut) return { ok: false, done: false };
    if (w.quick) w.fitted.fill(true);
    else w.fitted[part] = true;
    return { ok: true, done: this.done(w) };
  }

  /** The first cut part not yet fitted (the one that glows), or -1. */
  next(key) {
    const w = this.counters.get(key);
    return w && w.cut > 0 ? w.fitted.findIndex((f, i) => !f && i < w.cut) : -1;
  }

  /** The chisel's taps on a fitted patterned piece. */
  carve(key) {
    const w = this.counters.get(key);
    if (!w || !isPatterned(w.item)) return { ok: false, reason: 'Only patterned pieces are carved.' };
    if (!w.fitted.every(Boolean)) return { ok: false, reason: 'Fit every part first.' };
    if (this.bag().countOf(CHISEL) < 1) return { ok: false, reason: `Keep a ${itemName(CHISEL)} in your bag.` };
    w.carved = true;
    return { ok: true };
  }

  /** The finished piece to the bag, else a storehouse; it waits on the table if neither has room. */
  take(key) {
    const w = this.counters.get(key);
    if (!w || !this.done(w)) return false;
    const bag = this.bag();
    if (bag.roomFor(w.item, 1) >= 1) bag.add(w.item, 1);
    else if (!this.deliver({ [w.item]: 1 })) return false;
    this.last.set(key, w.item);
    this.counters.delete(key);
    return true;
  }

  /**
   * Tables that no longer stand give back what was not used: a finished
   * piece whole, else the planks for the parts not yet fitted (rounded down).
   */
  prune(stands) {
    for (const key of [...this.last.keys()]) if (!stands(key)) this.last.delete(key);
    for (const [key, w] of [...this.counters]) {
      if (stands(key)) continue;
      const owed = {};
      if (this.done(w)) owed[w.item] = 1;
      else if (w.paid) {
        const left = w.fitted.filter((f) => !f).length / w.fitted.length;
        for (const [id, n] of Object.entries(COST.get(w.item))) {
          const back = Math.floor(n * left);
          if (back > 0) owed[id] = back;
        }
      }
      // What the bag cannot hold goes to a storehouse. With room in neither,
      // it stays owed here and is tried again at the next prune: never lost.
      const bag = this.bag(), rest = {};
      for (const [id, n] of Object.entries(owed)) {
        const fits = Math.min(n, bag.roomFor(id, n));
        if (fits > 0) bag.add(id, fits);
        if (n - fits > 0) rest[id] = n - fits;
      }
      if (Object.keys(rest).length && !this.deliver(rest)) {
        if (this.done(w)) continue;
        // Keep only what is still owed, as a paid piece with nothing to cut.
        this.owed ??= new Map();
        this.owed.set(key, rest);
        this.counters.delete(key);
        continue;
      }
      this.counters.delete(key);
    }
    // Owed from earlier breaks: the bag or a storehouse, when there is room.
    for (const [key, rest] of [...(this.owed ?? [])]) {
      const bag = this.bag(), still = {};
      for (const [id, n] of Object.entries(rest)) {
        const fits = Math.min(n, bag.roomFor(id, n));
        if (fits > 0) bag.add(id, fits);
        if (n - fits > 0) still[id] = n - fits;
      }
      if (!Object.keys(still).length || this.deliver(still)) this.owed.delete(key);
      else this.owed.set(key, still);
    }
  }

  toJSON() {
    return [...this.counters].map(([key, w]) => ({ key, v: SAVE_VERSION, ...w }))
      .concat([...(this.owed ?? [])].map(([key, owed]) => ({ key, owed })));
  }

  loadJSON(list) {
    this.counters.clear();
    this.owed = new Map();
    for (const w of Array.isArray(list) ? list : []) {
      if (typeof w?.key === 'string' && w.owed && typeof w.owed === 'object') {
        const owed = Object.fromEntries(Object.entries(w.owed).filter(([, n]) => Number.isSafeInteger(n) && n > 0));
        if (Object.keys(owed).length) this.owed.set(w.key, owed);
        continue;
      }
      if (typeof w?.key !== 'string' || !FURNITURE.includes(w.item)) continue;
      const n = partsFor(w.item).length;
      if (w.v !== SAVE_VERSION) {
        // A world saved when a piece had up to 8 parts, each with its own cut
        // (CRAFT-9). What was paid is kept. A finished piece stays finished;
        // a half-built one has every part cut and back in the row.
        const old = Array.isArray(w.fitted) ? w.fitted : [];
        const whole = old.length > 0 && old.every(Boolean);
        const begun = !!w.paid || w.cut > 0;
        this.counters.set(w.key, { item: w.item, cut: begun ? n : 0, fitted: Array.from({ length: n }, () => whole),
          carved: whole && !!w.carved, paid: begun, quick: false });
        continue;
      }
      const fitted = Array.from({ length: n }, (_, i) => !!w.fitted?.[i]);
      // One stroke cuts every part: a piece is cut or it is not.
      const cut = w.cut > 0 ? n : 0;
      this.counters.set(w.key, { item: w.item, cut, fitted, carved: !!w.carved, paid: !!w.paid, quick: !!w.quick });
    }
  }
}
