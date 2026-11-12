import { groundAt, bodyFits, BODY_HALF } from './Mobs.js';
import { MOBS_BY_ID } from '../config/mobs.js';
import { WANDERERS } from '../config/wanderers.js';

/**
 * How bodies move against one another (IMP-28): a blow knocks its target
 * back along the blow with a small hop, and two bodies in the same place
 * push each other apart.
 *
 * Everything is scaled by `mass`, where a person is 1: a chicken (0.1)
 * flies off a blow and a triceratops (16) barely moves; a villager walking
 * into a long-neck goes round it and the long-neck stays where it is.
 *
 * Pure logic, no THREE. Nothing here allocates per frame: the Crowd keeps
 * its arrays and grows them only when more bodies turn up than ever before.
 */

export const PERSON_MASS = 1;
export const PERSON_RADIUS = 0.3;

/** A blow's push on a person: blocks a second, fading at KNOCK_FADE a second (about half a block). */
export const KNOCK_SPEED = 3.2;
/** Nothing is thrown faster than this, however small. */
export const KNOCK_MAX = 9;
/** How fast a knock fades, per second (the player's own is the same — PlayerController). */
export const KNOCK_FADE = 6;
/** The hop that goes with a blow, for a person; nothing hops higher than HOP_MAX. */
export const HOP = 2.2, HOP_MAX = 6.5;
/** Too heavy to leave the ground for a blow. */
const NO_HOP_MASS = 6;
/** A sword's blow throws this much further than a fist's; an arrow's less. */
export const SWORD_KNOCK = 1.6, ARROW_KNOCK = 0.7;
const GRAVITY = 22;

/** `current` moved towards `wanted` by at most `rate * dt`. */
export function ease(current, wanted, rate, dt) {
  const d = wanted - current, max = rate * dt;
  return d > max ? current + max : d < -max ? current - max : wanted;
}

/** `facing` turned towards `heading` by at most `maxTurn`, the short way round. */
export function turnTo(facing, heading, maxTurn) {
  const turn = Math.atan2(Math.sin(heading - facing), Math.cos(heading - facing));
  return facing + (turn > maxTurn ? maxTurn : turn < -maxTurn ? -maxTurn : turn);
}

/**
 * Struck from (fromX, fromZ): thrown back along the blow, with a hop unless
 * `lift` is false or it's too heavy. The throw is carried out by `drift`,
 * a frame at a time. `power` is 1 for a fist.
 */
export function knock(b, fromX, fromZ, power = 1, mass = PERSON_MASS, lift = true) {
  let dx = b.x - fromX, dz = b.z - fromZ;
  let d = Math.hypot(dx, dz);
  if (d < 1e-4) { dx = Math.sin(b.facing ?? 0); dz = Math.cos(b.facing ?? 0); d = 1; }
  const root = Math.sqrt(mass);
  const speed = Math.min(KNOCK_MAX, (KNOCK_SPEED * power) / root);
  b.kx = (dx / d) * speed;
  b.kz = (dz / d) * speed;
  if (lift && mass < NO_HOP_MASS) b.vy = Math.max(b.vy ?? 0, Math.min(HOP_MAX, (HOP * power) / root));
}

/**
 * One frame of a knock: along the ground or down off it, never up a step
 * (a blow used to lift a bandit out of the hole you'd trapped it in), never
 * into a wall (it slides along it) and never below `floorMin`. Returns
 * whether the body is still being thrown.
 */
export function drift(world, b, dt, tall = 2, half = BODY_HALF, floorMin = -Infinity, swim = 0) {
  const kx = b.kx, kz = b.kz;
  if (!kx && !kz) return false;
  if (kx * kx + kz * kz < 0.04) { b.kx = 0; b.kz = 0; return false; }
  const from = b.y + (b.swimming ? swim : 0);
  const here = groundAt(world, b.x, b.z, from, tall, swim) ?? b.y;
  const top = here + 0.05;
  const nx = b.x + kx * dt, nz = b.z + kz * dt;
  let g = groundAt(world, nx, nz, from, tall, swim);
  if (g != null && g <= top && g >= floorMin && bodyFits(world, nx, nz, Math.max(g, b.y), 1.8, half)) { b.x = nx; b.z = nz; }
  else {
    // Against a wall: along it, whichever way is open.
    g = groundAt(world, nx, b.z, from, tall, swim);
    if (g != null && g <= top && g >= floorMin && bodyFits(world, nx, b.z, Math.max(g, b.y), 1.8, half)) { b.x = nx; b.kz = 0; }
    else {
      g = groundAt(world, b.x, nz, from, tall, swim);
      if (g != null && g <= top && g >= floorMin && bodyFits(world, b.x, nz, Math.max(g, b.y), 1.8, half)) { b.z = nz; b.kx = 0; }
      else { b.kx = 0; b.kz = 0; return false; }
    }
  }
  const fade = Math.exp(-KNOCK_FADE * dt);
  b.kx *= fade; b.kz *= fade;
  return true;
}

/**
 * Gravity for someone on foot: down onto whatever is under them, at a fall
 * and not in one frame. Over a column with nowhere to stand (water, a
 * fence top, unmade land) they stay as they are.
 */
export function fall(world, b, dt, tall = 2) {
  const vy = b.vy ?? 0;
  const ground = groundAt(world, b.x, b.z, b.y, tall);
  if (ground == null) { if (!freeFall(world, b, dt)) b.vy = 0; return; }
  if (vy <= 0 && b.y <= ground) { b.y = ground; b.vy = 0; return; }
  b.vy = vy - GRAVITY * dt;
  b.y += b.vy * dt;
  if (b.y <= ground) { b.y = ground; b.vy = 0; }
}

/**
 * Nothing to stand on within reach (groundAt looks three blocks down) and
 * nothing but air there: it falls through it this frame, and finds the
 * ground when it gets near — a pit dug under someone used to leave them
 * hanging over it. False when what's under them is something else (water,
 * leaves, a fence, unmade land), where they stay as they are.
 */
export function freeFall(world, b, dt) {
  const bx = Math.floor(b.x), bz = Math.floor(b.z), base = Math.floor(b.y);
  // Land not made yet is not a pit.
  if (base < 4 || !world.getBlock || !world.hasChunk?.(bx >> 4, bz >> 4)) return false;
  for (let y = base + 1; y >= base - 3; y--) if (world.getBlock(bx, y, bz) !== 0) return false;
  b.vy = Math.max(-30, (b.vy ?? 0) - GRAVITY * dt);
  b.y += Math.max(-2.5, b.vy * dt);
  return true;
}

// ---- the crowd: bodies pushing each other apart ---------------------------------

/** Wider than any two bodies touching, so a body's neighbours are in the nine cells round it. */
const CELL = 2.5;
const TABLE = 1024;           // hash buckets; a power of two
/** The part of an overlap undone in one frame: all of it at once makes a packed crowd shake. */
const STIFF = 0.8;
/** The furthest one frame's push moves anybody. */
const MAX_PUSH = 0.3;
/** Bodies further apart than this in height don't touch (one on a wall, one below it). */
const REACH_Y = 1.5;
/** A push never takes anybody up or down more than this: not up a step, not off a ledge. */
const PUSH_STEP = 0.55;

/**
 * Everybody who takes up room this frame, and one pass that moves the ones
 * standing in each other apart. A spatial grid, so the cost goes with the
 * number of bodies and not its square: a body is only tested against the
 * ones in the nine cells round it.
 *
 *   crowd.clear();
 *   crowd.add(body, radius, mass, ...);   // for each body
 *   crowd.resolve(world);
 *
 * A body is anything with x, y, z. `mass` Infinity is something that pushes
 * and is never pushed (a siege engine, a god). An `external` body is not
 * moved here: what it should move by is left in `body.pushX` / `body.pushZ`
 * for its owner to apply — the player, who has collision of their own.
 */
export class Crowd {
  constructor(capacity = 256) {
    this.n = 0;
    this.head = new Int32Array(TABLE);
    this.grow(capacity);
  }

  grow(capacity) {
    const keep = this.n;
    const f32 = (old) => { const a = new Float32Array(capacity); if (old) a.set(old.subarray(0, keep)); return a; };
    const i32 = (old) => { const a = new Int32Array(capacity); if (old) a.set(old.subarray(0, keep)); return a; };
    this.capacity = capacity;
    this.bodies ??= [];
    this.bodies.length = capacity;
    this.radius = f32(this.radius); this.inv = f32(this.inv);
    this.tall = f32(this.tall); this.half = f32(this.half);
    this.ax = f32(this.ax); this.az = f32(this.az);
    // Where each is, read once a pass: the pair test then touches numbers only.
    this.px = new Float64Array(capacity); this.py = new Float64Array(capacity); this.pz = new Float64Array(capacity);
    this.cx = i32(this.cx); this.cz = i32(this.cz); this.next = i32(this.next);
    this.flags = new Uint8Array(capacity);
  }

  clear() {
    this.n = 0;
  }

  /**
   * @param tall      blocks of headroom it needs where it's pushed to
   * @param half      half its width against walls (bodyFits)
   * @param external  not moved here — see the class comment
   * @param settles   has no gravity of its own, so a push down a low step sets it down
   */
  add(body, radius = PERSON_RADIUS, mass = PERSON_MASS, tall = 2, half = BODY_HALF, external = false, settles = false) {
    if (this.n === this.capacity) {
      const flags = this.flags;
      this.grow(this.capacity * 2);
      this.flags.set(flags);
    }
    const i = this.n++;
    this.bodies[i] = body;
    this.radius[i] = radius;
    this.inv[i] = mass === Infinity ? 0 : 1 / mass;
    this.tall[i] = tall;
    this.half[i] = half;
    this.flags[i] = (external ? 1 : 0) | (settles ? 2 : 0);
    return i;
  }

  /**
   * Pushes apart whoever overlaps. Returns how many pairs were touching.
   * A second pass, only when somebody was: in a packed crowd one pass
   * leaves the ones in the middle squeezed from both sides.
   */
  resolve(world, passes = 2) {
    const touching = this.pass(world);
    for (let i = 1; i < passes && touching; i++) if (!this.pass(world)) break;
    return touching;
  }

  pass(world) {
    const { n, bodies, radius, inv, ax, az, cx, cz, next, head, px, py, pz } = this;
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      ax[i] = 0; az[i] = 0;
      px[i] = b.x; py[i] = b.y; pz[i] = b.z;
      const x = cx[i] = Math.floor(b.x / CELL), z = cz[i] = Math.floor(b.z / CELL);
      const h = ((x * 73856093) ^ (z * 19349663)) & (TABLE - 1);
      next[i] = head[h];
      head[h] = i;
    }
    let touching = 0;
    for (let i = 0; i < n; i++) {
      const x = cx[i], z = cz[i], ax0 = px[i], ay0 = py[i], az0 = pz[i], ri = radius[i], ii = inv[i];
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const nx = x + ox, nz = z + oz;
          for (let j = head[((nx * 73856093) ^ (nz * 19349663)) & (TABLE - 1)]; j >= 0; j = next[j]) {
            // Each pair once; and only who is really in that cell (two cells can share a bucket).
            if (j <= i || cx[j] !== nx || cz[j] !== nz) continue;
            const min = ri + radius[j];
            let dx = ax0 - px[j], dz = az0 - pz[j];
            const d2 = dx * dx + dz * dz;
            if (d2 >= min * min) continue;
            const dy = ay0 - py[j];
            if (dy > REACH_Y || dy < -REACH_Y) continue;
            const share = ii + inv[j];
            if (share === 0) continue;
            let d = Math.sqrt(d2);
            // Exactly in one another: apart along a line that depends only on who they are.
            if (d < 1e-4) { dx = Math.sin(i * 2.399 + j); dz = Math.cos(i * 2.399 + j); d = 1; }
            const push = ((min - d) * STIFF) / (d * share);
            ax[i] += dx * push * ii; az[i] += dz * push * ii;
            ax[j] -= dx * push * inv[j]; az[j] -= dz * push * inv[j];
            touching++;
          }
        }
      }
    }
    if (touching) for (let i = 0; i < n; i++) if (ax[i] !== 0 || az[i] !== 0) this.apply(world, i);
    return touching;
  }

  /** Moves one body by what the others pushed it, as far as the land lets it. */
  apply(world, i) {
    const b = this.bodies[i];
    let px = this.ax[i], pz = this.az[i];
    const p = Math.hypot(px, pz);
    if (p > MAX_PUSH) { px *= MAX_PUSH / p; pz *= MAX_PUSH / p; }
    // Moved here only as far as the others can tell; its owner does the real move.
    if (this.flags[i] & 1) { b.pushX += px; b.pushZ += pz; b.x += px; b.z += pz; return; }
    if (this.stand(world, i, b.x + px, b.z + pz)) return;
    // Against a wall or an edge: along it.
    if (px !== 0 && this.stand(world, i, b.x + px, b.z)) return;
    if (pz !== 0) this.stand(world, i, b.x, b.z + pz);
  }

  /** Puts body i at (x, z) if it can stand there without climbing, dropping or entering a wall. */
  stand(world, i, x, z) {
    const b = this.bodies[i], h = this.half[i];
    // Still over the same blocks it stands on now: nothing new to run into,
    // and no need to ask the world (most pushes are a few hundredths).
    if (Math.floor(x) === Math.floor(b.x) && Math.floor(z) === Math.floor(b.z)
      && Math.floor(x - h) === Math.floor(b.x - h) && Math.floor(x + h) === Math.floor(b.x + h)
      && Math.floor(z - h) === Math.floor(b.z - h) && Math.floor(z + h) === Math.floor(b.z + h)) {
      b.x = x; b.z = z;
      return true;
    }
    const g = groundAt(world, x, z, b.y, this.tall[i]);
    if (g == null || g > b.y + PUSH_STEP || g < b.y - PUSH_STEP) return false;
    if (b.perch != null && g < b.perch - 0.6) return false;
    if (!bodyFits(world, x, z, g, 1.8, this.half[i])) return false;
    b.x = x; b.z = z;
    if (g > b.y || this.flags[i] & 2) b.y = g;
    return true;
  }
}

/** A siege engine, a war beast: how much room it keeps round its middle. */
const ENGINE_RADIUS = 0.7;
/** Your guardian: a great stag or a great wolf, that a person doesn't shift. */
const GUARDIAN_RADIUS = 0.8, GUARDIAN_MASS = 8;

/**
 * Everybody who takes up room this frame, into `crowd`: the animals, the
 * people who aren't yours, your villagers, soldiers, warriors and guardian,
 * and you. Any of them may be missing. The dead, the dying, the showcase's
 * figures and whoever is being ridden take up none.
 *
 * @param who.player  { x, y, z } — added as an external body (Crowd), so
 *                    what the others moved it by comes back in `pushX` / `pushZ`
 */
export function gatherCrowd(crowd, who) {
  crowd.clear();
  const mobs = who.mobs;
  if (mobs) {
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.dead || m.dying > 0 || m.still || m.ridden) continue;
      const spec = MOBS_BY_ID.get(m.type);
      if (!spec) continue;
      crowd.add(m, spec.radius, spec.mass, Math.max(1, Math.ceil(spec.leg + spec.body.h)), Math.min(BODY_HALF, spec.radius));
    }
  }
  const wanderers = who.wanderers;
  if (wanderers) {
    for (let i = 0; i < wanderers.length; i++) {
      const p = wanderers[i];
      if (p.dead || p.done || p.still || p.mount) continue;
      const spec = WANDERERS[p.kind];
      if (!spec) continue;
      // Engines, gods and whoever keeps a seat or a stall (speed 0) are walked round, not shifted.
      const engine = spec.siege || spec.beast;
      crowd.add(p, engine ? ENGINE_RADIUS : PERSON_RADIUS, engine || spec.noKnock || !spec.speed ? Infinity : PERSON_MASS, 2, spec.siege ? 0.05 : BODY_HALF);
    }
  }
  const settlers = who.settlers;
  if (settlers) for (let i = 0; i < settlers.length; i++) crowd.add(settlers[i], PERSON_RADIUS, PERSON_MASS, 2, BODY_HALF, false, true);
  const soldiers = who.soldiers;
  if (soldiers) {
    for (let i = 0; i < soldiers.length; i++) {
      const s = soldiers[i];
      // A catapult's crew stands by its engine: they hold their ground.
      if (s.hp > 0) crowd.add(s, PERSON_RADIUS, s.engine ? Infinity : PERSON_MASS);
    }
  }
  const warriors = who.warriors;
  if (warriors) for (let i = 0; i < warriors.length; i++) if (warriors[i].hp > 0) crowd.add(warriors[i]);
  const g = who.guardian;
  if (g && !(g.downed > 0)) crowd.add(g, GUARDIAN_RADIUS, GUARDIAN_MASS, 2, BODY_HALF);
  if (who.player) {
    who.player.pushX = 0; who.player.pushZ = 0;
    crowd.add(who.player, PERSON_RADIUS, PERSON_MASS, 2, BODY_HALF, true);
  }
  return crowd;
}
