import * as THREE from 'three';
import { partsFor } from '../config/furnitureParts.js';
import { boxColor } from '../world/propShapes.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { BLOCKS_BY_ID, COUNTER } from '../config/blocks.js';
import { WORK_MIN, WORK_MAX } from '../duilt/BenchWork.js';
import { stillCopy } from './Models.js';

/**
 * CRAFT3D-1, CRAFT-9: the Carpenter's Table, close up, in the game's own
 * scene and camera (owner, 31 October: "see the block in 3d and when using
 * the saw we could cut the piece in a standard animation, and see the pieces
 * there to assemble"). The rules are duilt/Counter.js; this only draws them
 * and turns taps and drags into fits.
 *
 * On the table top: a pale outline of the piece in the middle, the plank
 * and the saw to its left, and the cut parts in a row in front. A tapped
 * part flies to its place; a dragged one snaps in near it. The next part
 * glows and its place is lit. Everything lives in one group, made at `pick`
 * and removed at `end`: at most 7 children (the worktop, the outline, the
 * plank with the saw, up to 4 parts), nothing made per frame.
 */
export const SAW_SECONDS = 0.8;
/** Held, the saw's gauge fills in this long; let go inside the bench window and the parts come off. */
export const SAW_HOLD_SECONDS = 1.6;
/** After a held stroke the parts fall this soon. */
const SAW_FALL_SECONDS = 0.2;
/** How close to its place a dragged part has to be dropped to snap in, in blocks. */
const SNAP = 0.4;
/** A tapped part takes this long to fly to its place. */
export const FLY_SECONDS = 0.3;
/** The piece is drawn at this scale on the table top. */
const SCALE = 0.55;
/** Far enough up and back that the whole top fits a phone held upright (390 px wide). */
const CAMERA_UP = 2.2, CAMERA_BACK = 1.8;
/** Held upright, the view looks this far nearer the player (in blocks), so the bar leaves the row of parts clear. */
const PORTRAIT_AHEAD = 0.5;
/**
 * Owner, 15 November: "the items need to be bigger and pieces too, cause in
 * mobile it's hard to pick them". Under a finger the camera sits this much
 * nearer, and a touch that just misses a part takes the nearest one within
 * FINGER of it (in screen halves: 0.14 is about a fingertip on a phone).
 */
const TOUCH_NEAR = 0.85, FINGER = 0.14;
/** How far beside the outline a touch drop still counts as on it. */
const TOUCH_MARGIN = 0.15;
/** A cut part waiting in the row is drawn up to this much bigger than in its place, to be seen and picked. */
const WAIT_SCALE = 1.7;
/** The row of waiting parts: how wide it may be, the gap between two, where its back edge lies, how deep a part may be. */
const ROW_WIDTH = 1.5, ROW_GAP = 0.08, ROW_Z = 0.36, ROW_DEPTH = 0.62;
const GLOW = 0xffb347, LIT = 0xffd98f;
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

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
    this.holding = false;
    this.level = 0;
    this.clock = 0;
    this.parts = [];
    this.slots = [];
    this._v = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
  }

  get active() {
    return this.key != null;
  }

  /** Opens the close-up over the table at `at` (its block position). */
  start(key, at) {
    this.end();
    this.key = key;
    this.top = new THREE.Vector3(at.x + 0.5, at.y + 1, at.z + 0.5);
    this._plane.constant = -this.top.y;
    this.offHurt = this.bus?.on('health:change', (e) => { if (e?.hurt > 0) this.end(); });
    const w = this.counters.work(key);
    if (w) this.pick(w.item, { resume: true });
    // A piece finished on an earlier visit, which did not fit then: hand it over now.
    this.finishIfDone();
  }

  /** Takes the piece's meshes out of the scene. */
  clear() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => { if (o.isMesh) { if (!o.userData.sharedGeometry) o.geometry.dispose(); o.material.dispose(); } });
    }
    this.group = null;
    this.parts = [];
    this.slots = [];
  }

  /** Closes it, and takes back everything it put in the scene. */
  end() {
    this.clear();
    this.holding = false;
    this.level = 0;
    this.offHurt?.();
    this.offHurt = null;
    this.key = null;
    this.sawing = 0;
    this.pendingTake = false;
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
    this.clear();
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
    this.depth = (hi.z - lo.z) * SCALE;
    // The worktop: the table's own top, drawn wide enough for the plank and the row.
    const worktop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 1.9), new THREE.MeshLambertMaterial({ color: BLOCKS_BY_ID.get(COUNTER)?.color ?? 0xa87a4c, map: grain() }));
    worktop.position.set(-0.15, -0.032, 0.3);
    g.add(worktop);
    // The outline: each part's place, see-through, lit when that part is next.
    const outline = new THREE.Group();
    this.slots = specs.map(({ boxes, box }) => partMesh(boxes, box, this.centre, 0xffffff, { transparent: true, opacity: 0.22, depthWrite: false }));
    outline.add(...this.slots);
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
    // Owner, 2 November ("3d looks awful"): the plank and saw models once loaded, the boxes before.
    const plankModel = stillCopy('carpentry_plank'), sawModel = stillCopy('carpentry_saw');
    if (plankModel && sawModel) {
      this.plank.material.visible = false;
      plankModel.scale.setScalar(SCALE);
      plankModel.position.y = -0.06 * SCALE;
      this.plank.add(plankModel);
      for (const m of this.sawMesh.children) m.visible = false;
      // Bigger than true scale and leant toward the camera, so the blade and teeth read from above.
      sawModel.scale.setScalar(0.9);
      sawModel.rotation.x = -Math.PI / 4;
      sawModel.position.y = -0.06 * SCALE;
      this.sawMesh.add(sawModel);
    }
    // The parts: in the row in front once cut, in the outline once fitted.
    // The row is as wide as the top allows, each part as big as fits.
    const wide = specs.reduce((n, { box }) => n + (box.maxX - box.minX) * SCALE, 0);
    const deep = Math.max(...specs.map(({ box }) => (box.maxZ - box.minZ) * SCALE));
    this.wait = Math.max(1, Math.min(WAIT_SCALE, (ROW_WIDTH - ROW_GAP * (specs.length - 1)) / wide, ROW_DEPTH / deep));
    const w = this.counters.work(this.key);
    let x = -(wide * this.wait + ROW_GAP * (specs.length - 1)) / 2;
    this.parts = specs.map(({ boxes, box }, i) => {
      const mesh = partMesh(boxes, box, this.centre, base);
      const sx = (box.maxX - box.minX) * SCALE * this.wait, sy = (box.maxY - box.minY) * SCALE * this.wait, sz = (box.maxZ - box.minZ) * SCALE * this.wait;
      mesh.userData.slot = mesh.position.clone();
      mesh.userData.home = new THREE.Vector3(x + sx / 2, sy / 2, ROW_Z + sz / 2);
      x += sx + ROW_GAP;
      mesh.visible = !!w && i < w.cut;
      mesh.userData.placed = !!w?.fitted[i];
      this.rest(mesh, mesh.userData.placed);
      g.add(mesh);
      return mesh;
    });
    this.scene.add(g);
    return { ok: true };
  }

  /** Make another: the piece last finished here, laid out again. */
  again() {
    if (!this.active) return { ok: false };
    const r = this.counters.again(this.key);
    return r.ok ? this.pick(this.counters.work(this.key).item, { resume: true }) : r;
  }

  /** Puts away a piece picked and not yet sawn, back to the list of pieces. */
  back() {
    if (!this.active || !this.counters.unchoose(this.key)) return false;
    this.clear();
    return true;
  }

  partMesh(i) {
    return this.parts[i];
  }

  /** Where part `i` belongs, in the scene. */
  slotOf(i) {
    return this.parts[i].userData.slot.clone().add(this.group.position);
  }

  /** The saw stroke: paid and counted now, every part shown when the stroke ends. */
  saw(seconds = SAW_SECONDS) {
    if (!this.active || this.sawing > 0) return { ok: false, reason: 'Still sawing.' };
    const r = this.counters.cut(this.key);
    if (!r.ok) return r;
    this.sawing = seconds;
    return r;
  }

  /** Saw is held: the gauge starts to fill, if the piece can be cut. */
  hold() {
    if (!this.active || this.sawing > 0) return { ok: false, reason: 'Still sawing.' };
    if (this.holding) return { ok: true };
    const can = this.counters.canCut(this.key);
    if (!can.ok) return can;
    this.holding = true;
    this.level = 0;
    return { ok: true };
  }

  /**
   * Saw is let go. In the bench window (WORK_MIN to WORK_MAX) the parts come
   * off: 'cut'. Short of it or past it nothing is spent: 'short', 'far'.
   */
  letGo() {
    if (!this.holding) return null;
    this.holding = false;
    const level = this.level;
    this.level = 0;
    if (this.sawMesh) this.sawMesh.position.x = 0;
    if (level < WORK_MIN) return { result: 'short' };
    if (level > WORK_MAX) return { result: 'far' };
    const r = this.saw(SAW_FALL_SECONDS);
    return r.ok ? { result: 'cut' } : { result: 'none', reason: r.reason };
  }

  /** The chisel's taps: the patterned piece is carved. */
  carve() {
    const r = this.active ? this.counters.carve(this.key) : { ok: false };
    if (r.ok) this.finishIfDone();
    return r;
  }

  /** Puts a part where it belongs: in its place at true size, or waiting in the row, bigger, its foot on the top. */
  rest(m, fitted) {
    m.userData.fly = null;
    m.scale.setScalar(fitted ? 1 : this.wait);
    m.position.copy(fitted ? m.userData.slot : m.userData.home);
  }

  /** Whether a tapped part is still on its way to its place. */
  get flying() {
    return this.parts.some((m) => m.userData.fly);
  }

  /**
   * Every part the rules call fitted goes to its place: `snapped` at once
   * (it was dropped there), the others flying, one after another.
   */
  settle(snapped = -1) {
    const w = this.counters.work(this.key);
    let order = 0;
    this.parts.forEach((m, i) => {
      if (!w?.fitted[i] || m.userData.placed) return;
      m.userData.placed = true;
      if (i === snapped) this.rest(m, true);
      else m.userData.fly = { from: m.position.clone(), scale: m.scale.x, t: -0.08 * order++ };
    });
    this.finishIfDone();
  }

  /** A tap (a click, a key) on cut part `i`: it flies to its place. */
  tapFit(i) {
    const m = this.parts[i];
    if (!this.active || !m?.visible || m.userData.placed || this.sawing > 0) return false;
    if (!this.counters.fit(this.key, i).ok) return false;
    this.settle();
    return true;
  }

  /** Moves part `i` so it sits at `point` (a scene position on the top). */
  dragTo(i, point) {
    const m = this.parts[i];
    if (!m?.visible || m.userData.placed) return;
    m.scale.setScalar(1);
    m.position.copy(point).sub(this.group.position);
    m.position.y = m.userData.slot.y;
  }

  /** Whether a point on the top is over the piece's outline, or within a finger of it. */
  overOutline(p) {
    return Math.abs(p.x) <= this.width / 2 + TOUCH_MARGIN && Math.abs(p.z) <= this.depth / 2 + TOUCH_MARGIN;
  }

  /** Lets go of part `i`: in its place it fits, anywhere else it goes back. */
  drop(i) {
    const m = this.parts[i];
    if (!m?.visible || m.userData.placed) return false;
    // Owner, 16 November: "when I drop the piece on top of the furniture it
    // goes to its place. This should be mobile only". On a touch screen a
    // part let go anywhere over the outline (or just beside it) fits.
    const near = COARSE ? this.overOutline(m.position)
      : Math.hypot(m.position.x - m.userData.slot.x, m.position.z - m.userData.slot.z) <= SNAP;
    if (near && this.counters.fit(this.key, i).ok) {
      this.settle(i);
      return true;
    }
    // A miss: back to the row. Nothing is lost.
    this.rest(m, false);
    return false;
  }

  finishIfDone() {
    if (!this.active || !this.counters.work(this.key)?.done) return;
    this.pendingTake = true;
  }

  /** The waiting part under screen point (ndcX, ndcY), or -1. Fitted parts stay put. */
  partAt(ndcX, ndcY) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this._ray.intersectObjects(this.parts.filter((m) => m.visible && !m.userData.placed), false)[0];
    if (hit) return this.parts.indexOf(hit.object);
    let best = -1, bestD = FINGER;
    this.parts.forEach((m, i) => {
      if (!m.visible || m.userData.placed) return;
      m.getWorldPosition(this._v).project(this.camera);
      const d = Math.hypot(this._v.x - ndcX, this._v.y - ndcY);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
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

  /** Each frame: the camera over the table, the saw stroke, parts in flight, a finished piece taken. */
  update(dt) {
    if (!this.active) return;
    const near = COARSE ? TOUCH_NEAR : 1;
    // On a screen held upright the bar covers the lower third: the view moves
    // toward the player so the row of parts sits above the bar.
    const ahead = this.camera.aspect < 1 ? PORTRAIT_AHEAD : 0;
    this.camera.position.set(this.top.x, this.top.y + CAMERA_UP * near, this.top.z + CAMERA_BACK * near + ahead);
    this._look.set(this.top.x, this.top.y, this.top.z + ahead);
    this.camera.lookAt(this._look);
    this.clock += dt;
    if (this.holding) {
      this.level = Math.min(1.25, this.level + dt / SAW_HOLD_SECONDS);
      if (this.sawMesh) this.sawMesh.position.x = Math.sin(this.level * Math.PI * 8) * 0.25;
    }
    if (this.sawing > 0) {
      this.sawing = Math.max(0, this.sawing - dt);
      if (this.sawMesh) this.sawMesh.position.x = Math.sin((SAW_SECONDS - this.sawing) * Math.PI * 10) * 0.25;
      if (this.sawing === 0) {
        if (this.sawMesh) this.sawMesh.position.x = 0;
        const w = this.counters.work(this.key);
        this.parts.forEach((m, i) => { m.visible = !!w && i < w.cut; });
      }
    }
    // A tapped part on its way: a short arc from the row to its place.
    for (const m of this.parts) {
      const f = m.userData.fly;
      if (!f) continue;
      f.t += dt;
      const k = Math.min(1, Math.max(0, f.t / FLY_SECONDS)), ease = k * k * (3 - 2 * k);
      m.position.lerpVectors(f.from, m.userData.slot, ease);
      m.position.y += Math.sin(Math.PI * k) * 0.25;
      m.scale.setScalar(f.scale + (1 - f.scale) * ease);
      if (k >= 1) this.rest(m, true);
    }
    this.light();
    if (this.pendingTake && !this.flying) {
      this.pendingTake = false;
      const item = this.item, took = this.counters.take(this.key);
      this.onDone?.({ item, took });
      if (took) this.clear();
    }
  }

  /** The next part glows and its place is lit (every part still waiting, on a piece made again). */
  light() {
    const w = this.key ? this.counters.work(this.key) : null;
    if (!w || !this.parts.length) return;
    const next = this.sawing > 0 ? -1 : this.counters.next(this.key), pulse = 0.5 + 0.5 * Math.sin(this.clock * 6);
    this.parts.forEach((m, i) => {
      const lit = !m.userData.placed && m.visible && (i === next || (w.quick && next >= 0));
      m.material.emissive.setHex(lit ? GLOW : 0x000000);
      m.material.emissiveIntensity = lit ? 0.3 + 0.35 * pulse : 0;
      const slot = this.slots[i];
      slot.visible = !m.userData.placed;
      slot.material.color.setHex(lit ? LIT : 0xffffff);
      slot.material.opacity = lit ? 0.4 + 0.25 * pulse : 0.22;
    });
  }
}

/**
 * One part: its boxes as one mesh, about the middle of `hull`, placed
 * relative to `centre` and scaled to the table. Each box keeps its own
 * colour (a tone of `base`, or its own); with `extra` it is a plain
 * see-through shape, the part's place in the outline.
 */
function partMesh(boxes, hull, centre, base, extra = null) {
  const mid = [(hull.minX + hull.maxX) / 2, (hull.minY + hull.maxY) / 2, (hull.minZ + hull.maxZ) / 2];
  const position = [], normal = [], uv = [], color = [], c = new THREE.Color();
  for (const b of boxes) {
    const geo = new THREE.BoxGeometry((b.maxX - b.minX) * SCALE, (b.maxY - b.minY) * SCALE, (b.maxZ - b.minZ) * SCALE).toNonIndexed();
    geo.translate(((b.minX + b.maxX) / 2 - mid[0]) * SCALE, ((b.minY + b.maxY) / 2 - mid[1]) * SCALE, ((b.minZ + b.maxZ) / 2 - mid[2]) * SCALE);
    position.push(...geo.attributes.position.array);
    normal.push(...geo.attributes.normal.array);
    uv.push(...geo.attributes.uv.array);
    c.setHex(extra ? 0xffffff : boxColor(b, base));
    for (let i = 0; i < geo.attributes.position.count; i++) color.push(c.r, c.g, c.b);
    geo.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial(extra ? { color: base, ...extra } : { vertexColors: true, map: grain() }));
  mesh.position.set((mid[0] - centre.x) * SCALE, (mid[1] - centre.y) * SCALE, (mid[2] - centre.z) * SCALE);
  return mesh;
}

/** A box from a part's bounds, placed relative to `centre` and scaled to the counter. */
function boxMesh(box, centre, color, extra = {}) {
  const geo = new THREE.BoxGeometry((box.maxX - box.minX) * SCALE, (box.maxY - box.minY) * SCALE, (box.maxZ - box.minZ) * SCALE);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, map: extra.transparent ? null : grain(), ...extra }));
  mesh.position.set(((box.minX + box.maxX) / 2 - centre.x) * SCALE, ((box.minY + box.maxY) / 2 - centre.y) * SCALE, ((box.minZ + box.maxZ) / 2 - centre.z) * SCALE);
  return mesh;
}

let grainTexture = null;
/**
 * A 16 x 16 pixel wood grain, grey, tinted by each part's colour: the cut
 * parts look like the planks they came from. Made once, shared, never disposed.
 */
function grain() {
  if (grainTexture || typeof document === 'undefined') return grainTexture;
  const data = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = y % 4 === 3 ? 170 : r > 0.85 ? 205 : r > 0.6 ? 232 : 255;
    data.set([v, v, v, 255], (y * 16 + x) * 4);
  }
  grainTexture = new THREE.DataTexture(data, 16, 16);
  grainTexture.magFilter = grainTexture.minFilter = THREE.NearestFilter;
  grainTexture.colorSpace = THREE.SRGBColorSpace;
  grainTexture.needsUpdate = true;
  return grainTexture;
}
