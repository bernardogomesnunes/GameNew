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
  update(world, playerPos, { enabled = true, now = performance.now() } = {}) {
    if (!enabled || !world?.lights?.size) {
      for (const light of this.pool) light.visible = false;
      return;
    }
    if (now - this.lastScan < RESCAN_INTERVAL_MS) return;
    this.lastScan = now;

    const nearest = [];
    for (const entry of world.lights.values()) {
      const dx = entry.x + 0.5 - playerPos.x;
      const dy = entry.y + 0.5 - playerPos.y;
      const dz = entry.z + 0.5 - playerPos.z;
      nearest.push({ entry, d2: dx * dx + dy * dy + dz * dz });
    }
    nearest.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.pool.length; i++) {
      const light = this.pool[i];
      if (i < nearest.length) {
        const { entry } = nearest[i];
        light.position.set(entry.x + 0.5, entry.y + 0.5, entry.z + 0.5);
        light.color.setHex(entry.light.color);
        light.intensity = entry.light.intensity;
        light.distance = entry.light.distance;
        light.visible = true;
      } else {
        light.visible = false;
      }
    }
  }

  dispose() {
    for (const light of this.pool) this.scene.remove(light);
    this.pool = [];
  }
}
