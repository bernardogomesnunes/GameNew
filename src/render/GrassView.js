import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';

/**
 * Grass tufts on turf (backlog batch 3, #8: "3D grass tufts on turf. They're
 * light: drawn in batches near you, and fade with distance."). A few crossed
 * blades on some of the grass round you — one batch, one draw — swaying a
 * little, and shrinking away to nothing towards the edge of their reach so
 * there's no line where they stop.
 */
export const GRASS = 1;
export const RADIUS = 22;
/** The last FADE blocks of RADIUS, tufts shrink away. */
const FADE = 7;
export const MAX_TUFTS = 1600;
/** Share of grass blocks with a tuft on. */
export const DENSITY = 0.42;
const RESCAN_MS = 900;
const MOVE = 2;

/** A repeatable 0..1 from a column, so a tuft is always where it was. */
export function tuftHash(x, z, salt = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((z | 0) + salt * 7919, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * IMP-29 (owner, 8 November: "Grass looks shitty, it's just two points, I
 * would like it to be detailed, like real grass, some taller, some small,
 * with thin leaves"). One tuft: BLADES thin blades scattered over a small
 * patch, each a tapered quad to its middle and a point above, bending
 * outward, some short and some tall. Root dark, tip light and a little
 * warmer, as grass is. 3 triangles a blade.
 */
export const BLADES = 11;

function tuftGeometry() {
  const pos = [], col = [], idx = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < BLADES; i++) {
    // Where it grows, which way it faces and leans, how tall and thin.
    const ra = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.22;
    const bx = Math.cos(ra) * rr, bz = Math.sin(ra) * rr;
    const face = rnd() * Math.PI * 2, fx = Math.cos(face), fz = Math.sin(face);
    const lean = ra + (rnd() - 0.5) * 1.2, lx = Math.cos(lean), lz = Math.sin(lean);
    const tall = i % 4 === 0 ? 0.55 + rnd() * 0.25 : 0.18 + rnd() * 0.3;
    const w = 0.022 + rnd() * 0.016, bend = (0.1 + rnd() * 0.12) * tall;
    const mid = tall * 0.55;
    const b = pos.length / 3;
    // Root (2), middle (2), tip (1): the middle bends a little, the tip more.
    pos.push(
      bx - fx * w, 0, bz - fz * w,
      bx + fx * w, 0, bz + fz * w,
      bx + lx * bend * 0.35 + fx * w * 0.6, mid, bz + lz * bend * 0.35 + fz * w * 0.6,
      bx + lx * bend * 0.35 - fx * w * 0.6, mid, bz + lz * bend * 0.35 - fz * w * 0.6,
      bx + lx * bend, tall, bz + lz * bend,
    );
    const tip = 1.2 + rnd() * 0.15;
    col.push(0.62, 0.66, 0.6, 0.62, 0.66, 0.6, 0.98, 1, 0.95, 0.98, 1, 0.95, tip, tip * 1.02, tip * 0.82);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b + 3, b + 2, b + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Lit as if from above, like the ground they grow from — not by which
  // way each thin blade happens to face.
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export class GrassView {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = { uTime: { value: 0 } };
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 at = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
            float sway = sin(uTime * 1.6 + at.x * 0.7 + at.y * 0.9) + 0.5 * sin(uTime * 2.7 + at.y * 1.3);
            // The tip bends most: a blade sways from its root.
            float bendY = position.y * position.y * 2.2;
            transformed.x += sway * 0.05 * bendY;
            transformed.z += sway * 0.035 * bendY;
          #endif`);
    };
    this.material = material;
    this.geometry = tuftGeometry();
    this.mesh = new THREE.InstancedMesh(this.geometry, material, MAX_TUFTS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TUFTS * 3), 3);
    scene.add(this.mesh);
    this.lastScan = -Infinity;
    this.from = null;
    this.matrix = new THREE.Matrix4();
    this.quat = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.vec = new THREE.Vector3();
    this.size = new THREE.Vector3();
    this.colour = new THREE.Color();
    this.base = new THREE.Color(PALETTE.spring);   // the grass block's own (config/palette.js)
  }

  /** Once a frame: where the tufts are (now and then, or when you've moved), then the wind. */
  update(world, player, now = performance.now(), { enabled = true } = {}) {
    this.uniforms.uTime.value = now / 1000;
    this.mesh.visible = enabled && !!world && !!player;
    if (!this.mesh.visible) return;
    const moved = !this.from || Math.abs(player.x - this.from.x) > MOVE || Math.abs(player.z - this.from.z) > MOVE
      || Math.abs(player.y - this.from.y) > MOVE * 2;
    if (!moved && now - this.lastScan < RESCAN_MS) return;
    this.lastScan = now;
    this.from = { x: player.x, y: player.y, z: player.z };
    this.place(world, player);
  }

  /** Lays the tufts on the grass round `player`. Returns how many. */
  place(world, player) {
    const px = Math.floor(player.x), pz = Math.floor(player.z);
    let n = 0;
    for (let dx = -RADIUS; dx <= RADIUS && n < MAX_TUFTS; dx++) {
      for (let dz = -RADIUS; dz <= RADIUS && n < MAX_TUFTS; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > RADIUS) continue;
        const x = px + dx, z = pz + dz;
        if (tuftHash(x, z) > DENSITY) continue;
        const y = this.groundAt(world, x, z);
        if (y == null || Math.abs(y - player.y) > RADIUS) continue;
        // Shrinking away over the last FADE blocks.
        const fade = Math.min(1, (RADIUS - d) / FADE);
        const s = (0.75 + tuftHash(x, z, 1) * 0.55) * fade;
        if (s <= 0.02) continue;
        this.vec.set(x + 0.2 + tuftHash(x, z, 2) * 0.6, y, z + 0.2 + tuftHash(x, z, 3) * 0.6);
        this.euler.set(0, tuftHash(x, z, 4) * Math.PI * 2, 0);
        this.quat.setFromEuler(this.euler);
        this.size.set(s, s * (0.8 + tuftHash(x, z, 5) * 0.5), s);
        this.matrix.compose(this.vec, this.quat, this.size);
        this.mesh.setMatrixAt(n, this.matrix);
        // A green of its own: lighter, darker, warmer, cooler.
        const v = tuftHash(x, z, 6), w = tuftHash(x, z, 7) - 0.5;
        this.colour.copy(this.base).multiplyScalar(0.85 + v * 0.3);
        this.colour.r *= 1 + w * 0.25; this.colour.b *= 1 - w * 0.25;
        this.mesh.setColorAt(n, this.colour);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return n;
  }

  /** The top of the turf in a column — grass with open air on it — or null. */
  groundAt(world, x, z) {
    if (!world.endless && !world.inBounds(x, 0, z)) return null;
    // Decorative sampling must not generate terrain outside the streaming
    // budget. A later scan picks up chunks supplied by the normal loader.
    if (world.endless && !world.hasChunk(x >> 4, z >> 4)) return null;
    const h = world.surfaceHeight(x, z);
    for (const y of [h, h + 1, h - 1]) {
      if (world.getBlock(x, y - 1, z) === GRASS && world.getBlock(x, y, z) === 0) return y;
    }
    return null;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
