import * as THREE from 'three';
import { WANDERERS } from '../config/wanderers.js';
import { beast } from './GuardianView.js';

/**
 * The parts of the Stone Kingdom's army that aren't people (the Ten Rounds,
 * config/war.js): battering rams, siege catapults, the Warlord's black beast,
 * and the archers' arrows in flight. The soldiers themselves are figures,
 * drawn with everyone else by a SettlerView.
 *
 * A round brings a handful of these at most, so each is its own little group
 * of boxes — made when it turns up, dropped when it's gone.
 */

const HURT = new THREE.Color(0xd23a2a);

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

function wheels(g, mat, xs, zs, y = 0.32, r = 0.64) {
  for (const x of xs) for (const z of zs) g.add(box(0.16, r, r, mat, x, y, z));
}

/** A tree trunk slung under a little roof, an iron head on the front, on four wheels. */
function ramModel() {
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3e2c1c });
  const iron = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const g = new THREE.Group();
  g.add(box(1.2, 0.18, 2.4, dark, 0, 0.62, 0));                  // the bed
  wheels(g, dark, [-0.66, 0.66], [-0.8, 0.8]);
  for (const z of [-1, 1]) for (const x of [-0.5, 0.5]) g.add(box(0.12, 1.2, 0.12, wood, x, 1.3, z)); // posts
  g.add(box(1.3, 0.1, 2.6, wood, 0, 1.95, 0));                   // roof
  const swing = new THREE.Group();
  swing.position.set(0, 1.25, 0);
  swing.add(box(0.36, 0.36, 2.6, wood, 0, 0, 0.2));              // the trunk
  swing.add(box(0.5, 0.5, 0.4, iron, 0, 0, 1.6));                // its head
  g.add(swing);
  return { group: g, swing, mats: [wood, dark, iron] };
}

/** A frame on wheels and a long throwing arm with a cup at its end. */
function catapultModel() {
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a2a1e });
  const stone = new THREE.MeshLambertMaterial({ color: 0x77736c });
  const g = new THREE.Group();
  g.add(box(1.4, 0.24, 2.2, dark, 0, 0.6, 0));
  wheels(g, dark, [-0.78, 0.78], [-0.75, 0.75]);
  for (const x of [-0.5, 0.5]) g.add(box(0.16, 1.1, 0.16, wood, x, 1.25, 0.1)); // uprights
  g.add(box(1.16, 0.14, 0.14, wood, 0, 1.75, 0.1));              // the axle
  const swing = new THREE.Group();
  swing.position.set(0, 1.75, 0.1);
  swing.add(box(0.16, 0.16, 2.2, wood, 0, 0, -0.7));             // the arm
  swing.add(box(0.44, 0.2, 0.44, dark, 0, 0.1, -1.8));           // the cup
  swing.add(box(0.3, 0.3, 0.3, stone, 0, 0.3, -1.8));            // a stone in it
  g.add(swing);
  return { group: g, swing, mats: [wood, dark, stone] };
}

/** The Warlord's mount: the same shadow beast as the black guardian, bigger. */
function beastModel() {
  const b = beast();
  b.group.scale.setScalar(1.3);
  const mats = [];
  b.group.traverse((o) => { if (o.material && !mats.includes(o.material)) mats.push(o.material); });
  return { group: b.group, legs: b.legs, mats };
}

export class ArmyView {
  constructor(scene) {
    this.scene = scene;
    this.shown = new Map(); // person → its model
    this.clock = 0;
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0x4a3a28 });
    this.arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.75);
    this.arrows = [];
  }

  update(people, arrows = [], dt = 1 / 60) {
    this.clock += dt;
    const seen = new Set();
    for (const p of people) {
      const spec = WANDERERS[p.kind];
      if (!spec?.siege && !spec?.beast) continue;
      seen.add(p);
      let m = this.shown.get(p);
      if (!m) {
        m = spec.siege === 'ram' ? ramModel() : spec.siege === 'catapult' ? catapultModel() : beastModel();
        m.base = m.mats.map((mat) => mat.color.clone());
        this.scene.add(m.group);
        this.shown.set(p, m);
      }
      // Face the way it's going; standing, the way it last faced (or was set to).
      if (p.target) {
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        if (dx || dz) p.facing = Math.atan2(dx, dz);
      }
      const moved = m.lx == null ? 0 : Math.hypot(p.x - m.lx, p.z - m.lz);
      m.lx = p.x; m.lz = p.z;
      m.group.position.set(p.x, p.y, p.z);
      m.group.rotation.y = p.facing ?? 0;
      // A blow: the ram's trunk thrusts, the catapult's arm whips over.
      if (p.swing > 0) p.swing = Math.max(0, p.swing - dt);
      if (spec.siege === 'ram') m.swing.position.z = Math.sin(Math.min(1, (p.swing ?? 0) / 0.35) * Math.PI) * 0.6;
      if (spec.siege === 'catapult') m.swing.rotation.x = (p.swing ?? 0) > 0 ? 1.6 * Math.sin(((p.swing ?? 0) / 0.6) * Math.PI) : 0;
      if (m.legs) {
        m.walk = (m.walk ?? 0) + moved;
        const s = moved > 0.002 ? Math.sin(m.walk * 3) * 0.6 : 0;
        m.legs.forEach((l, i) => { l.rotation.x = i === 0 || i === 3 ? s : -s; });
      }
      // Struck: a flash of red, the same as everyone else.
      m.mats.forEach((mat, i) => {
        mat.color.copy(m.base[i]);
        if (p.hurt > 0) mat.color.lerp(HURT, 0.6);
      });
    }
    for (const [p, m] of this.shown) {
      if (seen.has(p)) continue;
      this.drop(m);
      this.shown.delete(p);
    }

    // Arrows: one thin box each, pointed the way it's flying.
    while (this.arrows.length < arrows.length) {
      const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      this.scene.add(mesh);
      this.arrows.push(mesh);
    }
    this.arrows.forEach((mesh, i) => {
      const a = arrows[i];
      mesh.visible = !!a;
      if (!a) return;
      mesh.position.set(a.x, a.y, a.z);
      if (!a.stuck) mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
    });
  }

  drop(m) {
    this.scene.remove(m.group);
    m.group.traverse((o) => o.geometry?.dispose?.());
    for (const mat of m.mats) mat.dispose();
  }

  dispose() {
    for (const m of this.shown.values()) this.drop(m);
    this.shown.clear();
    for (const mesh of this.arrows) this.scene.remove(mesh);
    this.arrows = [];
    this.arrowGeo.dispose();
    this.arrowMat.dispose();
  }
}
