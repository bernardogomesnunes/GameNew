/**
 * Bare dirt turns to turf (asked for directly: "If I place a block of turf
 * next to dirt both exposed like top blocks, dirt should become turf after
 * some random time never smaller than 5 days but it can take as long as 50
 * days. This way a patch of turf next to some exposed dirt will do the job").
 *
 * Like saplings, nothing ticks per block: a dirt block that could take turf
 * — open to the sky, with turf beside it (a block up or down counts) — is
 * given a day for it, somewhere 5 to 50 game days on, and spread() turns the
 * ones whose day has come. Each one that turns gives its own dirt
 * neighbours their day in turn, so a lawn creeps outward from one patch.
 * Game days are the world's own clock (DuiltGame.days), as for saplings.
 */

export const GRASS = 1, DIRT = 2;
export const MIN_DAYS = 5, MAX_DAYS = 50;
const AIR = 0;

export class TurfSpread {
  constructor({ rand = Math.random } = {}) {
    this.rand = rand;
    this.due = new Map(); // "x,y,z" -> { x, y, z, at }
  }

  /** Dirt here could take turf now: open above, with turf beside it. */
  canTake(world, x, y, z) {
    if (world.getBlock(x, y, z) !== DIRT) return false;
    if (world.getBlock(x, y + 1, z) !== AIR) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if ((dx || dz) && world.getBlock(x + dx, y + dy, z + dz) === GRASS) return true;
        }
      }
    }
    return false;
  }

  /**
   * Looks again at the dirt round a changed block: anything that can now
   * take turf gets its day, if it hasn't one already. `skip(x, y, z)` keeps
   * some cells bare (a claimed building's).
   */
  consider(world, x, y, z, today, skip = null) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = x + dx, cy = y + dy, cz = z + dz, key = `${cx},${cy},${cz}`;
          if (this.due.has(key) || skip?.(cx, cy, cz) || !this.canTake(world, cx, cy, cz)) continue;
          this.due.set(key, { x: cx, y: cy, z: cz, at: today + MIN_DAYS + this.rand() * (MAX_DAYS - MIN_DAYS) });
        }
      }
    }
  }

  /** Turns every due dirt block that still can into turf. Returns the changes made. */
  spread(world, today, skip = null) {
    const changes = [];
    for (const [key, d] of this.due) {
      if (d.at > today) continue;
      this.due.delete(key);
      if (skip?.(d.x, d.y, d.z) || !this.canTake(world, d.x, d.y, d.z)) continue;
      world.setBlock(d.x, d.y, d.z, GRASS);
      changes.push({ x: d.x, y: d.y, z: d.z, prev: DIRT, next: GRASS });
    }
    for (const c of changes) this.consider(world, c.x, c.y, c.z, today, skip);
    return changes;
  }

  toJSON() {
    return [...this.due.values()].map((d) => [d.x, d.y, d.z, Math.round(d.at * 100) / 100]);
  }

  loadJSON(list) {
    this.due.clear();
    for (const r of Array.isArray(list) ? list : []) {
      if (r?.length === 4) this.due.set(`${r[0]},${r[1]},${r[2]}`, { x: r[0], y: r[1], z: r[2], at: r[3] });
    }
  }
}
