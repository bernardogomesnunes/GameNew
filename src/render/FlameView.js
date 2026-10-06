import * as THREE from 'three';
import { flicker } from './LightManager.js';

/**
 * Flames that move, over every campfire near you (asked for directly:
 * "Campfire fire needs some movement to show flames"). The block itself
 * only holds its embers; these are tongues of fire drawn over them — three
 * crossed planes each, in yellow fading to orange, that leap, sway and
 * shrink at their own pace. Which blocks: any whose light says `flame`
 * (config/blocks.js), found the same way the light manager finds lamps.
 */
const MAX_FIRES = 12;
const NEAR = 48;

function flameGeometry() {
  // A tongue: wide at the base, a point at the top, yellow inside going orange.
  const g = new THREE.BufferGeometry();
  const pos = [-0.5, 0, 0, 0.5, 0, 0, 0.32, 0.45, 0, -0.32, 0.45, 0, 0, 1, 0];
  const col = [1, 0.55, 0.15, 1, 0.55, 0.15, 1, 0.78, 0.3, 1, 0.78, 0.3, 1, 0.95, 0.6];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  return g;
}

export class FlameView {
  constructor(scene) {
    this.scene = scene;
    this.geometry = flameGeometry();
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.fires = [];
    for (let i = 0; i < MAX_FIRES; i++) {
      const group = new THREE.Group();
      const tongues = [];
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(this.geometry, this.material);
        t.rotation.y = (k * Math.PI) / 3;
        group.add(t);
        tongues.push(t);
      }
      group.visible = false;
      scene.add(group);
      this.fires.push({ group, tongues });
    }
    this.lastScan = 0;
    this.near = [];
  }

  /** Once a frame: which fires are near (a few times a second), then every flame moves. */
  update(world, player, now = performance.now()) {
    if (now - this.lastScan > 250) {
      this.lastScan = now;
      this.near = [];
      for (const e of world?.lights?.values?.() ?? []) {
        if (!e.light.flame || !player) continue;
        const d2 = (e.x + 0.5 - player.x) ** 2 + (e.z + 0.5 - player.z) ** 2;
        if (d2 < NEAR * NEAR) this.near.push({ e, d2 });
      }
      this.near.sort((a, b) => a.d2 - b.d2);
    }
    const t = now / 1000;
    for (let i = 0; i < this.fires.length; i++) {
      const fire = this.fires[i], e = this.near[i]?.e;
      fire.group.visible = !!e;
      if (!e) continue;
      fire.group.position.set(e.x + 0.5, e.y + 0.16, e.z + 0.5);
      const seed = e.x * 7 + e.z * 13;
      fire.tongues.forEach((tongue, k) => {
        const s = seed + k * 2.1;
        const h = 0.42 * flicker(t * (1 + k * 0.17), s) + 0.08 * Math.sin(t * 6.3 + s);
        tongue.scale.set(0.34 - k * 0.05, Math.max(0.15, h), 1);
        tongue.rotation.z = 0.12 * Math.sin(t * 3.7 + s);
      });
    }
  }

  dispose() {
    for (const f of this.fires) this.scene.remove(f.group);
    this.geometry.dispose();
    this.material.dispose();
  }
}
