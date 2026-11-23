import * as THREE from 'three';
import { RECIPES_BY_ID } from '../config/recipes.js';
import { mouldFor } from '../duilt/Crucible.js';
import { stillCopy } from './Models.js';
import { ITEMS_BY_ID } from '../config/items.js';

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
/**
 * The Kiln Oven is looked at lower, into its mouth, so the tray shows. On a
 * portrait screen the camera stands further back and looks below the oven,
 * which puts the oven in the top third, clear of the bar.
 */
const KILN_CAMERA = { wide: { up: 0.75, back: 1.5, look: -0.15 }, tall: { up: 0.7, back: 1.9, look: -0.45 } };
const METAL = 0xffa53a;

/** CRAFT-9 part 6: the Kiln Oven's colours: brick shell, dark mouth, fire, tray. */
const KILN_BRICK = 0x7e4434, KILN_ROOF = 0x63362b, KILN_DARK = 0x2a1610, KILN_FIRE = 0xff7a2a, KILN_TRAY = 0x5a5048;
/** What sits on the tray: brick red, glass pale blue, a vase terracotta. */
const WARE = { brick: 0xa8432c, glass: 0xb9dce8, vase: 0xc9825c, dried_red: 0x9a3a3a, dried_lilac: 0x7a5c98, dried_pale: 0xb8a27e };
/** The palette startKiln builds with: the Kiln Oven's own, or the Dehydrator's (PLAY-16: a warm draught, no flames, no chimney). */
const KILN_LOOK = { shell: KILN_BRICK, roof: KILN_ROOF, dark: KILN_DARK, fire: KILN_FIRE, fireMax: 1, tray: KILN_TRAY, chimney: true };
const DEHYDRATOR_LOOK = { shell: 0x9c7348, roof: 0x8a6440, dark: 0x3a2a1c, fire: 0xffb46a, fireMax: 0.15, tray: 0xc9b38a, chimney: false };

export class CrucibleView {
  /** `kind` 'crucible' (pot and moulds) or 'kiln' (the Kiln Oven: an oven mouth and a tray drawn out of it). */
  constructor({ scene, camera, crucibles, kind = 'crucible' }) {
    this.kind = kind;
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
    const box = (w, h, d, color, x, y, z, extra = {}, parent = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, ...extra }));
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    // The oven is built facing +z and turned round, so its mouth faces -z,
    // the way the Kiln Oven block's door does; the camera stands on that side.
    if (this.kind === 'kiln' || this.kind === 'dehydrator') {
      g.rotation.y = Math.PI;
      this.startKiln(box, this.kind === 'dehydrator' ? DEHYDRATOR_LOOK : KILN_LOOK);
      this.scene.add(g);
      return;
    }
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
    // PLAY-19: the Cauldron is this pot in iron, pouring into a wooden bowl. No models, no coin mould.
    if (this.kind === 'cauldron') {
      this.pot.material.color.setHex(0x2f2f33);
      this.pot.material.emissive.setHex(0xff7a2a);
      this.ingotMould.material.color.setHex(0x8a6238);
      this.ingotMould.scale.set(0.3 / 0.34, 0.1 / 0.08, 0.3 / 0.2);
      this.ingotMould.position.set(0.35, 0.05, 0);
      this.coinMould.visible = false;
      this.metal.material.emissiveIntensity = 0;
      this.scene.add(g);
      return;
    }
    this.dressModels();
    this.scene.add(g);
  }

  /**
   * CRAFT-9 part 6: the Kiln Oven close up. A brick oven with its mouth to
   * the camera, the fire glowing inside, an iron door that swings open once a
   * batch is fired, and a tray that slides out as Draw is held, carrying the
   * ware (brick, glass or a vase). Fourteen meshes, made here, none per frame.
   */
  startKiln(box, look = KILN_LOOK) {
    this.look = look;
    // The shell: floor, back, two sides, a roof and a lintel over the mouth.
    box(0.9, 0.08, 0.7, look.shell, 0, 0.04, -0.1);
    box(0.9, 0.5, 0.1, look.shell, 0, 0.33, -0.4);
    box(0.12, 0.5, 0.7, look.shell, -0.39, 0.33, -0.1);
    box(0.12, 0.5, 0.7, look.shell, 0.39, 0.33, -0.1);
    box(0.96, 0.12, 0.76, look.roof, 0, 0.64, -0.1);
    if (look.chimney !== false) box(0.16, 0.3, 0.16, look.roof, 0.26, 0.85, -0.3);
    box(0.66, 0.1, 0.08, look.shell, 0, 0.53, 0.21);
    box(0.66, 0.4, 0.02, look.dark, 0, 0.32, -0.34);
    // The fire: a bed of coals along the back wall of the chamber.
    this.fire = box(0.58, 0.1, 0.12, look.dark, 0, 0.13, -0.3, { emissive: look.fire, emissiveIntensity: Math.min(0.4, look.fireMax) });
    // The door hinges on the left of the mouth and swings out towards you.
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-0.33, 0.08, 0.24);
    this.group.add(this.doorPivot);
    this.door = box(0.66, 0.44, 0.04, 0x4c4a55, 0.33, 0.22, 0, {}, this.doorPivot);
    box(0.06, 0.06, 0.04, 0xc9ced6, 0.58, 0.24, 0.03, {}, this.doorPivot);
    // The tray, and the ware on it; both slide together.
    this.tray = new THREE.Group();
    this.tray.position.set(0, 0.14, -0.12);
    this.group.add(this.tray);
    box(0.46, 0.03, 0.38, look.tray, 0, 0, 0, {}, this.tray);
    box(0.04, 0.03, 0.4, 0x6b4a33, 0, 0, 0.36, {}, this.tray);
    this.ware = box(0.24, 0.12, 0.16, WARE.brick, 0, 0.075, 0, { emissive: look.fire, emissiveIntensity: 0 }, this.tray);
    this.wareId = null;
  }

  /** The ware takes the shape and colour of what the oven holds. */
  dressWare(id) {
    if (id === this.wareId) return;
    this.wareId = id;
    this.ware.material.color.setHex(WARE[id] ?? WARE.brick);
    this.ware.material.transparent = id === 'glass';
    this.ware.material.opacity = id === 'glass' ? 0.75 : 1;
    if (id === 'vase') { this.ware.scale.set(0.7, 1.9, 1.1); this.ware.position.y = 0.13; }
    else if (id === 'glass') { this.ware.scale.set(1.1, 0.3, 1.3); this.ware.position.y = 0.03; }
    else if (id.startsWith('dried_')) { this.ware.scale.set(1.1, 0.35, 1.2); this.ware.position.y = 0.03; }
    else { this.ware.scale.set(1, 1, 1); this.ware.position.y = 0.075; }
  }

  updateKiln(dt) {
    const s = this.crucibles.state(this.key);
    const recipe = s ? RECIPES_BY_ID.get(s.recipeId) : null;
    this.ware.visible = !!s?.waiting || !!s?.molten || this.level > 0;
    if (recipe) this.dressWare(recipe.output.id);
    // The ware glows as it fires and stays hot until drawn.
    this.ware.material.emissiveIntensity = s ? (s.molten ? 0.15 : 0.15 * s.progress) : 0;
    if (this.look.fireMax < 1) this.ware.material.emissiveIntensity = 0;
    const flicker = s?.waiting ? 0.7 + 0.25 * Math.sin(performance.now() / 120) : 0.25;
    this.fire.material.emissiveIntensity = Math.min(flicker, this.look.fireMax);
    if (this.holding) this.level = Math.min(1.25, this.level + dt / FILL_SECONDS);
    // The door stands open while something fired waits, shut while it fires.
    const open = s?.molten || this.level > 0 ? 1 : 0;
    this.doorPivot.rotation.y += (open * (Math.PI * 0.6) - this.doorPivot.rotation.y) * Math.min(1, dt * 8);
    // Full (level 1) brings the tray to the lip of the mouth; past it, off the edge.
    this.tray.position.z = -0.12 + 0.5 * Math.min(this.level, 1.25);
    this.tray.position.y = 0.14 - Math.max(0, this.level - 1.05) * 0.8;
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
    if (this.kind === 'kiln' || this.kind === 'dehydrator') {
      const c = KILN_CAMERA[this.camera.aspect < 1 ? 'tall' : 'wide'];
      this.camera.position.set(this.top.x, this.top.y + c.up, this.top.z - c.back);
      this.camera.lookAt(this.top.x, this.top.y + c.look, this.top.z);
      this.updateKiln(dt);
      return;
    }
    this.camera.position.set(this.top.x, this.top.y + CAMERA_UP, this.top.z + CAMERA_BACK);
    this.camera.lookAt(this.top);
    const s = this.crucibles.state(this.key);
    // The pot glows as its batch melts, and stays bright while metal is molten.
    const glow = s ? (s.molten ? 1 : s.progress) : 0;
    this.pot.material.emissiveIntensity = (this.kind === 'cauldron' ? 0.12 : 0.9) * glow;
    const flicker = s?.waiting ? 0.6 + 0.2 * Math.sin(performance.now() / 120) : 0.2;
    this.fire.material.emissiveIntensity = flicker;
    if (this.fireGlow) this.fireGlow.emissiveIntensity = 0.4 + flicker;
    if (this.potGlow) this.potGlow.emissiveIntensity = 0.15 + glow;
    if (this.holding) this.level = Math.min(1.25, this.level + dt / FILL_SECONDS);
    this.potPivot.rotation.z = -Math.min(1, this.level) * (Math.PI / 3);
    // The metal runs out over the chosen mould and rises with the level.
    const mould = s?.mould === 'coin' ? this.coinMould : this.ingotMould;
    if (this.kind === 'cauldron' && s) this.metal.material.color.setHex(ITEMS_BY_ID.get(RECIPES_BY_ID.get(s.recipeId)?.output.id)?.color ?? 0x8a5a2a);
    this.metal.visible = this.level > 0;
    if (this.metal.visible) {
      const g = mould.geometry.parameters, k = mould.scale, l = Math.min(this.level, 1.25);
      const spread = 0.85 * Math.min(1, 0.4 + 0.6 * l), h = 0.004 + 0.03 * l;
      this.metal.scale.set(g.width * k.x * spread, h, g.depth * k.z * spread);
      this.metal.position.set(mould.position.x, mould.position.y + (g.height * k.y) / 2 - 0.002 + h / 2, mould.position.z);
    }
  }
}
