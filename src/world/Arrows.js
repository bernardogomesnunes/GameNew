/**
 * Arrows in flight (asked for directly: "we don't have bow and arrows").
 *
 * An arrow is a point with a velocity, pulled down a little, stepped in
 * small slices so it can't pass through a wall or an animal at speed. Each
 * slice it asks `hitTest` whether anything alive is on the stretch it's
 * about to cover — an animal, a bandit — and stops in the first thing it
 * meets: a creature takes the hit (`onHit`), a block keeps it, stuck there
 * a while. Pure logic, like Projectiles: Game decides what a hit does.
 */

/** Blocks per second off the string. */
export const ARROW_SPEED = 34;
/** How hard it's pulled down, blocks per second squared: about a block of drop over 20 — aim a touch high far off. */
export const ARROW_GRAVITY = 6;
/** What an arrow takes off whatever it hits — a bandit (12) falls to three. */
export const ARROW_DAMAGE = 5;
/** How long an arrow stays stuck in a block. */
export const STUCK_SECONDS = 12;
/** An arrow still flying after this (off over the edge of everything) is gone. */
const MAX_FLIGHT = 6;
const STEP = 1 / 120;

export class Arrows {
  /**
   * @param hitTest (from, dir, length) → a hit ({ t, ... }) on anything alive
   *                along that stretch, nearest first, or null
   * @param onHit   (arrow, hit) — an arrow found its mark
   */
  constructor({ world, hitTest = null, onHit = null }) {
    this.world = world;
    this.hitTest = hitTest;
    this.onHit = onHit;
    this.list = [];
    this.nextId = 1;
  }

  /** Looses an arrow from `from` along `dir` (need not be unit length). */
  shoot(from, dir, speed = ARROW_SPEED) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const a = {
      id: this.nextId++, x: from.x, y: from.y, z: from.z,
      vx: (dir.x / len) * speed, vy: (dir.y / len) * speed, vz: (dir.z / len) * speed,
      age: 0, stuck: false,
    };
    this.list.push(a);
    return a;
  }

  tick(dt) {
    for (const a of this.list) {
      a.age += dt;
      if (a.stuck) {
        if (a.age > STUCK_SECONDS) a.done = true;
        continue;
      }
      let t = 0;
      while (t < dt - 1e-9 && !a.stuck && !a.done) {
        const step = Math.min(STEP, dt - t);
        t += step;
        a.vy -= ARROW_GRAVITY * step;
        const dx = a.vx * step, dy = a.vy * step, dz = a.vz * step;
        const len = Math.hypot(dx, dy, dz);
        const hit = this.hitTest?.({ x: a.x, y: a.y, z: a.z }, { x: dx / len, y: dy / len, z: dz / len }, len);
        if (hit) {
          a.done = true;
          a.x += (dx / len) * hit.t; a.y += (dy / len) * hit.t; a.z += (dz / len) * hit.t;
          this.onHit?.(a, hit);
          break;
        }
        const nx = a.x + dx, ny = a.y + dy, nz = a.z + dz;
        if (ny < 0 || this.world.collisionBoxAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
          // Stuck: its tip just in the block, the way it was going.
          a.x = a.x + dx * 0.6; a.y = a.y + dy * 0.6; a.z = a.z + dz * 0.6;
          a.stuck = true;
          a.age = 0;
          break;
        }
        a.x = nx; a.y = ny; a.z = nz;
      }
      if (!a.stuck && a.age > MAX_FLIGHT) a.done = true;
    }
    this.list = this.list.filter((a) => !a.done);
  }
}
