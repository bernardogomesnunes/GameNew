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
  if (g != null && g <= top && g >= floorMin && bodyFits(world, nx, nz, g, 1.8, half)) { b.x = nx; b.z = nz; }
  else {
    // Against a wall: along it, whichever way is open.
    g = groundAt(world, nx, b.z, from, tall, swim);
    if (g != null && g <= top && g >= floorMin && bodyFits(world, nx, b.z, g, 1.8, half)) { b.x = nx; b.kz = 0; }
    else {
      g = groundAt(world, b.x, nz, from, tall, swim);
      if (g != null && g <= top && g >= floorMin && bodyFits(world, b.x, nz, g, 1.8, half)) { b.z = nz; b.kx = 0; }
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
  if (ground == null) { b.vy = 0; return; }
  if (vy <= 0 && b.y <= ground) { b.y = ground; b.vy = 0; return; }
  b.vy = vy - GRAVITY * dt;
  b.y += b.vy * dt;
  if (b.y <= ground) { b.y = ground; b.vy = 0; }
}

// ---- the crowd: bodies pushing each other apart ---------------------------------

/** Wider than any two bodies touching, so a body's neighbours are in the nine cells round it. */
const CELL = 2.5;
const TABLE = 1024;           // hash buckets; a power of two
/** The part of an overlap undone in one frame: all of it at once makes a packed crowd shake. */
const STIFF = 0.5;
/** The furthest one frame's push moves anybody. */
const MAX_PUSH = 0.2;
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

  /** Pushes apart whoever overlaps. Returns how many pairs were touching. */
  resolve(world) {
    const { n, bodies, radius, inv, ax, az, cx, cz, next, head } = this;
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      ax[i] = 0; az[i] = 0;
      const x = cx[i] = Math.floor(b.x / CELL), z = cz[i] = Math.floor(b.z / CELL);
      const h = ((x * 73856093) ^ (z * 19349663)) & (TABLE - 1);
      next[i] = head[h];
      head[h] = i;
    }
    let touching = 0;
    for (let i = 0; i < n; i++) {
      const a = bodies[i], x = cx[i], z = cz[i];
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const nx = x + ox, nz = z + oz;
          for (let j = head[((nx * 73856093) ^ (nz * 19349663)) & (TABLE - 1)]; j >= 0; j = next[j]) {
            // Each pair once; and only who is really in that cell (two cells can share a bucket).
            if (j <= i || cx[j] !== nx || cz[j] !== nz) continue;
            const share = inv[i] + inv[j];
            if (share === 0) continue;
            const b = bodies[j];
            const min = radius[i] + radius[j];
            let dx = a.x - b.x, dz = a.z - b.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= min * min) continue;
            const dy = a.y - b.y;
            if (dy > REACH_Y || dy < -REACH_Y) continue;
            let d = Math.sqrt(d2);
            // Exactly in one another: apart along a line that depends only on who they are.
            if (d < 1e-4) { dx = Math.sin(i * 2.399 + j); dz = Math.cos(i * 2.399 + j); d = 1; }
            const push = ((min - d) * STIFF) / (d * share);
            ax[i] += dx * push * inv[i]; az[i] += dz * push * inv[i];
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
    if (this.flags[i] & 1) { b.pushX = px; b.pushZ = pz; return; }
    if (this.stand(world, i, b.x + px, b.z + pz)) return;
    // Against a wall or an edge: along it.
    if (px !== 0 && this.stand(world, i, b.x + px, b.z)) return;
    if (pz !== 0) this.stand(world, i, b.x, b.z + pz);
  }

  /** Puts body i at (x, z) if it can stand there without climbing, dropping or entering a wall. */
  stand(world, i, x, z) {
    const b = this.bodies[i];
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
