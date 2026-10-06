import { groundAt, bodyFits } from './Mobs.js';
import { roofPart } from '../config/blocks.js';
import { UNITS_BY_ID, LEGACY_UNIT } from '../config/soldiers.js';

/**
 * Your side of the war (the defence buildings — config/structures.js): the
 * soldiers a barracks trains, and the archers a watchtower posts.
 *
 *   Soldiers  a barracks trains who you pay it to (config/soldiers.js —
 *             warriors, swordsmen, archers and catapult crews), one at a
 *             time while you play, up to a soldier a bunk. They stand at
 *             their barracks, and when anything of the Stone Kingdom's — or
 *             a raiding bandit — comes within reach of it, they go for it:
 *             swords close in, archers shoot from where they are, a crew
 *             sets its catapult up and lobs stones. Beaten, a soldier is
 *             gone, and training another costs the same again.
 *   Archers   two on the lookout of every watchtower. They shoot at
 *             whatever comes within range, arrows you can see fly.
 *
 * Pure logic like Mobs and the Guardian: Game draws them, and hands in the
 * enemies and what a blow or an arrow does to one.
 */

export const SOLDIER = { hp: 24, hits: 4, reach: 1.9, every: 1.1, speed: 3.2, range: 28, leash: 44 };
export const TOWER_ARCHER = { range: 26, every: 2.2, damage: 3 };
/** A barracks trains a soldier in this much of a game day. Melee stats for a soldier of no unit (the showcase's). */
export const TRAIN_DAYS = 0.15;
/** Bunks beyond this train no more. */
export const MAX_SOLDIERS = 6;
const ARROW_SPEED = 26;
const TALL = 2;
const TABARD = 0xdfe6f2, STEEL = 0xb9bec6, ARCHER_COAT = 0x5f7f4a, HOOD = 0x3f5a34;

/**
 * One step for someone on foot towards (tx, tz), round what's in the way
 * rather than through it: straight on if it can, else a little to either
 * side, wider each try. Shared by your soldiers and your army.
 */
export function stepAround(world, s, tx, tz, dt, speed) {
  const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return false;
  s.speed = speed;
  const len = Math.min(d, speed * dt);
  const a = Math.atan2(dx, dz);
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const nx = s.x + Math.sin(a + turn) * len, nz = s.z + Math.cos(a + turn) * len;
    const g = groundAt(world, nx, nz, s.y, TALL);
    if (g == null || !bodyFits(world, nx, nz, g)) continue;
    s.x = nx; s.z = nz; s.y = g;
    return true;
  }
  return false;
}

export class Defenders {
  constructor({ world, rand = Math.random }) {
    this.world = world;
    this.rand = rand;
    this.soldiers = [];
    this.archers = [];
    this.arrows = [];
    // Per barracks: who it has trained, who it's training next, and the
    // day it started on the first of those.
    this.trained = {}; // structureId -> { roster: [unitId], queue: [unitId], since }
    this.nextId = 1;
  }

  /** Everyone of yours, to draw. */
  get people() {
    return [...this.soldiers, ...this.archers];
  }

  /** The catapults your crews have set up, to draw: { x, y, z, facing, swing }. */
  get engines() {
    return this.soldiers.filter((s) => s.engine).map((s) => s.engine);
  }

  /** What a barracks has: { roster, queue, since } — trained, waiting, and since when. */
  barracks(id) {
    return this.trained[String(id)] ?? { roster: [], queue: [], since: 0 };
  }

  /**
   * Puts one `unit` in line at barracks `id` (paid for already — see
   * DuiltGame.trainSoldier). Training starts now if nobody is ahead of it.
   */
  order(id, unit, days) {
    const key = String(id);
    const t = this.trained[key] ?? (this.trained[key] = { roster: [], queue: [], since: days });
    if (!t.queue.length) t.since = days;
    t.queue.push(unit);
    return t;
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
        const t = this.trained[b.id] ?? (this.trained[b.id] = { roster: [], queue: [], since: days });
        // The next in line joins every TRAIN_DAYS.
        while (t.queue.length && days - t.since >= TRAIN_DAYS) { t.roster.push(t.queue.shift()); t.since += TRAIN_DAYS; }
        if (!t.queue.length) t.since = days;
        // Everyone on the roster stands at their place in front of it, a
        // bunk each: whoever isn't there yet comes out.
        const bunks = Math.min(MAX_SOLDIERS, b.beds ?? 0);
        const yard = this.parade(b.region);
        const here = this.soldiers.filter((s) => s.post.of === b.id);
        t.roster.slice(0, bunks).forEach((unit, i) => {
          if (!yard || here.some((s) => s.slot === i)) return;
          const spot = { x: yard.x + (i % 3) - 1, y: yard.y, z: yard.z + Math.floor(i / 3) };
          const s = this.person(UNITS_BY_ID.get(unit)?.kind ?? 'soldier', spot, b.id, unit);
          s.slot = i;
          this.soldiers.push(s);
        });
      }
    }
  }

  /** A figure of yours: a tower's archer, or one of a barracks's soldiers trained as `unit`. */
  person(kind, spot, of, unit = null) {
    const u = UNITS_BY_ID.get(unit);
    const tower = kind === 'archer' && !u;
    return {
      id: `d${this.nextId++}`, kind, unit, x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5,
      post: { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5, of },
      hp: u?.hp ?? (tower ? 1 : SOLDIER.hp), cooldown: this.rand() * 1.5, hurt: 0,
      colour: tower ? ARCHER_COAT : TABARD, helm: tower ? HOOD : STEEL,
      name: u ? `Your ${u.name.toLowerCase()}` : tower ? 'Your archer' : 'Your soldier',
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
    for (const s of this.soldiers) {
      const u = UNITS_BY_ID.get(s.unit);
      if (u?.ranged) this.bowman(s, u, dt, enemies);
      else if (u?.siege) this.crew(s, u, dt, enemies, on);
      else this.soldier(s, dt, enemies, on);
    }
    this.soldiers = this.soldiers.filter((s) => s.hp > 0);
    for (const a of this.archers) this.archer(a, dt, enemies);
    this.flyArrows(dt, on);
  }

  soldier(s, dt, enemies, on) {
    const u = UNITS_BY_ID.get(s.unit);
    const m = u?.melee ?? SOLDIER, speed = u?.speed ?? SOLDIER.speed;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const target = this.nearestTo(s.post, enemies, SOLDIER.range);
    s.target = target ? { x: target.x, z: target.z } : null;
    s.foe = target;
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (target && away < SOLDIER.leash) {
      const d = Math.hypot(target.x - s.x, target.z - s.z);
      if (d > m.reach * 0.8) this.step(s, target.x, target.z, dt, speed);
      else s.speed = 0;
      if (d <= m.reach && s.cooldown <= 0) {
        s.cooldown = m.every;
        on.strike?.(target, m.hits, s);
      }
      return;
    }
    this.standEasy(s, dt, u);
  }

  /** Nothing to fight: back to the post, and get their breath back there. */
  standEasy(s, dt, u) {
    s.foe = null;
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (away > 0.4) { s.target = { x: s.post.x, z: s.post.z }; this.step(s, s.post.x, s.post.z, dt, (u?.speed ?? SOLDIER.speed) * 0.7); }
    else { s.target = null; s.speed = 0; s.hp = Math.min(u?.hp ?? SOLDIER.hp, s.hp + dt * 0.5); }
  }

  /** The enemy nearest `at`, within `range` of it, or null. */
  nearestTo(at, enemies, range) {
    let target = null, best = range;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - at.x, e.z - at.z);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  /**
   * A barracks archer: out from its post towards whatever's coming, only as
   * far as it takes to have it in range, and shooting from there.
   */
  bowman(s, u, dt, enemies) {
    const r = u.ranged;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const target = this.nearestTo(s.post, enemies, SOLDIER.range);
    s.foe = target;
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (!target || away >= SOLDIER.leash) return this.standEasy(s, dt, u);
    const d = Math.hypot(target.x - s.x, target.z - s.z);
    if (d > r.range * 0.85) { s.target = { x: target.x, z: target.z }; this.step(s, target.x, target.z, dt, u.speed); }
    else { s.target = null; s.speed = 0; }
    s.facing = Math.atan2(target.x - s.x, target.z - s.z);
    if (d <= r.range && s.cooldown <= 0) {
      s.cooldown = r.every;
      this.loose(s, target, r.damage);
    }
  }

  /**
   * A catapult crew: they stay by their barracks. When the enemy comes
   * within throw of it they set the catapult up in front of them, then lob
   * a stone at the nearest every so often; with nobody left to throw at for
   * a while, they pack it away again. `on.lob(engine, target, crew)` throws.
   */
  crew(s, u, dt, enemies, on) {
    const g = u.siege;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const target = this.nearestTo(s.post, enemies, g.range);
    if (!target) {
      s.idle = (s.idle ?? 0) + dt;
      if (s.engine && s.idle >= g.packAfter) { s.engine = null; s.setup = null; }
      if (s.engine?.swing > 0) s.engine.swing = Math.max(0, s.engine.swing - dt);
      return this.standEasy(s, dt, u);
    }
    s.idle = 0;
    s.foe = target;
    // Back at the post first: it goes up where they stand.
    if (Math.hypot(s.x - s.post.x, s.z - s.post.z) > 0.4) { s.target = { x: s.post.x, z: s.post.z }; this.step(s, s.post.x, s.post.z, dt, u.speed); return; }
    s.target = null; s.speed = 0;
    const facing = Math.atan2(target.x - s.x, target.z - s.z);
    s.facing = facing;
    if (!s.engine) {
      s.setup = (s.setup ?? g.setup) - dt;
      if (s.setup > 0) return;
      // Set up a little in front of them, towards the enemy.
      s.engine = { x: s.x + Math.sin(facing) * 1.6, y: s.y, z: s.z + Math.cos(facing) * 1.6, facing, swing: 0, crew: s };
      s.cooldown = Math.max(s.cooldown, 1);
    }
    const e = s.engine;
    e.facing = Math.atan2(target.x - e.x, target.z - e.z);
    if (e.swing > 0) e.swing = Math.max(0, e.swing - dt);
    if (s.cooldown > 0) return;
    s.cooldown = g.every;
    e.swing = 0.6;
    on.lob?.(e, target, s);
  }

  /** An arrow from `a` at `target`, straight at where it stands, landing when it gets there. */
  loose(a, target, damage) {
    const from = { x: a.x, y: a.y + 1.4, z: a.z };
    const to = { x: target.x, y: target.y + 1.1, z: target.z };
    const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
    const t = d / ARROW_SPEED;
    this.arrows.push({
      x: from.x, y: from.y, z: from.z,
      vx: (to.x - from.x) / t, vy: (to.y - from.y) / t, vz: (to.z - from.z) / t,
      left: t, target, from: a, age: 0, ours: true, damage,
    });
  }

  /** One step for a soldier, round what's in the way rather than through it. */
  step(s, tx, tz, dt, speed) {
    stepAround(this.world, s, tx, tz, dt, speed);
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
    this.loose(a, target, TOWER_ARCHER.damage);
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
      if (!e.dead && Math.hypot(e.x - r.x, e.z - r.z) < 1.4) { r.done = true; on.shot?.(e, r.damage ?? TOWER_ARCHER.damage, r.from); }
      else r.stuck = true;
    }
    this.arrows = this.arrows.filter((r) => !r.done && r.age < 4);
  }

  /** A blow from the enemy on one of your soldiers. Fallen, they're off their barracks's roster. */
  hurt(s, damage) {
    s.hp -= damage;
    s.hurt = 0.3;
    if (s.hp > 0) return false;
    const t = this.trained[s.post.of];
    if (t) {
      const i = t.roster[s.slot] === s.unit ? s.slot : t.roster.indexOf(s.unit);
      if (i >= 0) t.roster.splice(i, 1);
      // The others keep their places; the one fallen leaves a gap at the end.
      for (const o of this.soldiers) if (o.post.of === s.post.of && o !== s && o.slot > s.slot) o.slot--;
      s.slot = -1;
    }
    return true;
  }

  toJSON() {
    return { trained: this.trained };
  }

  loadJSON(data) {
    this.trained = {};
    const known = (list) => (Array.isArray(list) ? list.filter((u) => UNITS_BY_ID.has(u)) : []);
    for (const [id, t] of Object.entries(data?.trained ?? {})) {
      if (!Number.isFinite(t?.since)) continue;
      // Saved before you chose who to train: so many soldiers, all the same.
      if (Number.isInteger(t.count)) this.trained[id] = { roster: Array(Math.min(t.count, MAX_SOLDIERS)).fill(LEGACY_UNIT), queue: [], since: t.since };
      else this.trained[id] = { roster: known(t.roster).slice(0, MAX_SOLDIERS), queue: known(t.queue), since: t.since };
    }
    this.soldiers = [];
    this.archers = [];
  }
}
