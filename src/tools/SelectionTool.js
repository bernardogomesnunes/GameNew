import { AIR } from '../config/blocks.js';

export class SelectionTool {
  constructor() {
    this.active = false;
    this.pointA = null;
    this.pointB = null;
    this.clipboard = null;
  }

  toggle() {
    this.active = !this.active;
    if (!this.active) {
      this.pointA = null;
      this.pointB = null;
    }
    return this.active;
  }

  pick(point) {
    if (!this.pointA || (this.pointA && this.pointB)) {
      this.pointA = point;
      this.pointB = null;
    } else {
      this.pointB = point;
    }
  }

  get hasSelection() {
    return !!(this.pointA && this.pointB);
  }

  bounds() {
    if (!this.pointA) return null;
    const b = this.pointB || this.pointA;
    return {
      minX: Math.min(this.pointA.x, b.x), maxX: Math.max(this.pointA.x, b.x),
      minY: Math.min(this.pointA.y, b.y), maxY: Math.max(this.pointA.y, b.y),
      minZ: Math.min(this.pointA.z, b.z), maxZ: Math.max(this.pointA.z, b.z),
    };
  }

  copy(world) {
    const bounds = this.bounds();
    if (!bounds) return 0;
    const blocks = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          blocks.push({ dx: x - bounds.minX, dy: y - bounds.minY, dz: z - bounds.minZ, type: world.getBlock(x, y, z) });
        }
      }
    }
    this.clipboard = {
      sizeX: bounds.maxX - bounds.minX + 1,
      sizeY: bounds.maxY - bounds.minY + 1,
      sizeZ: bounds.maxZ - bounds.minZ + 1,
      blocks,
    };
    return blocks.length;
  }

  /** Returns proposed { x, y, z, prev, next } changes; does not touch the world. */
  buildPaste(world, anchor, skipAir = true) {
    if (!this.clipboard) return [];
    const changes = [];
    for (const b of this.clipboard.blocks) {
      if (skipAir && b.type === AIR) continue;
      const x = anchor.x + b.dx, y = anchor.y + b.dy, z = anchor.z + b.dz;
      if (!world.inBounds(x, y, z)) continue;
      const prev = world.getBlock(x, y, z);
      if (prev === b.type) continue;
      changes.push({ x, y, z, prev, next: b.type });
    }
    return changes;
  }
}
