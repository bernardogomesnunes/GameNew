import { isSoil, isFluid } from '../config/blocks.js';
import { isLoaded } from './Mobs.js';

/**
 * Fireflies — swarms of green lights that come out at night.
 *
 * Requested directly: "a mob called fireflies, that consist in dozens of
 * green neon dots that can show up at night." So: a handful of swarms at a
 * time over grass and forest floor round where you are, each a few dozen
 * dots drifting about a slowly wandering middle and blinking on and off.
 * They fade in as it gets dark and out again at dawn. Break, aimed at a
 * swarm, catches a few — what a Firefly Lantern is made with.
 *
 * Pure logic like Mobs: Game draws `dots()` with a FireflyView.
 */

export const SWARM = 32;          // dots in a fresh swarm
export const MAX_SWARMS = 7;
const NEAR = 10;                  // swarms gather between NEAR...
const RANGE = 40;                 // ...and RANGE blocks of you
const LEAVE = RANGE * 1.6;        // and are gone past this
const SPAWN_EVERY = 0.6;          // seconds between tries at a new swarm
const FADE = 4;                   // seconds to fade fully in or out
const CATCH = 5;                  // dots one catch takes
const SCATTER_BELOW = 6;          // a swarm this thin scatters
const LEAVES = new Set([5, 42, 44]);

export class Fireflies {
  constructor({ world, rand = Math.random }) {
    this.world = world;
    this.rand = rand;
    this.swarms = [];
    this.level = 0;     // 0 day .. 1 full night: how bright they all are
    this.clock = 0;
    this.untilSpawn = 0;
    this.nextId = 1;
  }

  /**
   * @param dark how dark it is, 0 (day) .. 1 (night). They're out above a
   *             third of the way.
   */
  tick(dt, player, dark) {
    this.clock += dt;
    const want = dark > 0.35 ? 1 : 0;
    this.level += Math.sign(want - this.level) * Math.min(Math.abs(want - this.level), dt / FADE);
    if (this.level <= 0) { this.swarms.length = 0; return; }

    this.swarms = this.swarms.filter((s) => s.dots.length >= SCATTER_BELOW
      && Math.hypot(s.x - player.x, s.z - player.z) < LEAVE);
    if (want) {
      this.untilSpawn -= dt;
      if (this.untilSpawn <= 0 && this.swarms.length < MAX_SWARMS) {
        this.untilSpawn = SPAWN_EVERY;
        this.spawnNear(player);
      }
    }
    // The middle of each swarm wanders slowly over the ground it's on.
    for (const s of this.swarms) {
      s.x = s.homeX + Math.sin(this.clock * 0.13 + s.phase) * 3;
      s.z = s.homeZ + Math.cos(this.clock * 0.11 + s.phase * 1.7) * 3;
    }
  }

  /** The ground a swarm hovers over at a column: grass, moss or forest floor, under trees or not. */
  groundAt(x, z) {
    if (!isLoaded(this.world, x, z)) return null;
    const w = this.world;
    for (let y = Math.min(w.height - 2, (w.surfaceHeight(x, z) | 0) + 10); y > 0; y--) {
      const id = w.getBlock(x, y, z);
      if (id === 0 || LEAVES.has(id) || id === 4 || id === 41 || id === 43) continue;
      if (isFluid(id) || !isSoil(id)) return null;
      return w.getBlock(x, y + 1, z) === 0 ? y + 1 : null;
    }
    return null;
  }

  /**
   * A new swarm somewhere round you, on the first of a few spots tried that
   * has grass or forest floor — so a patch of green in the desert still
   * gets its fireflies, and open sand doesn't.
   */
  spawnNear(player) {
    let x, z, y = null;
    for (let tries = 0; tries < 8 && y == null; tries++) {
      const a = this.rand() * Math.PI * 2, r = NEAR + this.rand() * (RANGE - NEAR);
      x = Math.floor(player.x + Math.cos(a) * r);
      z = Math.floor(player.z + Math.sin(a) * r);
      y = this.groundAt(x, z);
    }
    if (y == null) return null;
    const dots = [];
    for (let i = 0; i < SWARM; i++) {
      dots.push({
        // Each dot traces its own slow loop about the middle: radius, height, speed and phase.
        r: 0.6 + this.rand() * 3.2, h: 0.3 + this.rand() * 2.4,
        f1: 0.25 + this.rand() * 0.5, f2: 0.2 + this.rand() * 0.45, f3: 0.3 + this.rand() * 0.6,
        p1: this.rand() * 6.28, p2: this.rand() * 6.28, p3: this.rand() * 6.28,
        blink: 0.5 + this.rand() * 1.4, bp: this.rand() * 6.28,
      });
    }
    const s = { id: this.nextId++, homeX: x + 0.5, homeZ: z + 0.5, x: x + 0.5, y, z: z + 0.5, phase: this.rand() * 6.28, dots };
    this.swarms.push(s);
    return s;
  }

  /**
   * Every dot where it is now, and how bright: calls `each(x, y, z, glow)`
   * with glow 0..1 — on and off in slow pulses, all of it scaled by how
   * far into the night it is.
   */
  dots(each) {
    const t = this.clock;
    for (const s of this.swarms) {
      for (const d of s.dots) {
        const x = s.x + Math.sin(t * d.f1 + d.p1) * d.r;
        const z = s.z + Math.cos(t * d.f2 + d.p2) * d.r;
        const y = s.y + d.h + Math.sin(t * d.f3 + d.p3) * 0.5;
        const pulse = Math.max(0, Math.sin(t * d.blink + d.bp));
        each(x, y, z, this.level * (0.15 + 0.85 * pulse * pulse));
      }
    }
  }

  /** How many dots are out. */
  get count() {
    return this.swarms.reduce((n, s) => n + s.dots.length, 0);
  }

  /** The swarm a look ray passes through within `reach`, and how far along it, or null. */
  pick(origin, dir, reach) {
    let best = null;
    for (const s of this.swarms) {
      const cy = s.y + 1.4;
      const dx = s.x - origin.x, dy = cy - origin.y, dz = s.z - origin.z;
      const t = dx * dir.x + dy * dir.y + dz * dir.z;
      if (t < 0 || t > reach) continue;
      const off = Math.hypot(dx - dir.x * t, dy - dir.y * t, dz - dir.z * t);
      if (off < 2.2 && (!best || t < best.t)) best = { swarm: s, t };
    }
    return best;
  }

  /** A catch from a swarm: takes a few of its dots. Returns how many were caught. */
  catchFrom(s) {
    const n = Math.min(CATCH, s.dots.length);
    s.dots.splice(0, n);
    return n;
  }
}
