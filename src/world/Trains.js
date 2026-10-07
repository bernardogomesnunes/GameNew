/**
 * Trains (backlog batch 2, asked for directly: "Age 5: a train on a
 * one-block rail down the middle. Each part 8 long, 3 wide and 4 high, built
 * from iron. An engine plus up to 5 cars ... Runs on coal").
 *
 * A train runs along a line of rail blocks. It keeps the stretch of rail it
 * is on as a `trail` — the cells it covers, back to front — and where its
 * front is along that trail (`head`, in blocks from the trail's first cell).
 * Moving on, it reads the rail ahead one cell at a time: straight on where
 * the rail goes straight on, round the bend where it turns, a step up or down
 * where it climbs; at the end of the line it stops. Each part — the engine in
 * front, its cars behind — sits on the trail a fixed distance back, so the
 * cars follow the engine round every bend it took.
 *
 * Pure logic, like Arrows and Projectiles: Game drives it and draws it.
 */
import { RAIL } from '../config/blocks.js';

export { RAIL };
/** Each part's length along the rail, and the gap between parts. */
export const PART_LENGTH = 8, PART_GAP = 0.5;
/** Each part's width and height, for picking it out and drawing it. */
export const PART_WIDTH = 3, PART_HEIGHT = 4;
export const MAX_CARS = 5;
/** Blocks per second flat out; how fast it picks up, slows under brakes, and rolls to a stop. */
export const MAX_SPEED = 12, ACCEL = 2.5, BRAKE = 6, ROLL = 1.2;
/** How far one coal takes it. */
export const BLOCKS_PER_COAL = 120;
/** How much coal the engine's bunker holds. */
export const BUNKER = 64;
/** Where you stand in the engine: in its cab, this far back from its front, this high over the rail (on its footplate). */
export const CAB_BACK = 6, CAB_FLOOR = 1.55;

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;

export function isRail(world, x, y, z) {
  return world.getBlock(x, y, z) === RAIL;
}

/** The rail cells joined to the rail at `c`: beside it level, or a step up or down. */
export function railNeighbours(world, c) {
  const out = [];
  for (const [dx, dz] of SIDES) {
    for (const dy of [0, 1, -1]) {
      if (isRail(world, c.x + dx, c.y + dy, c.z + dz)) { out.push({ x: c.x + dx, y: c.y + dy, z: c.z + dz }); break; }
    }
  }
  return out;
}

/** The cell after `at`, coming from `from`: straight on if the rail goes on, else round the bend; null at the end of the line. */
export function nextRail(world, from, at) {
  const dx = Math.sign(at.x - from.x), dz = Math.sign(at.z - from.z);
  const on = railNeighbours(world, at).filter((n) => !(n.x === from.x && n.z === from.z));
  return on.find((n) => n.x - at.x === dx && n.z - at.z === dz) ?? on[0] ?? null;
}

/** How long a train with `cars` cars is, front to back. */
export function trainLength(cars) {
  return PART_LENGTH * (1 + cars) + PART_GAP * cars;
}

export class Trains {
  constructor({ world }) {
    this.world = world;
    this.list = [];
    this.nextId = 1;
  }

  /**
   * An engine set down on the rail at `at`, its front that cell, facing away
   * from the way (`look`, {x, z}) you aren't looking: along the rail, the
   * way you look. Needs a run of rail behind it as long as the engine.
   * Returns { ok, reason, train }.
   */
  place(at, look) {
    const w = this.world;
    if (!isRail(w, at.x, at.y, at.z)) return { ok: false, reason: 'Set it down on a rail.' };
    const near = railNeighbours(w, at);
    if (!near.length) return { ok: false, reason: `It needs a line of rail at least ${PART_LENGTH + 1} long.` };
    // Behind it: the neighbour most nearly the other way from where you look.
    const behind = near.reduce((best, n) => {
      const score = -((n.x - at.x) * look.x + (n.z - at.z) * look.z);
      return !best || score > best.score ? { n, score } : best;
    }, null).n;
    const back = [at, behind];
    while (back.length < PART_LENGTH + 1) {
      const n = nextRail(w, back[back.length - 2], back[back.length - 1]);
      if (!n || back.some((c) => same(c, n))) break;
      back.push(n);
    }
    if (back.length < PART_LENGTH + 1) return { ok: false, reason: `Not enough rail behind it: it needs ${PART_LENGTH + 1} in a line, it has ${back.length}.` };
    const trail = back.reverse();
    const train = { id: this.nextId++, trail, head: trail.length - 1, speed: 0, throttle: 0, cars: 0, fuel: 0, coal: 0 };
    this.list.push(train);
    return { ok: true, train };
  }

  /** One more car on the back, if there's rail for it. Returns { ok, reason }. */
  couple(train) {
    if (train.cars >= MAX_CARS) return { ok: false, reason: `An engine pulls ${MAX_CARS} cars at most.` };
    const need = train.head - trainLength(train.cars + 1);
    if (!this.extendBack(train, need)) return { ok: false, reason: 'Not enough rail behind the train for another car.' };
    train.cars++;
    return { ok: true };
  }

  /** The last car off the back, or (with none) the engine off the rail. Returns 'car', 'engine' or null. */
  uncouple(train) {
    if (train.cars > 0) { train.cars--; return 'car'; }
    this.list = this.list.filter((t) => t !== train);
    return 'engine';
  }

  /** Puts up to `n` coal in the bunker; returns how many went in. */
  loadCoal(train, n) {
    const room = Math.max(0, BUNKER - train.coal);
    const k = Math.min(room, n);
    train.coal += k;
    return k;
  }

  /**
   * Every frame. `throttle` on each train (-1..1, set by whoever's driving)
   * pulls it forward or back; let go, it rolls to a stop. It burns coal for
   * every block it's driven, none coasting. `endless`: a sandbox, where the
   * fire never goes out.
   */
  tick(dt, { endless = false } = {}) {
    for (const t of this.list) {
      const want = (t.throttle || 0) * MAX_SPEED;
      const fired = endless || t.fuel > 0 || t.coal > 0;
      if (t.throttle && fired) {
        // Against the way it's going, the brakes; with it, the fire.
        const rate = Math.sign(want) !== Math.sign(t.speed) && t.speed !== 0 ? BRAKE : ACCEL;
        t.speed += Math.sign(want - t.speed) * Math.min(Math.abs(want - t.speed), rate * dt);
      } else {
        t.speed -= Math.sign(t.speed) * Math.min(Math.abs(t.speed), ROLL * dt);
      }
      const ds = t.speed * dt;
      if (!ds) continue;
      if (t.throttle && !endless) {
        t.fuel -= Math.abs(ds);
        while (t.fuel <= 0 && t.coal > 0) { t.coal--; t.fuel += BLOCKS_PER_COAL; }
        if (t.fuel < 0) t.fuel = 0;
      }
      this.move(t, ds);
    }
  }

  /** Moves a train `ds` blocks along its rail, reading more rail as it goes; it stops where the rail does. */
  move(t, ds) {
    t.head += ds;
    if (ds > 0) {
      while (t.head > t.trail.length - 1) {
        const n = t.trail.length;
        const next = n >= 2 ? nextRail(this.world, t.trail[n - 2], t.trail[n - 1]) : null;
        if (!next) { t.head = t.trail.length - 1; t.speed = 0; break; }
        t.trail.push(next);
      }
    } else if (!this.extendBack(t, t.head - trainLength(t.cars))) {
      t.head = trainLength(t.cars);
      t.speed = 0;
    }
    // A rail taken up ahead: the line ends there now.
    for (let i = Math.max(1, Math.floor(t.head)); i < t.trail.length; i++) {
      const c = t.trail[i];
      if (!isRail(this.world, c.x, c.y, c.z)) {
        t.trail.length = i;
        if (t.head > i - 1) { t.head = i - 1; t.speed = 0; }
        break;
      }
    }
    this.trim(t);
  }

  /** Reads rail back off the tail until the trail reaches back to `u` (which may be negative). False if it runs out. */
  extendBack(t, u) {
    while (u < 0) {
      const next = t.trail.length >= 2 ? nextRail(this.world, t.trail[1], t.trail[0]) : null;
      if (!next || t.trail.some((c) => same(c, next))) return false;
      t.trail.unshift(next);
      t.head += 1;
      u += 1;
    }
    return true;
  }

  /** Forgets the rail more than a couple of cells beyond either end of the train. */
  trim(t) {
    const tail = Math.floor(t.head - trainLength(t.cars)) - 2;
    if (tail > 0) { t.trail.splice(0, tail); t.head -= tail; }
    const front = Math.ceil(t.head) + 2;
    if (t.trail.length > front + 1) t.trail.length = front + 1;
  }

  /** The point `u` blocks along a train's trail: between cell centres, on top of the rail. */
  pointAt(t, u) {
    const n = t.trail.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
    const j = Math.min(n - 1, i + 1);
    const f = Math.max(0, Math.min(1, u - i));
    const a = t.trail[i], b = t.trail[j];
    return { x: a.x + 0.5 + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + 0.5 + (b.z - a.z) * f };
  }

  /**
   * Where each part stands: { kind: 'engine' | 'car', index, x, y, z, yaw,
   * pitch } at its middle, its front down its own +z (yaw as three.js turns
   * a group: +z goes to (sin yaw, cos yaw)).
   */
  parts(t) {
    const out = [];
    for (let k = 0; k <= t.cars; k++) {
      const front = t.head - k * (PART_LENGTH + PART_GAP);
      const f = this.pointAt(t, front - 0.5), b = this.pointAt(t, front - PART_LENGTH + 0.5);
      const mid = this.pointAt(t, front - PART_LENGTH / 2);
      const dx = f.x - b.x, dz = f.z - b.z;
      out.push({
        kind: k === 0 ? 'engine' : 'car', index: k, ...mid,
        yaw: Math.atan2(dx, dz), pitch: Math.atan2(f.y - b.y, Math.hypot(dx, dz) || 1),
      });
    }
    return out;
  }

  /** Where you stand when you're driving: on the cab floor, and the way the engine faces. */
  cab(t) {
    const p = this.pointAt(t, t.head - CAB_BACK);
    const [engine] = this.parts(t);
    return { x: p.x, y: p.y + CAB_FLOOR, z: p.z, yaw: engine.yaw };
  }

  /**
   * The nearest train part a ray from `eye` along `dir` meets within `reach`:
   * { train, part, t } or null. Each part is an upright box turned to its yaw.
   */
  pick(eye, dir, reach) {
    let best = null;
    for (const train of this.list) {
      for (const part of this.parts(train)) {
        const c = Math.cos(-part.yaw), s = Math.sin(-part.yaw);
        // Into the part's own frame: its length down z, its width across x.
        const ox = eye.x - part.x, oz = eye.z - part.z;
        const o = { x: ox * c + oz * s, y: eye.y - part.y, z: -ox * s + oz * c };
        const d = { x: dir.x * c + dir.z * s, y: dir.y, z: -dir.x * s + dir.z * c };
        const t = slab(o, d, -PART_WIDTH / 2, 0, -PART_LENGTH / 2, PART_WIDTH / 2, PART_HEIGHT, PART_LENGTH / 2);
        if (t != null && t <= reach && (!best || t < best.t)) best = { train, part, t };
      }
    }
    return best;
  }

  toJSON() {
    return this.list.map((t) => ({
      trail: t.trail.map((c) => [c.x, c.y, c.z]), head: Math.round(t.head * 100) / 100,
      cars: t.cars, fuel: Math.round(t.fuel * 10) / 10, coal: t.coal,
    }));
  }

  loadJSON(data) {
    this.list = (Array.isArray(data) ? data : [])
      .filter((t) => Array.isArray(t?.trail) && t.trail.length >= 2 && Number.isFinite(t.head))
      .map((t) => ({
        id: this.nextId++, trail: t.trail.map(([x, y, z]) => ({ x, y, z })), head: t.head, speed: 0, throttle: 0,
        cars: Math.max(0, Math.min(MAX_CARS, t.cars | 0)), fuel: Math.max(0, +t.fuel || 0), coal: Math.max(0, t.coal | 0),
      }));
  }
}

/** Where a ray from `o` along `d` first enters the box, or null. */
function slab(o, d, minX, minY, minZ, maxX, maxY, maxZ) {
  let t0 = 0, t1 = Infinity;
  for (const [oa, da, lo, hi] of [[o.x, d.x, minX, maxX], [o.y, d.y, minY, maxY], [o.z, d.z, minZ, maxZ]]) {
    if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) return null; continue; }
    let a = (lo - oa) / da, b = (hi - oa) / da;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}
