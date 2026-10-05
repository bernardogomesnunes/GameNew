import * as THREE from 'three';

/**
 * The carts on your horses (asked for directly: "horses with wooden carts"):
 * a plank bed on two wheels, hitched behind the horse by two shafts, turning
 * as it turns. One mesh group per horse that has a cart, made the first time
 * it is seen and dropped once the horse is gone.
 */
const WOOD = 0xa77b4f, DARK_WOOD = 0x6b4a2c;
/** How far behind the horse's middle the cart's middle sits. */
const BEHIND = 1.75;

function makeCart() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: WOOD });
  const dark = new THREE.MeshLambertMaterial({ color: DARK_WOOD });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.3), wood);
  bed.position.y = 0.62;
  g.add(bed);
  // Low sides, so it reads as something that holds things.
  for (const [x, z, w, l] of [[-0.57, 0, 0.06, 1.3], [0.57, 0, 0.06, 1.3], [0, -0.62, 1.2, 0.06], [0, 0.62, 1.2, 0.06]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, l), wood);
    side.position.set(x, 0.83, z);
    g.add(side);
  }
  for (const x of [-0.7, 0.7]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, 0);
    g.add(wheel);
    // The shafts run forward to the horse.
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.3), dark);
    shaft.position.set(x * 0.5, 0.8, 1.2);
    g.add(shaft);
  }
  return g;
}

export class CartView {
  constructor(scene) {
    this.scene = scene;
    this.carts = new Map(); // horse record -> its cart's group
  }

  /** `mounts`: your horses (DuiltGame.mounts); those with `cart` get one drawn. */
  update(mounts) {
    const seen = new Set();
    for (const m of mounts ?? []) {
      if (!m.cart || m.dead) continue;
      seen.add(m);
      let g = this.carts.get(m);
      if (!g) {
        g = makeCart();
        this.carts.set(m, g);
        this.scene.add(g);
      }
      const f = m.facing ?? 0;
      // A horse faces down its own +z, so behind it is -z.
      g.position.set(m.x - Math.sin(f) * BEHIND, m.y, m.z - Math.cos(f) * BEHIND);
      g.rotation.set(0, f, 0);
    }
    for (const [m, g] of this.carts) {
      if (seen.has(m)) continue;
      this.scene.remove(g);
      g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      this.carts.delete(m);
    }
  }
}
