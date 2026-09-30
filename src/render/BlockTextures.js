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
  const topOf = new Map();
  for (const spec of BLOCKS) {
    const recipe = textureFor(spec.glyph);
    if (!recipe) continue;
    layerOf.set(spec.id, tiles.length);
    tiles.push(paint(recipe, spec.id));
    // A block whose top and bottom aren't its sides — a log's cut ends.
    if (recipe.top) {
      topOf.set(spec.id, tiles.length);
      tiles.push(paint(recipe.top, spec.id));
    }
  }
  built = {
    texture: tiles.length ? pack(tiles) : null,
    bumps: tiles.length ? packBumps(tiles) : null,
    layerOf, topOf, layers: tiles.length,
  };
  return built;
}

const tiles = new Map();
/**
 * One block's tile on its own — 16×16 greyscale RGBA bytes, the same one the
 * world draws it with — or null for a block that stays flat. For the bag's
 * icons (config/cubes.js), so a brick in your hand looks like the brick in
 * your wall.
 */
export function tileFor(blockId, { top = false } = {}) {
  const key = top ? `${blockId}:top` : blockId;
  if (tiles.has(key)) return tiles.get(key);
  const spec = BLOCKS.find((b) => b.id === blockId);
  let recipe = spec && textureFor(spec.glyph);
  if (top && recipe) recipe = recipe.top ?? recipe;
  const tile = recipe ? paint(recipe, spec.id) : null;
  tiles.set(key, tile);
  return tile;
}
export const TILE_SIZE = TILE;

/** Which layer a block samples, or -1 for one that stays flat. */
export function layerFor(blockId) {
  const found = blockTextureArray().layerOf.get(blockId);
  return found === undefined ? -1 : found;
}

/** The layer for a block's top and bottom faces — its own, or its sides' if it has none. */
export function topLayerFor(blockId) {
  const found = blockTextureArray().topOf.get(blockId);
  return found === undefined ? layerFor(blockId) : found;
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
  // A tint per pixel, for the few recipes that want colour in their stones
  // (cobbles): 1,1,1 everywhere else, so every other tile stays grey.
  const tint = new Float32Array(n * n * 3).fill(1);
  // How high each pixel stands, 0..1, for the recipes that have depth
  // (`bump`) — see packBumps and ChunkMesher's shader. Null for flat ones.
  let height = null;

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

  // Furrows: tilled soil, ridges with a ragged trough between them — dug,
  // not sawn, so no two pixels of a trough are quite as dark.
  if (recipe.furrows) {
    const every = recipe.furrows;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const r = y % every;
        if (r === 0) darken(x, y, depth * (0.55 + 0.45 * hash01(x, y, salt)));
        else if (r === 1 && hash01(x, y + 97, salt) < 0.5) darken(x, y, depth * 0.5);
      }
    }
  }

  // Cobbles: rounded stones of mixed sizes and shades bedded in dirt.
  // Requested directly, with a photo of a cobbled street: the old blotches
  // "look awful". Stones are thrown onto the tile one at a time and kept
  // only where they don't crowd a neighbour — big ones first, then small
  // ones into the holes — wrapping round the edges so walls tile without a
  // seam. Each is a rounded oval of its own tone, lit along the top and
  // shadowed along the bottom (tile rows run up the world, so a larger y is
  // higher); now and then one is warm or cool the way river stones are; and
  // what's left between them is dirt with grit in it.
  if (recipe.cobbles) {
    const wrap = (d) => (d > n / 2 ? d - n : d < -n / 2 ? d + n : d);
    const stones = [];
    let k = 0;
    for (const [tries, rlo, rhi] of [[recipe.cobbles * 40, 2.8, 4.4], [200, 1.6, 2.6], [200, 1, 1.5]]) {
      for (let t = 0; t < tries; t++, k++) {
        const st = {
          x: hash01(k, 107, salt) * n, y: hash01(k, 109, salt) * n,
          r: rlo + hash01(k, 113, salt) * (rhi - rlo),
          sx: 0.85 + hash01(k, 127, salt) * 0.3, sy: 0.85 + hash01(k, 131, salt) * 0.3,
        };
        const fits = stones.every((o) => Math.hypot(wrap(st.x - o.x), wrap(st.y - o.y)) >= st.r + o.r + 0.1);
        if (!fits) continue;
        const w = hash01(k, 101, salt);
        st.tone = 0.02 + hash01(k, 137, salt) * 0.1;
        st.tint = w < 0.1 ? [1, 0.93, 0.84] : w < 0.25 ? [0.95, 0.97, 1] : [1, 1, 1];
        stones.push(st);
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let best = null, bestT = Infinity, bdy = 0;
        for (const st of stones) {
          const dx = wrap(x + 0.5 - st.x), dy = wrap(y + 0.5 - st.y);
          const t = Math.hypot(dx / st.sx, dy / st.sy) / st.r;
          if (t < bestT) { bestT = t; best = st; bdy = dy / st.sy / st.r; }
        }
        if (recipe.bump) {
          height ??= new Float32Array(n * n);
          // A dome per stone, the big ones standing a little prouder.
          height[y * n + x] = bestT > 1 ? 0 : Math.sqrt(1 - bestT * bestT) * (0.55 + 0.45 * Math.min(1, best.r / 4));
        }
        if (bestT > 1) {
          // Earth between the stones: darker, and a little brown.
          darken(x, y, depth * (0.8 + 0.2 * hash01(x, y, salt + 17)));
          tint.set([1, 0.95, 0.86], (y * n + x) * 3);
          continue;
        }
        let shade = best.tone;
        if (bestT > 0.5 && bdy > 0.25) shade = 0;                         // lit top
        else if (bestT > 0.5 && bdy < -0.2) shade += depth * 0.35;        // shadowed foot
        if (hash01(x, y, salt + 29) < 0.1) shade += depth * 0.15;
        darken(x, y, shade);
        tint.set(best.tint, (y * n + x) * 3);
      }
    }
  }

  // Bark: furrows running up the trunk, each wandering a pixel or two side
  // to side (with a period that divides the tile, so it stacks seamlessly
  // up a trunk), a softer shadow beside each, the odd crack across a ridge
  // and a knot.
  if (recipe.bark) {
    const furrows = recipe.bark;
    for (let f = 0; f < furrows; f++) {
      const x0 = Math.floor((f + hash01(f, 61, salt) * 0.6) * n / furrows);
      const amp = 0.6 + hash01(f, 67, salt) * 0.9;
      const phase = hash01(f, 71, salt) * Math.PI * 2;
      const turns = 1 + Math.floor(hash01(f, 73, salt) * 2);
      for (let y = 0; y < n; y++) {
        const x = x0 + Math.round(Math.sin((y / n) * Math.PI * 2 * turns + phase) * amp);
        darken(x, y, depth);
        darken(x + 1, y, depth * 0.45);
        if (hash01(x, y, salt + 5) < 0.3) darken(x - 1, y, depth * 0.3);
      }
    }
    for (let c = 0; c < (recipe.cracks ?? 0) + 2; c++) {
      const x = Math.floor(hash01(c, 79, salt) * n), y = Math.floor(hash01(c, 83, salt) * n);
      darken(x, y, depth * 0.7); darken(x + 1, y, depth * 0.7);
    }
    for (let k = 0; k < (recipe.knots ?? 0); k++) {
      const cx = Math.floor(hash01(k, 89, salt) * n), cy = Math.floor(hash01(k, 97, salt) * n);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) darken(cx + dx, cy + dy, depth * 0.8);
      darken(cx, cy, depth * 0.35);
    }
  }

  // Rings: a log's cut end — growth rings round the pith, and the bark
  // round the rim.
  if (recipe.rings) {
    const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - c, y - c);
        const edge = Math.min(x, y, n - 1 - x, n - 1 - y);
        if (edge === 0) darken(x, y, depth);
        else if (edge === 1 && hash01(x, y, salt + 11) < 0.5) darken(x, y, depth * 0.6);
        else if (d < 0.8) darken(x, y, depth * 0.9);
        else if ((d / recipe.rings) % 1 < 0.34) darken(x, y, depth * 0.5);
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

  // Cut-outs: pixels with nothing there at all, which the block shader
  // discards (see ChunkMesher's withBlockTextures). Small gaps of one or two
  // pixels, and the corners bitten off in a curve.
  const alpha = new Uint8Array(n * n).fill(255);
  for (let g = 0; g < (recipe.gaps ?? 0); g++) {
    const x = 2 + Math.floor(hash01(g, 43, salt) * (n - 4));
    const y = 2 + Math.floor(hash01(g, 47, salt) * (n - 4));
    alpha[y * n + x] = 0;
    if (hash01(g, 53, salt) < 0.5) alpha[y * n + ((x + 1) % n)] = 0;
    else alpha[((y + 1) % n) * n + x] = 0;
  }
  const bite = recipe.bite ?? 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = Math.min(x, n - 1 - x), cy = Math.min(y, n - 1 - y);
      if (cx + cy < bite) alpha[y * n + x] = 0;
    }
  }

  // Any other recipe with depth takes it from its own shading: the dark
  // lines (mortar, furrows, grain) are the low parts.
  if (recipe.bump && !height) {
    height = new Float32Array(n * n);
    let lo = Infinity, hi = -Infinity;
    for (const v of level) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < n * n; i++) height[i] = hi > lo ? (level[i] - lo) / (hi - lo) : 0;
  }
  if (height) for (let i = 0; i < n * n; i++) height[i] *= recipe.bump;

  const out = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const l = Math.max(0, Math.min(1, level[i]));
    out[i * 4] = Math.round(l * tint[i * 3] * 255);
    out[i * 4 + 1] = Math.round(l * tint[i * 3 + 1] * 255);
    out[i * 4 + 2] = Math.round(l * tint[i * 3 + 2] * 255);
    out[i * 4 + 3] = alpha[i];
  }
  out.height = height;
  return out;
}

/**
 * The tiles' heights, as a second layered texture laid out like the first:
 * red is how high a pixel stands, alpha says whether the layer has any depth
 * at all (so a flat one costs the shader one lookup, not five).
 */
function packBumps(tiles) {
  const n = TILE;
  const data = new Uint8Array(n * n * 4 * tiles.length);
  tiles.forEach((tile, i) => {
    const h = tile.height;
    if (!h) return;
    for (let p = 0; p < n * n; p++) {
      const o = (i * n * n + p) * 4;
      data[o] = Math.round(Math.max(0, Math.min(1, h[p])) * 255);
      data[o + 3] = 255;
    }
  });
  const tex = new THREE.DataArrayTexture(data, n, n, tiles.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
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
  built?.bumps?.dispose();
  built = null;
}
