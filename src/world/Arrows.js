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
/** How long an arrow stays stuck in a block — long enough to walk over and take it back. */
export const STUCK_SECONDS = 60;
/** How near you have to walk to an arrow stuck in something to pick it up. */
export const PICKUP_REACH = 1.6;
/** How long you hold the bow drawn for a full-strength shot, in ms; anything less flies slower and hits softer. */
export const FULL_DRAW_MS = 900;
/** A draw shorter than this is let go of without loosing anything. */
export const MIN_DRAW_MS = 120;

/**
 * What a draw of `heldMs` gives: { power 0..1, speed, damage }. Half a draw
 * flies about two-thirds as fast and hits for three; a full one, ARROW_SPEED
 * and ARROW_DAMAGE.
 */
export function drawShot(heldMs) {
  const power = Math.max(0, Math.min(1, heldMs / FULL_DRAW_MS));
  return {
    power,
    speed: ARROW_SPEED * (0.4 + 0.6 * power),
    damage: Math.max(1, Math.round(ARROW_DAMAGE * (0.3 + 0.7 * power))),
  };
}
/** An arrow still flying after this (off over the edge of everything) is gone. */
const MAX_FLIGHT = 6;
/** A magic bolt fades after this many seconds (about 60 blocks). */
export const BOLT_FLIGHT = 1.5;
/** Blocks per second for a magic bolt. */
export const BOLT_SPEED = 40;
const STEP = 1 / 120;

export class Arrows {
  /**
   * @param hitTest (from, dir, length) → a hit ({ t, ... }) on anything alive
   *                along that stretch, nearest first, or null
   * @param onHit   (arrow, hit) — an arrow found its mark
   */
  constructor({ world, hitTest = null, onHit = null, onBlock = null }) {
    this.world = world;
    // WIZ-5: a magic bolt that met a block: (bolt, x, y, z).
    this.onBlock = onBlock;
    this.hitTest = hitTest;
    this.onHit = onHit;
    this.list = [];
    this.nextId = 1;
  }

  /** Looses an arrow from `from` along `dir` (need not be unit length), hitting for `damage`. */
  shoot(from, dir, speed = ARROW_SPEED, damage = ARROW_DAMAGE, bolt = false) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const a = {
      id: this.nextId++, x: from.x, y: from.y, z: from.z,
      vx: (dir.x / len) * speed, vy: (dir.y / len) * speed, vz: (dir.z / len) * speed,
      age: 0, stuck: false, damage, ...(bolt ? { bolt: true } : {}),
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
        if (!a.bolt) a.vy -= ARROW_GRAVITY * step; // a magic bolt flies straight
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
        if (a.bolt && (ny < 0 || this.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) !== 0)) {
          // A bolt does not stick: it bursts on the block, and says which.
          a.done = true;
          this.onBlock?.(a, Math.floor(nx), Math.floor(ny), Math.floor(nz));
          break;
        }
        if (ny < 0 || this.world.collisionBoxAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
          // Stuck: its tip just in the block, the way it was going.
          a.x = a.x + dx * 0.6; a.y = a.y + dy * 0.6; a.z = a.z + dz * 0.6;
          a.stuck = true;
          a.age = 0;
          break;
        }
        a.x = nx; a.y = ny; a.z = nz;
      }
      if (!a.stuck && a.age > (a.bolt ? BOLT_FLIGHT : MAX_FLIGHT)) a.done = true;
    }
    this.list = this.list.filter((a) => !a.done);
  }

  /**
   * Every arrow stuck within PICKUP_REACH of `at` (where you stand — your
   * middle, so one in the ground at your feet counts), taken out of the
   * world. Returns how many: they go back in your bag.
   */
  collect(at, reach = PICKUP_REACH) {
    let n = 0;
    for (const a of this.list) {
      if (!a.stuck || a.done) continue;
      if (Math.hypot(a.x - at.x, a.y - at.y, a.z - at.z) <= reach) { a.done = true; n++; }
    }
    if (n) this.list = this.list.filter((a) => !a.done);
    return n;
  }
}
