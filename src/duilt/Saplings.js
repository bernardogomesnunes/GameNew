import { AIR } from '../config/blocks.js';
import { BIOMES } from '../config/biomes.js';
import { TREE_SIZES, hash01, sizedTree, treeShape } from '../world/ChunkGen.js';

/**
 * Saplings that grow into trees. Asked for directly: "Sapling should be a
 * 3D model, and should grow into a tree in 10 game days. Let's remove the
 * sapling from the world generation and it needs to be planted."
 *
 * Like Crops, nothing ticks per plant: each one remembers the game day it
 * went in, and grow() turns any that have had their ten days into a tree —
 * the same tree, drawn by the same code (ChunkGen's treeShape), that the
 * land around it would have grown wild, in that land's wood. Game days are
 * days of the world's own clock (DuiltGame.days), so a sapling grows while
 * you play, not while the game is shut.
 */

export const SAPLING = 20;
/** Game days from planting to a tree. */
export const GROW_DAYS = 10;
/** Where there's no wild tree to copy (a desert, an old fixed world): an oak. */
const OAK = { trunk: [4, 6], canopy: 2, wood: 4, leaves: 5 };

/** Wild wood and leaves of every kind: a crown can grow into another tree's. */
const TREE_BLOCKS = new Set([4, 5, 41, 42, 43, 44]);

export class Saplings {
  constructor() {
    this.planted = new Map(); // "x,y,z" -> { x, y, z, at }
  }

  plant(x, y, z, at) {
    this.planted.set(`${x},${y},${z}`, { x, y, z, at });
  }

  remove(x, y, z) {
    this.planted.delete(`${x},${y},${z}`);
  }

  get(x, y, z) {
    return this.planted.get(`${x},${y},${z}`) ?? null;
  }

  /** Whole game days before the one at (x, y, z) is a tree: 0 once it's due. */
  daysLeft(x, y, z, today) {
    const s = this.get(x, y, z);
    if (!s) return null;
    return Math.max(0, Math.ceil(s.at + GROW_DAYS - today));
  }

  /**
   * Grows every loaded sapling whose ten days are up. Returns the cells it
   * changed. A sapling with no room — a roof over it, a wall where its crown
   * would go — tries smaller trees, and failing those waits (and says so:
   * `blocked`), rather than pushing leaves through somebody's house.
   */
  grow(world, today) {
    const changes = [];
    for (const [key, s] of this.planted) {
      if (!world.hasChunk(s.x >> 4, s.z >> 4)) continue;
      if (world.getBlock(s.x, s.y, s.z) !== SAPLING) { this.planted.delete(key); continue; }
      if (today - s.at < GROW_DAYS) continue;
      const cells = treeFor(world, s.x, s.y, s.z);
      if (!cells) { s.blocked = true; continue; }
      for (const c of cells) {
        const prev = world.getBlock(c.x, c.y, c.z);
        world.setBlock(c.x, c.y, c.z, c.block);
        changes.push({ x: c.x, y: c.y, z: c.z, prev, next: c.block });
      }
      this.planted.delete(key);
    }
    return changes;
  }

  toJSON() {
    return [...this.planted.values()].map(({ x, y, z, at }) => ({ x, y, z, at }));
  }

  loadJSON(list) {
    this.planted.clear();
    for (const s of Array.isArray(list) ? list : []) {
      if (Number.isFinite(s?.x) && Number.isFinite(s?.at)) this.plant(s.x, s.y, s.z, s.at);
    }
  }
}

/** The wild trees of the land at (x, z), or an oak where there are none. */
export function treeStyleAt(world, x, z) {
  const t = world.gen ? BIOMES[world.gen.biomeIndexAt(x, z)]?.trees : null;
  return t?.wood ? t : OAK;
}

/**
 * The cells of the tree a sapling at (x, y, z) grows into, or null if no
 * size of it fits. Its size is drawn the way a wild tree's is (TREE_SIZES),
 * from where it stands; never a giant — those need four trunks of room.
 */
export function treeFor(world, x, y, z) {
  const style = treeStyleAt(world, x, z);
  const seed = world.gen?.seed ?? 0;
  const [lo, hi] = style.trunk ?? [4, 6];
  const base = lo + Math.floor(hash01(x, z, seed ^ 0x1b9d) * (hi - lo + 1));
  const roll = hash01(x, z, seed ^ 0x4e2b);
  const want = TREE_SIZES.findIndex((c) => roll < c.upTo);
  for (let i = want; i >= 0; i--) {
    const tree = sizedTree(style, y, base, TREE_SIZES[i].size);
    const cells = [];
    let fits = true;
    treeShape((bx, by, bz, block, airOnly) => {
      if (!fits) return;
      if (!world.inBounds(bx, by, bz)) { if (!airOnly) fits = false; return; }
      const here = world.getBlock(bx, by, bz);
      if (airOnly) {
        // Leaves fill the air round it; they meet other leaves and wood
        // happily, but anything built is in the way.
        if (here === AIR) cells.push({ x: bx, y: by, z: bz, block });
        else if (!TREE_BLOCKS.has(here)) fits = false;
        return;
      }
      // The trunk: up from the sapling's own cell, through nothing but air.
      if (here !== AIR && !(bx === x && by === y && bz === z)) { fits = false; return; }
      cells.push({ x: bx, y: by, z: bz, block });
    }, x, z, tree, seed);
    if (fits) return cells;
  }
  return null;
}
