import * as THREE from 'three';
import { MOBS_BY_ID } from '../config/mobs.js';
import { BREATH_SECONDS } from '../world/Mobs.js';

/**
 * IMP-45 (owner, 9 November: "They need to spit fire"): a dragon breathing
 * (Mobs.fly sets `breathing` and `breathAt`) pours fire from its mouth to
 * where you stood.
 *
 * IMP-47 (owner, 15 November: the fire "odd looking"): the stream is TONGUES
 * small pointed flames in place of 14 solid lumps. Each tongue travels from
 * the mouth to the target and starts again. Along the way its colour runs
 * down RAMP (white-yellow, yellow, orange, red, dark red), it widens into a
 * cone, rises a little, and its length flickers 19 times a second. Past
 * 60% of the way more and more tongues are left out, so the stream thins;
 * SMOKE dark puffs drift up from the far end. The flames are drawn solid,
 * since added light vanishes against a bright sky.
 *
 * Two instanced meshes hold every stream, made once. A frame writes
 * matrices and colours into their buffers and allocates nothing.
 */
export const STREAMS = 3, TONGUES = 96, SMOKE = 16;

/** The flame's colour by how far along the stream it is (0 the mouth, 1 the far end). */
export const RAMP = [[0, 0xfff8dc], [0.16, 0xffe46a], [0.42, 0xffa022], [0.68, 0xf2541a], [0.88, 0xb8241a], [1, 0x8a1c14]]
  .map(([at, hex]) => ({ at, colour: new THREE.Color(hex) }));
const SMOKE_NEAR = new THREE.Color(0x4a3a34), SMOKE_FAR = new THREE.Color(0x2a2626);

export function flameColour(f, out) {
  let i = 1;
  while (i < RAMP.length - 1 && f > RAMP[i].at) i++;
  const a = RAMP[i - 1], b = RAMP[i];
  return out.copy(a.colour).lerp(b.colour, Math.max(0, Math.min(1, (f - a.at) / (b.at - a.at))));
}

/** One tongue: a spindle, blunt behind and pointed ahead (+z), its point darker than its root. */
function tongueGeometry() {
  const profile = [[0, -0.3], [0.42, -0.05], [0.3, 0.45], [0, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(profile, 5);
  const pos = g.attributes.position, colour = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow((pos.getY(i) + 0.3) / 1.5, 1.2);
    colour[i * 3] = 1 - 0.05 * t; colour[i * 3 + 1] = 1 - 0.3 * t; colour[i * 3 + 2] = 1 - 0.5 * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  g.rotateX(Math.PI / 2);
  return g;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

export class FireBreathView {
  constructor(scene) {
    this.scene = scene;
    this.flames = new THREE.InstancedMesh(tongueGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false }), STREAMS * TONGUES);
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), STREAMS * SMOKE);
    for (const mesh of [this.flames, this.smoke]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.setColorAt(0, RAMP[0].colour);
      scene.add(mesh);
    }
    // What makes each tongue its own: where in the cycle it starts, where
    // across the stream it flies, how big it is, how it tilts, and how soon
    // it is left out as the stream thins. Fixed numbers, drawn once.
    let seed = 20261115;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = Math.max(TONGUES, SMOKE);
    this.start = new Float32Array(n); this.angle = new Float32Array(n); this.across = new Float32Array(n);
    this.big = new Float32Array(n); this.keep = new Float32Array(n); this.beat = new Float32Array(n);
    this.tilt = new Float32Array(n * 4);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let k = 0; k < n; k++) {
      this.start[k] = (k + rnd()) / n;
      this.angle[k] = rnd() * Math.PI * 2;
      this.across[k] = Math.sqrt(rnd());
      this.big[k] = 0.7 + rnd() * 0.6;
      this.keep[k] = rnd();
      this.beat[k] = rnd() * Math.PI * 2;
      q.setFromEuler(e.set((rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.1, rnd() * Math.PI * 2)).toArray(this.tilt, k * 4);
    }
    this._mouth = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._side = new THREE.Vector3(); this._lift = new THREE.Vector3();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._aim = new THREE.Quaternion(); this._q = new THREE.Quaternion(); this._t = new THREE.Quaternion();
    this._m = new THREE.Matrix4(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }

  /** Once a frame, with the world's animals. */
  update(mobs, now = performance.now()) {
    this._flames = 0; this._smoke = 0;
    let used = 0;
    const list = mobs ?? [];
    for (let i = 0; i < list.length && used < STREAMS; i++) {
      const m = list[i];
      if (!(m.breathing > 0) || !m.breathAt) continue;
      const spec = MOBS_BY_ID.get(m.type);
      if (!spec) continue;
      used++;
      this.pour(m, spec, now / 1000);
    }
    this.flames.count = this._flames;
    this.smoke.count = this._smoke;
    if (this._flames) { this.flames.instanceMatrix.needsUpdate = true; this.flames.instanceColor.needsUpdate = true; }
    if (this._smoke) { this.smoke.instanceMatrix.needsUpdate = true; this.smoke.instanceColor.needsUpdate = true; }
  }

  /**
   * Where the fire leaves a dragon: `mouth` in config/mobs.js, measured on
   * its model, turned the way MobView turns the model (its heading, and in
   * the air its nose up or down with its climb and its lean into a turn).
   */
  mouthOf(m, spec, out) {
    const ahead = spec.mouth?.out ?? spec.body.l / 2 + spec.head, up = spec.mouth?.up ?? spec.leg + spec.body.h + spec.head * 0.5;
    const air = m.airborne && !(m.dying > 0);
    this._e.set(air ? Math.max(-0.35, Math.min(0.35, -(m.climb ?? 0) * 0.06)) : 0, m.facing, air ? -(m.bank ?? 0) : 0, 'YXZ');
    out.set(0, up, ahead).applyQuaternion(this._q.setFromEuler(this._e));
    return out.set(out.x + m.x, out.y + m.y, out.z + m.z);
  }

  /** One dragon's stream, written into the next free instances. */
  pour(m, spec, t) {
    const mouth = this.mouthOf(m, spec, this._mouth);
    const dir = this._dir.set(m.breathAt.x, m.breathAt.y, m.breathAt.z).sub(mouth);
    const len = dir.length();
    if (len < 0.05) return;
    dir.divideScalar(len);
    const side = this._side.crossVectors(dir, UP);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const lift = this._lift.crossVectors(side, dir);
    this._aim.setFromUnitVectors(Z, dir);
    // A bigger dragon breathes a bigger fire: the Elder Dragon's is twice a drake's.
    const size = Math.max(1, Math.min(2, spec.body.l / 2.6));
    // The fire runs out from the mouth in the first 0.3 of the breath, and dies from the mouth end in the last 0.2.
    const life = 1 - m.breathing / BREATH_SECONDS;
    const front = Math.min(1, life / 0.3), back = Math.max(0, (life - 0.8) / 0.2);

    for (let k = 0; k < TONGUES; k++) {
      // Slow out of the mouth and faster after, so the flames crowd at the mouth.
      const f = Math.pow((this.start[k] + t * 1.5) % 1, 1.35);
      if (f > front || f < back || this.keep[k] < (f - 0.6) * 1.4) continue;
      const flick = Math.abs(Math.sin(t * 19 + this.beat[k]));
      const r = size * (0.05 + 0.55 * f) * this.across[k];
      const sway = Math.sin(t * 7 + this.beat[k]) * 0.14 * f * size;
      this._p.copy(mouth).addScaledVector(dir, f * len)
        .addScaledVector(side, Math.cos(this.angle[k]) * r + sway)
        .addScaledVector(lift, Math.sin(this.angle[k]) * r);
      this._p.y += f * f * 0.9 * size;
      const wide = size * (0.16 + 0.5 * f) * (1 - 0.7 * smooth(0.65, 1, f)) * this.big[k];
      this._s.set(wide, wide, wide * (0.9 + 0.9 * flick));
      // Straight as a jet at the mouth, tumbling by the far end.
      this._q.identity().slerp(this._t.fromArray(this.tilt, k * 4), 0.15 + 0.85 * f).premultiply(this._aim);
      this.flames.setMatrixAt(this._flames, this._m.compose(this._p, this._q, this._s));
      this.flames.setColorAt(this._flames, flameColour(f, this._c).multiplyScalar(0.82 + 0.18 * flick));
      this._flames++;
    }

    for (let k = 0; k < SMOKE; k++) {
      const g = (this.start[k] + t * 0.8) % 1, f = 0.66 + 0.42 * g;
      if (f > front + 0.2 || life < 0.15 || this.keep[k] < back * 0.8) continue;
      const r = size * (0.5 + 0.5 * g) * this.across[k];
      this._p.copy(mouth).addScaledVector(dir, f * len)
        .addScaledVector(side, Math.cos(this.angle[k]) * r)
        .addScaledVector(lift, Math.sin(this.angle[k]) * r);
      this._p.y += (0.5 + 1.8 * g) * size;
      // Each puff swells, then shrinks away to nothing.
      const wide = size * (0.25 + 0.7 * g) * (1 - smooth(0.6, 1, g)) * this.big[k];
      if (wide < 0.02) continue;
      this._s.set(wide, wide * 0.85, wide);
      this._q.fromArray(this.tilt, k * 4);
      this.smoke.setMatrixAt(this._smoke, this._m.compose(this._p, this._q, this._s));
      this.smoke.setColorAt(this._smoke, this._c.copy(SMOKE_NEAR).lerp(SMOKE_FAR, g));
      this._smoke++;
    }
  }
}
