import { cropOf, cropBlock, CROPS_BY_KIND, STAGE_SECONDS, RIPE } from '../config/crops.js';

/**
 * What's planted, and when. A crop's stage is read off how long it's been in
 * the ground — nothing ticks per plant — so a field keeps growing while
 * you're away or off in another part of the world, and comes up ripe when
 * you get back. Game calls grow() every so often to bring the blocks in
 * line with the clock.
 */
export class Crops {
  constructor() {
    this.planted = new Map(); // "x,y,z" -> { x, y, z, kind, at }
  }

  plant(x, y, z, kind, at = Date.now()) {
    this.planted.set(`${x},${y},${z}`, { x, y, z, kind, at });
  }

  remove(x, y, z) {
    this.planted.delete(`${x},${y},${z}`);
  }

  /** The stage a crop planted at `at` has reached by `now`. */
  static stageAt(at, now) {
    return Math.max(0, Math.min(RIPE, Math.floor((now - at) / 1000 / STAGE_SECONDS)));
  }

  /**
   * Moves every loaded crop on to the stage its time in the ground says.
   * Returns the cells it changed. A crop that isn't there any more (broken
   * some way that didn't say so) is forgotten.
   */
  grow(world, now = Date.now()) {
    const changes = [];
    for (const [key, c] of this.planted) {
      if (!world.hasChunk(c.x >> 4, c.z >> 4)) continue;
      const id = world.getBlock(c.x, c.y, c.z);
      const here = cropOf(id);
      if (!here || here.kind !== c.kind) { this.planted.delete(key); continue; }
      const want = Crops.stageAt(c.at, now);
      if (want <= here.stage) continue;
      const next = cropBlock(c.kind, want);
      world.setBlock(c.x, c.y, c.z, next);
      changes.push({ x: c.x, y: c.y, z: c.z, prev: id, next });
    }
    return changes;
  }

  toJSON() {
    return [...this.planted.values()];
  }

  loadJSON(list) {
    this.planted.clear();
    for (const c of Array.isArray(list) ? list : []) {
      if (CROPS_BY_KIND.has(c?.kind)) this.plant(c.x, c.y, c.z, c.kind, c.at);
    }
  }
}

/**
 * What breaking a crop gives: a ripe one its produce and seeds to plant
 * again; one that isn't ripe yet just its seed back.
 */
export function harvestOf(blockId) {
  const c = cropOf(blockId);
  if (!c) return null;
  if (c.stage < RIPE) return { [`seeds_${c.kind}`]: 1 };
  return { [CROPS_BY_KIND.get(c.kind).produce]: 2, [`seeds_${c.kind}`]: 2 };
}

/** How many crops one farm grows at once (backlog batch 2: "up to 4 crops"). */
export const FARM_SEED_SLOTS = 4;

/**
 * What a farm makes, per cycle (backlog batch 2). It grows whatever seeds
 * were put into it — one seed a crop, up to FARM_SEED_SLOTS — and each
 * gives its crop and its own seeds back: a carrot seed in, carrots and
 * carrot seeds out. Nothing put in, nothing grows. The blocks planted in
 * its soil are yours to pick by hand; they no longer decide this.
 */
export function farmProduce(structure) {
  const out = {};
  for (const kind of structure.seeds ?? []) {
    const c = CROPS_BY_KIND.get(kind);
    if (!c) continue;
    out[c.produce] = (out[c.produce] ?? 0) + 1;
    out[`seeds_${kind}`] = 1;
  }
  return out;
}
