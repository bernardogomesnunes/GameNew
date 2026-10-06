import * as THREE from 'three';

/**
 * Smoke going up from the chimneys near you (backlog batch 3, #19): soft grey
 * puffs that rise out of the top of a stack, drift, swell and fade. Only the
 * top of a stack smokes — a chimney with another on it is part of the flue.
 * Which blocks: any marked `smoke` (config/blocks.js), kept track of by the
 * world the way lamps are (World.smokes).
 */
const MAX_STACKS = 8;
const PUFFS = 6;
const NEAR = 64;
/** How high a puff rises before it's gone, and how long that takes. */
const RISE = 3.2, SECONDS = 4.5;

export class SmokeView {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.stacks = [];
    for (let i = 0; i < MAX_STACKS; i++) {
      const group = new THREE.Group();
      const puffs = [];
      for (let k = 0; k < PUFFS; k++) {
        const material = new THREE.MeshBasicMaterial({ color: 0xd9d6d0, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
        const puff = new THREE.Mesh(this.geometry, material);
        group.add(puff);
        puffs.push(puff);
      }
      group.visible = false;
      scene.add(group);
      this.stacks.push({ group, puffs });
    }
    this.lastScan = 0;
    this.near = [];
  }

  /** Once a frame: which stacks are near (twice a second), then every puff moves. */
  update(world, player, now = performance.now()) {
    if (now - this.lastScan > 500) {
      this.lastScan = now;
      this.near = [];
      for (const e of world?.smokes?.values?.() ?? []) {
        if (!player || world.smokes.has(`${e.x},${e.y + 1},${e.z}`)) continue;
        const d2 = (e.x + 0.5 - player.x) ** 2 + (e.z + 0.5 - player.z) ** 2;
        if (d2 < NEAR * NEAR) this.near.push({ e, d2 });
      }
      this.near.sort((a, b) => a.d2 - b.d2);
    }
    const t = now / 1000;
    for (let i = 0; i < this.stacks.length; i++) {
      const stack = this.stacks[i], e = this.near[i]?.e;
      stack.group.visible = !!e;
      if (!e) continue;
      stack.group.position.set(e.x + 0.5, e.y + 1, e.z + 0.5);
      const seed = e.x * 0.37 + e.z * 0.61;
      stack.puffs.forEach((puff, k) => {
        puff.visible = true;
        // Each puff is somewhere along its rise, spaced through the cycle.
        const phase = ((t / SECONDS + k / PUFFS + seed) % 1 + 1) % 1;
        const size = 0.28 + phase * 0.55;
        puff.position.set(
          Math.sin(t * 0.7 + k * 1.9 + seed) * 0.12 + phase * 0.5,
          phase * RISE,
          Math.cos(t * 0.6 + k * 2.3 + seed) * 0.12,
        );
        puff.scale.setScalar(size);
        puff.rotation.set(phase * 0.8 + k, phase * 1.3 + k * 0.7, 0);
        puff.material.opacity = 0.55 * Math.min(1, phase * 6) * (1 - phase);
      });
    }
  }

  dispose() {
    for (const s of this.stacks) {
      this.scene.remove(s.group);
      for (const p of s.puffs) p.material.dispose();
    }
    this.geometry.dispose();
  }
}
