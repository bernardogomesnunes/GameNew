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
    const material = new THREE.MeshBasicMaterial({ color: CLOUD_COLOR });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    // Always somewhere near the camera by construction (re-centred every
    // frame in update) — its true bounds are meaningless to compute from
    // the geometry alone, so skip the check rather than have it wrongly cull.
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);

    this.offset = 0;
    this.dummy = new THREE.Object3D();
    // Each cell's own puff shape and jitter, worked out once and stable
    // forever after — a hash of its index, not stored noise, so there is
    // nothing to regenerate as cells are reused while the player walks.
    this.variants = [];
    for (let i = 0; i < this.count; i++) {
      this.variants.push({
        w: 9 + hash01(i, 1) * 11,
        d: 7 + hash01(i, 2) * 9,
        h: 2 + hash01(i, 3) * 2,
        yOff: hash01(i, 4) * 8,
        xJitter: (hash01(i, 5) - 0.5) * CELL * 0.6,
        zJitter: (hash01(i, 6) - 0.5) * CELL * 0.6,
      });
    }
  }

  update(dt, playerX, playerZ) {
    this.offset = (this.offset + dt * DRIFT_SPEED) % CELL;
    const baseX = Math.round(playerX / CELL) * CELL;
    const baseZ = Math.round(playerZ / CELL) * CELL;
    let i = 0;
    for (let gx = -RADIUS; gx <= RADIUS; gx++) {
      for (let gz = -RADIUS; gz <= RADIUS; gz++, i++) {
        const v = this.variants[i];
        this.dummy.position.set(
          baseX + gx * CELL + v.xJitter + this.offset,
          CLOUD_Y + v.yOff,
          baseZ + gz * CELL + v.zJitter,
        );
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
