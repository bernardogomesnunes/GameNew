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

export const RINGS = [
  { age: 1, size: 32, name: 'Settlement' },
  { age: 2, size: 64, name: 'Industry' },
  { age: 3, size: 128, name: 'Craft' },
  { age: 4, size: 256, name: 'Town' },
  { age: 5, size: 512, name: 'Domain' },
  { age: 6, size: 1024, name: 'Frontier' },
];

const EDGE = 0xf0c674;

export class Territory {
  constructor({ world, scene, bus, age = 1 }) {
    this.world = world;
    this.scene = scene;
    this.bus = bus;
    this.age = age;
    this.centreX = Math.floor(world.sizeX / 2);
    this.centreZ = Math.floor(world.sizeZ / 2);

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
     * At a flat 9% this was invisible: you could walk into the edge of your
     * land with nothing on screen to say so. A wall you cannot see is not a
     * border, it is a bug. But a solid one would box you in visually, so the
     * opacity is carried on the vertices — strongest at the ground where you
     * meet it, gone by the top so it never blocks the view.
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

    /*
     * Two lines marking the edge, both behind the world.
     *
     * The ground line used to draw with depth testing off, which put a bright
     * stripe across whatever happened to be in front of it — a hillside, a
     * tree, a block you had just placed. A border drawn through solid ground
     * reads as an overlay stuck to the screen rather than a thing standing in
     * the world. The wall already says where the edge is from any distance, so
     * the lines are decoration and are occluded like everything else.
     */
    const pts = [
      new THREE.Vector3(b.minX, baseY, b.minZ), new THREE.Vector3(b.maxX + 1, baseY, b.minZ),
      new THREE.Vector3(b.maxX + 1, baseY, b.maxZ + 1), new THREE.Vector3(b.minX, baseY, b.maxZ + 1),
      new THREE.Vector3(b.minX, baseY, b.minZ),
    ];
    const line = (y, opacity) => {
      const mesh = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().setY(baseY + y))),
        new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity, depthWrite: false }),
      );
      this.fence.add(mesh);
    };
    line(0.05, 0.8);   // where the border meets the ground
    line(2.2, 0.45);   // and again at chest height, for when the ground dips away
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
