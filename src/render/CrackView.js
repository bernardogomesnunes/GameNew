import * as THREE from 'three';

/**
 * Cracks spreading over the block you are digging (backlog batch 2: "a break
 * animation"). A box a hair bigger than the block, drawn over it with a tile
 * that is clear except for the cracks; the further the dig, the further they
 * run. The tiles are painted here as pixels — the same 16-across grain as the
 * block textures — so they read as part of the world, not a sticker on it.
 */

export const CRACK_STAGES = 6;
const N = 16;

function hash01(a, b, salt) {
  let h = (a * 374761393 + b * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The crack pixels, in the order they appear: a few branches wandering out
 * from near the middle, each a step at a time. Stage k shows the first
 * (k + 1) / CRACK_STAGES of them.
 */
export function crackPath() {
  const branches = [];
  const B = 5;
  for (let b = 0; b < B; b++) {
    const angle = (b / B) * Math.PI * 2 + hash01(b, 1, 7) * 0.9;
    let x = 7.5 + Math.cos(angle) * 1.2, y = 7.5 + Math.sin(angle) * 1.2;
    let dx = Math.cos(angle), dy = Math.sin(angle);
    const path = [];
    for (let s = 0; s < 10; s++) {
      path.push([Math.round(x), Math.round(y)]);
      const turn = (hash01(b, s, 13) - 0.5) * 1.1;
      [dx, dy] = [dx * Math.cos(turn) - dy * Math.sin(turn), dx * Math.sin(turn) + dy * Math.cos(turn)];
      x += dx; y += dy;
      if (x < 0 || y < 0 || x > N - 1 || y > N - 1) break;
    }
    branches.push(path);
  }
  // Interleave so every stage grows every branch a little.
  const out = [];
  for (let s = 0; s < 10; s++) for (const p of branches) if (p[s]) out.push(p[s]);
  return out;
}

/** The tile for one stage: RGBA, clear but for the cracks. */
export function crackTile(stage) {
  const path = crackPath();
  const shown = Math.ceil(path.length * (stage + 1) / CRACK_STAGES);
  const data = new Uint8Array(N * N * 4);
  for (const [x, y] of path.slice(0, shown)) {
    const o = (y * N + x) * 4;
    data[o] = 24; data[o + 1] = 18; data[o + 2] = 14; data[o + 3] = 200;
  }
  return data;
}

export class CrackView {
  constructor(scene) {
    this.textures = Array.from({ length: CRACK_STAGES }, (_, k) => {
      const t = new THREE.DataTexture(crackTile(k), N, N, THREE.RGBAFormat);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    });
    this.material = new THREE.MeshBasicMaterial({
      map: this.textures[0], transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  /** Shows the cracks on block (x, y, z) at `progress` 0..1, or hides them (null). */
  update(at, progress = 0) {
    if (!at) { this.mesh.visible = false; return; }
    const stage = Math.max(0, Math.min(CRACK_STAGES - 1, Math.floor(progress * CRACK_STAGES)));
    if (this.material.map !== this.textures[stage]) this.material.map = this.textures[stage];
    this.mesh.position.set(at.x + 0.5, at.y + 0.5, at.z + 0.5);
    this.mesh.visible = true;
  }
}
