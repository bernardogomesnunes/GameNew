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
    this.planted = new Map(); // "x,y,z" -> { x, y, z, kind, at, farm? }
  }

  /** `farm` is the id of the farm that sowed it, for one it tends itself (see tendFarm). */
  plant(x, y, z, kind, at = Date.now(), farm = null) {
    this.planted.set(`${x},${y},${z}`, { x, y, z, kind, at, ...(farm != null ? { farm } : {}) });
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
      if (CROPS_BY_KIND.has(c?.kind)) this.plant(c.x, c.y, c.z, c.kind, c.at, c.farm ?? null);
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

const FARMLAND = 21, AIR = 0;

/**
 * A farm's crops, out in its soil (backlog batch 3, #13: "A farm's crops grow
 * visibly on its farmland, the same as ones you plant yourself"). Every bare
 * tilled block in it gets one of the crops put into it, taking turns across
 * the field, and they grow like any crop. When the farm pays out, what was
 * ripe is cut and sown again. A crop taken out of the farm comes up out of
 * its soil. Anything you planted there yourself is yours, and left alone.
 * Returns the cells changed. `structure.region`, `.seeds`, `.lastPaidAt`.
 */
export function tendFarm(world, crops, structure, now = Date.now()) {
  const changes = [];
  const set = (x, y, z, next) => {
    const prev = world.getBlock(x, y, z);
    world.setBlock(x, y, z, next);
    changes.push({ x, y, z, prev, next });
  };
  const kinds = (structure.seeds ?? []).filter((k) => CROPS_BY_KIND.has(k));
  // What it sowed before: gone if its crop was taken out, cut and resown if
  // it was ripe when the farm last paid out.
  for (const [key, c] of crops.planted) {
    if (c.farm !== structure.id || !world.hasChunk(c.x >> 4, c.z >> 4)) continue;
    const here = cropOf(world.getBlock(c.x, c.y, c.z));
    if (!here || here.kind !== c.kind) { crops.planted.delete(key); continue; }
    if (!kinds.includes(c.kind)) { set(c.x, c.y, c.z, AIR); crops.planted.delete(key); continue; }
    // Ripe by the time it last paid out, not just sown before then.
    if (here.stage >= RIPE && Crops.stageAt(c.at, structure.lastPaidAt ?? 0) >= RIPE) {
      set(c.x, c.y, c.z, cropBlock(c.kind, 0));
      c.at = now;
    }
  }
  if (!kinds.length) return changes;
  // Bare soil: sown, the crops taking turns cell by cell.
  const r = structure.region;
  let i = 0;
  for (let x = r.minX; x <= r.maxX; x++) {
    for (let z = r.minZ; z <= r.maxZ; z++) {
      if (!world.hasChunk(x >> 4, z >> 4)) continue;
      for (let y = r.minY; y <= r.maxY; y++) {
        if (world.getBlock(x, y, z) !== FARMLAND) continue;
        const kind = kinds[i++ % kinds.length];
        if (world.getBlock(x, y + 1, z) !== AIR) continue;
        set(x, y + 1, z, cropBlock(kind, 0));
        crops.plant(x, y + 1, z, kind, now, structure.id);
      }
    }
  }
  return changes;
}

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
