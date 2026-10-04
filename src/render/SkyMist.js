import * as THREE from 'three';
import { FLOOR, ISLAND_R } from '../world/skyKingdom.js';
import { BEACON_NEAR } from './SkyBeacon.js';

/**
 * Cloud round the Sky Kingdom (plan section 4: "mist round the floating
 * island, and cloud below it"). An island hanging in clear air reads as a
 * model on a stand; one sitting on a bank of cloud, with mist trailing off
 * its cliffs, reads as somewhere high up.
 *
 * Two layers of puffs in the same blocky style as the sky's own clouds
 * (SkyClouds), placed once round the island and never moved:
 *
 * - a bank below it, solid, that the tip of its rock pokes down through —
 *   seen from the ground it's the island's floor of cloud, and from the edge
 *   of the island it's a sea of cloud below you;
 * - wisps clinging to the cliffs below the rim, half in the rock.
 *
 * All solid: see-through boxes read as panes of glass, and cost a phone's
 * fill rate besides.
 *
 * Only drawn near the island: further off, the stand-in (SkyBeacon) carries
 * its own small collar of cloud.
 */

const BANK = 42;
const WISPS = 22;
/** The bank's height: under the island's floor, round the lower half of its rock. */
const BANK_Y = FLOOR - 44;
const WISP_Y = FLOOR - 10;

function hash01(i, salt) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Where each puff sits relative to the island's middle, and how big — fixed,
 * a hash of its number. Exported for the tests.
 */
export function mistLayout() {
  const bank = [], wisps = [];
  for (let i = 0; i < BANK; i++) {
    // Spread over a disc a little wider than the island, thicker underneath.
    const a = hash01(i, 1) * Math.PI * 2, r = ISLAND_R * 1.5 * Math.sqrt(hash01(i, 2));
    bank.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r, y: BANK_Y + (hash01(i, 3) - 0.5) * 10,
      w: 22 + hash01(i, 4) * 22, h: 4 + hash01(i, 5) * 4, d: 18 + hash01(i, 6) * 18,
    });
  }
  for (let i = 0; i < WISPS; i++) {
    const a = (i / WISPS) * Math.PI * 2 + hash01(i, 7) * 0.3, r = ISLAND_R * (0.9 + hash01(i, 8) * 0.14);
    wisps.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r, y: WISP_Y + (hash01(i, 9) - 0.5) * 12,
      w: 10 + hash01(i, 10) * 14, h: 2 + hash01(i, 11) * 3, d: 8 + hash01(i, 12) * 10,
    });
  }
  return { bank, wisps };
}

/**
 * A unit box lit from above, baked in: the sky's own clouds are flat white
 * shapes, which high overhead is right, but a bank seen from the side or
 * from above read as white cards. Tops full, sides a shade down, bottoms
 * greyer — a cloud's own shadow — and still unlit, so it costs nothing.
 */
function shadedBox() {
  const geo = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const n = geo.attributes.normal, colours = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const y = n.getY(i), k = y > 0.5 ? 1 : y < -0.5 ? 0.78 : 0.9;
    colours.set([k, k, k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

export class SkyMist {
  constructor(scene) {
    const { bank, wisps } = mistLayout();
    const all = [...bank, ...wisps];
    // Not tone mapped, like the sky it hangs in: drawn brighter the way the
    // world is, an off-white cloud burns out to a flat white card.
    this.material = new THREE.MeshBasicMaterial({ color: 0xfbfaf4, vertexColors: true });
    this.material.toneMapped = false;
    this.mesh = new THREE.InstancedMesh(shadedBox(), this.material, all.length);
    const m = new THREE.Object3D();
    all.forEach((p, i) => {
      m.position.set(p.x, p.y, p.z);
      m.scale.set(p.w, p.h, p.d);
      m.updateMatrix();
      this.mesh.setMatrixAt(i, m.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    // The mesh moves to the island; its instances' bounds are relative to
    // it and cheaper to skip than to keep right.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.enabled = true;
    scene.add(this.mesh);
  }

  /**
   * @param at     the island's middle { x, y, z }, or null for none
   * @param eye    where you're looking from
   * @param cloud  the sky's cloud colour now (DayCycle.cloudColor)
   */
  update(at, eye, cloud) {
    const near = !!(this.enabled && at && Math.hypot(at.x - eye.x, at.z - eye.z) < BEACON_NEAR);
    this.mesh.visible = near;
    if (!near) return;
    this.mesh.position.set(at.x, 0, at.z);
    this.material.color.copy(cloud);
  }
}
