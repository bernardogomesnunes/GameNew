import { ITEMS_BY_ID, stackLimit, isTool, LEGACY_ITEMS } from '../config/items.js';

export const DEFAULT_SLOTS = 40;

/**
 * How many of the player's own slots are the hotbar — real inventory slots,
 * not a summary of them. Reported directly: the hotbar used to auto-build
 * itself from whatever the bag held, one entry per kind — nothing to press,
 * nothing to arrange, and nothing selectable that wasn't a block or one of
 * a handful of hardcoded special items (a bucket, food), so a pickaxe could
 * never actually be selected at all. The first PLAYABLE_SLOTS indices of
 * the player's own Inventory are that hotbar now: what's sitting in slot 0
 * is what number-key 1 selects, same as any classic hotbar, and getting an
 * item there at all is done by hand, from the bag panel, the same lift/tap
 * gesture that already rearranges the rest of the bag — see
 * ui/DuiltUI.js's renderBag and ui/UIManager.js's buildHotbar.
 */
export const PLAYABLE_SLOTS = 9;

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
  constructor({ slots = DEFAULT_SLOTS, bus = null, endless = false } = {}) {
    this.slots = new Array(slots).fill(null);
    this.bus = bus;
    /**
     * A creative bag: one of everything, forever. Reported directly: "in
     * creative mode I can delete items, and food if eaten disappears ... All
     * items should be one, not able to delete, just move." Nothing taken out
     * of an endless bag ever leaves it — eating, placing, a tool wearing out,
     * the bin — and nothing already in it ever piles up a second copy. Moving
     * things round the grid works as always.
     */
    this.endless = endless;
  }

  get size() {
    return this.slots.length;
  }

  grow(to) {
    if (to <= this.slots.length) return;
    while (this.slots.length < to) this.slots.push(null);
    this.changed();
  }

  /**
   * Sets how many slots there are, and returns how many there turned out to be.
   *
   * Growing is free. Shrinking is not allowed to throw anything away — a
   * storehouse stripped back to a shed while it still holds sixty things would
   * otherwise eat them — so what is in it packs forward first and the shelves
   * only come off the end once they are empty. That means a downgraded
   * storehouse stays large until you take things out of it, which is the only
   * honest answer and also closes the obvious cheat: build a warehouse, strip
   * it back to a shed, keep the space. You keep it exactly as long as it has
   * your goods on it.
   */
  resize(to) {
    if (!Number.isInteger(to) || to < 1) return this.slots.length;
    if (to > this.slots.length) { this.grow(to); return this.slots.length; }
    if (to === this.slots.length) return this.slots.length;

    this.compact();
    const used = this.slots.reduce((n, s, i) => (s ? i + 1 : n), 0);
    const size = Math.max(to, used);
    if (size < this.slots.length) {
      this.slots.length = size;
      this.changed();
    }
    return this.slots.length;
  }

  /** Packs everything to the front, keeping the order it was in. */
  compact() {
    const filled = this.slots.filter(Boolean);
    if (filled.length === this.slots.length) return;
    const next = new Array(this.slots.length).fill(null);
    filled.forEach((s, i) => { next[i] = s; });
    if (next.some((s, i) => s !== this.slots[i])) {
      this.slots = next;
      this.changed();
    }
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
    return this.covers(id, amount);
  }

  /** True when every { id: amount } pair in the bill is covered. */
  hasAll(bill) {
    return Object.entries(bill).every(([id, amount]) => this.covers(id, amount));
  }

  /** Whether there's enough of one item — any at all, in an endless bag. */
  covers(id, amount) {
    const n = this.countOf(id);
    return this.endless ? n > 0 || amount <= 0 : n >= amount;
  }

  /** What's missing from a bill, as { id: shortfall }. Empty when it's affordable. */
  missing(bill) {
    const out = {};
    for (const [id, amount] of Object.entries(bill)) {
      if (this.covers(id, amount)) continue;
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
    // An endless bag (a sandbox) takes anything — `add` keeps one of each
    // and calls the rest handed over. Reported directly: "Getting bag is
    // full toast when there's clearly slots in my bag" — making a tool in
    // Creative, where every slot holds one of something and a tool never
    // stacks, counted no room at all.
    if (this.endless) return count;
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
    if (this.endless) {
      if (this.countOf(id)) return 0;
      const i = this.firstEmpty();
      // No slot to show it in: an endless bag still takes it (see roomFor).
      if (i === -1) return 0;
      this.slots[i] = { id, count: 1, wear: 0 };
      this.changed();
      return 0;
    }
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
    if (this.endless) return this.has(id) ? count : 0;
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

  /**
   * Hands one slot's contents to a different container, as far as it will take
   * them, and returns how many moved.
   *
   * `move` above shuffles slots inside one bag; this is the other thing, and
   * they are not the same operation however similar they read. A storehouse is
   * its own Inventory standing in the world, so putting a stack into it is a
   * transfer between two containers — and the one rule that matters is that an
   * item is never in both at once, nor in neither. So the count comes off this
   * slot only for as much as the other side actually accepted.
   */
  moveTo(other, index) {
    if (!other || other === this || !this.inRange(index)) return 0;
    const slot = this.slots[index];
    if (!slot) return 0;
    const leftover = other.add(slot.id, slot.count, { wear: slot.wear });
    const moved = slot.count - leftover;
    if (moved <= 0) return 0;
    if (this.endless) return moved; // handed over, and still here
    slot.count -= moved;
    if (slot.count <= 0) this.slots[index] = null;
    this.changed();
    return moved;
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
    if (this.endless || !slot || slot.count < 2 || isTool(slot.id)) return false;
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

  /**
   * Empties one slot completely and throws away what was in it — the trash
   * icon in the bag. Unlike `remove`, which takes an item by id from wherever
   * it happens to be stacked, this is by slot, because "get rid of the stack
   * I am pointing at" and "get rid of one of these, somewhere" are different
   * requests. Returns what was thrown out, or null if the slot was empty.
   */
  discard(index) {
    if (this.endless || !this.inRange(index)) return null;
    const slot = this.slots[index];
    if (!slot) return null;
    this.slots[index] = null;
    this.changed();
    return { id: slot.id, count: slot.count };
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
    if (max == null || this.endless) return 'ok'; // tools without durability never wear
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
      // An item that was replaced comes back as what replaced it; anything
      // else that no longer exists is dropped rather than carried as a ghost.
      const id = LEGACY_ITEMS[s?.id] ?? s?.id;
      if (s && ITEMS_BY_ID.has(id)) next[i] = { id, count: s.count, wear: s.wear || 0 };
    });
    this.slots = next;
    this.changed();
  }
}
