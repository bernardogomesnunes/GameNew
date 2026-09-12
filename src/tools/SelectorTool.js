import { AIR } from '../config/blocks.js';

/**
 * A fixed-size cubic selector instead of free corner-picking.
 *
 * Sizes are powers of two up to one chunk footprint, and the box snaps to a
 * grid of its own size on every axis. Snapping all three means the cell you are
 * aiming at always *contains* the block under the crosshair, the box stops
 * sliding around as the crosshair drifts within a cell, and captured regions
 * tile against each other and against chunks. That last property is what lets
 * achievements and pricing reason about a template at all.
 *
 * To frame something taller than the current size, step the size up rather than
 * dragging: the grid keeps every design aligned with every other one.
 */
export const SELECTOR_SIZES = [2, 4, 8, 16];

export class SelectorTool {
  constructor() {
    this.active = false;
    this.sizeIndex = 2; // 8x8x8 is the useful default for a building
    this.anchor = null; // { x, y, z } minimum corner, grid-snapped
  }

  get size() {
    return SELECTOR_SIZES[this.sizeIndex];
  }

  toggle() {
    this.active = !this.active;
    if (!this.active) this.anchor = null;
    return this.active;
  }

  cycleSize() {
    this.sizeIndex = (this.sizeIndex + 1) % SELECTOR_SIZES.length;
    return this.size;
  }

  /** Snaps the box to the grid cell containing the targeted block. */
  aimAt(target) {
    if (!target) return;
    const s = this.size;
    const snap = (v) => Math.floor(v / s) * s;
    this.anchor = { x: snap(target.x), y: snap(target.y), z: snap(target.z) };
  }

  /** True when the anchor moved — the caller uses this to avoid rebuilding the highlight every frame. */
  aimChanged(target) {
    const before = this.anchor;
    this.aimAt(target);
    const a = this.anchor;
    if (!before || !a) return before !== a;
    return before.x !== a.x || before.y !== a.y || before.z !== a.z;
  }

  bounds() {
    if (!this.anchor) return null;
    const s = this.size;
    return {
      minX: this.anchor.x, maxX: this.anchor.x + s - 1,
      minY: this.anchor.y, maxY: this.anchor.y + s - 1,
      minZ: this.anchor.z, maxZ: this.anchor.z + s - 1,
    };
  }

  /** Reads the selected volume into a template payload. Returns null if empty. */
  capture(world) {
    const b = this.bounds();
    if (!b) return null;
    const s = this.size;
    const blocks = [];
    for (let x = b.minX; x <= b.maxX; x++) {
      for (let y = b.minY; y <= b.maxY; y++) {
        for (let z = b.minZ; z <= b.maxZ; z++) {
          const type = world.getBlock(x, y, z);
          if (type === AIR) continue; // templates store only what they place
          blocks.push({ dx: x - b.minX, dy: y - b.minY, dz: z - b.minZ, type });
        }
      }
    }
    if (!blocks.length) return null;
    return { size: s, blocks };
  }
}

/** Rotates a template's blocks 90 degrees clockwise about Y, in place of the old footprint. */
export function rotateTemplate(template, quarterTurns = 1) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (!turns) return template;
  const s = template.size;
  let blocks = template.blocks;
  for (let t = 0; t < turns; t++) {
    blocks = blocks.map(({ dx, dy, dz, type }) => ({ dx: s - 1 - dz, dy, dz: dx, type }));
  }
  return { ...template, blocks };
}

/** Proposed { x, y, z, prev, next } changes for stamping a template at an anchor. */
export function buildTemplatePlacement(world, template, anchor) {
  const changes = [];
  for (const b of template.blocks) {
    const x = anchor.x + b.dx, y = anchor.y + b.dy, z = anchor.z + b.dz;
    if (!world.inBounds(x, y, z)) continue;
    const prev = world.getBlock(x, y, z);
    if (prev === b.type) continue;
    changes.push({ x, y, z, prev, next: b.type });
  }
  return changes;
}
