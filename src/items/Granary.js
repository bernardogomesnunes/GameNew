import { Inventory } from './Inventory.js';
import { ITEMS_BY_ID } from '../config/items.js';

/**
 * A granary's store: one slot for each kind of thing it holds, and no limit
 * to how many (asked for directly: "store them efficiently and free the
 * storage rooms. This means a slot per item, that grows", then "all the items
 * produced in a farm ... It should not have a hard limit as these produce a
 * lot").
 *
 * So no stack limits and no empty shelves: a kind comes in, it gets a slot;
 * the last of it goes out, the slot goes too. Only what `accepts` lets in —
 * what farms grow — is taken; anything else is handed back untouched, the
 * same way a full shelf hands it back, so a delivery moves on to the
 * storehouses (StructureRegistry.deliver).
 */
export class Granary extends Inventory {
  constructor({ bus = null, accepts = () => true } = {}) {
    super({ slots: 0, bus });
    this.accepts = accepts;
  }

  roomFor(id, count = 1) {
    return ITEMS_BY_ID.has(id) && this.accepts(id) && count > 0 ? count : 0;
  }

  add(id, count = 1) {
    if (!ITEMS_BY_ID.has(id) || !this.accepts(id) || count <= 0) return count;
    const slot = this.slots.find((s) => s?.id === id);
    if (slot) slot.count += count;
    else this.slots.push({ id, count, wear: 0 });
    this.changed();
    return 0;
  }

  remove(id, count = 1) {
    const taken = super.remove(id, count);
    this.tidy();
    return taken;
  }

  moveTo(other, index) {
    const moved = super.moveTo(other, index);
    this.tidy();
    return moved;
  }

  discard(index) {
    const out = super.discard(index);
    this.tidy();
    return out;
  }

  /** It is as big as what is in it: there are no shelves to add or take off. */
  resize() { return this.slots.length; }

  grow() {}

  /** One slot a kind: halving a stack would make two. */
  split() { return false; }

  /** In order of name; it's already one slot a kind, packed at the front. */
  sortSlots() {
    const name = (id) => ITEMS_BY_ID.get(id)?.name ?? id;
    const before = this.slots.map((s) => s.id).join();
    this.slots.sort((a, b) => name(a.id).localeCompare(name(b.id)));
    if (this.slots.map((s) => s.id).join() === before) return false;
    this.changed();
    return true;
  }

  /** Drops the slot of anything run out. */
  tidy() {
    if (!this.slots.some((s) => !s)) return;
    this.slots = this.slots.filter(Boolean);
    this.changed();
  }

  loadJSON(data) {
    super.loadJSON(data);
    // One slot a kind, whatever the save had.
    const merged = new Map();
    for (const s of this.slots) {
      if (!s) continue;
      const had = merged.get(s.id);
      if (had) had.count += s.count; else merged.set(s.id, { ...s });
    }
    this.slots = [...merged.values()];
  }
}
