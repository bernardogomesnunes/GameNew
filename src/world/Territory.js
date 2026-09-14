import * as THREE from 'three';

/**
 * How much of the world you're allowed to touch.
 *
 * The map is the reward. You start with a 32-block plot and each age doubles
 * it, out to a frontier sixteen times wider. That's the spine of the whole
 * game, so it lives in one small object that everything else asks.
 *
 * The border is drawn rather than merely enforced: a wall you can see is a
 * promise, and watching it move outward is the moment the age change is *felt*
 * rather than read in a toast.
 */

// The rings come from the age list rather than being written out again here.
// They had already drifted: these went to 512 and 1024, and a Duilt world is
// generated at 256 — so from Age 5 the border stood outside the terrain it was
// supposed to enclose.
export { RINGS } from '../config/ages.js';
import { RINGS } from '../config/ages.js';

const EDGE = 0xf0c674;

/** How far above a block's top face the edge stroke floats, to avoid z-fighting. */
const LIFT = 0.03;

export class Territory {
  constructor({ world, scene, bus, age = 1 }) {
    this.world = world;
    this.scene = scene;
    this.bus = bus;
    this.age = age;
    // Where the settlement is. A fixed world puts it in the middle of the
    // map; an endless one has no middle, so it is the origin.
    this.centreX = world.centreX;
    this.centreZ = world.centreZ;

    this.fence = new THREE.Group();
    this.fence.renderOrder = 9;
    scene.add(this.fence);
    this.rebuildFence();
  }

  get ring() {
    return RINGS.find((r) => r.age === this.age) ?? RINGS[0];
  }

  get size() {
    return this.ring.size;
  }

  /** The claimed square, in world block coordinates. */
  bounds() {
    const half = this.size / 2;
    return {
      minX: this.centreX - half, maxX: this.centreX + half - 1,
      minZ: this.centreZ - half, maxZ: this.centreZ + half - 1,
    };
  }

  contains(x, z) {
    const b = this.bounds();
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  /** True when the whole region is claimed — a structure may not straddle the border. */
  containsRegion(region) {
    return this.contains(region.minX, region.minZ) && this.contains(region.maxX, region.maxZ);
  }

  /** How far outside the border a point is, in blocks. 0 when inside. */
  distanceOutside(x, z) {
    const b = this.bounds();
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    return Math.max(dx, dz);
  }

  /** Moves to the next ring. Returns the new ring, or null if already at the frontier. */
  advance() {
    const next = RINGS.find((r) => r.age === this.age + 1);
    if (!next) return null;
    this.age = next.age;
    this.rebuildFence();
    this.bus?.emit('territory:expanded', { age: next.age, size: next.size, name: next.name });
    return next;
  }

  setAge(age) {
    this.age = RINGS.some((r) => r.age === age) ? age : 1;
    this.rebuildFence();
  }

  /**
   * A translucent curtain on all four sides. Tall enough to read from the
   * ground, short enough not to wall in the sky.
   */
  rebuildFence() {
    for (const child of [...this.fence.children]) {
      this.fence.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }

    const b = this.bounds();
    // Sit the fence on the ground, not at bedrock: an outline drawn twenty
    // blocks below the surface reads as offset from the land it encloses.
    const baseY = Math.max(0, this.groundLevel() - 1);
    const top = Math.min(this.world.height, baseY + 34);
    const h = top - baseY;
    const w = this.size;

    /**
     * One face of the border, fading out with height.
     *
     * This is the only thing marking the edge. There were lines along the top
     * and bottom of it too, which had to be drawn over the world to be seen
     * from a distance — and a bright stripe across a hillside reads as
     * something stuck to the screen rather than a thing standing in the world.
     * The wall says it on its own, and says it just as well when the border is
     * a thousand blocks out and you only ever see it from far away.
     *
     * At a flat 9% it was invisible: you could walk into the edge of your land
     * with nothing on screen to say so. A solid one would box you in visually,
     * so the opacity is carried on the vertices — strongest at the ground where
     * you meet it, gone by the top so it never blocks the view.
     */
    const wall = (px, pz, rotY) => {
      const geo = new THREE.PlaneGeometry(w, h, 1, 12);
      const pos = geo.attributes.position;
      const rgba = new Float32Array(pos.count * 4);
      const base = new THREE.Color(EDGE);
      for (let i = 0; i < pos.count; i++) {
        // 0 at the foot of the wall, 1 at the top.
        const t = (pos.getY(i) + h / 2) / h;
        rgba[i * 4 + 0] = base.r;
        rgba[i * 4 + 1] = base.g;
        rgba[i * 4 + 2] = base.b;
        rgba[i * 4 + 3] = 0.34 * Math.pow(1 - t, 2.2);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));

      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, baseY + h / 2, pz);
      mesh.rotation.y = rotY;
      this.fence.add(mesh);
    };

    const midX = (b.minX + b.maxX + 1) / 2;
    const midZ = (b.minZ + b.maxZ + 1) / 2;
    wall(midX, b.minZ, 0);
    wall(midX, b.maxZ + 1, 0);
    wall(b.minX, midZ, Math.PI / 2);
    wall(b.maxX + 1, midZ, Math.PI / 2);

    this.buildEdgeStroke(b);
  }

  /**
   * A line drawn along the top of the blocks that touch the border.
   *
   * The wall says where your land ends when you look up; this says it when you
   * look down, which is where you are looking while you build. The version
   * before this was a flat rectangle hung in the air at the boundary: it had to
   * be drawn over the world to be seen at all, and a bright stripe crossing a
   * hillside reads as something stuck to the screen.
   *
   * This one sits on the ground instead, stepping up and down with it, and is
   * depth-tested like everything else — so a block in front of it hides it,
   * which is the whole reason the old one had to go.
   */
  buildEdgeStroke(b) {
    const pts = [];

    // The generator's height map is written once and never updated, so a block
    // broken on the edge would leave the stroke hanging over a hole. Find the
    // real top, starting the search a little above the recorded one.
    const topOf = (x, z) => {
      if (!this.world.inBounds(x, 0, z)) return null;
      const from = Math.min(this.world.height - 1, this.world.surfaceHeight(x, z) + 12);
      for (let y = from; y >= 0; y--) if (this.world.isSolid(x, y, z)) return y + 1;
      return null;
    };

    /**
     * Walks one side, block by block, drawing the top of each block's outward
     * face. Where two neighbours sit at different heights a riser joins them,
     * so the stroke stays one unbroken line over broken ground rather than a
     * row of floating dashes.
     */
    const side = (count, cell, ends) => {
      let prevY = null;
      let prevEnd = null;
      for (let i = 0; i < count; i++) {
        const [x, z] = cell(i);
        const y = topOf(x, z);
        if (y == null) { prevY = null; continue; }
        const [a, c] = ends(x, z);
        if (prevY != null && prevY !== y) {
          pts.push(prevEnd[0], prevY + LIFT, prevEnd[1], prevEnd[0], y + LIFT, prevEnd[1]);
        }
        pts.push(a[0], y + LIFT, a[1], c[0], y + LIFT, c[1]);
        prevY = y;
        prevEnd = c;
      }
    };

    const n = this.size;
    // A block at (x, z) occupies x..x+1 and z..z+1, so the outward face of the
    // low-side rows is at the block coordinate and the high-side rows at +1.
    side(n, (i) => [b.minX + i, b.minZ], (x, z) => [[x, z], [x + 1, z]]);
    side(n, (i) => [b.minX + i, b.maxZ], (x, z) => [[x, z + 1], [x + 1, z + 1]]);
    side(n, (i) => [b.minX, b.minZ + i], (x, z) => [[x, z], [x, z + 1]]);
    side(n, (i) => [b.maxX, b.minZ + i], (x, z) => [[x + 1, z], [x + 1, z + 1]]);

    if (!pts.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: EDGE,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,      // it is a marking on the ground, not a thing with volume
    });
    const line = new THREE.LineSegments(geo, mat);
    line.renderOrder = 2;
    this.edge = line;
    this.fence.add(line);
  }

  /**
   * Redraws the stroke when something changed under it.
   *
   * The border is buildable ground like any other, so a block broken or placed
   * on the last row moves the surface the line is drawn on. Anything further in
   * cannot affect it, which is almost every edit — so the common case costs one
   * comparison per change and nothing else.
   */
  onBlocksChanged(changes) {
    const b = this.bounds();
    const touches = changes.some(({ x, z }) =>
      (x === b.minX || x === b.maxX || z === b.minZ || z === b.maxZ) && this.contains(x, z));
    if (touches) this.rebuildFence();
  }

  /** Representative surface height inside the border, for placing the fence. */
  groundLevel() {
    const b = this.bounds();
    const pts = [
      [this.centreX, this.centreZ],
      [b.minX + 2, b.minZ + 2], [b.maxX - 2, b.minZ + 2],
      [b.minX + 2, b.maxZ - 2], [b.maxX - 2, b.maxZ - 2],
    ];
    const heights = pts
      .filter(([x, z]) => this.world.inBounds(x, 0, z))
      .map(([x, z]) => this.world.surfaceHeight(x, z));
    if (!heights.length) return 0;
    heights.sort((a, c) => a - c);
    return heights[Math.floor(heights.length / 2)]; // median shrugs off one odd corner
  }

  setVisible(on) {
    this.fence.visible = on;
  }

  toJSON() {
    return { age: this.age };
  }

  dispose() {
    this.scene.remove(this.fence);
  }
}
