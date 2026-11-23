import { hash01 } from '../world/ChunkGen.js';

/**
 * Mushy Logs (PLAY-15, docs/design/play-14-21.md). A pile of logs seeded with
 * one kind of mushroom. Placed, it covers itself in ten game days; breaking
 * it then gives 15 to 25 mushrooms and spends the log.
 *
 * Like Saplings, nothing ticks per log: each remembers the game day it went
 * in, and grow() sets its block to the stage that day count has reached.
 */

export const MUSHY_KINDS = {
  red: { base: 556, item: 'mushroom_red', log: 'mushy_log_red' },
  lilac: { base: 559, item: 'mushroom_lilac', log: 'mushy_log_lilac' },
  pale: { base: 562, item: 'mushroom_pale', log: 'mushy_log_pale' },
};
export const MUSHY_GROW_DAYS = 10;
/** A stage starts on these days. */
export const MUSHY_STAGE_DAYS = [0, 4, 10];
export const MUSHY_MIN = 15, MUSHY_MAX = 25;

/** { kind, stage } for a mushy log block, or null. */
export function mushyOf(blockId) {
  for (const [kind, k] of Object.entries(MUSHY_KINDS)) {
    if (blockId >= k.base && blockId < k.base + MUSHY_STAGE_DAYS.length) return { kind, stage: blockId - k.base };
  }
  return null;
}

/** The yield of the log placed at (x, y, z) on game day `at`, in a world of `seed`: 15 to 25, mean 20. */
export function mushyYield(x, y, z, at, seed) {
  const salt = (seed ^ 0x6d75 ^ Math.imul(y | 0, 0x9e3779b1) ^ Math.floor(at * 1000)) | 0;
  const s = hash01(x, z, salt) + hash01(x, z, salt ^ 0x5bd1); // 0 to 2
  return MUSHY_MIN + Math.round(5 * s);
}

export class MushyLogs {
  constructor() {
    this.planted = new Map(); // "x,y,z" -> { x, y, z, at, kind }
  }

  plant(x, y, z, at, kind) {
    this.planted.set(`${x},${y},${z}`, { x, y, z, at, kind });
  }

  /** Removes the record at (x, y, z) and returns it, or null. */
  take(x, y, z) {
    const key = `${x},${y},${z}`;
    const rec = this.planted.get(key) ?? null;
    this.planted.delete(key);
    return rec;
  }

  get(x, y, z) {
    return this.planted.get(`${x},${y},${z}`) ?? null;
  }

  /** 0, 1 or 2: the stage the log has reached by game day `today`. */
  stageOn(rec, today) {
    const age = today - rec.at;
    let stage = 0;
    for (let i = 0; i < MUSHY_STAGE_DAYS.length; i++) if (age >= MUSHY_STAGE_DAYS[i]) stage = i;
    return stage;
  }

  /** Whole game days before the log at (x, y, z) is ready: 0 once it is. */
  daysLeft(x, y, z, today) {
    const r = this.get(x, y, z);
    if (!r) return null;
    return Math.max(0, Math.ceil(r.at + MUSHY_GROW_DAYS - today));
  }

  /** Brings every loaded log to its stage. Returns the cells it changed, as { x, y, z, prev, next }. */
  grow(world, today) {
    const changes = [];
    for (const [key, r] of this.planted) {
      if (!world.hasChunk(r.x >> 4, r.z >> 4)) continue;
      const k = MUSHY_KINDS[r.kind];
      const here = world.getBlock(r.x, r.y, r.z);
      const now = mushyOf(here);
      if (!k || !now || now.kind !== r.kind) { this.planted.delete(key); continue; }
      const next = k.base + this.stageOn(r, today);
      if (next === here) continue;
      world.setBlock(r.x, r.y, r.z, next);
      changes.push({ x: r.x, y: r.y, z: r.z, prev: here, next });
    }
    return changes;
  }

  toJSON() {
    return [...this.planted.values()].map(({ x, y, z, at, kind }) => ({ x, y, z, at, kind }));
  }

  loadJSON(list) {
    this.planted.clear();
    for (const r of Array.isArray(list) ? list : []) {
      if (Number.isFinite(r?.x) && Number.isFinite(r?.y) && Number.isFinite(r?.z) && Number.isFinite(r?.at) && MUSHY_KINDS[r.kind]) {
        this.plant(r.x, r.y, r.z, r.at, r.kind);
      }
    }
  }
}
