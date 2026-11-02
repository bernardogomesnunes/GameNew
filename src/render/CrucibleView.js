import * as THREE from 'three';
import { RECIPES_BY_ID } from '../config/recipes.js';
import { mouldFor } from '../duilt/Crucible.js';
import { stillCopy } from './Models.js';

/**
 * CRAFT3D-3: the crucible close up, on the real block in the world. A pot
 * over a fire glowing as a batch melts, and an ingot and a coin mould beside
 * it. Holding Pour tilts the pot and fills the chosen mould; letting go pours
 * at that level (duilt/Crucible.js decides what it makes). Six meshes in all,
 * made at start and taken away at end; nothing is made per frame.
 *
 * Owner, 2 November ("3d looks awful"): once the models have loaded, the
 * hearth (fire, moulds, tongs) and the pot are the pixel-textured models from
 * tools/mobs/machines.py; the plain boxes stay as the stand-in before that.
 */
export const FILL_SECONDS = 1.5;
const CAMERA_UP = 1.6, CAMERA_BACK = 1.35;
const METAL = 0xffa53a;

export class CrucibleView {
  constructor({ scene, camera, crucibles }) {
    this.scene = scene;
    this.camera = camera;
    this.crucibles = crucibles;
    this.key = null;
    this.group = null;
    this.level = 0;
    this.holding = false;
  }

  get active() {
    return this.key != null;
  }

  start(key, at) {
    this.end();
    this.key = key;
    this.top = new THREE.Vector3(at.x + 0.5, at.y + 1, at.z + 0.5);
    const g = this.group = new THREE.Group();
    g.position.copy(this.top);
    const box = (w, h, d, color, x, y, z, extra = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, ...extra }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    this.fire = box(0.5, 0.06, 0.5, 0x3a1a0a, -0.25, 0.03, 0, { emissive: 0xff5a1a, emissiveIntensity: 0.4 });
    // The pot tilts about its front edge, towards the moulds.
    this.potPivot = new THREE.Group();
    this.potPivot.position.set(-0.05, 0.06, 0);
    g.add(this.potPivot);
    this.pot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), new THREE.MeshLambertMaterial({ color: 0x4a3a34, emissive: METAL, emissiveIntensity: 0 }));
    this.pot.position.set(-0.2, 0.17, 0);
    this.potPivot.add(this.pot);
    this.ingotMould = box(0.34, 0.08, 0.2, 0x5a5048, 0.35, 0.04, -0.15);
    this.coinMould = box(0.3, 0.06, 0.3, 0x5a5048, 0.35, 0.03, 0.22);
    this.metal = box(1, 1, 1, METAL, 0, 0, 0, { emissive: METAL, emissiveIntensity: 0.8 });
    this.metal.visible = false;
    this.dressModels();
    this.scene.add(g);
  }

  /**
   * The hearth and pot models in place of the boxes, when loaded. The boxes
   * stay as hidden markers: the metal reads the moulds' sizes from them.
   */
  dressModels() {
    const hearth = stillCopy('crucible_hearth'), pot = stillCopy('crucible_pot');
    this.fireGlow = this.potGlow = null;
    if (!hearth || !pot) return;
    this.group.add(hearth);
    this.potPivot.add(pot);
    this.potPivot.position.y = 2 / 16;   // on the coals
    for (const m of [this.fire, this.pot, this.ingotMould, this.coinMould]) m.visible = false;
    // The models' moulds: the ingot cavity is 7 x 4 px, 2 px deep; the coin plate 6 x 5, 1 deep.
    this.ingotMould.position.set(6.5 / 16, 1 / 16, -3 / 16);
    this.ingotMould.scale.set(6 / 5.44, 2 / 1.28, 3 / 3.2);
    this.coinMould.position.set(6 / 16, 0.5 / 16, 3.5 / 16);
    this.coinMould.scale.set(5 / 4.8, 1 / 0.96, 4 / 4.8);
    this.fireGlow = hearth.userData.material;
    this.potGlow = pot.userData.material;
  }

  end() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => { if (o.isMesh) { if (!o.userData.sharedGeometry) o.geometry.dispose(); o.material.dispose(); } });
    }
    this.group = null;
    this.key = null;
    this.holding = false;
    this.level = 0;
  }

  /** Whether there is something to pour into the chosen mould now. */
  canPour() {
    const s = this.active ? this.crucibles.state(this.key) : null;
    return !!s?.molten && mouldFor(RECIPES_BY_ID.get(s.recipeId)) === s.mould;
  }

  /** Hold (true) to tilt and fill; let go (false) to pour at that level. */
  holdPour(on) {
    if (on) { if (this.canPour()) this.holding = true; return null; }
    if (!this.holding) return null;
    this.holding = false;
    const r = this.crucibles.pour(this.key, this.level);
    this.level = 0;
    return r;
  }

  update(dt) {
    if (!this.active) return;
    this.camera.position.set(this.top.x, this.top.y + CAMERA_UP, this.top.z + CAMERA_BACK);
    this.camera.lookAt(this.top);
    const s = this.crucibles.state(this.key);
    // The pot glows as its batch melts, and stays bright while metal is molten.
    const glow = s ? (s.molten ? 1 : s.progress) : 0;
    this.pot.material.emissiveIntensity = 0.9 * glow;
    const flicker = s?.waiting ? 0.6 + 0.2 * Math.sin(performance.now() / 120) : 0.2;
    this.fire.material.emissiveIntensity = flicker;
    if (this.fireGlow) this.fireGlow.emissiveIntensity = 0.4 + flicker;
    if (this.potGlow) this.potGlow.emissiveIntensity = 0.15 + glow;
    if (this.holding) this.level = Math.min(1.25, this.level + dt / FILL_SECONDS);
    this.potPivot.rotation.z = -Math.min(1, this.level) * (Math.PI / 3);
    // The metal runs out over the chosen mould and rises with the level.
    const mould = s?.mould === 'coin' ? this.coinMould : this.ingotMould;
    this.metal.visible = this.level > 0;
    if (this.metal.visible) {
      const g = mould.geometry.parameters, k = mould.scale, l = Math.min(this.level, 1.25);
      const spread = 0.85 * Math.min(1, 0.4 + 0.6 * l), h = 0.004 + 0.03 * l;
      this.metal.scale.set(g.width * k.x * spread, h, g.depth * k.z * spread);
      this.metal.position.set(mould.position.x, mould.position.y + (g.height * k.y) / 2 - 0.002 + h / 2, mould.position.z);
    }
  }
}
