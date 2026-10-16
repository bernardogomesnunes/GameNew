import * as THREE from 'three';
import { dress } from './Models.js';
import { CELL, FUTURE_GROUND, inFuture, futureArrival } from '../world/future.js';

/**
 * The Future's traffic (backlog batch 4, D3: "flying cars, trams"), drawn:
 * trams gliding along the maglev rails of the east–west streets, and cars
 * flying over the city in lanes above the streets, their lamps lit.
 *
 * Scenery only — nothing to ride or be hit by. Where each one is depends
 * only on the clock, so there's nothing to save and nothing to step: every
 * frame each is put where it is at that moment, round you, and the lot is
 * hidden whenever you're not in the Future.
 */

/** How far round you the traffic runs before it wraps round to the far side. */
const SPAN = 480;
/** Streets each way of you with a tram. */
const TRAM_STREETS = 3, TRAMS_PER_STREET = 2;
const TRAM_SPEED = 11, TRAM_LONG = 16, TRAM_WIDE = 3.4, TRAM_TALL = 3.2, TRAM_HOVER = 0.35;
const CARS = 26, CAR_SPEED = [16, 26];
const CAR_COLOURS = [0xe8ecf0, 0xff4fb8, 0x3fe6ff, 0xffd166, 0x9b7bff, 0x2b2f38];

/** A position along a span centred on `around`, for a thing at `raw` along an endless line. */
function wrap(raw, around) {
  const lo = around - SPAN / 2;
  return lo + ((((raw - lo) % SPAN) + SPAN) % SPAN);
}

/** A repeatable 0..1 from an integer. */
function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class FutureView {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return m;
    };
    const white = new THREE.MeshLambertMaterial({ color: 0xeef2f6 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
    // Lit from inside: drawn at their own colour, so they shine at night.
    const windows = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
    const stripe = new THREE.MeshBasicMaterial({ color: 0x3fe6ff });
    const head = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tail = new THREE.MeshBasicMaterial({ color: 0xff3b5c });
    this.mats = [white, dark, windows, stripe, head, tail];

    this.trams = [];
    for (let k = 0; k < (2 * TRAM_STREETS + 1) * TRAMS_PER_STREET; k++) {
      const g = new THREE.Group();
      // Long and low, rounded off at the ends with a step in, a band of
      // windows down each side, a stripe under them and lamps at both ends.
      g.add(box(TRAM_LONG - 2, TRAM_TALL, TRAM_WIDE, white, 0, TRAM_TALL / 2, 0));
      for (const s of [-1, 1]) {
        g.add(box(1, TRAM_TALL - 0.6, TRAM_WIDE - 0.4, white, s * (TRAM_LONG / 2 - 0.5), (TRAM_TALL - 0.6) / 2, 0));
        g.add(box(0.06, 0.5, TRAM_WIDE - 1, head, s * (TRAM_LONG / 2), 0.9, 0));
      }
      g.add(box(TRAM_LONG - 3, 1.1, TRAM_WIDE + 0.04, windows, 0, TRAM_TALL - 1.2, 0));
      g.add(box(TRAM_LONG - 1, 0.18, TRAM_WIDE + 0.06, stripe, 0, 0.7, 0));
      g.add(box(TRAM_LONG - 4, 0.3, TRAM_WIDE - 1, dark, 0, -0.15, 0));
      this.group.add(g);
      this.trams.push(g);
    }

    this.cars = [];
    for (let k = 0; k < CARS; k++) {
      const g = new THREE.Group();
      const paint = new THREE.MeshLambertMaterial({ color: CAR_COLOURS[k % CAR_COLOURS.length] });
      this.mats.push(paint);
      // A teardrop of boxes: the body, a glass cabin on it, lamps front and back.
      g.add(box(1.8, 0.7, 3.6, paint, 0, 0, 0));
      g.add(box(1.4, 0.55, 1.8, windows, 0, 0.6, 0.2));
      g.add(box(1.5, 0.2, 0.06, head, 0, 0.05, -1.82));
      g.add(box(1.5, 0.2, 0.06, tail, 0, 0.05, 1.82));
      g.add(box(2.4, 0.08, 0.8, dark, 0, -0.35, 1.1));
      this.group.add(g);
      this.cars.push({ mesh: g, speed: CAR_SPEED[0] + rand(k + 5) * (CAR_SPEED[1] - CAR_SPEED[0]), alongX: k % 2 === 0, lane: k, height: 18 + Math.floor(rand(k + 9) * 5) * 9 });
    }
  }

  /**
   * Puts everything where it is at `time` (seconds), round the player at
   * `at` — or hides it all when they're not in the Future.
   */
  update(at, time, centreX = 0, centreZ = 0) {
    const here = !!at && inFuture(at.x, centreX);
    this.group.visible = here;
    if (!here) return;
    // Their models (render/Models.js), once loaded: a tram runs along x, a
    // car faces -z as a model does, in its own colour.
    for (const t of this.trams) dress(t, 'tram', { turn: Math.PI / 2, scale: [1.36, 1.07, 2.0] });
    this.cars.forEach((c, i) => dress(c.mesh, i % 6 ? `flying_car_${i % 6}` : 'flying_car', { turn: 0, scale: 1.3, y: -0.6 }));
    const o = futureArrival(centreX, centreZ);
    const u = at.x - o.x, v = at.z - o.z;
    const street = (n) => Math.floor((n + CELL / 2) / CELL);
    const iu = street(u), iv = street(v);

    // Trams: down the middle of each east–west street near you, between its two rails.
    let k = 0;
    for (let dj = -TRAM_STREETS; dj <= TRAM_STREETS; dj++) {
      const j = iv + dj;
      const z = o.z + j * CELL - CELL / 2 + 4;
      const dir = j % 2 === 0 ? 1 : -1;
      for (let n = 0; n < TRAMS_PER_STREET; n++, k++) {
        const raw = dir * time * TRAM_SPEED + (rand(j * 7 + n) + n / TRAMS_PER_STREET) * SPAN;
        const t = this.trams[k];
        t.position.set(o.x + wrap(raw, u), FUTURE_GROUND + TRAM_HOVER, z);
        t.rotation.y = 0;
      }
    }

    // Cars: each in its own lane over a street, one way or the other, at its own height.
    for (const c of this.cars) {
      const lane = (c.lane >> 1) % 7 - 3;
      const dir = c.lane % 4 < 2 ? 1 : -1;
      const raw = dir * time * c.speed + rand(c.lane + 21) * SPAN;
      const y = FUTURE_GROUND + c.height + Math.sin(time * 0.7 + c.lane) * 0.4;
      if (c.alongX) {
        const z = o.z + (iv + lane) * CELL - CELL / 2 + (dir > 0 ? 2.5 : 5.5);
        c.mesh.position.set(o.x + wrap(raw, u), y, z);
        c.mesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        const x = o.x + (iu + lane) * CELL - CELL / 2 + (dir > 0 ? 2.5 : 5.5);
        c.mesh.position.set(x, y, o.z + wrap(raw, v));
        c.mesh.rotation.y = dir > 0 ? Math.PI : 0;
      }
    }
  }
}
