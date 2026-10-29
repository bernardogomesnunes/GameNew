import { registerWarBehaviors } from '../core/warBehaviors.js';
import { WANDERERS, WANDERER_NAMES } from '../config/wanderers.js';
import { groundAt, surfaceAt, isLoaded } from '../world/Mobs.js';
const ARMY_FROM=30, ARMY_SPREAD=7, MOUNTED=1.05, TALL=2;
const methods = {
  sendWarband(home, towards, edge, who, round) {
    const d0 = Math.hypot(towards.x - home.x, towards.z - home.z) || 1;
    const ux = (towards.x - home.x) / d0, uz = (towards.z - home.z) / d0;
    let ox = null, oz = null, y = null;
    for (let r = edge + ARMY_FROM; r >= 24; r -= 8) {
      const x = home.x + ux * r, z = home.z + uz * r;
      if (!isLoaded(this.world, x, z)) continue;
      const top = surfaceAt(this.world, Math.floor(x), Math.floor(z));
      if (top == null) continue;
      ox = x; oz = z; y = top;
      break;
    }
    if (ox == null) return null;
    const band = [];
    let beast = null;
    for (const [kind, count] of who) {
      for (let i = 0; i < count; i++) {
        // Across the road, not down it: -uz, ux is sideways.
        const side = (this.rand() - 0.5) * 2 * ARMY_SPREAD, back = this.rand() * 4;
        const x = ox - uz * side - ux * back, z = oz + ux * side - uz * back;
        const spec = WANDERERS[kind];
        const p = this.person(kind, x, surfaceAt(this.world, Math.floor(x), Math.floor(z)) ?? y, z, {
          war: true, round,
          // Who comes for your storehouses; the beast and the Warlord come for you.
          raider: !spec.siege && !spec.beast && kind !== 'warlord',
          stage: 'coming', settlement: home, home: { x: ox, z: oz },
          name: kind === 'warlord' ? 'Vorhak' : undefined,
        });
        // Engines and beasts are named for what they are, not like people.
        if (spec.siege || spec.beast) p.name = spec.one.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase());
        else if (!p.name) p.name = WANDERER_NAMES[Math.floor(this.rand() * WANDERER_NAMES.length)];
        if (spec.beast) beast = p;
        band.push(p);
      }
    }
    // The Warlord on his beast's back.
    const lord = band.find((p) => p.kind === 'warlord');
    if (lord && beast) { lord.mount = beast; beast.rider = lord; lord.x = beast.x; lord.z = beast.z; lord.y = beast.y + MOUNTED; }
    this.list.push(...band);
    return band;
  },
  riding(p) {
    const m = p.mount;
    if (!m) return false;
    if (m.dead) { p.mount = null; return false; }
    p.x = m.x; p.z = m.z; p.y = m.y + MOUNTED;
    p.facing = m.facing;
    return true;
  },
  siegeGoal(p) {
    let best = null;
    for (const { region } of this.buildings()) {
      const x = Math.max(region.minX, Math.min(region.maxX + 1, p.x));
      const z = Math.max(region.minZ, Math.min(region.maxZ + 1, p.z));
      const d = Math.hypot(x - p.x, z - p.z);
      if (!best || d < best.d) best = { x, z, d, region };
    }
    if (best) return best;
    const s = p.settlement;
    return s ? { x: s.x, z: s.z, d: Math.hypot(s.x - p.x, s.z - p.z), region: null } : null;
  },
  ram(p, dt, spec) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    const goal = this.siegeGoal(p);
    if (!goal) { p.target = null; p.speed = 0; return; }
    // At the building: on into the middle of it.
    const r = goal.region;
    const to = goal.d < 1.2 && r ? { x: (r.minX + r.maxX + 1) / 2, z: (r.minZ + r.maxZ + 1) / 2 } : goal;
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz) || 1;
    const ax = Math.floor(p.x + (dx / d) * 0.9), az = Math.floor(p.z + (dz / d) * 0.9);
    const stuck = groundAt(this.world, ax + 0.5, az + 0.5, p.y, TALL) == null;
    if (stuck && this.inLand(ax, az)) {
      p.target = null; p.speed = 0;
      p.facing = Math.atan2(dx, dz);
      if (p.cooldown > 0) return;
      p.cooldown = spec.every;
      p.swing = 0.35;
      const y0 = Math.floor(p.y);
      const cells = [y0, y0 + 1, y0 + 2]
        .filter((y) => this.world.collisionBoxAt(ax, y, az))
        .map((y) => ({ x: ax, y, z: az }));
      if (cells.length) this.onBatter?.(p, cells);
      return;
    }
    p.target = d > 0.3 ? to : null;
    p.speed = spec.speed;
  },
  catapult(p, dt, spec) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    const goal = this.siegeGoal(p);
    if (!goal) { p.target = null; p.speed = 0; return; }
    if (goal.d > spec.range) {
      p.target = { x: goal.x, z: goal.z };
      p.speed = spec.speed;
      return;
    }
    p.target = null; p.speed = 0;
    p.facing = Math.atan2(goal.x - p.x, goal.z - p.z);
    if (p.cooldown > 0) return;
    p.cooldown = spec.every;
    p.swing = 0.6;
    this.onThrow?.(p, { x: goal.x, z: goal.z });
  }
};
registerWarBehaviors(methods);
