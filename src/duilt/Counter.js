import { partsFor, isPatterned, COST, FURNITURE } from '../config/furnitureParts.js';
import { itemName } from '../config/items.js';

/**
 * CRAFT3D-1: the carpentry counter's rules. Furniture is made only here:
 * pick a piece, saw a plank into its parts (paid at the first cut), fit every
 * part onto the outline, carve patterned pieces with the chisel, take it.
 *
 * Each placed counter keeps its own work by its position ("x,y,z"), saved
 * with the world. Nothing here draws or reads the world: render/CounterView.js
 * draws it, and Game says which counters still stand (prune).
 */
const SAW = 'carpentry_saw', CHISEL = 'carpentry_chisel';

export class Counters {
  /**
   * @param bag      () => the Inventory to pay from and give to
   * @param deliver  (payload) => whether a storehouse took it (StructureRegistry.deliver)
   */
  constructor({ bag, deliver = () => false }) {
    this.bag = bag;
    this.deliver = deliver;
    /** key → { item, cut, fitted: boolean[], carved, paid } */
    this.counters = new Map();
  }

  /** What is on the counter at `key`, with `done` worked out, or null. */
  work(key) {
    const w = this.counters.get(key);
    return w ? { ...w, fitted: [...w.fitted], done: this.done(w) } : null;
  }

  done(w) {
    return w.fitted.length > 0 && w.fitted.every(Boolean) && (!isPatterned(w.item) || w.carved);
  }

  /** Starts `itemId` on an empty counter. Costs nothing until the first cut. */
  choose(key, itemId) {
    if (!FURNITURE.includes(itemId)) return { ok: false, reason: 'That is not made at a counter.' };
    const w = this.counters.get(key);
    if (w && (w.paid || w.cut > 0)) return { ok: false, reason: `Finish the ${itemName(w.item).toLowerCase()} first, or break the counter.` };
    this.counters.set(key, { item: itemId, cut: 0, fitted: partsFor(itemId).map(() => false), carved: false, paid: false });
    return { ok: true };
  }

  /** Whether the next cut can be made, and why not. */
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

  /** One saw cut: the next part comes off. The planks are paid at the first. */
  cut(key) {
    const can = this.canCut(key);
    if (!can.ok) return can;
    const w = this.counters.get(key);
    if (!w.paid) {
      if (!this.bag().spend(COST.get(w.item))) return { ok: false, reason: 'Your bag changed. Try again.' };
      w.paid = true;
    }
    return { ok: true, part: w.cut++ };
  }

  /** Part `part` goes into its place in the outline. Only parts already cut. */
  fit(key, part) {
    const w = this.counters.get(key);
    if (!w || !Number.isInteger(part) || part < 0 || part >= w.cut) return { ok: false, done: false };
    w.fitted[part] = true;
    return { ok: true, done: this.done(w) };
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

  /** The finished piece to the bag, else a storehouse; it waits on the counter if neither has room. */
  take(key) {
    const w = this.counters.get(key);
    if (!w || !this.done(w)) return false;
    const bag = this.bag();
    if (bag.roomFor(w.item, 1) >= 1) bag.add(w.item, 1);
    else if (!this.deliver({ [w.item]: 1 })) return false;
    this.counters.delete(key);
    return true;
  }

  /**
   * Counters that no longer stand give back what was not used: a finished
   * piece whole, else the planks for the parts not yet fitted (rounded down).
   */
  prune(stands) {
    for (const [key, w] of [...this.counters]) {
      if (stands(key)) continue;
      const bag = this.bag();
      if (this.done(w)) bag.add(w.item, 1);
      else if (w.paid) {
        const left = w.fitted.filter((f) => !f).length / w.fitted.length;
        for (const [id, n] of Object.entries(COST.get(w.item))) {
          const back = Math.floor(n * left);
          if (back > 0) bag.add(id, back);
        }
      }
      this.counters.delete(key);
    }
  }

  toJSON() {
    return [...this.counters].map(([key, w]) => ({ key, ...w }));
  }

  loadJSON(list) {
    this.counters.clear();
    for (const w of Array.isArray(list) ? list : []) {
      if (typeof w?.key !== 'string' || !FURNITURE.includes(w.item)) continue;
      const n = partsFor(w.item).length;
      const fitted = Array.from({ length: n }, (_, i) => !!w.fitted?.[i]);
      const cut = Math.min(n, Math.max(0, Number.isSafeInteger(w.cut) ? w.cut : 0));
      this.counters.set(w.key, { item: w.item, cut, fitted, carved: !!w.carved, paid: !!w.paid });
    }
  }
}
