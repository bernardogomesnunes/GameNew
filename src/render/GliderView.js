import * as THREE from 'three';

/**
 * The flying machine, drawn on you while you fly with it (asked for
 * directly: "a wooden plane da Vinci style"): a wooden keel above your head,
 * two ribbed canvas wings out either side, and a tail behind. The wings beat
 * slowly while you fly and hold still, spread, while you glide down.
 *
 * Seen from inside in first person — the wings at the edges of the view
 * when you look up or about — and whole from behind in third person.
 */
const WOOD = 0x8a6440, DARK_WOOD = 0x5e4129, CANVAS = 0xefe6d2;

function wing(side) {
  const g = new THREE.Group();
  // Unlit, so the underside you see from beneath isn't a black slab.
  const canvas = new THREE.MeshBasicMaterial({ color: CANVAS, side: THREE.DoubleSide });
  const wood = new THREE.MeshBasicMaterial({ color: WOOD });
  // The canvas: three panels, each a little shorter, like a bat's wing.
  for (let i = 0; i < 3; i++) {
    const len = 2.6 - i * 0.55;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.55), canvas);
    panel.position.set(side * (len / 2 + 0.15), 0, -0.2 + i * 0.5);
    g.add(panel);
    // A rib along the front of each panel.
    const rib = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), wood);
    rib.position.set(side * (len / 2 + 0.15), 0.04, -0.45 + i * 0.5);
    g.add(rib);
  }
  return g;
}

export class GliderView {
  constructor(scene) {
    this.group = new THREE.Group();
    const wood = new THREE.MeshBasicMaterial({ color: WOOD });
    const dark = new THREE.MeshBasicMaterial({ color: DARK_WOOD });
    const canvas = new THREE.MeshBasicMaterial({ color: CANVAS, side: THREE.DoubleSide });
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), wood);
    keel.position.set(0, 0, 0.3);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark);
    mast.position.set(0, -0.25, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.45), canvas);
    tail.position.set(0, 0, 1.45);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.4), canvas);
    fin.position.set(0, 0.2, 1.45);
    this.left = wing(-1);
    this.right = wing(1);
    // On the ground it stands on a frame: two struts down to a pair of
    // skids, so a parked machine is something standing there, not floating.
    this.stand = new THREE.Group();
    for (const x of [-0.7, 0.7]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.08), dark);
      strut.position.set(x, -1.25, 0);
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.8), dark);
      skid.position.set(x, -2.46, 0.1);
      this.stand.add(strut, skid);
    }
    this.group.add(keel, mast, tail, fin, this.left, this.right, this.stand);
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }

  /** Follows the player (or stands for a parked one); `mode` is 'fly', 'glide', 'parked' or null (hidden). */
  update(player, mode, dt) {
    this.group.visible = !!mode;
    if (!mode || !player) return;
    this.t += dt;
    const p = player.position;
    // High and a little behind: in first person it edges the top of the
    // view rather than filling its sides.
    const yaw = player.yaw ?? 0;
    this.group.position.set(p.x + Math.sin(yaw) * 0.6, p.y + 2.5, p.z + Math.cos(yaw) * 0.6);
    this.group.rotation.set(0, yaw, 0);
    this.stand.visible = mode === 'parked';
    // A slow beat while flying; held out flat for a glide; folded a little at rest.
    const beat = mode === 'fly' ? Math.sin(this.t * 4.5) * 0.22 : mode === 'parked' ? -0.12 : 0.06;
    this.left.rotation.z = -beat;
    this.right.rotation.z = beat;
  }
}

/**
 * The flying machines set down in the world (DuiltGame.machines), one
 * GliderView each, parked. The one you're flying is drawn on you instead.
 */
export class MachineView {
  constructor(scene) {
    this.scene = scene;
    this.views = new Map(); // machine record -> its GliderView
  }

  update(machines, flying) {
    const seen = new Set();
    for (const m of machines ?? []) {
      if (m === flying) continue;
      seen.add(m);
      let v = this.views.get(m);
      if (!v) { v = new GliderView(this.scene); this.views.set(m, v); }
      v.update({ position: m, yaw: m.yaw ?? 0 }, 'parked', 0);
    }
    for (const [m, v] of this.views) {
      if (seen.has(m)) continue;
      v.dispose();
      this.views.delete(m);
    }
  }
}
