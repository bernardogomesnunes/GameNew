import {
  FRUIT_PLANTS_BY_KIND, POT_BLOCK, GROWN, YOUNG_AT, GROWN_AT, REGROW_MIN, REGROW_MAX,
  plantBlock, plantOf, isRipeSegment, ripeOf,
} from '../config/fruitPlants.js';

/**
 * Fruit plants in pots (FRUIT-4, config/fruitPlants.js). Like Saplings,
 * nothing ticks per plant: each remembers the game day it was sown, and
 * grow() sets its blocks to the look that day count has reached.
 *
 * A record is keyed by the plant's base cell, the one just above the pot:
 *   { x, y, z, kind, at, pickedAt?, regrow? }
 * `at` is the game day it was sown. After a pick, `pickedAt` is that day and
 * `regrow` the days (1 or 2) until it bears again.
 */
export class FruitPlants {
  constructor() {
    this.planted = new Map(); // "x,y,z" -> record
  }

  plant(x, y, z, kind, at) {
    this.planted.set(`${x},${y},${z}`, { x, y, z, kind, at });
  }

  get(x, y, z) {
    return this.planted.get(`${x},${y},${z}`) ?? null;
  }

  /** Removes the record at (x, y, z) and returns it, or null. */
  take(x, y, z) {
    const key = `${x},${y},${z}`;
    const rec = this.planted.get(key) ?? null;
    this.planted.delete(key);
    return rec;
  }

  /** The base cell of the plant that has a block at (x, y, z), or null. */
  baseOf(world, x, y, z) {
    let by = y;
    while (plantOf(world.getBlock(x, by - 1, z))) by--;
    return plantOf(world.getBlock(x, by, z)) ? { x, y: by, z } : null;
  }

  /** 'sprout', 'young' or 'grown': how far along it is on game day `today`. */
  stageOn(rec, today) {
    const days = FRUIT_PLANTS_BY_KIND.get(rec.kind).days;
    const age = today - rec.at;
    return age < days * YOUNG_AT ? 'sprout' : age < days * GROWN_AT ? 'young' : 'grown';
  }

  /** True when a grown plant carries fruit on game day `today`. */
  ripeOn(rec, today) {
    const days = FRUIT_PLANTS_BY_KIND.get(rec.kind).days;
    if (rec.pickedAt != null) return today - rec.pickedAt >= (rec.regrow ?? REGROW_MAX);
    return today - rec.at >= days;
  }

  /** Whole game days before the plant is next ripe: 0 once it is. */
  daysLeft(rec, today) {
    const days = FRUIT_PLANTS_BY_KIND.get(rec.kind).days;
    const due = rec.pickedAt != null ? rec.pickedAt + (rec.regrow ?? REGROW_MAX) : rec.at + days;
    return Math.max(0, Math.ceil(due - today));
  }

  /** Marks the plant picked on `today`; it bears again after `regrow` days (1 to 2). */
  markPicked(rec, today, rand = Math.random) {
    rec.pickedAt = today;
    rec.regrow = REGROW_MIN + Math.floor(rand() * (REGROW_MAX - REGROW_MIN + 1));
  }

  /** The blocks the plant should be, bottom to top: [{ dy, id }]. */
  wanted(rec, today) {
    const stage = this.stageOn(rec, today);
    if (stage === 'sprout') return [{ dy: 0, id: plantBlock(rec.kind, 'sprout') }];
    if (stage === 'young') return [{ dy: 0, id: plantBlock(rec.kind, 'young') }];
    const ripe = this.ripeOn(rec, today);
    return GROWN.map((seg, dy) => ({ dy, id: plantBlock(rec.kind, ripe ? ripeOf(seg) : seg) }));
  }

  /**
   * Brings every loaded plant to the look its days say. Returns the cells it
   * changed as { x, y, z, prev, next }. A plant whose pot is gone, or whose
   * base is no longer its own, is forgotten. A grown plant with no room above
   * it waits as a young one (`blocked`).
   */
  grow(world, today) {
    const changes = [];
    for (const [key, r] of this.planted) {
      if (!world.hasChunk(r.x >> 4, r.z >> 4)) continue;
      const here = plantOf(world.getBlock(r.x, r.y, r.z));
      if (!here || here.kind !== r.kind || world.getBlock(r.x, r.y - 1, r.z) !== POT_BLOCK) { this.planted.delete(key); continue; }
      let want = this.wanted(r, today);
      const room = want.every(({ dy }) => {
        const id = world.getBlock(r.x, r.y + dy, r.z);
        return id === 0 || plantOf(id)?.kind === r.kind;
      }) && world.inBounds(r.x, r.y + want.length - 1, r.z);
      r.blocked = !room;
      if (!room) want = [{ dy: 0, id: plantBlock(r.kind, 'young') }];
      for (const { dy, id } of want) {
        const prev = world.getBlock(r.x, r.y + dy, r.z);
        if (prev === id) continue;
        world.setBlock(r.x, r.y + dy, r.z, id);
        changes.push({ x: r.x, y: r.y + dy, z: r.z, prev, next: id });
      }
    }
    return changes;
  }

  toJSON() {
    return [...this.planted.values()].map(({ x, y, z, kind, at, pickedAt, regrow }) => ({
      x, y, z, kind, at, ...(pickedAt != null ? { pickedAt, regrow } : {}),
    }));
  }

  loadJSON(list) {
    this.planted.clear();
    for (const r of Array.isArray(list) ? list : []) {
      if (!Number.isFinite(r?.x) || !Number.isFinite(r?.y) || !Number.isFinite(r?.z) || !Number.isFinite(r?.at) || !FRUIT_PLANTS_BY_KIND.has(r.kind)) continue;
      this.plant(r.x, r.y, r.z, r.kind, r.at);
      if (Number.isFinite(r.pickedAt)) { const rec = this.get(r.x, r.y, r.z); rec.pickedAt = r.pickedAt; rec.regrow = r.regrow; }
    }
  }
}

export { plantOf, isRipeSegment };
