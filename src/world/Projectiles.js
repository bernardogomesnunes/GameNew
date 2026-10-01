/**
 * Stones in flight — what a catapult throws (Phase 6c).
 *
 * Chosen directly: "real projectile arcs that break blocks". So a stone is
 * a point with a velocity under gravity, stepped in small slices so it
 * can't skip through a wall at speed, and where it first meets something
 * solid it knocks out a small crater of blocks. Pure logic, like Mobs:
 * Game draws `list` and decides what a crater is allowed to take.
 */

/** Blocks per second squared — heavier than the player feels, so arcs read as thrown. */
export const GRAVITY = 20;
/** How fast a catapult throws. On flat ground its longest throw is v²/g. */
export const LAUNCH_SPEED = 28;
/** The longest throw on level ground, in blocks. */
export const MAX_RANGE = (LAUNCH_SPEED * LAUNCH_SPEED) / GRAVITY;
/** How big a hole a stone makes. */
export const BLAST = 1.6;
/** Slice length for stepping a stone, in seconds. */
const STEP = 1 / 120;
/** A stone that hasn't landed by now (thrown off the edge of the world) is dropped. */
const MAX_FLIGHT = 12;

/** The angle a catapult lobs at, and the steeper one it uses to clear a wall. */
export const LOB = (50 * Math.PI) / 180;
export const STEEP = (70 * Math.PI) / 180;

/**
 * The launch velocity that lands a stone at `to` from `from`, thrown at
 * `angle` — a catapult's arm always swings to the same stop, and what
 * changes is how hard it's wound. When the target is out of reach it
 * throws as hard as it can and says so.
 *
 * Returns { vx, vy, vz, inRange }.
 */
export function aimAt(from, to, { angle = LOB, speed = LAUNCH_SPEED, g = GRAVITY } = {}) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  const h = to.y - from.y;
  const ux = d > 1e-6 ? dx / d : 0, uz = d > 1e-6 ? dz / d : -1;
  const c = Math.cos(angle), t = Math.tan(angle);
  // From y = h at x = d on the parabola: v² = g d² / (2 cos²θ (d tanθ − h)).
  const den = 2 * c * c * (d * t - h);
  let v = den > 0 ? Math.sqrt((g * d * d) / den) : Infinity;
  const inRange = v <= speed;
  if (!inRange) v = speed;
  return { vx: ux * v * c, vy: v * Math.sin(angle), vz: uz * v * c, inRange };
}

/**
 * The throw a catapult actually makes at `to`: its usual lob if that comes
 * down where you're looking, a steeper one if something's in the way (a
 * wall, a hill), and failing both, the usual lob anyway.
 */
export function bestAim(world, from, to) {
  for (const angle of [LOB, STEEP]) {
    const v = aimAt(from, to, { angle });
    if (!v.inRange) continue;
    const landed = fly(world, { ...from, ...v });
    if (landed && Math.hypot(landed.x - to.x, landed.z - to.z) < 1.5) return v;
  }
  return aimAt(from, to);
}

/** Whether a stone at (x, y, z) has hit something: a solid cell, or the floor of the world. */
function blocked(world, x, y, z) {
  if (y < 0) return true;
  return !!world.collisionBoxAt(Math.floor(x), Math.floor(y), Math.floor(z));
}

/**
 * Steps a stone `s` — { x, y, z, vx, vy, vz }, moved in place — on for up to
 * `seconds`, calling `visit(x, y, z)` every few slices. Returns where it
 * landed — { x, y, z, t, cell }, the last open point and the solid cell it
 * met — or null if it's still in the air at the end.
 */
export function fly(world, s, seconds = MAX_FLIGHT, visit = null, every = 6) {
  let t = 0, n = 0;
  while (t < seconds - 1e-9) {
    s.vy -= GRAVITY * STEP;
    const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP, nz = s.z + s.vz * STEP;
    t += STEP;
    if (blocked(world, nx, ny, nz)) {
      return { x: s.x, y: s.y, z: s.z, t, cell: { x: Math.floor(nx), y: Math.floor(ny), z: Math.floor(nz) } };
    }
    s.x = nx; s.y = ny; s.z = nz;
    if (visit && ++n % every === 0) visit(s.x, s.y, s.z);
  }
  return null;
}

/** The arc a throw would take, as points — for drawing where it will go before you let go. */
export function predictArc(world, from, v, maxPoints = 160) {
  const points = [{ x: from.x, y: from.y, z: from.z }];
  const landed = fly(world, { x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz }, MAX_FLIGHT, (x, y, z) => {
    if (points.length < maxPoints) points.push({ x, y, z });
  });
  if (landed) points.push({ x: landed.x, y: landed.y, z: landed.z });
  return { points, landed };
}

/**
 * The solid cells within BLAST of where a stone came down — what it
 * knocks out. Bedrock and the like are the caller's to spare.
 */
export function craterCells(world, at, radius = BLAST) {
  const out = [];
  const r = Math.ceil(radius);
  const cx = at.x, cy = at.y, cz = at.z;
  for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    for (let y = Math.max(0, Math.floor(cy) - r); y <= Math.floor(cy) + r; y++) {
      for (let z = Math.floor(cz) - r; z <= Math.floor(cz) + r; z++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
        if (d > radius) continue;
        const id = world.getBlock(x, y, z);
        if (id) out.push({ x, y, z, id, d });
      }
    }
  }
  return out;
}

export class Projectiles {
  /**
   * @param onImpact (stone, landed) — where one came down.
   */
  constructor({ world, onImpact = null }) {
    this.world = world;
    this.onImpact = onImpact;
    this.list = [];
    this.nextId = 1;
  }

  fire(from, v) {
    const s = { id: this.nextId++, x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz, age: 0 };
    this.list.push(s);
    return s;
  }

  tick(dt) {
    for (const s of this.list) {
      const landed = fly(this.world, s, dt);
      s.age += dt;
      if (landed) {
        s.done = true;
        this.onImpact?.(s, landed);
      } else if (s.age > MAX_FLIGHT) {
        s.done = true;
      }
    }
    this.list = this.list.filter((s) => !s.done);
  }
}
