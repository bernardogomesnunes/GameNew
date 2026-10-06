import * as THREE from 'three';

/**
 * A drifting layer of low-poly puffs high over the world — requested
 * directly alongside the rest of the terrain overhaul.
 *
 * Not part of the voxel world at all: block data only goes up to the
 * world's own height (see ChunkGen's WORLD_HEIGHT), but the render scene has
 * no such ceiling, so clouds sit well above it as pure decoration, the same
 * way FarTerrain's distant ring is real geometry but never real chunk data.
 *
 * A small fixed grid of box instances re-centred on the player every frame,
 * the same infinite-illusion trick FarTerrain's rings use — never more
 * instances than COUNT regardless of how far the world is walked, and no
 * per-frame allocation once built.
 */

const CLOUD_Y = 210;
const CELL = 48;
const RADIUS = 4;            // -RADIUS..RADIUS in both grid axes
const DRIFT_SPEED = 0.7;     // blocks/second
// A pale, warm-white rather than pure white — the sky itself (Game.js's
// 0xadd7f5) and every block already sit in the same softened palette, and a
// stark white cloud would be the one saturated thing in the sky.
const CLOUD_COLOR = 0xfbfaf4;

function hash01(i, salt) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class SkyClouds {
  constructor(scene) {
    const side = RADIUS * 2 + 1;
    this.count = side * side;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // Unlit on purpose: a cloud seen from below or the side is still bright
    // in real daylight, and MeshLambertMaterial's directional shading was
    // turning every face but the sun-facing one a flat, un-cloud-like grey.
    // A little see-through (asked for directly: "they should be transparent
    // or cloudy"), and not writing depth, so one cloud behind another shows
    // through it rather than being cut out of it.
    const material = new THREE.MeshBasicMaterial({ color: CLOUD_COLOR, transparent: true, opacity: 0.78, depthWrite: false });
    // Nor tone mapped (render/atmosphere.js): the world is drawn brighter
    // than it was, and a cloud already near white would burn out to a flat
    // white card and lose its sunset colour.
    material.toneMapped = false;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    // Always somewhere near the camera by construction (re-centred every
    // frame in update) — its true bounds are meaningless to compute from
    // the geometry alone, so skip the check rather than have it wrongly cull.
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);

    // How far the whole layer has drifted, ever. Not wrapped: wrapping it
    // every CELL jumped every cloud back a whole cell at once.
    this.drift = 0;
    this.variants = new Map();
    this.dummy = new THREE.Object3D();
  }

  /**
   * A cloud's own shape and jitter, from the sky cell it belongs to — not
   * from where that cell sits relative to you. Keyed by where you stood, all
   * of them changed shape and jumped each time you crossed a cell (reported
   * directly: "The clouds tickle whenever I move ... they should move
   * smoothly no matter my movement").
   */
  variant(cx, cz) {
    // Kept, so a frame allocates nothing: the same few dozen cells are asked
    // for every frame, and only change as the sky drifts or you travel.
    const key = cx * 1048576 + cz;
    const known = this.variants.get(key);
    if (known) return known;
    if (this.variants.size > 600) this.variants.clear();
    // Both coordinates packed into one number, unique to the cell (a sum or
    // xor of the two gave mirror-image cells the same cloud).
    const i = (((cx + 32768) & 0xffff) << 16) | ((cz + 32768) & 0xffff);
    const v = {
      w: 9 + hash01(i, 1) * 11,
      d: 7 + hash01(i, 2) * 9,
      h: 2 + hash01(i, 3) * 2,
      yOff: hash01(i, 4) * 8,
      xJitter: (hash01(i, 5) - 0.5) * CELL * 0.6,
      zJitter: (hash01(i, 6) - 0.5) * CELL * 0.6,
    };
    this.variants.set(key, v);
    return v;
  }

  /** Tints the clouds — grey-blue at night, warm at dusk. See render/DayCycle.js. */
  setColor(color) {
    this.mesh.material.color.copy(color);
  }

  update(dt, playerX, playerZ) {
    this.drift += dt * DRIFT_SPEED;
    // The cells round you, in the drifting sky's own frame: a cloud is its
    // cell's, wherever you are, and moves only by the drift.
    const baseX = Math.round((playerX - this.drift) / CELL);
    const baseZ = Math.round(playerZ / CELL);
    let i = 0;
    for (let gx = -RADIUS; gx <= RADIUS; gx++) {
      for (let gz = -RADIUS; gz <= RADIUS; gz++, i++) {
        const cx = baseX + gx, cz = baseZ + gz;
        const v = this.variant(cx, cz);
        this.dummy.position.set(cx * CELL + v.xJitter + this.drift, CLOUD_Y + v.yOff, cz * CELL + v.zJitter);
        this.dummy.scale.set(v.w, v.h, v.d);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
