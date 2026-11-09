import { groundAt, bodyFits } from './Mobs.js';
import { roofPart } from '../config/blocks.js';
import { UNITS_BY_ID, LEGACY_UNIT, SOLDIER_CAPS } from '../config/soldiers.js';

/**
 * Your side of the war (the defence buildings — config/structures.js): the
 * soldiers a barracks trains, and the archers a watchtower posts.
 *
 *   Soldiers  a barracks trains who you pay it to (config/soldiers.js —
 *             warriors, swordsmen, archers and catapult crews), one at a
 *             time while you play, up to their building's capacity. They stand at
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

/**
 * `range`: they meet what comes within this of their post; `leash`: they chase
 * no further out. Owner, 8 November: "They should raid my city, not die 40
 * blocks out. They should come and attack my soldiers" (were 28 and 44).
 */
export const SOLDIER = { hp: 24, hits: 4, reach: 1.9, every: 1.1, speed: 3.2, range: 16, leash: 22 };
export const TOWER_ARCHER = { range: 26, every: 2.2, damage: 3 };
/** A barracks trains a soldier in this much of a game day. Melee stats for a soldier of no unit (the showcase's). */
export const TRAIN_DAYS = 0.15;
/** The most any one barracks holds (its top level; config/soldiers.js SOLDIER_CAPS). */
export const MAX_SOLDIERS = 40;
/** A soldier who went without their meal hits this much as hard, and doesn't get their breath back. */
export const HUNGRY_STRENGTH = 0.6;
/** A blow or an arrow from `s`, as hard as they can manage today. */
export const blowOf = (s, hits) => (s.hungry ? Math.max(1, Math.round(hits * HUNGRY_STRENGTH)) : hits);
const ARROW_SPEED = 26;
/**
 * Idle soldiers patrol within PATROL blocks of their post, resting REST_MIN
 * to REST_MIN + REST_MORE seconds between walks; a walk that is blocked ends
 * with a short BLOCKED pause, then they head somewhere else (owner, 4
 * November: they "seem stuck in one place").
 */
const PATROL = 7, REST_MIN = 1, REST_MORE = 3.5, BLOCKED = 0.4;
/** A walk that has not got GIVE_UP_BY blocks nearer in GIVE_UP_AFTER seconds is given up. */
const GIVE_UP_AFTER = 2.5, GIVE_UP_BY = 0.5;
const TALL = 2;

/**
 * What a barracks's or Garrison's soldiers do between fights (IMP-37). Owner,
 * 9 November: "soldiers from barracks and garrison should have order:
 * defense which have then ready to defend the village, around the building,
 * patrol (which has 1 of them patrol the village) and formation to call all
 * of them to the front of the building. They are always gathering at the
 * front now."
 *
 *   defend     posts spread all round the building, two blocks out from its
 *              walls; each strolls within DEFEND_ROAM of its post
 *   patrol     the same, except one sword (the first trained) walks a loop
 *              round the whole village and fights whatever it meets
 *   formation  everyone lined up in front of the building, standing still
 */
export const ORDERS = [
  { id: 'defend', name: 'Defend', blurb: 'Spread round the building, ready for anything that comes at the village.' },
  { id: 'patrol', name: 'Patrol', blurb: 'One of them walks round the village; the rest stand round the building.' },
  { id: 'formation', name: 'Formation', blurb: 'All of them lined up in front of the building.' },
];
export const DEFAULT_ORDER = 'defend';
const ORDER_IDS = new Set(ORDERS.map((o) => o.id));
const DEFEND_ROAM = 3;
/** How far out from the village's buildings the patrol walks, and how near a corner counts as reached. */
const ROUTE_MARGIN = 4, AT_CORNER = 1.2;
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
    // How many of the soldiers went without their meal (Settlers.eat): the
    // first that many fight weaker until they're fed.
    this.hungry = 0;
    this.nextId = 1;
    // Per barracks: its standing order (ORDERS); missing means DEFAULT_ORDER.
    this.orders = {};
    // Barracks whose soldiers need new posts: their order changed, or
    // somebody joined.
    this.repost = new Set();
    // The patrol's loop round the village: [{ x, z }], from sync.
    this.route = [];
  }

  /** A barracks's standing order: 'defend', 'patrol' or 'formation'. */
  orderOf(id) {
    return this.orders[String(id)] ?? DEFAULT_ORDER;
  }

  /** Gives barracks `id` a standing order; its soldiers walk to their new places on the next sync. */
  setOrder(id, order) {
    if (!ORDER_IDS.has(order)) return false;
    const key = String(id);
    if (this.orderOf(key) === order) return true;
    this.orders[key] = order;
    this.repost.add(key);
    return true;
  }

  /** Everyone of yours, to draw. */
  get people() {
    return [...this.soldiers, ...this.archers];
  }

  /** How many soldiers your barracks have trained between them — who live in the town. */
  get residents() {
    return Object.values(this.trained).reduce((n, t) => n + t.roster.length, 0);
  }

  /**
   * The soldier nearest to coming out of training, across every barracks:
   * { unit, of, ratio, secondsLeft, more } — `more` being how many else are
   * waiting anywhere — or null when nobody is training. `daySeconds` is how
   * long a game day lasts.
   */
  nextOut(days, daySeconds) {
    let best = null, waiting = 0;
    for (const [of, t] of Object.entries(this.trained)) {
      if (!t.queue.length) continue;
      waiting += t.queue.length;
      const done = t.since + TRAIN_DAYS;
      if (!best || done < best.done) best = { unit: t.queue[0], of, done, since: t.since };
    }
    if (!best) return null;
    const ratio = Math.min(1, Math.max(0, (days - best.since) / TRAIN_DAYS));
    return { unit: best.unit, of: best.of, ratio, secondsLeft: Math.max(0, (best.done - days) * daySeconds), more: waiting - 1 };
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
   * soldiers trained as the days pass, two archers on each
   * watchtower, and nobody left at a building that's gone or broken.
   *
   * @param buildings  [{ id, type, region, valid, cap }] — your claimed ones
   * @param days       the world's own count of days (DuiltGame.days)
   * @param village    { minX, maxX, minZ, maxZ } round all your buildings, for
   *                   the patrol's loop; without it, the loop goes round the barracks
   * @returns          who finished training just now: [{ unit, of, left }],
   *                   `left` being how many are still in line behind them
   */
  sync(buildings, days, village = null) {
    const joined = [];
    // Ids as strings throughout: the training is saved as JSON, whose keys are.
    const standing = new Map(buildings.filter((b) => b.valid).map((b) => [String(b.id), { ...b, id: String(b.id) }]));
    this.soldiers = this.soldiers.filter((s) => {
      const b = standing.get(s.post.of);
      // A lost level benches overflow; its paid roster stays intact, also
      // across saves. Restoring the level lets those slots form up again.
      return ['barracks', 'military'].includes(b?.type)
        && s.slot >= 0 && s.slot < Math.min(MAX_SOLDIERS, b.cap ?? SOLDIER_CAPS[0]);
    });
    this.archers = this.archers.filter((a) => standing.get(a.post.of)?.type === 'watchtower');
    for (const id of Object.keys(this.trained)) if (!['barracks', 'military'].includes(standing.get(id)?.type)) delete this.trained[id];
    for (const id of Object.keys(this.orders)) if (!['barracks', 'military'].includes(standing.get(id)?.type)) delete this.orders[id];
    const occupied = new Set();
    for (const s of this.people) {
      occupied.add(`${Math.floor(s.post.x)},${Math.floor(s.post.z)}`);
      occupied.add(`${Math.floor(s.x)},${Math.floor(s.z)}`);
    }

    for (const b of standing.values()) {
      if (b.type === 'watchtower') {
        if (this.archers.some((a) => a.post.of === b.id)) continue;
        for (const spot of this.lookout(b.region)) this.archers.push(this.person('archer', spot, b.id));
      } else if (b.type === 'barracks' || b.type === 'military') {
        const t = this.trained[b.id] ?? (this.trained[b.id] = { roster: [], queue: [], since: days });
        // The next in line joins every TRAIN_DAYS.
        while (t.queue.length && days - t.since >= TRAIN_DAYS) {
          const unit = t.queue.shift();
          t.roster.push(unit);
          t.since += TRAIN_DAYS;
          joined.push({ unit, of: b.id, left: t.queue.length });
        }
        if (!t.queue.length) t.since = days;
        // Everyone on the roster stands at their place in front of it:
        // whoever isn't there yet comes out. `cap` is the building's level.
        const cap = Math.min(MAX_SOLDIERS, b.cap ?? SOLDIER_CAPS[0]);
        const here = this.soldiers.filter((s) => s.post.of === b.id);
        let spots;
        t.roster.slice(0, cap).forEach((unit, i) => {
          if (here.some((s) => s.slot === i)) return;
          spots ??= this.paradeSpots(b.region, occupied);
          const spot = spots.shift();
          // No clear ground yet: keep the trained slot and retry next sync.
          if (!spot) return;
          const s = this.person(UNITS_BY_ID.get(unit)?.kind ?? 'soldier', spot, b.id, unit);
          s.slot = i;
          this.soldiers.push(s);
          occupied.add(`${spot.x},${spot.z}`);
          this.repost.add(b.id);
        });
        if (this.repost.has(b.id)) this.placeAll(b, village);
      }
    }
    return joined;
  }

  /**
   * Gives every soldier of barracks `b` its place for the barracks's order
   * (ORDERS), and they walk there from wherever they are. One with no
   * ground for a place keeps the one it had.
   */
  placeAll(b, village) {
    const order = this.orderOf(b.id);
    const mine = this.soldiers.filter((s) => s.post.of === b.id).sort((a, c) => a.slot - c.slot);
    const occupied = new Set();
    for (const s of this.people) {
      if (s.post.of === b.id) continue;
      occupied.add(`${Math.floor(s.post.x)},${Math.floor(s.post.z)}`);
    }
    const all = order === 'formation' ? this.paradeSpots(b.region, occupied) : this.spreadSpots(this.ringSpots(b.region, occupied), mine.length);
    const patroller = order === 'patrol' ? mine.find((s) => { const u = UNITS_BY_ID.get(s.unit); return !u?.ranged && !u?.siege; }) : null;
    if (patroller) this.route = this.loopRound(village ?? b.region);
    let i = 0;
    for (const s of mine) {
      s.patrol = s === patroller;
      s.hold = order === 'formation';
      s.roam = order === 'formation' ? 0 : DEFEND_ROAM;
      s.leg = s.patrol ? this.nearestCorner(s) : null;
      if (s.patrol) continue;
      const spot = all[i++];
      if (!spot) continue;
      s.post.x = spot.x + 0.5; s.post.y = spot.y; s.post.z = spot.z + 0.5;
      s.round = b.region;
      this.walkHome(s);
      s.rest = 0;
    }
    this.repost.delete(b.id);
  }

  /**
   * Sends `s` back to its post, round the corners of its building when the
   * building stands between them: [corner, ..., post] in `s.via`.
   */
  walkHome(s) {
    const post = { x: s.post.x, z: s.post.z };
    const r = s.round;
    s.via = null;
    if (!r) return void (s.stroll = post);
    const inside = (x, z) => x > r.minX - 0.6 && x < r.maxX + 1.6 && z > r.minZ - 0.6 && z < r.maxZ + 1.6;
    const clear = (a, c) => {
      const n = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 0.5);
      for (let i = 1; i < n; i++) if (inside(a.x + ((c.x - a.x) * i) / n, a.z + ((c.z - a.z) * i) / n)) return false;
      return true;
    };
    const from = { x: s.x, z: s.z };
    if (clear(from, post)) return void (s.stroll = post);
    const xs = [r.minX - 1.5, r.maxX + 2.5], zs = [r.minZ - 1.5, r.maxZ + 2.5];
    const corners = [{ x: xs[0], z: zs[0] }, { x: xs[1], z: zs[0] }, { x: xs[1], z: zs[1] }, { x: xs[0], z: zs[1] }];
    const ways = [...corners.map((c) => [c]), ...corners.flatMap((c, i) => [[c, corners[(i + 1) % 4]], [corners[(i + 1) % 4], c]])];
    let best = null, bestLen = Infinity;
    for (const w of ways) {
      const pts = [from, ...w, post];
      let len = 0, ok = true;
      for (let i = 1; i < pts.length && ok; i++) { ok = clear(pts[i - 1], pts[i]); len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); }
      if (ok && len < bestLen) { best = w; bestLen = len; }
    }
    if (!best) return void (s.stroll = post);
    s.via = [...best.slice(1).map((c) => ({ ...c })), post];
    s.stroll = { ...best[0] };
  }

  /**
   * Places to stand all round a building, two blocks out from its walls,
   * clockwise from its front-left corner. The same checks as paradeSpots.
   */
  ringSpots(r, occupied) {
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    const spots = [];
    const x0 = r.minX - 2, x1 = r.maxX + 2, z0 = r.minZ - 2, z1 = r.maxZ + 2;
    const add = (x, z) => {
      if (occupied.has(`${x},${z}`) || !this.world.inBounds(x, 1, z)) return;
      const y = groundAt(this.world, x + 0.5, z + 0.5, r.minY + 1, TALL);
      if (y == null || y <= 0) return;
      spots.push({ x, y, z, a: Math.atan2(x + 0.5 - cx, -(z + 0.5 - cz)) });
    };
    for (let x = x0; x <= x1; x++) { add(x, z0); add(x, z1); }
    for (let z = z0 + 1; z < z1; z++) { add(x0, z); add(x1, z); }
    return spots.sort((a, b) => a.a - b.a);
  }

  /**
   * `n` of `spots` (sorted round the building), as evenly spaced round it as
   * they go, the first in the middle of its front: one soldier alone stands
   * where it came out.
   */
  spreadSpots(spots, n) {
    if (spots.length <= n) return spots;
    let first = 0;
    spots.forEach((p, i) => { if (Math.abs(p.a) < Math.abs(spots[first].a)) first = i; });
    const out = [];
    for (let k = 0; k < n; k++) out.push(spots[(first + Math.floor((k * spots.length) / n)) % spots.length]);
    return out;
  }

  /** The patrol's loop: the corners and middles of the edges of `r`, ROUTE_MARGIN out, in walking order. */
  loopRound(r) {
    const x0 = r.minX - ROUTE_MARGIN, x1 = r.maxX + ROUTE_MARGIN, z0 = r.minZ - ROUTE_MARGIN, z1 = r.maxZ + ROUTE_MARGIN;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    return [[x0, z0], [mx, z0], [x1, z0], [x1, mz], [x1, z1], [mx, z1], [x0, z1], [x0, mz]]
      .filter(([x, z]) => this.world.inBounds(Math.floor(x), 1, Math.floor(z)))
      .map(([x, z]) => ({ x: x + 0.5, z: z + 0.5 }));
  }

  nearestCorner(s) {
    let best = 0, d = Infinity;
    this.route.forEach((c, i) => { const e = Math.hypot(c.x - s.x, c.z - s.z); if (e < d) { d = e; best = i; } });
    return best;
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
   * Distinct places in front of the building, nearest its middle first.
   * Each column gets its own floor and headroom check. The bounded search
   * stays within the old formation's six-block front strip and never reads
   * unloaded columns: looking for room must not generate more terrain.
   */
  paradeSpots(r, occupied) {
    const cx = (r.minX + r.maxX) / 2;
    const spots = [];
    for (let z = r.minZ - 6; z < r.minZ; z++) {
      for (let x = r.minX - 3; x <= r.maxX + 3; x++) {
        if (occupied.has(`${x},${z}`) || !this.world.inBounds(x, 1, z)) continue;
        // groundAt refuses unloaded columns, water, leaves, tall obstacles,
        // and floors without two blocks of headroom; it also handles slabs.
        const y = groundAt(this.world, x + 0.5, z + 0.5, r.minY + 1, TALL);
        if (y == null || y <= 0) continue;
        spots.push({ x, y, z, d: Math.abs(x - cx) + Math.abs(z - (r.minZ - 2)) * 2 });
      }
    }
    return spots.sort((a, b) => a.d - b.d);
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
    let hungry = this.hungry;
    for (const s of this.soldiers) s.hungry = hungry-- > 0;
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
    const target = this.nearestTo(s.patrol ? s : s.post, enemies, SOLDIER.range);
    s.target = target ? { x: target.x, z: target.z } : null;
    s.foe = target;
    const away = s.patrol ? 0 : Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (target && away < SOLDIER.leash) {
      const d = Math.hypot(target.x - s.x, target.z - s.z);
      if (d > m.reach * 0.8) this.step(s, target.x, target.z, dt, speed);
      else s.speed = 0;
      if (d <= m.reach && s.cooldown <= 0) {
        s.cooldown = m.every;
        on.strike?.(target, blowOf(s, m.hits), s);
      }
      return;
    }
    if (s.patrol && this.route.length) return void this.walkRound(s, dt, u);
    this.standEasy(s, dt, u);
  }

  /** The patrol: on round the village's loop, corner to corner, at a walk; a blocked leg is skipped. */
  walkRound(s, dt, u) {
    s.foe = null;
    const leg = (s.leg ?? 0) % this.route.length;
    const c = this.route[leg];
    const left = Math.hypot(c.x - s.x, c.z - s.z);
    const w = s.walk && s.walk.leg === leg ? s.walk : (s.walk = { leg, best: left, since: 0 });
    if (left < w.best - GIVE_UP_BY) { w.best = left; w.since = 0; } else w.since += dt;
    const moved = left > AT_CORNER && w.since <= GIVE_UP_AFTER * 2
      && stepAround(this.world, s, c.x, c.z, dt, (u?.speed ?? SOLDIER.speed) * 0.55);
    if (moved) { s.target = { x: c.x, z: c.z }; return; }
    s.leg = (leg + 1) % this.route.length;
    s.target = null; s.speed = 0;
  }

  /**
   * Nothing to fight: they stroll round their post the way villagers walk
   * between jobs (IMP-17: "make sure they ... have the same logic of
   * movement as the villagers"), resting a few seconds between walks and
   * getting their breath back while they rest. Back from a fight, the first
   * walk is home to the post.
   */
  standEasy(s, dt, u) {
    s.foe = null;
    const speed = (u?.speed ?? SOLDIER.speed) * (s.hold ? 0.8 : 0.45);
    const roam = s.roam ?? PATROL;
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (!s.stroll && away > (s.hold ? 0.4 : roam + 1)) this.walkHome(s);
    if (s.stroll) {
      const left = Math.hypot(s.stroll.x - s.x, s.stroll.z - s.z);
      // Shuffling against a wall gets them no nearer: they give that walk up.
      const st = s.stroll;
      if (st.best == null || left < st.best - GIVE_UP_BY) { st.best = left; st.since = 0; }
      else st.since += dt;
      const stuck = st.since > GIVE_UP_AFTER;
      const moved = left > 0.3 && !stuck && stepAround(this.world, s, s.stroll.x, s.stroll.z, dt, speed);
      if (moved) { s.target = { x: s.stroll.x, z: s.stroll.z }; return; }
      // Round a corner of the building: on to the next one, or the post.
      if (s.via?.length && (left <= 0.3 || stuck)) { s.stroll = s.via.shift(); return; }
      // There: rest a while. Blocked: a moment's pause, then somewhere else.
      s.stroll = null;
      s.via = null;
      s.rest = left > 0.3 ? BLOCKED : REST_MIN + this.rand() * REST_MORE;
    }
    s.target = null; s.speed = 0;
    if (!s.hungry) s.hp = Math.min(u?.hp ?? SOLDIER.hp, s.hp + dt * 0.5);
    // In formation they stand where they are put.
    if (s.hold) return;
    s.rest = (s.rest ?? this.rand() * REST_MORE) - dt;
    if (s.rest > 0) return;
    // Far out: back toward the post. Otherwise a new spot round it, one
    // they can stand on, so the walk is not over before it starts.
    if (away > roam - 1) return void this.walkHome(s);
    for (let tries = 0; tries < 6 && !s.stroll; tries++) {
      const a = this.rand() * Math.PI * 2, r = Math.min(2, roam / 2) + this.rand() * (roam - Math.min(2, roam / 2));
      const x = s.post.x + Math.sin(a) * r, z = s.post.z + Math.cos(a) * r;
      if (this.clearWalk(s, x, z)) s.stroll = { x, z };
    }
    if (!s.stroll) s.rest = BLOCKED;
  }

  /** Whether `s` can walk straight to (x, z): ground all the way, no step over 1, room to stand. */
  clearWalk(s, x, z) {
    const n = Math.ceil(Math.hypot(x - s.x, z - s.z) / 0.5);
    let y = s.y;
    for (let i = 1; i <= n; i++) {
      const px = s.x + ((x - s.x) * i) / n, pz = s.z + ((z - s.z) * i) / n;
      const g = groundAt(this.world, px, pz, y, TALL);
      if (g == null || Math.abs(g - y) > 1 || !bodyFits(this.world, px, pz, g)) return false;
      y = g;
    }
    return true;
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
   * A barracks archer: shoots from its post at whatever comes in range, and
   * does not walk out to meet it (owner, 8 November: "They should raid my
   * city, not die 40 blocks out"). Off its post (back from a stroll), it
   * walks back first.
   */
  bowman(s, u, dt, enemies) {
    const r = u.ranged;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const target = this.nearestTo(s, enemies, r.range);
    s.foe = target;
    if (!target) return this.standEasy(s, dt, u);
    const d = Math.hypot(target.x - s.x, target.z - s.z);
    const away = Math.hypot(s.x - s.post.x, s.z - s.post.z);
    if (away > 2) { s.target = { x: s.post.x, z: s.post.z }; this.step(s, s.post.x, s.post.z, dt, u.speed); }
    else { s.target = null; s.speed = 0; }
    s.stroll = null;
    s.facing = Math.atan2(target.x - s.x, target.z - s.z);
    if (d <= r.range && s.cooldown <= 0) {
      s.cooldown = r.every;
      this.loose(s, target, blowOf(s, r.damage));
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
    return { trained: this.trained, orders: this.orders };
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
    this.orders = {};
    for (const [id, o] of Object.entries(data?.orders ?? {})) if (ORDER_IDS.has(o)) this.orders[id] = o;
    this.repost = new Set();
    this.soldiers = [];
    this.archers = [];
  }
}
