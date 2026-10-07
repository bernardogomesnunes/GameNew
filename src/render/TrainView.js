import * as THREE from 'three';
import { PART_LENGTH, PART_WIDTH } from '../world/Trains.js';

/**
 * Trains, drawn (see world/Trains.js). Each part is a group in its own frame
 * — its front down +z, its width across x, the rail at y = 0 — turned to
 * where the trail puts it. The engine: a green boiler on a black frame, its
 * chimney at the front, a cab at the back you stand in to drive; a car: a
 * wooden coach with windows down both sides. Smoke puffs from the chimney
 * while it's being driven.
 */
const IRON = 0x2e3036, BOILER = 0x2f5a44, BRASS = 0xc9a55a, RED = 0x9a2a22, WHEEL = 0x3a3a3e;
const COACH = 0x7a5236, COACH_TRIM = 0x5a3b28, ROOF = 0x4a4d55, GLASS = 0x2a3440;

const L = PART_LENGTH, W = PART_WIDTH;
const DECK = 1.1; // the top of the frame
/** The cab's footplate, and its roof, over the frame — you stand on one, under the other (Trains' CAB_FLOOR). */
const FOOTPLATE = 0.45, ROOF_AT = 2.95;

function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(g, w, h, d, x, y, z, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

/** Wheels and axles along a part: a pair at each z, turning about x. */
function wheels(g, zs, r, m) {
  const out = [];
  const geo = new THREE.CylinderGeometry(r, r, 0.22, 14);
  for (const z of zs) {
    for (const x of [-W / 2 + 0.35, W / 2 - 0.35]) {
      const w = new THREE.Mesh(geo, m);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, r + 0.05, z);
      g.add(w);
      out.push(w);
    }
  }
  return out;
}

function frame(g, mats) {
  box(g, W - 0.4, 0.45, L - 0.2, 0, DECK - 0.45, 0, mats.iron);
  // Buffer beams, red, front and back, with their two buffers.
  for (const z of [L / 2 - 0.15, -L / 2 + 0.15]) {
    box(g, W - 0.2, 0.4, 0.3, 0, DECK - 0.5, z, mats.red);
    for (const x of [-0.9, 0.9]) box(g, 0.25, 0.25, 0.3, x, DECK - 0.42, z + Math.sign(z) * 0.25, mats.iron);
  }
}

function engine(mats) {
  const g = new THREE.Group();
  frame(g, mats);
  const spin = wheels(g, [2.6, 0.9, -0.8, -2.6], 0.6, mats.wheel);
  // The boiler, lying along it from the cab to the smokebox at the front —
  // low enough that from the footplate you see out over it.
  const BY = DECK + 0.95, BR = 0.9;
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, 4.6, 18), mats.boiler);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, BY, 1.3);
  g.add(boiler);
  const smokebox = new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.04, BR + 0.04, 0.6, 18), mats.iron);
  smokebox.rotation.x = Math.PI / 2;
  smokebox.position.set(0, BY, 3.8);
  g.add(smokebox);
  // Brass bands round it, a dome on top, and the chimney at the front.
  for (const z of [0, 1.5, 3]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.03, BR + 0.03, 0.08, 18), mats.brass);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, BY, z);
    g.add(band);
  }
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.45, 12), mats.brass);
  dome.position.set(0, BY + BR + 0.15, 1.2);
  g.add(dome);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 1.4, 12), mats.iron);
  chimney.position.set(0, BY + BR + 0.6, 3.3);
  g.add(chimney);
  // The cab at the back: a raised footplate you stand on, sides to the
  // waist, a front to the chest with the window open above it, corner posts
  // up to the roof, open behind.
  const cz = -2.4, cl = 3.2;
  box(g, W, FOOTPLATE, cl, 0, DECK, cz, mats.iron);
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) {
    box(g, 0.12, 1.4, cl, x, DECK, cz, mats.boiler);
    for (const z of [cz - cl / 2 + 0.1, cz + cl / 2 - 0.1]) box(g, 0.14, ROOF_AT - 1.4, 0.14, x, DECK + 1.4, z, mats.boiler);
  }
  box(g, W, 1.4, 0.12, 0, DECK, cz + cl / 2 - 0.06, mats.boiler);
  box(g, W + 0.2, 0.14, cl + 0.3, 0, DECK + ROOF_AT, cz, mats.roof);
  return { group: g, spin, chimneyTop: new THREE.Vector3(0, DECK + 2.6, 3.3) };
}

function car(mats) {
  const g = new THREE.Group();
  frame(g, mats);
  const spin = wheels(g, [2.8, 1.8, -1.8, -2.8], 0.45, mats.wheel);
  // A wooden coach: low walls, a band of windows, a curved-looking roof.
  const len = L - 0.6;
  box(g, W, 0.12, len, 0, DECK, 0, mats.trim);
  for (const x of [-W / 2 + 0.07, W / 2 - 0.07]) {
    box(g, 0.14, 0.9, len, x, DECK + 0.12, 0, mats.coach);
    box(g, 0.1, 0.8, len - 0.4, x, DECK + 1.02, 0, mats.glass);
    for (let z = -len / 2 + 0.1; z <= len / 2; z += 1.2) box(g, 0.16, 0.8, 0.16, x, DECK + 1.02, z, mats.coach);
    box(g, 0.14, 0.5, len, x, DECK + 1.82, 0, mats.coach);
  }
  for (const z of [-len / 2 + 0.07, len / 2 - 0.07]) {
    box(g, W, 2.2, 0.14, 0, DECK + 0.12, z, mats.coach);
    box(g, 0.9, 1.6, 0.16, 0, DECK + 0.12, z, mats.trim);
  }
  box(g, W + 0.2, 0.16, len + 0.2, 0, DECK + 2.32, 0, mats.roof);
  box(g, W - 0.6, 0.14, len, 0, DECK + 2.48, 0, mats.roof);
  return { group: g, spin };
}

export class TrainView {
  constructor(scene) {
    this.scene = scene;
    this.mats = {
      iron: mat(IRON), boiler: mat(BOILER), brass: mat(BRASS), red: mat(RED), wheel: mat(WHEEL),
      coach: mat(COACH), trim: mat(COACH_TRIM), roof: mat(ROOF), glass: mat(GLASS),
    };
    this.parts = new Map(); // `${train.id}:${index}` -> { group, spin, kind }
    this.puffs = [];
    this.puffGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.puffMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.7, depthWrite: false });
    this.wait = 0;
  }

  /** Draws every train in `trains` (a Trains); `driven`, the one you're driving, smokes. */
  update(trains, dt, driven = null) {
    const seen = new Set();
    for (const t of trains?.list ?? []) {
      for (const p of trains.parts(t)) {
        const key = `${t.id}:${p.index}`;
        seen.add(key);
        let v = this.parts.get(key);
        if (v && v.kind !== p.kind) { this.drop(key, v); v = null; }
        if (!v) {
          v = { ...(p.kind === 'engine' ? engine(this.mats) : car(this.mats)), kind: p.kind };
          v.group.rotation.order = 'YXZ';
          this.scene.add(v.group);
          this.parts.set(key, v);
        }
        v.group.position.set(p.x, p.y, p.z);
        v.group.rotation.y = p.yaw;
        v.group.rotation.x = -p.pitch;
        // The wheels turn as far as the train went.
        const turn = (t.speed * dt) / 0.55;
        for (const w of v.spin) w.rotation.x += turn;
        if (p.kind === 'engine' && t === driven && Math.abs(t.speed) > 0.2) this.smoke(v, dt, Math.abs(t.speed));
      }
    }
    for (const [key, v] of this.parts) if (!seen.has(key)) this.drop(key, v);
    for (const puff of this.puffs) {
      puff.life -= dt;
      puff.mesh.position.y += dt * 1.6;
      puff.mesh.scale.setScalar(1 + (1.6 - puff.life) * 1.2);
      puff.mesh.material.opacity = Math.max(0, puff.life / 1.6) * 0.7;
    }
    for (const puff of this.puffs.filter((q) => q.life <= 0)) { puff.mesh.removeFromParent(); puff.mesh.material.dispose(); }
    this.puffs = this.puffs.filter((q) => q.life > 0);
  }

  smoke(v, dt, speed) {
    this.wait -= dt * (0.6 + speed / 6);
    if (this.wait > 0 || this.puffs.length > 24) return;
    this.wait = 0.18;
    const mesh = new THREE.Mesh(this.puffGeo, this.puffMat.clone());
    mesh.position.copy(v.group.localToWorld(v.chimneyTop.clone()));
    this.scene.add(mesh);
    this.puffs.push({ mesh, life: 1.6 });
  }

  drop(key, v) {
    v.group.removeFromParent();
    v.group.traverse((o) => o.geometry?.dispose());
    this.parts.delete(key);
  }
}
