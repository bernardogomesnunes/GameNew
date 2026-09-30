import { MOBS_BY_ID, mobsForBiome } from '../config/mobs.js';
import { BIOMES } from '../config/biomes.js';
import { WATER } from '../config/blocks.js';

/**
 * The animals living around you: where they turn up, how they get about,
 * and what happens when you hit one.
 *
 * Nothing here is saved. Wild animals are scenery that happens to be
 * huntable — they turn up in the country around you, keep to their own
 * biome, and are forgotten once you've walked far enough away, the same way
 * far chunks are. That keeps the save format exactly as it was.
 *
 * Pure logic, no THREE: MobView draws `list`, Game routes the Break button
 * here through `pick` and `hit`.
 */

const CAP = 24;             // animals alive at once, all species together
const SPAWN_EVERY = 1.2;    // seconds between attempts to bring a herd in
const SPAWN_MIN = 24;       // never pop into view right beside you...
const SPAWN_MAX = 60;       // ...nor so far out you'll never meet them
const DESPAWN = 96;         // gone once you're this far away
const SCARE = 7;            // how close a skittish animal lets you come
const FLEE_TIME = 4;        // seconds of running after a scare or a hit
const HURT_FLASH = 0.25;    // seconds an animal shows red after a hit
const DYING_TIME = 0.6;     // seconds it takes to topple before it's gone
const GRAVITY = 22;
const STEP = 1;             // the highest ledge an animal walks up
const DROP = 3;             // the furthest drop it will walk off

const LEAVES = new Set([5, 42, 44]);

export class Mobs {
  /**
   * @param avoid  (x, z) => true where nothing should spawn — your own
   *               settlement, so a herd doesn't appear in the middle of it.
   */
  constructor({ world, rand = Math.random, avoid = null, cap = CAP }) {
    this.world = world;
    this.rand = rand;
    this.avoid = avoid;
    this.cap = cap;
    this.list = [];
    this.nextId = 1;
    this.sinceSpawn = SPAWN_EVERY;
  }

  tick(dt, player) {
    this.list = this.list.filter((m) => !m.dead && Math.hypot(m.x - player.x, m.z - player.z) < DESPAWN);
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= SPAWN_EVERY && this.list.length < this.cap) {
      this.sinceSpawn = 0;
      this.trySpawn(player);
    }
    for (const m of this.list) {
      this.think(m, dt, player);
      this.move(m, dt);
    }
  }

  // ---- arriving -----------------------------------------------------------

  /** One try at bringing a herd in somewhere out of sight but not too far. */
  trySpawn(player) {
    const a = this.rand() * Math.PI * 2;
    const r = SPAWN_MIN + this.rand() * (SPAWN_MAX - SPAWN_MIN);
    const x = Math.floor(player.x + Math.cos(a) * r);
    const z = Math.floor(player.z + Math.sin(a) * r);
    if (this.avoid?.(x, z) || !this.loaded(x, z)) return 0;
    const biome = BIOMES[this.world.biomeIndex(x, z)]?.id;
    const spec = this.choose(mobsForBiome(biome));
    if (!spec) return 0;
    const ground = this.surfaceAt(x, z);
    if (ground == null) return 0;

    const [lo, hi] = spec.herd;
    const want = Math.min(lo + Math.floor(this.rand() * (hi - lo + 1)), this.cap - this.list.length);
    let made = 0;
    for (let i = 0; i < want * 3 && made < want; i++) {
      const hx = x + 0.5 + (i ? (this.rand() - 0.5) * 6 : 0);
      const hz = z + 0.5 + (i ? (this.rand() - 0.5) * 6 : 0);
      if (this.avoid?.(Math.floor(hx), Math.floor(hz))) continue;
      const y = i ? this.groundAt(hx, hz, ground, spec) : ground;
      if (y == null) continue;
      this.list.push(this.make(spec, hx, y, hz));
      made++;
    }
    return made;
  }

  make(spec, x, y, z) {
    return {
      id: this.nextId++, type: spec.id, x, y, z, vy: 0,
      facing: this.rand() * Math.PI * 2, hp: spec.hp,
      target: null, speed: 0, timer: this.rand() * 2,
      grazing: false, fleeFor: 0, hurt: 0, dying: 0, dead: false, stride: 0,
    };
  }

  /** A species picked by weight, or null for a biome nothing lives in. */
  choose(options) {
    if (!options.length) return null;
    let total = 0;
    for (const o of options) total += o.weight ?? 1;
    let roll = this.rand() * total;
    for (const o of options) {
      roll -= o.weight ?? 1;
      if (roll < 0) return o;
    }
    return options[options.length - 1];
  }

  // ---- ground -------------------------------------------------------------

  /** Whether a column's chunk already exists — never generate one by looking. */
  loaded(x, z) {
    return this.world.hasChunk(Math.floor(x) >> 4, Math.floor(z) >> 4);
  }

  /**
   * The ground at the top of a column, or null for water, treetops, or a
   * column not generated yet. Where a herd first lands.
   */
  surfaceAt(x, z) {
    if (!this.loaded(x, z)) return null;
    const w = this.world;
    const start = Math.min(w.height - 1, (w.surfaceHeight(x, z) | 0) + 8);
    for (let y = start; y >= 0; y--) {
      const id = w.getBlock(x, y, z);
      if (id === 0) continue;
      if (id === WATER || LEAVES.has(id)) return null;
      const box = w.collisionBoxAt(x, y, z);
      if (!box) continue;
      return box.maxY;
    }
    return null;
  }

  /**
   * Where an animal would stand at (x, z) coming from height `fromY`: a
   * step up of one at most, a drop of three at most, headroom for its body,
   * and never into water. Null means it can't go there.
   */
  groundAt(x, z, fromY, spec) {
    if (!this.loaded(x, z)) return null;
    const w = this.world;
    const bx = Math.floor(x), bz = Math.floor(z);
    const base = Math.floor(fromY);
    const tall = Math.max(1, Math.ceil(spec.leg + spec.body.h));
    for (let y = base + STEP; y >= base - DROP; y--) {
      const box = w.collisionBoxAt(bx, y, bz);
      if (!box) {
        if (w.getBlock(bx, y, bz) === WATER) return null;
        continue;
      }
      if (LEAVES.has(w.getBlock(bx, y, bz))) return null;
      if (box.maxY > fromY + STEP + 0.01) return null;
      for (let h = y + 1; h <= y + tall; h++) {
        if (w.collisionBoxAt(bx, h, bz)) return null;
      }
      return box.maxY;
    }
    return null;
  }

  // ---- behaving -----------------------------------------------------------

  think(m, dt, player) {
    const spec = MOBS_BY_ID.get(m.type);
    m.hurt = Math.max(0, m.hurt - dt);
    if (m.dying > 0) {
      m.dying -= dt;
      if (m.dying <= 0) m.dead = true;
      return;
    }
    const dx = m.x - player.x, dz = m.z - player.z;
    const d = Math.hypot(dx, dz) || 1;

    if (spec.skittish && d < SCARE && m.fleeFor <= 0) m.fleeFor = FLEE_TIME * 0.6;
    if (m.fleeFor > 0) {
      m.fleeFor -= dt;
      m.grazing = false;
      // Straight away from you, re-aimed every beat so it doesn't run in a
      // line while you circle it.
      if (!m.target || m.timer <= 0) {
        const away = Math.atan2(dx, dz) + (this.rand() - 0.5) * 0.9;
        m.target = { x: m.x + Math.sin(away) * 8, z: m.z + Math.cos(away) * 8 };
        m.timer = 0.8;
      }
      m.speed = spec.run;
      m.timer -= dt;
      return;
    }

    m.timer -= dt;
    if (m.timer > 0) return;
    if (this.rand() < 0.45) {
      m.target = null;
      m.speed = 0;
      m.grazing = true;
      m.timer = 2 + this.rand() * 4;
    } else {
      const a = this.rand() * Math.PI * 2, r = 2 + this.rand() * 5;
      m.target = { x: m.x + Math.sin(a) * r, z: m.z + Math.cos(a) * r };
      m.speed = spec.walk;
      m.grazing = false;
      m.timer = 3 + this.rand() * 4;
    }
  }

  move(m, dt) {
    const spec = MOBS_BY_ID.get(m.type);
    if (m.dying > 0) return this.fall(m, dt, spec);
    if (m.target && m.speed > 0) {
      const dx = m.target.x - m.x, dz = m.target.z - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        m.target = null;
        m.speed = 0;
      } else {
        const step = Math.min(dist, m.speed * dt);
        const nx = m.x + (dx / dist) * step, nz = m.z + (dz / dist) * step;
        const ground = this.groundAt(nx, nz, m.y, spec);
        m.facing = Math.atan2(dx, dz);
        if (ground == null) {
          // A wall, a cliff, water, or unmade land: give up on that way and
          // think again next frame.
          m.target = null;
          m.speed = 0;
          m.timer = 0;
        } else {
          m.x = nx;
          m.z = nz;
          m.stride += step;
          if (ground > m.y) { m.y = ground; m.vy = 0; }
        }
      }
    }
    this.fall(m, dt, spec);
  }

  /** Settles onto whatever is under it — a block dug away drops it down. */
  fall(m, dt, spec) {
    const ground = this.groundAt(m.x, m.z, m.y, spec);
    if (ground == null) { m.vy = 0; return; }
    if (m.vy <= 0 && m.y <= ground) { m.y = ground; m.vy = 0; return; }
    m.vy -= GRAVITY * dt;
    m.y += m.vy * dt;
    if (m.y <= ground) { m.y = ground; m.vy = 0; }
  }

  // ---- hunting ------------------------------------------------------------

  /**
   * The nearest live animal along a look ray within reach, as { mob, t }
   * with t the distance along the ray, or null.
   */
  pick(origin, dir, maxDistance) {
    let best = null;
    for (const m of this.list) {
      if (m.dying > 0 || m.dead) continue;
      const spec = MOBS_BY_ID.get(m.type);
      // An upright box around the whole animal, as wide as it is long so
      // which way it faces doesn't matter — generous, which is the point:
      // an animal you have to hit dead centre is one you never catch.
      const half = Math.max(spec.body.w, spec.body.l + spec.head * 0.6) / 2 + 0.1;
      const t = rayBox(origin, dir,
        m.x - half, m.y, m.z - half,
        m.x + half, m.y + spec.leg + spec.body.h + spec.head * 0.5, m.z + half);
      if (t != null && t <= maxDistance && (!best || t < best.t)) best = { mob: m, t };
    }
    return best;
  }

  /**
   * One blow from (fromX, fromZ). It runs either way; at zero it topples
   * and this hands back what it left behind.
   */
  hit(m, damage, fromX, fromZ) {
    const spec = MOBS_BY_ID.get(m.type);
    m.hp -= damage;
    m.hurt = HURT_FLASH;
    m.grazing = false;
    if (m.hp <= 0) {
      m.dying = DYING_TIME;
      m.target = null;
      m.speed = 0;
      return { killed: true, drops: this.rollDrops(spec) };
    }
    m.fleeFor = FLEE_TIME;
    m.timer = 0;
    m.vy = 4; // a startled hop
    const away = Math.atan2(m.x - fromX, m.z - fromZ);
    const kx = m.x + Math.sin(away) * 0.5, kz = m.z + Math.cos(away) * 0.5;
    const ground = this.groundAt(kx, kz, m.y, spec);
    if (ground != null) { m.x = kx; m.z = kz; }
    return { killed: false, drops: {} };
  }

  rollDrops(spec) {
    const out = {};
    for (const [id, [lo, hi]] of Object.entries(spec.drops)) {
      const n = lo + Math.floor(this.rand() * (hi - lo + 1));
      if (n > 0) out[id] = n;
    }
    return out;
  }
}

/** Distance along a ray to where it enters a box, or null if it misses. */
export function rayBox(o, d, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0, tmax = Infinity;
  for (const [oo, dd, lo, hi] of [[o.x, d.x, minX, maxX], [o.y, d.y, minY, maxY], [o.z, d.z, minZ, maxZ]]) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return null;
      continue;
    }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

