import * as THREE from 'three';

/**
 * The guardian, drawn (Phase 7d): a few boxes each, legs that swing as it
 * runs. The white stag is made of light — drawn unlit, with gold antlers
 * and a soft light of its own, so it glows at night. The black beast is
 * shadow: near-black, a little see-through, with violet eyes that glow.
 */

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/** A leg hung from its hip, so swinging it is one rotation. */
function leg(mat, x, y, z, len, w = 0.14) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(box(w, len, w, mat, 0, -len / 2, 0));
  return pivot;
}

function stag() {
  const light = new THREE.MeshBasicMaterial({ color: 0xf4f1ff });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a2440 });
  const g = new THREE.Group();
  g.add(box(0.62, 0.62, 1.35, light, 0, 1.25, 0));            // body
  g.add(box(0.3, 0.6, 0.3, light, 0, 1.75, 0.58));             // neck
  g.add(box(0.36, 0.34, 0.6, light, 0, 2.08, 0.82));           // head
  g.add(box(0.06, 0.06, 0.02, dark, 0.14, 2.14, 1.12));        // eyes
  g.add(box(0.06, 0.06, 0.02, dark, -0.14, 2.14, 1.12));
  // Antlers: a tine up from each side, branching back and out.
  for (const s of [1, -1]) {
    g.add(box(0.06, 0.5, 0.06, gold, 0.14 * s, 2.48, 0.72));
    g.add(box(0.06, 0.06, 0.36, gold, 0.14 * s, 2.7, 0.6));
    g.add(box(0.3, 0.06, 0.06, gold, 0.28 * s, 2.58, 0.72));
    g.add(box(0.06, 0.28, 0.06, gold, 0.42 * s, 2.72, 0.72));
  }
  g.add(box(0.16, 0.2, 0.12, light, 0, 1.5, -0.72));           // tail
  const legs = [[0.2, 0.5], [-0.2, 0.5], [0.2, -0.5], [-0.2, -0.5]].map(([x, z]) => leg(light, x, 0.95, z, 0.95));
  for (const l of legs) g.add(l);
  const glow = new THREE.PointLight(0xfff1c8, 3, 12, 1);
  glow.position.set(0, 1.6, 0);
  g.add(glow);
  return { group: g, legs };
}

function beast() {
  const shadow = new THREE.MeshLambertMaterial({ color: 0x17131f, transparent: true, opacity: 0.88 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xb48cff });
  const g = new THREE.Group();
  g.add(box(0.72, 0.62, 1.5, shadow, 0, 0.95, 0));             // body
  g.add(box(0.5, 0.48, 0.6, shadow, 0, 1.2, 0.95));            // head
  g.add(box(0.36, 0.26, 0.3, shadow, 0, 1.06, 1.35));          // muzzle
  g.add(box(0.1, 0.07, 0.03, eyes, 0.15, 1.32, 1.26));
  g.add(box(0.1, 0.07, 0.03, eyes, -0.15, 1.32, 1.26));
  for (const s of [1, -1]) g.add(box(0.12, 0.24, 0.1, shadow, 0.18 * s, 1.52, 0.9)); // ears
  // A ridge of spines down its back.
  for (let i = 0; i < 4; i++) g.add(box(0.1, 0.22 - i * 0.03, 0.14, shadow, 0, 1.36, 0.45 - i * 0.32));
  g.add(box(0.14, 0.14, 0.7, shadow, 0, 1.0, -1.05));          // tail
  const legs = [[0.24, 0.52], [-0.24, 0.52], [0.24, -0.52], [-0.24, -0.52]].map(([x, z]) => leg(shadow, x, 0.68, z, 0.68, 0.18));
  for (const l of legs) g.add(l);
  return { group: g, legs };
}

export class GuardianView {
  constructor(scene) {
    this.scene = scene;
    this.shown = null;
    this.clock = 0;
  }

  update(guardian, dt = 1 / 60) {
    if (!guardian || guardian.downed > 0) {
      if (this.shown) this.shown.group.visible = false;
      return;
    }
    if (!this.shown || this.shown.ring !== guardian.ring) {
      if (this.shown) this.scene.remove(this.shown.group);
      this.shown = { ring: guardian.ring, ...(guardian.ring === 'white' ? stag() : beast()) };
      this.scene.add(this.shown.group);
    }
    const { group, legs } = this.shown;
    group.visible = true;
    this.clock += dt;
    group.position.set(guardian.x, guardian.y, guardian.z);
    group.rotation.y = guardian.facing;
    // A gallop when it moves, standing still when it doesn't; a slow
    // breath either way.
    const swing = guardian.moving ? Math.sin(this.clock * 12) * 0.6 : 0;
    legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? swing : -swing); });
    group.position.y += Math.sin(this.clock * 2) * 0.03 + (guardian.moving ? Math.abs(Math.sin(this.clock * 12)) * 0.06 : 0);
  }

  dispose() {
    if (this.shown) this.scene.remove(this.shown.group);
    this.shown = null;
  }
}
