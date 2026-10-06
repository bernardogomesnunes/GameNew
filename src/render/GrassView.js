import * as THREE from 'three';

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

function tuftGeometry() {
  // Five blades, each a tapered quad standing on the ground, fanned round.
  const pos = [], col = [], idx = [];
  const blades = [[0, 0.42, 0.13], [1.25, 0.3, 0.11], [2.5, 0.48, 0.12], [3.75, 0.36, 0.1], [5, 0.44, 0.12]];
  for (const [a, h, w] of blades) {
    const cx = Math.cos(a) * w, cz = Math.sin(a) * w;
    const lean = 0.08;
    const b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx * 0.25 + lean * Math.sin(a), h, cz * 0.25 - lean * Math.cos(a), -cx * 0.25 + lean * Math.sin(a), h, -cz * 0.25 - lean * Math.cos(a));
    col.push(0.74, 0.74, 0.74, 0.74, 0.74, 0.74, 1.14, 1.14, 1.14, 1.14, 1.14, 1.14);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
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
            transformed.x += sway * 0.05 * position.y;
            transformed.z += sway * 0.035 * position.y;
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
    this.base = new THREE.Color(0x7fc254);
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
