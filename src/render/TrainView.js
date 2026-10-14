import * as THREE from 'three';
import { PART_LENGTH, PART_WIDTH } from '../world/Trains.js';

/**
 * Trains, drawn (see world/Trains.js). Each part is a group in its own frame
 * — its front down +z, its width across x, the rail at y = 0 — turned to
 * where the trail puts it. The engine: a green boiler on a black frame, its
 * chimney at the front, a cab at the back you stand in to drive; a car: a
 * wooden coach with windows down both sides. Smoke puffs from the chimney
 * while it's being driven. All of it blocks, as the world is: square wheels,
 * a boiler stepped round rather than smooth.
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

/**
 * Square wheels, as everything else in the world is blocks (asked for
 * directly: "The train could be more blocky"): a disc of blocks — a
 * square, a cross over it — and a lighter hub, turning about x.
 */
function wheels(g, zs, r, mats) {
  const out = [];
  const t = 0.22, s = r * 2;
  for (const z of zs) {
    for (const x of [-W / 2 + 0.35, W / 2 - 0.35]) {
      const w = new THREE.Group();
      w.position.set(x, r + 0.05, z);
      w.add(new THREE.Mesh(new THREE.BoxGeometry(t, s * 0.72, s * 0.72), mats.wheel));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(t, s, s * 0.44), mats.wheel));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(t, s * 0.44, s), mats.wheel));
      const hub = new THREE.Mesh(new THREE.BoxGeometry(t + 0.06, s * 0.3, s * 0.3), mats.red);
      w.add(hub);
      g.add(w);
      out.push(w);
    }
  }
  return out;
}

/** A blocky round along z: a wide flat box and a tall narrow one through it, so its cross-section is a stepped circle. */
function blockRound(g, r, len, x, y, z, m) {
  box(g, r * 2, r * 1.4, len, x, y - r * 0.7, z, m);
  box(g, r * 1.4, r * 2, len, x, y - r, z, m);
}

function frame(g, mats) {
  box(g, W - 0.4, 0.45, L - 0.2, 0, DECK - 0.45, 0, mats.iron);
  // Buffer beams, red, front and back, with their two buffers.
  for (const z of [L / 2 - 0.15, -L / 2 + 0.15]) {
    box(g, W - 0.2, 0.4, 0.3, 0, DECK - 0.5, z, mats.red);
    for (const x of [-0.9, 0.9]) box(g, 0.25, 0.25, 0.3, x, DECK - 0.42, z + Math.sign(z) * 0.25, mats.iron);
  }
  // A walkway along each side, a step proud of the frame.
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) box(g, 0.2, 0.1, L - 0.6, x, DECK - 0.1, 0, mats.iron);
}

function engine(mats) {
  const g = new THREE.Group();
  frame(g, mats);
  const spin = wheels(g, [2.6, 0.9, -0.8, -2.6], 0.6, mats);
  // The rods joining the big wheels, either side.
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) box(g, 0.08, 0.14, 3.6, x, 0.6, 0, mats.brass);
  // The boiler, lying along it from the cab to the smokebox at the front —
  // low enough that from the footplate you see out over it. Square, stepped.
  const BY = DECK + 0.95, BR = 0.9;
  blockRound(g, BR, 4.6, 0, BY, 1.3, mats.boiler);
  blockRound(g, BR + 0.05, 0.6, 0, BY, 3.8, mats.iron);
  // The smokebox door: a darker square on the front, a brass handle.
  box(g, 1.1, 1.1, 0.06, 0, BY - 0.55, 4.12, mats.wheel);
  box(g, 0.16, 0.16, 0.06, 0, BY - 0.08, 4.17, mats.brass);
  // Brass bands round it, a dome on top, and the chimney at the front.
  for (const z of [0, 1.5, 3]) blockRound(g, BR + 0.04, 0.12, 0, BY, z, mats.brass);
  box(g, 0.7, 0.4, 0.7, 0, BY + BR - 0.05, 1.2, mats.brass);
  box(g, 0.5, 0.15, 0.5, 0, BY + BR + 0.35, 1.2, mats.brass);
  box(g, 0.6, 1.2, 0.6, 0, BY + BR - 0.05, 3.3, mats.iron);
  box(g, 0.8, 0.22, 0.8, 0, BY + BR + 1.1, 3.3, mats.iron);
  // A lamp on the front, under the chimney.
  box(g, 0.34, 0.34, 0.2, 0, DECK + 0.05, L / 2 - 0.1, mats.lamp);
  // The cab at the back: a raised footplate you stand on, sides to the
  // waist, a front to the chest with the window open above it, corner posts
  // up to the roof, open behind.
  const cz = -2.4, cl = 3.2;
  box(g, W, FOOTPLATE, cl, 0, DECK, cz, mats.iron);
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) {
    box(g, 0.12, 1.4, cl, x, DECK, cz, mats.boiler);
    box(g, 0.16, 0.14, cl, x, DECK + 1.4, cz, mats.brass);
    for (const z of [cz - cl / 2 + 0.1, cz + cl / 2 - 0.1]) box(g, 0.16, ROOF_AT - 1.4, 0.16, x, DECK + 1.4, z, mats.boiler);
  }
  box(g, W, 1.4, 0.12, 0, DECK, cz + cl / 2 - 0.06, mats.boiler);
  // The roof, two steps: a wide eave and a raised middle.
  box(g, W + 0.2, 0.14, cl + 0.3, 0, DECK + ROOF_AT, cz, mats.roof);
  box(g, W - 0.6, 0.14, cl + 0.1, 0, DECK + ROOF_AT + 0.14, cz, mats.roof);
  return { group: g, spin, chimneyTop: new THREE.Vector3(0, DECK + 2.6, 3.3) };
}

function car(mats) {
  const g = new THREE.Group();
  frame(g, mats);
  const spin = wheels(g, [2.8, 1.8, -1.8, -2.8], 0.45, mats);
  // A wooden coach: plank walls in two tones, a band of windows, a
  // stepped roof.
  const len = L - 0.6;
  box(g, W, 0.12, len, 0, DECK, 0, mats.trim);
  for (const x of [-W / 2 + 0.07, W / 2 - 0.07]) {
    // Planks, upright, every other one darker.
    const n = 12, pw = len / n;
    for (let i = 0; i < n; i++) box(g, 0.14, 0.9, pw, x, DECK + 0.12, -len / 2 + pw * (i + 0.5), i % 2 ? mats.trim : mats.coach);
    box(g, 0.1, 0.8, len - 0.4, x, DECK + 1.02, 0, mats.glass);
    for (let z = -len / 2 + 0.1; z <= len / 2; z += 1.2) box(g, 0.18, 0.8, 0.18, x, DECK + 1.02, z, mats.trim);
    box(g, 0.16, 0.12, len, x, DECK + 1.02, 0, mats.trim);
    box(g, 0.14, 0.5, len, x, DECK + 1.82, 0, mats.coach);
  }
  for (const z of [-len / 2 + 0.07, len / 2 - 0.07]) {
    box(g, W, 2.2, 0.14, 0, DECK + 0.12, z, mats.coach);
    box(g, 0.9, 1.6, 0.16, 0, DECK + 0.12, z, mats.trim);
  }
  box(g, W + 0.2, 0.16, len + 0.2, 0, DECK + 2.32, 0, mats.roof);
  box(g, W - 0.6, 0.14, len, 0, DECK + 2.48, 0, mats.roof);
  box(g, W - 1.4, 0.12, len - 0.4, 0, DECK + 2.62, 0, mats.roof);
  // Its passengers (world/Passengers.js): ten seats, five down each side,
  // a head and shoulders showing in the windows — hidden till someone sits.
  const seats = [];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, z = -2.6 + Math.floor(i / 2) * 1.3;
    const coat = mats.coats[i % mats.coats.length];
    const body = box(g, 0.5, 0.75, 0.4, side * 0.55, DECK + 0.45, z, coat);
    const head = box(g, 0.34, 0.34, 0.34, side * 0.55, DECK + 1.2, z, mats.skin);
    body.visible = head.visible = false;
    seats.push([body, head]);
  }
  return { group: g, spin, seats };
}

export class TrainView {
  constructor(scene) {
    this.scene = scene;
    this.mats = {
      iron: mat(IRON), boiler: mat(BOILER), brass: mat(BRASS), red: mat(RED), wheel: mat(WHEEL),
      coach: mat(COACH), trim: mat(COACH_TRIM), roof: mat(ROOF),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
      // See-through, so the passengers show (world/Passengers.js).
      glass: new THREE.MeshLambertMaterial({ color: GLASS, transparent: true, opacity: 0.4, depthWrite: false }),
      skin: mat(0xd9a77c), coats: [0x7a2f3a, 0x3f5a7a, 0x5f7a3e, 0x8a6a44, 0x6d4a7a].map(mat),
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
        // Its passengers, in their seats.
        if (v.seats) {
          const n = (t.riders ?? []).filter((r) => r.car === p.index - 1).reduce((s, r) => s + r.n, 0);
          v.seats.forEach(([body, head], i) => { body.visible = head.visible = i < n; });
        }
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
