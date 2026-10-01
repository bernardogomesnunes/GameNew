import { groundAt } from './Mobs.js';

/**
 * The guardian (Phase 7d, docs/plan-phase7-lore.md): what your god sends
 * when you raise its Sanctuary, tamed to you.
 *
 *   white  Aurelion, a great stag of light — fast, and heals you while
 *          you're near it ("heals your soldiers near it": you, until there
 *          are soldiers).
 *   black  Umbra, a beast of shadow — enemies near it lose their nerve and
 *          break and run.
 *
 * Both fight bandits. It follows you, holds where it is, or goes after
 * anything hostile nearby — tapped to change which, until the soldiers'
 * command wheel exists. Beaten down, it goes back to its Sanctuary and
 * comes back after a day.
 *
 * Pure logic like Mobs: Game draws it with a GuardianView and gives it the
 * callbacks that touch the rest of the world.
 */

export const GUARDIANS = {
  white: {
    name: 'Aurelion', about: 'the white stag', hp: 60, speed: 6.5, hits: 6, every: 0.9, reach: 2.4,
    heal: { range: 7, every: 3 },
  },
  black: {
    name: 'Umbra', about: 'the shadow beast', hp: 70, speed: 4.8, hits: 8, every: 1.2, reach: 2.4,
    fear: { range: 9, seconds: 6 },
  },
};

export const MODES = ['follow', 'stay', 'attack'];
export const MODE_WORDS = { follow: 'following you', stay: 'holding here', attack: 'hunting your enemies' };

/** A day of play — DayCycle's ten minutes of light and the faster night. */
export const DOWNED_SECONDS = 900;
/** How far it goes after an enemy: round you when following, round itself when told to attack. */
const GUARD_RANGE = 8;
const HUNT_RANGE = 18;
/** What each blow it lands costs it: bandits hit back. */
const COUNTER = 2;
/** Further than this from you and it catches up at once rather than running across the map. */
const LEASH = 40;
const TALL = 2;

export class Guardian {
  constructor({ world, ring, home, state = null }) {
    this.world = world;
    this.ring = ring;
    this.spec = GUARDIANS[ring];
    this.home = home;
    this.x = state?.x ?? home.x;
    this.y = state?.y ?? home.y;
    this.z = state?.z ?? home.z;
    this.hp = state?.hp ?? this.spec.hp;
    this.mode = MODES.includes(state?.mode) ? state.mode : 'follow';
    this.downed = state?.downed ?? 0;
    this.cooldown = 0;
    this.healClock = 0;
    this.fearClock = 0;
    this.facing = 0;
    this.moving = false;
    this.hurt = 0;
  }

  get name() {
    return this.spec.name;
  }

  /** Next order: follow → stay → attack → follow. */
  command() {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    return this.mode;
  }

  /**
   * @param enemies   bandits it may go after (each { x, y, z, ... })
   * @param on        { strike(enemy, damage), heal(), scare(enemy, seconds), downed(), back() }
   */
  tick(dt, player, enemies = [], on = {}) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    if (this.downed > 0) {
      this.downed -= dt;
      if (this.downed <= 0) {
        this.downed = 0;
        this.hp = this.spec.hp;
        this.x = this.home.x; this.y = this.home.y; this.z = this.home.z;
        on.back?.();
      }
      return;
    }

    const toPlayer = Math.hypot(player.x - this.x, player.z - this.z);
    if (this.mode !== 'stay' && toPlayer > LEASH) {
      // Too far behind: it's simply there again, a little behind you.
      this.x = player.x - 2; this.z = player.z - 2;
      this.y = groundAt(this.world, this.x, this.z, player.y + 2, TALL) ?? player.y;
    }

    // Who to go after.
    const centre = this.mode === 'attack' ? this : this.mode === 'follow' ? player : this;
    const range = this.mode === 'attack' ? HUNT_RANGE : GUARD_RANGE;
    let target = null, best = range;
    for (const e of enemies) {
      const d = Math.hypot(e.x - centre.x, e.z - centre.z);
      if (d < best) { best = d; target = e; }
    }
    this.target = target;

    if (target) {
      const d = Math.hypot(target.x - this.x, target.z - this.z);
      if (d > this.spec.reach * 0.8) this.stepTowards(target.x, target.z, dt, this.spec.speed * 1.15);
      else this.moving = false;
      if (d <= this.spec.reach && this.cooldown <= 0) {
        this.cooldown = this.spec.every;
        on.strike?.(target, this.spec.hits);
        this.hp -= COUNTER;
        this.hurt = 0.25;
        if (this.hp <= 0) {
          this.hp = 0;
          this.downed = DOWNED_SECONDS;
          on.downed?.();
          return;
        }
      }
    } else if (this.mode === 'follow' && toPlayer > 3.5) {
      // A little behind and to the side of you, not underfoot.
      this.stepTowards(player.x - (player.x - this.x) / toPlayer * 2.5, player.z - (player.z - this.z) / toPlayer * 2.5, dt, this.spec.speed);
    } else {
      this.moving = false;
    }

    // The stag heals you while you're near it.
    if (this.spec.heal) {
      if (toPlayer <= this.spec.heal.range) {
        this.healClock += dt;
        if (this.healClock >= this.spec.heal.every) { this.healClock = 0; on.heal?.(); }
      } else this.healClock = 0;
    }
    // The beast frightens whoever comes near.
    if (this.spec.fear) {
      this.fearClock -= dt;
      if (this.fearClock <= 0) {
        this.fearClock = 1;
        for (const e of enemies) {
          if (Math.hypot(e.x - this.x, e.z - this.z) <= this.spec.fear.range) on.scare?.(e, this.spec.fear.seconds);
        }
      }
    }
    // Slowly back to full while nothing's happening.
    if (!target) this.hp = Math.min(this.spec.hp, this.hp + dt * 0.5);
  }

  stepTowards(tx, tz, dt, speed) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.moving = false; return; }
    const step = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * step, nz = this.z + (dz / d) * step;
    // It climbs what a deer could and goes round nothing — a guardian is
    // never stuck behind a fence for long: it just finds its feet past it.
    const g = groundAt(this.world, nx, nz, this.y + 1.5, TALL);
    this.x = nx; this.z = nz;
    if (g != null) this.y = g;
    this.facing = Math.atan2(dx, dz);
    this.moving = true;
  }

  /** The look ray's distance to it, if it passes close enough to count as pointing at it. */
  pick(origin, dir, maxDistance = 12) {
    if (this.downed > 0) return null;
    const dx = this.x - origin.x, dy = this.y + 1 - origin.y, dz = this.z - origin.z;
    const t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (t < 0 || t > maxDistance) return null;
    const off = Math.hypot(dx - dir.x * t, dy - dir.y * t, dz - dir.z * t);
    return off < 1.3 ? t : null;
  }

  toJSON() {
    return {
      ring: this.ring, mode: this.mode, hp: Math.round(this.hp), downed: Math.round(this.downed),
      home: this.home, x: this.x, y: this.y, z: this.z,
    };
  }
}
