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
/** How many lights get a glow round them (see Glows), nearest first. */
const MAX_GLOWS = 64;

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
    this.glows = new Glows(scene, MAX_GLOWS);
  }

  /** Call once a frame. Cheap to call when nothing has changed — it throttles itself. */
  update(world, playerPos, { enabled = true, now = performance.now(), look = null, night = 0 } = {}) {
    if (!enabled || !world?.lights?.size) {
      for (const light of this.pool) light.visible = false;
      this.glows.show([], 0);
      return;
    }
    if (now - this.lastScan >= RESCAN_INTERVAL_MS) {
      this.lastScan = now;
      this.assign(world, playerPos, look);
      this.glows.show(nearestLights(world.lights.values(), playerPos, MAX_GLOWS), night);
    }
    this.glows.setNight(night);
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
    this.glows.dispose();
  }
}

/** The placed lights nearest `at`, up to `max`, each as { x, y, z, color }. */
export function nearestLights(entries, at, max) {
  const out = [];
  for (const e of entries) {
    const x = e.x + 0.5, y = e.y + (e.light.y ?? 0.5), z = e.z + 0.5;
    out.push({ x, y, z, color: e.light.color, d2: (x - at.x) ** 2 + (y - at.y) ** 2 + (z - at.z) ** 2 });
  }
  return out.sort((a, b) => a.d2 - b.d2).slice(0, max);
}

/**
 * A soft glow round each light: what a shader pack's bloom does to a lantern
 * at night, done the cheap way (asked for: Complementary shaders as
 * inspiration). One batch of points, added onto whatever is behind them,
 * faint by day and full at night.
 */
export class Glows {
  constructor(scene, max) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setDrawRange(0, 0);
    this.material = new THREE.PointsMaterial({
      size: 2.6, sizeAttenuation: true, map: glowTexture(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
    scene.add(this.points);
    this.scene = scene;
    this._c = new THREE.Color();
  }

  show(list, night) {
    const n = Math.min(list.length, this.max);
    for (let i = 0; i < n; i++) {
      const g = list[i];
      this.positions.set([g.x, g.y, g.z], i * 3);
      this._c.setHex(g.color ?? 0xffd27a);
      this.colors.set([this._c.r, this._c.g, this._c.b], i * 3);
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, n);
    this.setNight(night);
  }

  setNight(night) {
    this.material.opacity = 0.18 + 0.62 * night;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

let glowTex = null;
/** A round soft falloff, white in the middle, made in code so it needs no canvas. */
function glowTexture() {
  if (glowTex) return glowTex;
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
    const a = Math.max(0, 1 - r) ** 2.2;
    const i = (y * N + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(a * 255);
  }
  glowTex = new THREE.DataTexture(data, N, N);
  glowTex.needsUpdate = true;
  return glowTex;
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
