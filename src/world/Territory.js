import * as THREE from 'three';

/** Logs and leaves of every kind of tree — see buildEdgeStroke. */
const TREE_BLOCKS = new Set([4, 5, 41, 42, 43, 44]);

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
/** How high the border's curtain stands over the ground, and how strong it is at its foot. */
const CURTAIN = 7;
const CURTAIN_ALPHA = 0.5;
/** How often a border with gaps in it looks again for the ground. */
const REFRESH_MS = 2000;

export class Territory {
  /**
   * @param sandbox  a free-build world has no border at all — see DuiltGame's
   *   own note on what "sandbox" turns off. `contains`/`containsRegion` say
   *   yes to everywhere, `bounds()` is never asked to draw a fence around
   *   that, and nothing here ever advances a ring, since there are no ages
   *   to advance through.
   */
  constructor({ world, scene, bus, age = 1, sandbox = false }) {
    this.world = world;
    this.scene = scene;
    this.bus = bus;
    this.age = age;
    this.sandbox = sandbox;
    // Where the settlement is. A fixed world puts it in the middle of the
    // map; an endless one has no middle, so it is the origin.
    this.centreX = world.centreX;
    this.centreZ = world.centreZ;

    this.fence = new THREE.Group();
    this.fence.renderOrder = 9;
    scene.add(this.fence);
    if (!sandbox) this.rebuildFence();
  }

  get ring() {
    return RINGS.find((r) => r.age === this.age) ?? RINGS[0];
  }

  get size() {
    return this.ring.size;
  }

  /** Whether the border still stops you walking — not from the last age (config/ages.js). */
  get open() {
    return !!this.ring.open;
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
    if (this.sandbox) return true;
    const b = this.bounds();
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  /** True when the whole region is claimed — a structure may not straddle the border. */
  containsRegion(region) {
    if (this.sandbox) return true;
    return this.contains(region.minX, region.minZ) && this.contains(region.maxX, region.maxZ);
  }

  /** How far outside the border a point is, in blocks. 0 when inside. */
  distanceOutside(x, z) {
    if (this.sandbox) return 0;
    const b = this.bounds();
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    return Math.max(dx, dz);
  }

  /** Moves to the next ring. Returns the new ring, or null if already at the frontier — or always null in a sandbox, which has no rings to advance through. */
  advance() {
    if (this.sandbox) return null;
    const next = RINGS.find((r) => r.age === this.age + 1);
    if (!next) return null;
    this.age = next.age;
    this.rebuildFence();
    this.bus?.emit('territory:expanded', { age: next.age, size: next.size, name: next.name });
    return next;
  }

  setAge(age) {
    this.age = RINGS.some((r) => r.age === age) ? age : 1;
    if (!this.sandbox) this.rebuildFence();
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
    // Columns along the edge whose ground wasn't there yet (an endless world
    // makes it as you go): drawn again once it is — see refreshIfStale.
    this.gaps = 0;

    /**
     * A curtain along the border that stands on the ground, column by
     * column, fading out a few blocks up.
     *
     * It used to be four flat sheets hung at one height for the whole
     * border — the middle of the heights at the centre and the corners. At
     * 32 blocks that's close enough; at 320 the edge runs over hills and
     * into mountains, so the sheet sat buried under one stretch and floated
     * over the next, and from the ground you saw nothing at all (reported:
     * "Age 6 borders disappear completely, no visual cue"). Following the
     * ground, it's there wherever you meet it.
     *
     * Each column's foot goes down to the lower of its neighbours, so a
     * step in the ground doesn't leave a slot of sky in the curtain.
     *
     * All of it is one mesh, for the reason the four sheets became one
     * before: separate transparent pieces swap which draws on top as you
     * move, and the corners flicker.
     */
    const positions = [];
    const colors = [];
    const indices = [];
    const col = new THREE.Color(EDGE);
    const curtain = (cells, face) => {
      const tops = cells.map(([x, z]) => this.edgeTop(x, z));
      tops.forEach((y, i) => {
        if (y == null) { this.gaps++; return; }
        const foot = Math.min(y, tops[i - 1] ?? y, tops[i + 1] ?? y) - 0.4;
        const head = y + CURTAIN;
        const [[ax, az], [cx, cz]] = face(...cells[i]);
        const at = positions.length / 3;
        positions.push(ax, foot, az, cx, foot, cz, cx, head, cz, ax, head, az);
        // Strongest at the ground, where you meet it; gone by the top. The
        // fade is measured from this column's ground, so every column reads
        // the same however far down its foot reaches.
        const alphaAt = (yy) => CURTAIN_ALPHA * Math.pow(Math.max(0, Math.min(1, 1 - (yy - y) / CURTAIN)), 1.6);
        for (const yy of [foot, foot, head, head]) colors.push(col.r, col.g, col.b, Math.min(CURTAIN_ALPHA, alphaAt(yy)));
        indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
      });
    };
    const n = this.size;
    const run = (f) => Array.from({ length: n }, (_, i) => f(i));
    curtain(run((i) => [b.minX + i, b.minZ]), (x, z) => [[x, z], [x + 1, z]]);
    curtain(run((i) => [b.minX + i, b.maxZ]), (x, z) => [[x, z + 1], [x + 1, z + 1]]);
    curtain(run((i) => [b.minX, b.minZ + i]), (x, z) => [[x, z], [x, z + 1]]);
    curtain(run((i) => [b.maxX, b.minZ + i]), (x, z) => [[x + 1, z], [x + 1, z + 1]]);

    if (positions.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.fence.add(new THREE.Mesh(geo, mat));
    }

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

    const topOf = (x, z) => this.edgeTop(x, z);

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
    if (this.sandbox) return;
    const b = this.bounds();
    const touches = changes.some(({ x, z }) =>
      (x === b.minX || x === b.maxX || z === b.minZ || z === b.maxZ) && this.contains(x, z));
    if (touches) this.rebuildFence();
  }

  /**
   * The top of the ground in a column on the border, or null where it isn't
   * there yet. The generator's height map is written once and never updated,
   * so a block broken on the edge would leave the border hanging over a hole:
   * this finds the real top, starting a little above the recorded one.
   */
  edgeTop(x, z) {
    if (!this.world.inBounds(x, 0, z)) return null;
    if (this.world.endless && !this.world.hasChunk(Math.floor(x) >> 4, Math.floor(z) >> 4)) return null;
    const from = Math.min(this.world.height - 1, this.world.surfaceHeight(x, z) + 12);
    for (let y = from; y >= 0; y--) {
      // Through a tree, not over it: the border is on the ground, and a tall
      // crown overhanging it would lift it into the leaves.
      const id = this.world.getBlock(x, y, z);
      if (TREE_BLOCKS.has(id)) continue;
      if (this.world.isSolid(x, y, z)) return y + 1;
    }
    return null;
  }

  /**
   * Draws the border again if some of it was missing ground — called every
   * frame, it does nothing unless there are gaps, and then at most every
   * couple of seconds, so the border fills in as the land round it loads.
   */
  refreshIfStale(now = Date.now()) {
    if (this.sandbox || !this.gaps) return false;
    if (now - (this.refreshedAt ?? 0) < REFRESH_MS) return false;
    this.refreshedAt = now;
    const was = this.gaps;
    this.rebuildFence();
    return this.gaps !== was;
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
