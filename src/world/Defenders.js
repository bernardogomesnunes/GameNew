import { groundAt } from './Mobs.js';
import { roofPart } from '../config/blocks.js';

/**
 * Your side of the war (the defence buildings — config/structures.js): the
 * soldiers a barracks trains, and the archers a watchtower posts.
 *
 *   Soldiers  one for every bunk in a barracks (up to six), trained one at
 *             a time while you play. They stand at their barracks, and when
 *             anything of the Stone Kingdom's — or a raiding bandit — comes
 *             within reach of it, they march out and fight it. Beaten, a
 *             soldier is gone, and the barracks trains another.
 *   Archers   two on the lookout of every watchtower. They shoot at
 *             whatever comes within range, arrows you can see fly.
 *
 * Pure logic like Mobs and the Guardian: Game draws them, and hands in the
 * enemies and what a blow or an arrow does to one.
 */

export const SOLDIER = { hp: 24, hits: 4, reach: 1.9, every: 1.1, speed: 3.2, range: 28, leash: 44 };
export const TOWER_ARCHER = { range: 26, every: 2.2, damage: 3 };
/** A barracks trains a soldier in this much of a game day. */
export const TRAIN_DAYS = 0.15;
/** Bunks beyond this train no more. */
export const MAX_SOLDIERS = 6;
const ARROW_SPEED = 26;
const TALL = 2;
const TABARD = 0xdfe6f2, STEEL = 0xb9bec6, ARCHER_COAT = 0x5f7f4a, HOOD = 0x3f5a34;

export class Defenders {
  constructor({ world, rand = Math.random }) {
    this.world = world;
    this.rand = rand;
    this.soldiers = [];
    this.archers = [];
    this.arrows = [];
    // Per barracks: how many it has trained, and the day it started on the next.
    this.trained = {}; // structureId -> { count, since }
    this.nextId = 1;
  }

  /** Everyone of yours, to draw. */
  get people() {
    return [...this.soldiers, ...this.archers];
  }

  /**
   * Brings the posts in line with the buildings standing now: a barracks's
   * soldiers trained up to its bunks as the days pass, two archers on each
   * watchtower, and nobody left at a building that's gone or broken.
   *
   * @param buildings  [{ id, type, region, valid, beds }] — your claimed ones
   * @param days       the world's own count of days (DuiltGame.days)
   */
  sync(buildings, days) {
    // Ids as strings throughout: the training is saved as JSON, whose keys are.
    const standing = new Map(buildings.filter((b) => b.valid).map((b) => [String(b.id), { ...b, id: String(b.id) }]));
    this.soldiers = this.soldiers.filter((s) => standing.get(s.post.of)?.type === 'barracks');
    this.archers = this.archers.filter((a) => standing.get(a.post.of)?.type === 'watchtower');
    for (const id of Object.keys(this.trained)) if (standing.get(id)?.type !== 'barracks') delete this.trained[id];

    for (const b of standing.values()) {
      if (b.type === 'watchtower') {
        if (this.archers.some((a) => a.post.of === b.id)) continue;
        for (const spot of this.lookout(b.region)) this.archers.push(this.person('archer', spot, b.id));
      } else if (b.type === 'barracks') {
        const bunks = Math.min(MAX_SOLDIERS, b.beds ?? 0);
        const t = this.trained[b.id] ?? (this.trained[b.id] = { count: 0, since: days });
        // One more each TRAIN_DAYS, up to a soldier a bunk.
        while (t.count < bunks && days - t.since >= TRAIN_DAYS) { t.count++; t.since += TRAIN_DAYS; }
        if (t.count >= bunks) t.since = days;
        const here = this.soldiers.filter((s) => s.post.of === b.id);
        const yard = this.parade(b.region);
        for (let i = here.length; i < t.count && yard; i++) {
          const spot = { x: yard.x + (i % 3) - 1, y: yard.y, z: yard.z + Math.floor(i / 3) };
          this.soldiers.push(this.person('soldier', spot, b.id));
        }
      }
    }
  }

  person(kind, spot, of) {
    return {
      id: `d${this.nextId++}`, kind, x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5,
      post: { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5, of },
      hp: kind === 'soldier' ? SOLDIER.hp : 1, cooldown: this.rand() * 1.5, hurt: 0,
      colour: kind === 'soldier' ? TABARD : ARCHER_COAT, helm: kind === 'soldier' ? STEEL : HOOD,
      name: kind === 'soldier' ? 'Your soldier' : 'Your archer',
      target: null, speed: 0,
    };
  }

  /**
   * Two places to stand on a tower's top: the highest floor with headroom
   * — not on its roof — either side of the middle.
   */
  lookout(r) {
    const cx = Math.floor((r.minX + r.maxX) / 2), cz = Math.floor((r.minZ + r.maxZ) / 2);
    const near = [[cx - 1, cz - 1], [cx + 1, cz + 1], [cx + 1, cz - 1], [cx - 1, cz + 1], [cx, cz - 1], [cx, cz + 1], [cx - 1, cz], [cx + 1, cz]];
    for (let y = r.maxY; y > r.minY + 2; y--) {
      const spots = near.filter(([x, z]) => this.standable(x, y, z) && !roofPart(this.world.getBlock(x, y - 1, z)))
        .slice(0, 2).map(([x, z]) => ({ x, y, z }));
      if (spots.length === 2) return spots;
    }
    return [];
  }

  /**
   * Where a barracks's soldiers form up: open ground just outside it,
   * nearest the middle of its front (-z) — out where they can march from,
   * not shut in a yard behind a gate.
   */
  parade(r) {
    const cx = (r.minX + r.maxX) / 2;
    let best = null;
    for (let z = r.minZ - 3; z <= r.maxZ + 3; z++) {
      for (let x = r.minX - 3; x <= r.maxX + 3; x++) {
        const inside = x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
        if (inside) continue;
        for (let y = r.minY - 1; y <= r.minY + 2; y++) {
          if (!this.standable(x, y, z)) continue;
          const d = Math.abs(x - cx) + Math.abs(z - (r.minZ - 2)) * 2;
          if (!best || d < best.d) best = { x, y, z, d };
        }
      }
    }
    return best;
  }

  standable(x, y, z) {
    const w = this.world;
    return !!w.collisionBoxAt(x, y - 1, z) && !w.collisionBoxAt(x, y, z) && !w.collisionBoxAt(x, y + 1, z);
  }

  /**
   * @param enemies  who may be fought — [{ x, y, z, hp, dead }]
   * @param on       { strike(enemy, damage, from), shot(enemy, damage, from) }
   */
  tick(dt, enemies, on = {}) {
    for (const s of this.soldiers) this.soldier(s, dt, enemies, on);
    this.soldiers = this.soldiers.filter((s) => s.hp > 0);
    for (const a of this.archers) this.archer(a, dt, enemies);
    this.flyArrows(dt, on);
  }

  soldier(s, dt, enemies, on) {
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    // Whoever's nearest their post, within reach of it.
    let target = null, best = SOLDIER.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - s.post.x, e.z - s.post.z);
      if (d < best) { best = d; target = e; }
    }
    s.target = target ? { x: target.x, z: target.z } : null;
    s.foe = target;
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (target && away < SOLDIER.leash) {
      const d = Math.hypot(target.x - s.x, target.z - s.z);
      if (d > SOLDIER.reach * 0.8) this.step(s, target.x, target.z, dt, SOLDIER.speed);
      else s.speed = 0;
      if (d <= SOLDIER.reach && s.cooldown <= 0) {
        s.cooldown = SOLDIER.every;
        on.strike?.(target, SOLDIER.hits, s);
      }
      return;
    }
    // Nothing to fight: back to the post, and stand easy there.
    s.foe = null;
    if (away > 0.4) { s.target = { x: s.post.x, z: s.post.z }; this.step(s, s.post.x, s.post.z, dt, SOLDIER.speed * 0.7); }
    else { s.target = null; s.speed = 0; s.hp = Math.min(SOLDIER.hp, s.hp + dt * 0.5); }
  }

  /** One step for a soldier, round what's in the way rather than through it. */
  step(s, tx, tz, dt, speed) {
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    s.speed = speed;
    const len = Math.min(d, speed * dt);
    const a = Math.atan2(dx, dz);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const nx = s.x + Math.sin(a + turn) * len, nz = s.z + Math.cos(a + turn) * len;
      const g = groundAt(this.world, nx, nz, s.y, TALL);
      if (g == null) continue;
      s.x = nx; s.z = nz; s.y = g;
      return;
    }
  }

  archer(a, dt, enemies) {
    a.cooldown = Math.max(0, a.cooldown - dt);
    let target = null, best = TOWER_ARCHER.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - a.x, e.z - a.z);
      if (d < best) { best = d; target = e; }
    }
    a.target = null;
    if (!target) return;
    a.facing = Math.atan2(target.x - a.x, target.z - a.z);
    if (a.cooldown > 0) return;
    a.cooldown = TOWER_ARCHER.every;
    // Straight at where it stands, dropping a little: it lands when it gets there.
    const from = { x: a.x, y: a.y + 1.4, z: a.z };
    const to = { x: target.x, y: target.y + 1.1, z: target.z };
    const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
    const t = d / ARROW_SPEED;
    this.arrows.push({
      x: from.x, y: from.y, z: from.z,
      vx: (to.x - from.x) / t, vy: (to.y - from.y) / t, vz: (to.z - from.z) / t,
      left: t, target, from: a, age: 0, ours: true,
    });
  }

  flyArrows(dt, on) {
    for (const r of this.arrows) {
      r.age += dt;
      if (r.stuck) continue;
      const step = Math.min(dt, r.left);
      r.x += r.vx * step; r.y += r.vy * step; r.z += r.vz * step;
      r.left -= step;
      if (r.left > 0) continue;
      // There: in it if it's still about where it was, else in the ground.
      const e = r.target;
      if (!e.dead && Math.hypot(e.x - r.x, e.z - r.z) < 1.4) { r.done = true; on.shot?.(e, TOWER_ARCHER.damage, r.from); }
      else r.stuck = true;
    }
    this.arrows = this.arrows.filter((r) => !r.done && r.age < 4);
  }

  /** A blow from the enemy on one of your soldiers. */
  hurt(s, damage) {
    s.hp -= damage;
    s.hurt = 0.3;
    if (s.hp > 0) return false;
    const t = this.trained[s.post.of];
    if (t) t.count = Math.max(0, t.count - 1);
    return true;
  }

  toJSON() {
    return { trained: this.trained };
  }

  loadJSON(data) {
    this.trained = {};
    for (const [id, t] of Object.entries(data?.trained ?? {})) {
      if (Number.isInteger(t?.count) && Number.isFinite(t?.since)) this.trained[id] = { count: Math.min(t.count, MAX_SOLDIERS), since: t.since };
    }
    this.soldiers = [];
    this.archers = [];
  }
}
