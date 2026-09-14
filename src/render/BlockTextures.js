import * as THREE from 'three';
import { BLOCKS } from '../config/blocks.js';
import { textureFor, TILE_BASE } from '../config/textures.js';

/**
 * Painting the recipes in config/textures.js into something the GPU can use.
 *
 * Greyscale, near white, and multiplied against the block's colour — so this
 * adds shading and nothing else. The colour still comes from the registry and
 * the per-block hue variation still lands on top of it. A block with no recipe
 * is simply flat, and sits beside a textured one without looking like a
 * different art style, because both are the same colour underneath.
 *
 * A texture *array* rather than an atlas. Greedy meshing merges a flat floor
 * into one quad however many blocks wide it is, and that quad's tile has to
 * repeat across it — repeating inside an atlas bleeds into the neighbouring
 * tile, while each layer of an array is its own image and tiles cleanly. That
 * is what lets every opaque block in a chunk stay in a single draw call and
 * still have a surface of its own.
 *
 * Sixteen pixels square, nearest-neighbour, so it reads as pixel art rather
 * than a blurred photograph of a rock — which is the thing that makes a
 * stylised world look cheap. Every mark is placed from a fixed hash rather
 * than Math.random, so the tile is the same one every session.
 */

const TILE = 16;
let built = null;

/** A repeatable 0..1 from two integers. No state, no surprises. */
function hash01(a, b, salt) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Every material's tile in one layered texture, and which layer each block uses. */
export function blockTextureArray() {
  if (built) return built;
  const tiles = [];
  const layerOf = new Map();
  for (const spec of BLOCKS) {
    const recipe = textureFor(spec.glyph);
    if (!recipe) continue;
    layerOf.set(spec.id, tiles.length);
    tiles.push(paint(recipe, spec.id));
  }
  built = { texture: tiles.length ? pack(tiles) : null, layerOf, layers: tiles.length };
  return built;
}

/** Which layer a block samples, or -1 for one that stays flat. */
export function layerFor(blockId) {
  const found = blockTextureArray().layerOf.get(blockId);
  return found === undefined ? -1 : found;
}

/** One tile, as greyscale bytes. Data, not a picture — no canvas involved. */
function paint(recipe, salt) {
  const n = TILE;
  const level = new Float32Array(n * n).fill(TILE_BASE);
  const darken = (x, y, amount) => {
    const i = ((y % n) + n) % n * n + (((x % n) + n) % n);
    level[i] = Math.min(level[i], TILE_BASE - amount);
  };

  const depth = recipe.depth ?? 0.15;

  // Lines: planks and trunks run one way, brick courses stagger, a grid is
  // mortar. Drawn first so marks can break them up.
  if (recipe.lines) {
    const every = recipe.every ?? 4;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (recipe.lines === 'h' && y % every === 0) darken(x, y, depth);
        if (recipe.lines === 'v' && x % every === 0) darken(x, y, depth);
        if (recipe.lines === 'grid' && (x % every === 0 || y % every === 0)) darken(x, y, depth);
        if (recipe.lines === 'brick') {
          const course = Math.floor(y / every);
          const offset = course % 2 ? Math.floor(every * 1.5) : 0;
          if (y % every === 0 || (x + offset) % (every * 2) === 0) darken(x, y, depth);
        }
      }
    }
  }

  // A darker lip along the edges, for a block that reads as having a rim.
  if (recipe.band) {
    const w = recipe.band;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < w; k++) {
        darken(i, k, depth); darken(i, n - 1 - k, depth);
        darken(k, i, depth); darken(n - 1 - k, i, depth);
      }
    }
  }

  // Blobs: cobbles and gravel, a few rounded patches rather than loose pixels.
  for (let b = 0; b < (recipe.blobs ?? 0); b++) {
    const cx = Math.floor(hash01(b, 1, salt) * n);
    const cy = Math.floor(hash01(b, 2, salt) * n);
    const r = 1.4 + hash01(b, 3, salt) * 1.8;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        // Darker at the edge than the middle, so it reads as a stone rather
        // than a stain.
        darken(x, y, depth * (d / r) * 0.9);
      }
    }
  }

  // Veins: marble and crystal, a couple of drifting lines.
  for (let v = 0; v < (recipe.veins ?? 0); v++) {
    let x = hash01(v, 7, salt) * n;
    for (let y = 0; y < n; y++) {
      x += (hash01(v, y, salt) - 0.5) * 1.6;
      darken(Math.round(x), y, depth);
    }
  }

  // Cracks: stone, short diagonal runs.
  for (let c = 0; c < (recipe.cracks ?? 0); c++) {
    let x = hash01(c, 11, salt) * n, y = hash01(c, 13, salt) * n;
    const dx = hash01(c, 17, salt) - 0.5, dy = hash01(c, 19, salt) - 0.5;
    for (let i = 0; i < n / 2; i++) {
      darken(Math.round(x), Math.round(y), depth);
      x += dx * 1.6; y += dy * 1.6;
    }
  }

  // Marks: the loose pixels that make a surface read as ground rather than
  // paint. Two weights, so it does not look like even static.
  for (let m = 0; m < (recipe.marks ?? 0); m++) {
    const x = Math.floor(hash01(m, 23, salt) * n);
    const y = Math.floor(hash01(m, 29, salt) * n);
    const heavy = hash01(m, 31, salt) < 0.35;
    darken(x, y, depth * (heavy ? 1 : 0.45));
  }

  // Holes: leaves, a few pixels bright enough to read as sky through the
  // canopy without actually being transparent.
  for (let h = 0; h < (recipe.holes ?? 0); h++) {
    const x = Math.floor(hash01(h, 37, salt) * n);
    const y = Math.floor(hash01(h, 41, salt) * n);
    const i = ((y % n) + n) % n * n + (((x % n) + n) % n);
    level[i] = 1;
  }

  // A fine speckle over everything, for the materials that want grain.
  if (recipe.speck) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = hash01(x, y, salt + 977);
        if (v < 0.5) darken(x, y, recipe.speck * (v * 2));
      }
    }
  }

  const out = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const g = Math.round(Math.max(0, Math.min(1, level[i])) * 255);
    out[i * 4] = g; out[i * 4 + 1] = g; out[i * 4 + 2] = g; out[i * 4 + 3] = 255;
  }
  return out;
}

/** Stacks the tiles into one layered texture. */
function pack(tiles) {
  const n = TILE;
  const data = new Uint8Array(n * n * 4 * tiles.length);
  tiles.forEach((tile, i) => data.set(tile, i * n * n * 4));
  const tex = new THREE.DataArrayTexture(data, n, n, tiles.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;   // a shading mask, not a colour
  tex.needsUpdate = true;
  return tex;
}

/** Throws the tiles away. For a hard reset of the renderer. */
export function disposeTextures() {
  built?.texture?.dispose();
  built = null;
}
