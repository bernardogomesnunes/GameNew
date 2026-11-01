import * as THREE from 'three';
import { partsFor } from '../config/furnitureParts.js';
import { boxColor } from '../world/propShapes.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';

/**
 * CRAFT3D-1: the carpentry counter, close up, in the game's own scene and
 * camera (owner, 31 October: "see the block in 3d and when using the saw we
 * could cut the piece in a standard animation, and see the pieces there to
 * assemble"). The rules are duilt/Counter.js; this only draws them and turns
 * pointer drags into fits.
 *
 * On the counter top: a pale outline of the piece in the middle, the plank
 * and the saw to its left, and the cut parts in a row in front, waiting to be
 * dragged into the outline. Everything lives in one group, made at `pick` and
 * removed at `end`: at most 9 children (the outline, the plank and saw, up to
 * 8 parts... the saw rides with the plank), nothing made per frame.
 */
export const SAW_SECONDS = 0.8;
/** How close to its place a part has to be dropped to snap in, in blocks. */
const SNAP = 0.15;
/** The piece is drawn at this scale on the counter top. */
const SCALE = 0.55;
/** Far enough up and back that the whole top fits a phone held upright (390 px wide). */
const CAMERA_UP = 2.2, CAMERA_BACK = 1.8;

export class CounterView {
  constructor({ scene, camera, counters, bus = null, onDone = null }) {
    this.scene = scene;
    this.camera = camera;
    this.counters = counters;
    this.bus = bus;
    this.onDone = onDone;
    this.key = null;
    this.group = null;
    this.sawing = 0;
    this._v = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
  }

  get active() {
    return this.key != null;
  }

  /** Opens the close-up over the counter at `at` (its block position). */
  start(key, at) {
    this.end();
    this.key = key;
    this.top = new THREE.Vector3(at.x + 0.5, at.y + 1, at.z + 0.5);
    this._plane.constant = -this.top.y;
    this.offHurt = this.bus?.on('health:change', (e) => { if (e?.hurt > 0) this.end(); });
    const w = this.counters.work(key);
    if (w) this.pick(w.item, { resume: true });
  }

  /** Closes it, and takes back everything it put in the scene. */
  end() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    this.group = null;
    this.parts = [];
    this.offHurt?.();
    this.offHurt = null;
    this.key = null;
    this.sawing = 0;
  }

  /**
   * Lays out `itemId` on the counter: the outline, the plank and saw, and its
   * parts (hidden until cut; fitted ones already in place when resuming).
   */
  pick(itemId, { resume = false } = {}) {
    if (!this.active) return { ok: false };
    if (!resume) {
      const r = this.counters.choose(this.key, itemId);
      if (!r.ok) return r;
    }
    if (this.group) { this.scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    this.item = itemId;
    const base = BLOCKS_BY_ID.get(ITEMS_BY_ID.get(itemId)?.block)?.color ?? 0xc49360;
    const g = this.group = new THREE.Group();
    g.position.copy(this.top);
    const specs = partsFor(itemId);
    // The piece sits centred on the top, its parts' boxes scaled down.
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const { box } of specs) { lo.min(this._v.set(box.minX, box.minY, box.minZ)); hi.max(this._v.set(box.maxX, box.maxY, box.maxZ)); }
    this.centre = new THREE.Vector3((lo.x + hi.x) / 2, lo.y, (lo.z + hi.z) / 2);
    this.width = (hi.x - lo.x) * SCALE;
    // The outline: one see-through box per part, merged into one mesh's worth of children.
    const outline = new THREE.Group();
    for (const { box } of specs) outline.add(boxMesh(box, this.centre, 0xffffff, { transparent: true, opacity: 0.22, depthWrite: false }));
    g.add(outline);
    // The plank, with the saw resting on it, to the left.
    this.plank = boxMesh({ minX: 0, maxX: 1.6, minY: 0, maxY: 0.12, minZ: 0, maxZ: 0.5 }, new THREE.Vector3(0.8, 0, 0.25), base);
    this.plank.position.set(-0.75, 0, -0.1);
    this.sawMesh = new THREE.Group();
    this.sawMesh.add(boxMesh({ minX: -0.25, maxX: 0.25, minY: 0, maxY: 0.12, minZ: -0.01, maxZ: 0.01 }, new THREE.Vector3(), 0xb9bec6));
    this.sawMesh.add(boxMesh({ minX: 0.25, maxX: 0.4, minY: 0, maxY: 0.1, minZ: -0.03, maxZ: 0.03 }, new THREE.Vector3(), 0x6b4a2e));
    this.sawMesh.position.set(0, 0.12, 0);
    this.plank.add(this.sawMesh);
    g.add(this.plank);
    // The parts: in the row in front once cut, in the outline once fitted.
    const w = this.counters.work(this.key);
    this.parts = specs.map(({ box, tone }, i) => {
      const mesh = boxMesh(box, this.centre, boxColor({ tone }, base));
      mesh.userData.slot = mesh.position.clone();
      mesh.userData.home = new THREE.Vector3(-0.6 + (i % 4) * 0.4, 0, 0.45 + Math.floor(i / 4) * 0.25)
        .sub(this._v.set((box.minX + box.maxX) / 2 - this.centre.x, box.minY - this.centre.y, (box.minZ + box.maxZ) / 2 - this.centre.z).multiplyScalar(SCALE))
        .add(mesh.position);
      mesh.visible = !!w && i < w.cut;
      mesh.position.copy(w?.fitted[i] ? mesh.userData.slot : mesh.userData.home);
      g.add(mesh);
      return mesh;
    });
    this.scene.add(g);
    return { ok: true };
  }

  partMesh(i) {
    return this.parts[i];
  }

  /** Where part `i` belongs, in the scene. */
  slotOf(i) {
    return this.parts[i].userData.slot.clone().add(this.group.position);
  }

  /** One saw cut: paid and counted now, the part shown when the stroke ends. */
  saw() {
    if (!this.active || this.sawing > 0) return { ok: false, reason: 'Still sawing.' };
    const r = this.counters.cut(this.key);
    if (!r.ok) return r;
    this.sawing = SAW_SECONDS;
    this.sawingPart = r.part;
    return r;
  }

  /** The chisel's taps: the patterned piece is carved. */
  carve() {
    const r = this.active ? this.counters.carve(this.key) : { ok: false };
    if (r.ok) this.finishIfDone();
    return r;
  }

  /** Moves part `i` so it sits at `point` (a scene position on the top). */
  dragTo(i, point) {
    const m = this.parts[i];
    if (!m?.visible) return;
    m.position.copy(point).sub(this.group.position);
    m.position.y = m.userData.slot.y;
  }

  /** Lets go of part `i`: in its place it fits, anywhere else it goes back. */
  drop(i) {
    const m = this.parts[i];
    if (!m?.visible) return false;
    const near = Math.hypot(m.position.x - m.userData.slot.x, m.position.z - m.userData.slot.z) <= SNAP;
    if (near && this.counters.fit(this.key, i).ok) {
      m.position.copy(m.userData.slot);
      this.finishIfDone();
      return true;
    }
    m.position.copy(this.counters.work(this.key)?.fitted[i] ? m.userData.slot : m.userData.home);
    return false;
  }

  finishIfDone() {
    if (!this.counters.work(this.key)?.done) return;
    this.pendingTake = true;
  }

  /** The part under screen point (ndcX, ndcY), or -1. */
  partAt(ndcX, ndcY) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this._ray.intersectObjects(this.parts.filter((m) => m.visible), false)[0];
    return hit ? this.parts.indexOf(hit.object) : -1;
  }

  /**
   * Where screen point (ndcX, ndcY) meets the level part `i` sits at in its
   * place (the counter top when no part is given), or null. Read at that
   * level, the pointer and the part's place line up on screen.
   */
  pointOnTop(ndcX, ndcY, i = -1) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    this._plane.constant = -(this.top.y + (this.parts[i]?.userData.slot.y ?? 0));
    return this._ray.ray.intersectPlane(this._plane, this._hit);
  }

  /** Each frame: the camera over the counter, the saw stroke, a finished piece taken. */
  update(dt) {
    if (!this.active) return;
    this.camera.position.set(this.top.x, this.top.y + CAMERA_UP, this.top.z + CAMERA_BACK);
    this.camera.lookAt(this.top);
    if (this.sawing > 0) {
      this.sawing = Math.max(0, this.sawing - dt);
      if (this.sawMesh) this.sawMesh.position.x = Math.sin((SAW_SECONDS - this.sawing) * Math.PI * 10) * 0.25;
      if (this.sawing === 0) {
        if (this.sawMesh) this.sawMesh.position.x = 0;
        const m = this.parts[this.sawingPart];
        if (m) m.visible = true;
      }
    }
    if (this.pendingTake) {
      this.pendingTake = false;
      const item = this.item, took = this.counters.take(this.key);
      this.onDone?.({ item, took });
      if (took && this.group) { this.scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.group = null; this.parts = []; }
    }
  }
}

/** A box from a part's bounds, placed relative to `centre` and scaled to the counter. */
function boxMesh(box, centre, color, extra = {}) {
  const geo = new THREE.BoxGeometry((box.maxX - box.minX) * SCALE, (box.maxY - box.minY) * SCALE, (box.maxZ - box.minZ) * SCALE);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, ...extra }));
  mesh.position.set(((box.minX + box.maxX) / 2 - centre.x) * SCALE, ((box.minY + box.maxY) / 2 - centre.y) * SCALE, ((box.minZ + box.maxZ) / 2 - centre.z) * SCALE);
  return mesh;
}
