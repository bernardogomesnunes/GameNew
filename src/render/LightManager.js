import * as THREE from 'three';

/**
 * Real dynamic light from placed blocks — a lantern actually lights the room
 * it's in, rather than the block registry's `light` field being decoration
 * that does nothing.
 *
 * A world can hold far more lanterns than a phone can afford to light at
 * once, so this keeps a small fixed pool of real THREE.PointLights and hands
 * them to whichever placed lights are actually nearest the player, moving
 * them there rather than creating and destroying a light per lantern. A
 * light with nothing assigned just sits off-screen, invisible and free.
 */
const MAX_ACTIVE_LIGHTS = 10;
const RESCAN_INTERVAL_MS = 200; // lanterns don't move; the player does, and not every frame
/**
 * Lanterns this close together share one light. Reported directly:
 * "lanterns are not giving light anymore" — a settlement whose buildings had
 * been evolved had four lights in a house, two in a farm, and only the ten
 * nearest of all of them ever lit; the rest of the street was dark. A
 * building's lights are one glow seen from outside it, so they're one light.
 */
const CLUSTER = 4;
/** How much further away a light behind you counts as, against one in front. */
const BEHIND = 3;

export class LightManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < MAX_ACTIVE_LIGHTS; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1);
      light.visible = false;
      scene.add(light);
      this.pool.push(light);
    }
    this.lastScan = 0;
  }

  /** Call once a frame. Cheap to call when nothing has changed — it throttles itself. */
  update(world, playerPos, { enabled = true, now = performance.now(), look = null } = {}) {
    if (!enabled || !world?.lights?.size) {
      for (const light of this.pool) light.visible = false;
      return;
    }
    if (now - this.lastScan >= RESCAN_INTERVAL_MS) {
      this.lastScan = now;
      this.assign(world, playerPos, look);
    }
    // A fire's light wavers every frame, after any rescan has set it.
    for (const light of this.pool) {
      const e = light.userData.entry;
      if (light.visible && e?.light.flicker) light.intensity = (light.userData.base ?? e.light.intensity) * flicker(now / 1000, e.x * 7 + e.z * 13);
    }
  }

  /**
   * Hands the pool's lights to the placed lights that matter most: nearest
   * first, those in front of you (`look`, the way you face) before those
   * behind, and lanterns close together as one (see CLUSTER).
   */
  assign(world, playerPos, look = null) {
    const groups = lightGroups(world.lights.values(), playerPos, look, this.pool.length);
    for (let i = 0; i < this.pool.length; i++) {
      const light = this.pool[i];
      const g = groups[i];
      if (g) {
        // From where the flame is: a lantern's glass, a chandelier's candles —
        // or the middle of a few of them.
        light.position.set(g.x, g.y, g.z);
        light.color.setHex(g.entry.light.color);
        light.intensity = g.intensity;
        light.userData.base = g.intensity;
        light.distance = g.distance;
        // How fast it fades: 2 is the physical inverse square, which gives a
        // hard bright disc and then nothing; the blocks' lights use 1.
        light.decay = g.entry.light.decay ?? 2;
        light.visible = true;
        light.userData.entry = g.entry;
      } else {
        light.visible = false;
        light.userData.entry = null;
      }
    }
  }

  dispose() {
    for (const light of this.pool) this.scene.remove(light);
    this.pool = [];
  }
}

/**
 * The placed lights, as up to `max` glows to give real light to: each a
 * lantern, or a few within CLUSTER blocks of each other as one — a bit
 * brighter and reaching a bit further than one alone. Most important first.
 */
export function lightGroups(entries, at, look = null, max = MAX_ACTIVE_LIGHTS) {
  const scored = [];
  for (const entry of entries) {
    const x = entry.x + 0.5, y = entry.y + (entry.light.y ?? 0.5), z = entry.z + 0.5;
    const dx = x - at.x, dy = y - at.y, dz = z - at.z;
    let d2 = dx * dx + dy * dy + dz * dz;
    // Behind you counts as further off — unless it's right beside you.
    if (look && d2 > 9 && dx * look.x + dy * look.y + dz * look.z < 0) d2 *= BEHIND * BEHIND;
    scored.push({ entry, x, y, z, d2 });
  }
  scored.sort((a, b) => a.d2 - b.d2);
  const groups = [];
  for (const s of scored) {
    const near = groups.find((g) => g.entry.light.color === s.entry.light.color
      && Math.abs(g.ox - s.x) <= CLUSTER && Math.abs(g.oy - s.y) <= CLUSTER && Math.abs(g.oz - s.z) <= CLUSTER);
    if (near) {
      near.members.push(s);
      continue;
    }
    if (groups.length >= max) continue;
    groups.push({ entry: s.entry, ox: s.x, oy: s.y, oz: s.z, members: [s] });
  }
  for (const g of groups) {
    const n = g.members.length;
    g.x = g.members.reduce((t, m) => t + m.x, 0) / n;
    g.y = g.members.reduce((t, m) => t + m.y, 0) / n;
    g.z = g.members.reduce((t, m) => t + m.z, 0) / n;
    g.intensity = g.entry.light.intensity * Math.min(2, 1 + 0.35 * (n - 1));
    g.distance = g.entry.light.distance + (n > 1 ? CLUSTER : 0);
  }
  return groups;
}

/** How bright a fire is at time `t` (s), 0.75..1.05: a few waves at odd rates, so it never visibly repeats. */
export function flicker(t, seed = 0) {
  return 0.9 + 0.08 * Math.sin(t * 9.1 + seed) + 0.05 * Math.sin(t * 15.7 + seed * 1.3) + 0.03 * Math.sin(t * 23.3 + seed * 0.7);
}
