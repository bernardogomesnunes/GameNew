import * as THREE from 'three';

/**
 * PLAY-4: the puff of dust a killed animal leaves as it shrinks away. A small
 * pool of boxes: each burst throws 8 of them out and up; they slow, grow a
 * little and fade over SECONDS.
 */
const POOL = 48;
const PER = 8;
const SECONDS = 0.7;

export class PoofView {
  constructor(scene) {
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.bits = [];
    for (let i = 0; i < POOL; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xe8e2d6, transparent: true, opacity: 0, depthWrite: false, fog: true });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.bits.push({ mesh, age: SECONDS, vx: 0, vy: 0, vz: 0, size: 0 });
    }
    this.next = 0;
    this.last = 0;
  }

  /** A burst at (x, y, z), sized to the animal (`size` blocks across). */
  burst(x, y, z, size = 1) {
    for (let k = 0; k < PER; k++) {
      const b = this.bits[this.next];
      this.next = (this.next + 1) % POOL;
      const a = (k / PER) * Math.PI * 2 + Math.random() * 0.6;
      const speed = (1.2 + Math.random() * 0.8) * Math.max(0.6, size);
      b.vx = Math.cos(a) * speed; b.vz = Math.sin(a) * speed; b.vy = 0.8 + Math.random() * 1.2;
      b.size = (0.18 + Math.random() * 0.12) * Math.max(0.7, size);
      b.age = 0;
      b.mesh.position.set(x, y + 0.2, z);
      b.mesh.visible = true;
    }
  }

  /** Once a frame. */
  update(now = performance.now()) {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    for (const b of this.bits) {
      if (b.age >= SECONDS) continue;
      b.age += dt;
      const p = Math.min(1, b.age / SECONDS);
      const drag = Math.max(0, 1 - dt * 3);
      b.vx *= drag; b.vz *= drag; b.vy *= drag;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.scale.setScalar(b.size * (1 + p));
      b.mesh.material.opacity = 0.8 * (1 - p);
      if (p >= 1) b.mesh.visible = false;
    }
  }

  setVisible(on) { for (const b of this.bits) b.mesh.visible = on && b.age < SECONDS; }
}
