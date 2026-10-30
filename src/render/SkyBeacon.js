import * as THREE from 'three';
import { ISLAND_R } from '../world/skyKingdom.js';

/**
 * The Sky Kingdom seen from far off (world/skyKingdom.js): a small island
 * hanging low in the sky the way it lies, with a gold light on it — brighter
 * at night — so the dark path always has somewhere to point.
 *
 * The real island is 5,000 blocks out, far past where anything is drawn, so
 * this is a stand-in: pulled in to BEACON_FAR along the true line, sized and
 * raised so it stays a shape you can pick out rather than a speck under the
 * horizon. Close enough to see the island itself, it goes.
 */

/** Never drawn further than this — inside the fog's end and the camera's far plane. */
export const BEACON_FAR = 1300;
/** Nearer than this the island itself is in view, and the stand-in goes. */
export const BEACON_NEAR = 260;
/** It always sits at least this high over the horizon (radians)... */
const LIFT = 0.07;
/** ...and is at least this wide, as a share of how far away it's drawn. */
const WIDTH = 0.045;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class SkyBeacon {
  constructor(scene) {
    this.group = new THREE.Group();
    const mat = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
    // A unit island: rock tapering to a point below, grass on top, the
    // palace and its gold roof in the middle.
    const rock = new THREE.Mesh(new THREE.ConeGeometry(1, 1.1, 9), mat(0x7d7a86));
    rock.rotation.x = Math.PI; rock.position.y = -0.55;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 0.12, 9), mat(0x9fc58a));
    grass.position.y = 0.06;
    const hall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.3), mat(0xeef0f5));
    hall.position.y = 0.22;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 4), mat(0xe2c26a));
    roof.position.y = 0.42; roof.rotation.y = Math.PI / 4;
    this.island = new THREE.Group();
    this.island.add(rock, grass, hall, roof);
    // Its collar of cloud, as the island itself has up close (SkyMist): a
    // couple of flat puffs round the lower half of the rock.
    this.cloud = mat(0xf4f3ee);
    this.cloud.toneMapped = false;
    for (const [x, z, w, d] of [[0.15, 0.1, 2.5, 1.7], [-0.3, -0.2, 1.7, 2.3], [0.5, -0.45, 1.2, 0.9]]) {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, d), this.cloud);
      puff.position.set(x, -0.62, z);
      this.island.add(puff);
    }
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffe3a0, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.group.add(this.island, this.glow);
    this.group.visible = false;
    this.group.renderOrder = 4;
    scene.add(this.group);
  }

  /**
   * @param at     { x, y, z } of the island's middle, or null for none (the white path)
   * @param eye    where you're looking from
   * @param night  0 by day .. 1 at midnight
   */
  update(at, eye, night = 0, cloud = null) {
    const where = at && placeBeacon(at, eye);
    this.group.visible = !!where;
    if (!where) return;
    this.group.position.set(where.x, where.y, where.z);
    this.island.scale.setScalar(where.size);
    if (cloud) this.cloud.color.copy(cloud);
    this.glow.position.y = where.size * 0.3;
    this.glow.scale.setScalar(where.size * (2.6 + night * 1.4));
    this.glow.material.opacity = 0.35 + night * 0.6;
  }
}

/**
 * Where the stand-in goes, and how big: along the true line from `eye`,
 * no further than BEACON_FAR, no lower than LIFT over the horizon, no
 * narrower than WIDTH. Null when the island itself is near enough to see.
 */
export function placeBeacon(at, eye) {
  const dx = at.x - eye.x, dz = at.z - eye.z, d = Math.hypot(dx, dz);
  if (d < BEACON_NEAR) return null;
  const drawn = Math.min(d, BEACON_FAR), k = drawn / d;
  const y = eye.y + Math.max((at.y - eye.y) * k, drawn * Math.tan(LIFT));
  return { x: eye.x + dx * k, y, z: eye.z + dz * k, size: Math.max(ISLAND_R * k, drawn * WIDTH), distance: d };
}
