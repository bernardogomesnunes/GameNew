import { ITEMS_BY_ID, stackLimit, isTool } from '../config/items.js';

export const DEFAULT_SLOTS = 40;

/**
 * The player's bag: a fixed run of slots, each holding one kind of item.
 *
 * This replaces the old resource wallet. The wallet knew you had 340 wood and
 * nothing else; slots let you hold a half-worn axe next to a stack of dirt,
 * which is the difference between a building game and a crafting one.
 *
 * Stack limits come from the item, never from here — see config/items.js for
 * why a uniform limit is wrong.
 *
 * A slot is either null or { id, count, wear }. `wear` is only meaningful for
 * tools and counts uses spent, so a fresh tool is 0.
 */
export class Inventory {
  constructor({ slots = DEFAULT_SLOTS, bus = null } = {}) {
    this.slots = new Array(slots).fill(null);
    this.bus = bus;
  }

  get size() {
    return this.slots.length;
  }

  /** Storage buildings widen the bag; nothing ever narrows it while items are in it. */
  grow(to) {
    while (this.slots.length < to) this.slots.push(null);
    this.changed();
  }

  changed() {
    this.bus?.emit('inventory:change', {});
  }

  // ---- reading ----

  /** Total of one item across every slot. */
  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  has(id, amount = 1) {
    return this.countOf(id) >= amount;
  }

  /** True when every { id: amount } pair in the bill is covered. */
  hasAll(bill) {
    return Object.entries(bill).every(([id, amount]) => this.countOf(id) >= amount);
  }

  /** What's missing from a bill, as { id: shortfall }. Empty when it's affordable. */
  missing(bill) {
    const out = {};
    for (const [id, amount] of Object.entries(bill)) {
      const short = amount - this.countOf(id);
      if (short > 0) out[id] = short;
    }
    return out;
  }

  firstEmpty() {
    return this.slots.indexOf(null);
  }

  /**
   * How many of an item would actually fit right now, without putting any in.
   *
   * `add` already reports what would not fit — but only after the fact, which
   * is no use to a button that has to say whether it can do the thing *before*
   * you press it. A full bag with dirt still in it made the bench offer "Turn
   * soil" as if it were fine: you pressed Make, the craft paid, found nowhere
   * to put the soil, handed your dirt back, and all you got was a message. So
   * anything that produces an item asks here first.
   */
  roomFor(id, count = 1) {
    if (!ITEMS_BY_ID.has(id) || count <= 0) return 0;
    const limit = stackLimit(id);
    let room = 0;
    for (const slot of this.slots) {
      if (!slot) room += limit;
      // Tools never merge into an existing stack — see `add`.
      else if (!isTool(id) && slot.id === id) room += Math.max(0, limit - slot.count);
      if (room >= count) return count;
    }
    return room;
  }

  /** Distinct item ids held, in slot order — what the hotbar draws from. */
  heldIds() {
    const seen = [];
    for (const s of this.slots) if (s && !seen.includes(s.id)) seen.push(s.id);
    return seen;
  }

  // ---- writing ----

  /**
   * Adds items, topping up existing stacks before opening new slots.
   * Returns how many did NOT fit, so callers can refuse a pickup rather than
   * silently destroying it.
   */
  add(id, count = 1, { wear = 0 } = {}) {
    if (!ITEMS_BY_ID.has(id) || count <= 0) return count;
    const limit = stackLimit(id);
    let left = count;

    // Tools never merge — each one carries its own wear.
    if (!isTool(id)) {
      for (const slot of this.slots) {
        if (left <= 0) break;
        if (!slot || slot.id !== id || slot.count >= limit) continue;
        const room = limit - slot.count;
        const move = Math.min(room, left);
        slot.count += move;
        left -= move;
      }
    }

    while (left > 0) {
      const i = this.firstEmpty();
      if (i === -1) break; // bag full; the remainder is reported, not dropped
      const move = Math.min(limit, left);
      this.slots[i] = { id, count: move, wear };
      left -= move;
    }

    if (left !== count) this.changed();
    return left;
  }

  /**
   * Removes up to `count`, latest slots first so partial stacks are consumed
   * before full ones. Returns how many were actually taken.
   */
  remove(id, count = 1) {
    let left = count;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const slot = this.slots[i];
      if (!slot || slot.id !== id) continue;
      const take = Math.min(slot.count, left);
      slot.count -= take;
      left -= take;
      if (slot.count <= 0) this.slots[i] = null;
    }
    const taken = count - left;
    if (taken > 0) this.changed();
    return taken;
  }

  /**
   * Pays a whole bill or none of it. Building costs must not half-charge when
   * the bag turns out to be short.
   */
  spend(bill) {
    if (!this.hasAll(bill)) return false;
    for (const [id, amount] of Object.entries(bill)) this.remove(id, amount);
    return true;
  }

  /** Puts a bill back — the refund half of the same transaction. */
  refund(bill) {
    for (const [id, amount] of Object.entries(bill)) this.add(id, amount);
  }

  // ---- moving things around the grid ----

  /**
   * Drops the contents of one slot onto another: merges when they match and
   * there is room, swaps otherwise. Both are what a player expects, and
   * guessing wrong is the fastest way to lose someone's items.
   */
  move(from, to) {
    if (from === to || !this.inRange(from) || !this.inRange(to)) return false;
    const a = this.slots[from];
    if (!a) return false;
    const b = this.slots[to];

    if (b && b.id === a.id && !isTool(a.id)) {
      const limit = stackLimit(a.id);
      const room = limit - b.count;
      if (room <= 0) { this.swap(from, to); return true; }
      const move = Math.min(room, a.count);
      b.count += move;
      a.count -= move;
      if (a.count <= 0) this.slots[from] = null;
      this.changed();
      return true;
    }

    this.swap(from, to);
    return true;
  }

  swap(from, to) {
    const t = this.slots[to];
    this.slots[to] = this.slots[from];
    this.slots[from] = t;
    this.changed();
  }

  /** Halves a stack into the first free slot — long-press on touch, right-click on desktop. */
  split(from) {
    if (!this.inRange(from)) return false;
    const slot = this.slots[from];
    if (!slot || slot.count < 2 || isTool(slot.id)) return false;
    const target = this.firstEmpty();
    if (target === -1) return false;
    const half = Math.floor(slot.count / 2);
    slot.count -= half;
    this.slots[target] = { id: slot.id, count: half, wear: 0 };
    this.changed();
    return true;
  }

  inRange(i) {
    return Number.isInteger(i) && i >= 0 && i < this.slots.length;
  }

  // ---- tools ----

  /** First usable tool of a kind, or null. */
  findTool(id) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.id === id) return { index: i, slot: s };
    }
    return null;
  }

  /**
   * Spends one use of a tool. Returns 'worn' when it breaks on this use, so the
   * caller can say so rather than letting it vanish silently.
   */
  useTool(id, amount = 1) {
    const found = this.findTool(id);
    if (!found) return 'missing';
    const max = ITEMS_BY_ID.get(id)?.durability;
    if (max == null) return 'ok'; // tools without durability never wear
    found.slot.wear += amount;
    if (found.slot.wear >= max) {
      this.slots[found.index] = null;
      this.changed();
      return 'worn';
    }
    this.changed();
    return 'ok';
  }

  /** Restores a tool to new — the whetstone's job. */
  repair(index) {
    const slot = this.slots[index];
    if (!slot || !isTool(slot.id)) return false;
    slot.wear = 0;
    this.changed();
    return true;
  }

  // ---- persistence ----

  toJSON() {
    return { slots: this.slots.map((s) => (s ? { id: s.id, count: s.count, wear: s.wear || 0 } : null)) };
  }

  loadJSON(data) {
    if (!data?.slots) return;
    const next = new Array(Math.max(this.slots.length, data.slots.length)).fill(null);
    data.slots.forEach((s, i) => {
      // Drop anything whose item no longer exists rather than carrying a ghost.
      if (s && ITEMS_BY_ID.has(s.id)) next[i] = { id: s.id, count: s.count, wear: s.wear || 0 };
    });
    this.slots = next;
    this.changed();
  }
}
