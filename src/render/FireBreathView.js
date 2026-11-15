import * as THREE from 'three';
import { MOBS_BY_ID } from '../config/mobs.js';
import { BREATH_SECONDS } from '../world/Mobs.js';

/**
 * IMP-45 (owner, 9 November: "They need to spit fire"): a dragon breathing
 * (Mobs.fly sets `breathing` and `breathAt`) pours a stream of flame from its
 * mouth to where you stood. Puffs of fire along the line, growing as they
 * go; drawn solid, since added light vanishes against a bright sky. A fixed pool, made once; nothing per frame.
 */
const STREAMS = 3, PUFFS = 14;

export class FireBreathView {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.IcosahedronGeometry(0.5, 0);
    this.materials = [0xfff2a8, 0xffb347, 0xff6a1a].map((color) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.streams = [];
    for (let i = 0; i < STREAMS; i++) {
      const group = new THREE.Group();
      const puffs = [];
      for (let k = 0; k < PUFFS; k++) {
        const p = new THREE.Mesh(this.geometry, this.materials[Math.min(2, Math.floor((k / PUFFS) * 3))]);
        group.add(p);
        puffs.push(p);
      }
      group.visible = false;
      scene.add(group);
      this.streams.push({ group, puffs });
    }
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  /** Once a frame, with the world's animals. */
  update(mobs, now = performance.now()) {
    let used = 0;
    for (const m of mobs ?? []) {
      if (used >= STREAMS || !(m.breathing > 0) || !m.breathAt) continue;
      const spec = MOBS_BY_ID.get(m.type);
      const s = this.streams[used++];
      s.group.visible = true;
      const reach = spec.body.l / 2 + spec.head;
      const mouth = this._a.set(m.x + Math.sin(m.facing) * reach, m.y + spec.leg + spec.body.h + spec.head * 0.5, m.z + Math.cos(m.facing) * reach);
      const to = this._b.set(m.breathAt.x, m.breathAt.y, m.breathAt.z);
      const life = 1 - m.breathing / BREATH_SECONDS, t = now / 1000;
      s.puffs.forEach((p, k) => {
        const f = ((k / PUFFS) + t * 1.7) % 1;
        if (f > life * 1.4 + 0.15) { p.visible = false; return; }
        p.visible = true;
        p.position.lerpVectors(mouth, to, f);
        p.position.y += Math.sin(k * 2.3 + t * 9) * 0.3 * f;
        p.scale.setScalar((0.3 + f * 1.6) * (spec.head / 1.2));
      });
    }
    for (let i = used; i < STREAMS; i++) this.streams[i].group.visible = false;
  }
}
