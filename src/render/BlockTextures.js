import { paintLegacyCobble } from './legacyCobble.js';
import * as THREE from 'three';
import { BLOCKS, BLOCKS_BY_ID } from '../config/blocks.js';
import { blockTexture, TILE_SCALE } from '../config/textures.js';

/**
 * Painting the recipes in config/textures.js into something the GPU can use.
 *
 * Each tile multiplies the block's colour, so the colour still comes from the
 * registry and the per-block hue variation still lands on top of it. What a
 * tile adds is the material: mortar between bricks, seams between boards,
 * warm and cool stones in a cobbled wall, moss in its cracks, pale wood inside
 * dark bark. A tile is painted in multipliers of the block colour as you would
 * see them (1.1 is "a tenth lighter"), turned into light for the shader, and
 * then evened out so that it averages to exactly the block's colour — see
 * normalise below. A block with no recipe is simply flat, and sits beside a
 * textured one without looking like a different art style, because both
 * average to their registry colours.
 *
 * A texture *array* rather than an atlas. Greedy meshing merges a flat floor
 * into one quad however many blocks wide it is, and that quad's tile has to
 * repeat across it — repeating inside an atlas bleeds into the neighbouring
 * tile, while each layer of an array is its own image and tiles cleanly. That
 * is what lets every opaque block in a chunk stay in a single draw call and
 * still have a surface of its own.
 *
 * Thirty-two pixels square: twice the detail across a face that sixteen gave,
 * enough for a brick to have a lit top edge and a shadowed foot and for a
 * board to have grain, and still small — every material in the game is a few
 * hundred kilobytes of layers, nothing on a phone. Nearest-neighbour up close,
 * so it reads as crisp pixel art rather than a blurred photograph of a rock,
 * and mipmapped far off, because a 32-pixel pattern squeezed into a dozen
 * screen pixels otherwise crawls and sparkles as you walk (the block shader
 * samples with the quad's own gradients, so the seam between two repeats of a
 * tile does not pick the wrong mip). Every mark is placed from a fixed hash
 * rather than Math.random, so the tile is the same one every session.
 */

const TILE = 32;
/** Recipes are written as you'd see the colours; the shader works in light. */
const GAMMA = 2.2;
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
    const recipe = blockTexture(spec);
    // Shaped blocks (slabs, stairs, roof tiles, props) are drawn in their
    // plain colour, so they need no layer of their own.
    if (!recipe || spec.shape) continue;
    layerOf.set(spec.id, tiles.length);
    tiles.push(tileFor(spec.id));
    // A block whose top and bottom aren't its sides — a log's cut ends.
    if (recipe.top) {
      topOf.set(spec.id, tiles.length);
      tiles.push(tileFor(spec.id, { top: true }));
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
 * One block's tile on its own — 32×32 RGBA bytes, the same one the world
 * draws it with, a byte of 255 meaning TILE_SCALE times the block's colour —
 * or null for a block that stays flat. For the bag's icons (config/cubes.js),
 * so a brick in your hand looks like the brick in your wall.
 */
export function tileFor(blockId, { top = false } = {}) {
  const key = top ? `${blockId}:top` : blockId;
  if (tiles.has(key)) return tiles.get(key);
  const spec = BLOCKS_BY_ID.get(blockId);
  let recipe = blockTexture(spec);
  if (top && recipe) recipe = recipe.top ?? recipe;
  const tile = !recipe ? null
    : recipe.legacy === 'cobble' ? legacyTile(paintLegacyCobble(spec.id, undefined, recipe.size ?? 16), spec)
    : finish(paint(recipe, spec, spec.id), recipe, spec);
  tiles.set(key, tile);
  return tile;
}

/**
 * A tile from before the 32px textures (see render/legacyCobble.js), doubled
 * to fill a layer and written straight through: its level times its tint is
 * what the block's colour is multiplied by, as it was then — no gamma. The
 * one thing done to it is a single even lift so it averages to its block's
 * colour, like every other tile now; the old ones sat at about 0.8 of theirs,
 * and next to blocks that don't it would only read as dimmer.
 */
function legacyTile({ level, tint, height, size }, spec) {
  const out = new Uint8Array(TILE * TILE * 4);
  const h = new Float32Array(TILE * TILE);
  const f = TILE / size;
  const col = new THREE.Color(spec?.color ?? 0xffffff);
  const w = [0.2126 * col.r, 0.7152 * col.g, 0.0722 * col.b];
  const ws = w[0] + w[1] + w[2] || 1;
  let sum = 0;
  for (let i = 0; i < size * size; i++) {
    const l = Math.max(0, Math.min(1, level[i]));
    sum += l * (w[0] * tint[i * 3] + w[1] * tint[i * 3 + 1] + w[2] * tint[i * 3 + 2]) / ws;
  }
  const k = sum > 0 ? (size * size) / sum : 1;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const s = Math.floor(y / f) * size + Math.floor(x / f), o = y * TILE + x;
      const l = Math.max(0, Math.min(1, level[s])) * k;
      for (let ch = 0; ch < 3; ch++) out[o * 4 + ch] = Math.round(Math.min(1, (l * tint[s * 3 + ch]) / TILE_SCALE) * 255);
      out[o * 4 + 3] = 255;
      h[o] = height[s];
    }
  }
  out.height = h;
  out.shine = null;
  return out;
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

// --- the canvas ----------------------------------------------------------------

/**
 * A tile being painted: a level per pixel (1 = the block's colour), a tint per
 * pixel (1,1,1 = none), a height for the ones with depth, and which pixels are
 * there at all. Rows run up a wall: a larger y is higher, so "lit from above"
 * means lighter at the top of a stone.
 */
function canvas() {
  const n = TILE;
  return { L: new Float32Array(n * n).fill(1), T: new Float32Array(n * n * 3).fill(1), H: null, A: new Uint8Array(n * n).fill(255) };
}
const at = (x, y) => ((((y | 0) % TILE) + TILE) % TILE) * TILE + ((((x | 0) % TILE) + TILE) % TILE);
const shade = (c, x, y, f) => { c.L[at(x, y)] *= f; };
function tint(c, x, y, rgb, k = 1) {
  const i = at(x, y) * 3;
  for (let ch = 0; ch < 3; ch++) c.T[i + ch] *= 1 + (rgb[ch] - 1) * k;
}
function setTint(c, x, y, rgb) {
  const i = at(x, y) * 3;
  c.T[i] = rgb[0]; c.T[i + 1] = rgb[1]; c.T[i + 2] = rgb[2];
}
function lift(c, x, y, h) {
  c.H ??= new Float32Array(TILE * TILE);
  c.H[at(x, y)] = h;
}

/** Smooth noise that wraps at the tile's edges, `cx` by `cy` cells across it. */
function vnoise(x, y, cx, cy, salt) {
  const fx = (x * cx) / TILE, fy = (y * cy) / TILE;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const sx = fx - x0, sy = fy - y0;
  const tx = sx * sx * (3 - 2 * sx), ty = sy * sy * (3 - 2 * sy);
  const v = (i, j) => hash01(((i % cx) + cx) % cx, ((j % cy) + cy) % cy, salt);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx;
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}
/** A few octaves of it, 0..1: broad patches with finer ones inside. */
function fbm(x, y, salt, cells = 2, octaves = 3) {
  let sum = 0, amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const k = cells << o;
    sum += vnoise(x, y, k, k, salt + o * 101) * amp;
    total += amp; amp *= 0.5;
  }
  return sum / total;
}

/** Points on a jittered grid, for stones and plates that pack edge to edge. */
function scatter(cols, rows, jitter, salt) {
  const pts = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      pts.push({
        x: ((i + 0.5 + (hash01(k, 3, salt) - 0.5) * 2 * jitter) * TILE) / cols,
        y: ((j + 0.5 + (hash01(k, 5, salt) - 0.5) * 2 * jitter) * TILE) / rows,
        k, h: hash01(k, 7, salt), h2: hash01(k, 11, salt),
      });
    }
  }
  return pts;
}
const wrapd = (d) => (d > TILE / 2 ? d - TILE : d < -TILE / 2 ? d + TILE : d);
/** The nearest of `pts` to a pixel and the gap to the next one (wrapping round the tile). */
function nearest(pts, x, y) {
  let d1 = Infinity, d2 = Infinity, p = null, dx = 0, dy = 0;
  for (const q of pts) {
    const ex = wrapd(x - q.x), ey = wrapd(y - q.y);
    const d = Math.hypot(ex, ey);
    if (d < d1) { d2 = d1; d1 = d; p = q; dx = ex; dy = ey; } else if (d < d2) d2 = d;
  }
  return { d1, d2, p, dx, dy };
}
const each = (fn) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y, x + 0.5, y + 0.5); };
const pick = (list, h) => list[Math.min(list.length - 1, Math.floor(h * list.length))];

// --- painting a recipe ------------------------------------------------------------

/** Which way `hue` swings a patch: towards warm (and, negated, towards cool). */
const HUE_SWING = [1.12, 1.0, 0.86];

/** A recipe painted into a canvas, before it is turned into bytes. */
function paint(recipe, spec, salt) {
  if (recipe.fringe) return grassSide(recipe, spec, salt);
  const c = canvas();
  const depth = recipe.depth ?? 0.2;

  if (recipe.mottle) each((x, y, px, py) => shade(c, x, y, 1 + (fbm(px, py, salt + 3) - 0.5) * 2 * recipe.mottle));
  // Broad patches warmer and cooler, the way rock and earth weather.
  if (recipe.hue) each((x, y, px, py) => tint(c, x, y, HUE_SWING, (fbm(px, py, salt + 19, 2, 2) - 0.5) * 2 * recipe.hue));
  if (recipe.strata) strata(c, recipe, salt, depth);
  if (recipe.ripples) ripples(c, recipe, salt, depth);
  if (recipe.furrows) furrows(c, recipe, salt, depth);
  if (recipe.pebbles) pebbles(c, recipe, salt, depth);
  if (recipe.cobbles) cobbles(c, recipe, salt, depth);
  if (recipe.lines === 'brick') bricks(c, recipe, salt, depth);
  if (recipe.lines === 'ashlar') ashlar(c, recipe, salt, depth);
  if (recipe.lines === 'planks') planks(c, recipe, salt, depth);
  if (recipe.bark) (recipe.birch ? birch : bark)(c, recipe, salt, depth);
  if (recipe.rings) rings(c, recipe, salt, depth);
  if (recipe.beams) beams(c, recipe, salt);
  // Calçada (playtest, P9): little stones in mortar, every one a shade of its own.
  if (recipe.setts) {
    setts(c, recipe, salt, depth);
    // The wave: a band of dark stones swinging once across the tile and
    // meeting itself at the edges, so a pavement of them runs on unbroken.
    if (recipe.wave) wave(c);
  }
  if (recipe.veins) veins(c, recipe, salt, depth);
  if (recipe.plate) plate(c, recipe, salt, depth);
  if (recipe.band) trimBand(c, recipe, salt, depth);
  if (recipe.facets) facets(c, recipe, salt, depth);
  if (recipe.crust) crust(c, recipe, salt, depth);
  if (recipe.frame) frame(c, recipe, depth);
  if (recipe.clumps) clumps(c, recipe, salt, depth);
  if (recipe.litter) litter(c, recipe, salt, depth);
  if (recipe.leaves) leaves(c, recipe, salt, depth);
  if (recipe.blades) blades(c, recipe, salt, depth);
  if (recipe.ore) ore(c, recipe, salt, depth);
  if (recipe.cracks) cracks(c, recipe, salt, depth);
  if (recipe.marks) marks(c, recipe, salt, depth);
  if (recipe.speck) each((x, y) => shade(c, x, y, 1 + (hash01(x, y, salt + 977) - 0.5) * 2 * recipe.speck));
  if (recipe.edge) edge(c, recipe.edge);
  if (recipe.gaps || recipe.bite) cutouts(c, recipe, salt);
  return c;
}

/**
 * The side of a grass block: earth, with the turf hanging over the top edge
 * in a ragged line and a shadow under it. The earth is the Dirt block's own
 * tile, recoloured from grass to dirt — so it is the same earth you dig.
 */
function grassSide(recipe, spec, salt) {
  const { under, turf } = recipe.fringe;
  const dirtSpec = BLOCKS_BY_ID.get(under);
  const dirt = paint(blockTexture(dirtSpec), dirtSpec, salt + 7);
  const grass = paint({ ...recipe, fringe: null }, spec, salt + 13);
  const ratio = [16, 8, 0].map((s) => Math.min(1.85, (((dirtSpec.color >> s) & 255) + 1) / (((spec.color >> s) & 255) + 1)));
  const c = canvas();
  for (let x = 0; x < TILE; x++) {
    let hang = turf + Math.round((vnoise(x + 0.5, 0, 8, 1, salt) - 0.5) * 4);
    if (hash01(x, 5, salt) < 0.22) hang += 1 + Math.floor(hash01(x, 6, salt) * 4);
    for (let y = 0; y < TILE; y++) {
      const i = at(x, y);
      const fromGrass = y >= TILE - hang;
      const src = fromGrass ? grass : dirt;
      c.L[i] = src.L[i];
      for (let ch = 0; ch < 3; ch++) c.T[i * 3 + ch] = src.T[i * 3 + ch] * (fromGrass ? 1 : ratio[ch]);
      if (y === TILE - hang - 1) c.L[i] *= 0.62;
      else if (y === TILE - hang - 2) c.L[i] *= 0.84;
      else if (fromGrass && y === TILE - hang) c.L[i] *= 0.9;
    }
  }
  return c;
}

/** Clay: faint layers, the way it settled. */
function strata(c, recipe, salt, depth) {
  each((x, y, px, py) => shade(c, x, y, 1 + Math.sin(Math.PI * 2 * (py * recipe.strata) / TILE + (vnoise(px, py, 4, 2, salt) - 0.5) * 3) * depth * 0.5));
}

/** Sand and water: ripples running across, bent by a slow wobble. */
function ripples(c, recipe, salt, depth) {
  each((x, y, px, py) => {
    const phase = ((py + (vnoise(px, py, 4, 4, salt) - 0.5) * 7) * recipe.ripples) / TILE;
    const s = Math.sin(Math.PI * 2 * phase);
    shade(c, x, y, 1 + (s > 0.6 ? 0.6 : s < -0.3 ? -1 : 0) * depth * 0.35);
  });
}

/** Tilled soil: ridges, lit along their crowns, with a dark wet trough between. */
function furrows(c, recipe, salt, depth) {
  const every = recipe.furrows;
  each((x, y, px, py) => {
    const p = (((py + (vnoise(px, py, 8, 2, salt) - 0.5) * 2) % every) + every) % every / every;
    if (p < 0.25) { shade(c, x, y, 1 - depth * (1 - p * 2.4)); tint(c, x, y, [0.88, 0.86, 0.86]); lift(c, x, y, p); }
    else { if (p > 0.55 && p < 0.85) shade(c, x, y, 1.12); lift(c, x, y, 0.4 + Math.sin(Math.PI * (p - 0.25) / 0.75) * 0.6); }
  });
}

/** Gravel: little stones packed edge to edge, each its own grey or brown, lit on top. */
function pebbles(c, recipe, salt, depth) {
  const k = recipe.pebbles, pts = scatter(k, k, 0.42, salt), r = TILE / k / 2;
  const fl = recipe.flecks ?? [[1, 1, 1]];
  each((x, y, px, py) => {
    const { d1, d2, p, dy } = nearest(pts, px, py);
    if (d2 - d1 < 1.2) { shade(c, x, y, 1 - depth); tint(c, x, y, [0.92, 0.9, 0.88]); lift(c, x, y, 0); return; }
    let f = 0.84 + p.h * 0.3;
    if (d1 > r * 0.45) f *= dy > 0 ? 1.12 : 0.86;
    shade(c, x, y, f);
    tint(c, x, y, pick(fl, p.h2));
    lift(c, x, y, Math.max(0.2, 1 - (d1 / (r * 1.4)) ** 2));
  });
}

/**
 * Cobbles: rounded stones of mixed sizes and shades bedded in earth.
 * Requested directly, with a photo of a cobbled street: the old blotches
 * "look awful". Stones are thrown onto the tile one at a time and kept only
 * where they don't crowd a neighbour — big ones first, then small ones into
 * the holes — wrapping round the edges so walls tile without a seam. Each is
 * a rounded oval of its own tone, lit along the top and shadowed along the
 * bottom; one in three is warm or cool the way river stones are; and what's
 * left between them is earth, with moss growing in it.
 *
 * `plain`: the first cobblestone, as it was before the 32px textures — pale
 * grey stones packed close, only the odd one warm or cool, plain earth
 * between and no moss. Requested directly: "Cobble was fine as it was ...
 * the only one I think it got worse".
 */
function cobbles(c, recipe, salt, depth) {
  const n = TILE, stones = [], plain = !!recipe.plain;
  const gap = plain ? 0.2 : 0.6;
  let k = 0;
  for (const [tries, rlo, rhi] of [[recipe.cobbles * 40, 5.4, 8.6], [220, 3.2, 5.2], [220, 2, 3]]) {
    for (let t = 0; t < tries; t++, k++) {
      const st = {
        x: hash01(k, 107, salt) * n, y: hash01(k, 109, salt) * n,
        r: rlo + hash01(k, 113, salt) * (rhi - rlo),
        sx: 0.85 + hash01(k, 127, salt) * 0.3, sy: 0.85 + hash01(k, 131, salt) * 0.3,
      };
      if (!stones.every((o) => Math.hypot(wrapd(st.x - o.x), wrapd(st.y - o.y)) >= st.r + o.r + gap)) continue;
      const w = hash01(k, 101, salt);
      if (plain) {
        st.tone = 0.88 + hash01(k, 137, salt) * 0.1;
        st.tint = w < 0.1 ? [1, 0.93, 0.84] : w < 0.25 ? [0.95, 0.97, 1] : [1, 1, 1];
        stones.push(st);
        continue;
      }
      st.tone = 0.88 + hash01(k, 137, salt) * 0.2;
      st.tint = w < 0.16 ? [1.1, 0.98, 0.84] : w < 0.32 ? [0.9, 0.96, 1.1] : w < 0.42 ? [1.08, 1.04, 0.9] : [1, 1, 1];
      stones.push(st);
    }
  }
  const moss = recipe.moss ?? 0;
  each((x, y, px, py) => {
    let best = null, bestT = Infinity, bdy = 0;
    for (const st of stones) {
      const dx = wrapd(px - st.x), dy = wrapd(py - st.y);
      const t = Math.hypot(dx / st.sx, dy / st.sy) / st.r;
      if (t < bestT) { bestT = t; best = st; bdy = dy / st.sy / st.r; }
    }
    lift(c, x, y, bestT > 1 ? 0 : Math.sqrt(1 - bestT * bestT) * (0.55 + 0.45 * Math.min(1, best.r / 8)));
    const mossy = moss && fbm(px, py, salt + 41, 4, 2) < moss * 0.95;
    if (bestT > 1) {
      // Earth between the stones, or moss where it is damp.
      if (plain) { shade(c, x, y, 1 - depth * (0.8 + 0.2 * hash01(x, y, salt + 17))); setTint(c, x, y, [1, 0.95, 0.86]); }
      else if (mossy) { shade(c, x, y, 1 - depth * (0.45 + 0.25 * hash01(x, y, salt + 17))); setTint(c, x, y, [0.74, 1.08, 0.56]); }
      else { shade(c, x, y, 1 - depth * (0.85 + 0.15 * hash01(x, y, salt + 17))); setTint(c, x, y, [1.02, 0.9, 0.76]); }
      return;
    }
    let f = best.tone;
    if (bestT > 0.5 && bdy > 0.25) f = plain ? 1 : f * 1.14;         // lit top
    else if (bestT > 0.5 && bdy < -0.2) f *= 1 - depth * 0.4;         // shadowed foot
    if (hash01(x, y, salt + 29) < 0.1) f *= 1 - depth * 0.2;
    shade(c, x, y, f);
    setTint(c, x, y, best.tint);
    // Moss creeping up out of the gaps onto the foot of a stone.
    if (mossy && bestT > 0.78 && bdy < 0.1) tint(c, x, y, [0.8, 1.06, 0.66], 0.8);
  });
}

/**
 * Brick: courses of bricks 16 long and 8 high, the joints staggered, two
 * pixels of mortar under and beside each. Each brick is fired a shade and a
 * hue of its own — a little orange, a little burnt — with its top edge
 * catching the light and its foot in shadow. The mortar is its own colour
 * (`mortar`): pale on red brick, darker than the brick on the Dark Brick.
 */
function bricks(c, recipe, salt, depth) {
  const CH = 8, BL = 16, M = 2;
  const mortar = recipe.mortar ?? [1.4, 1.4, 1.4];
  each((x, y, px, py) => {
    const course = Math.floor(y / CH), off = course % 2 ? BL / 2 : 0;
    const bx = (x + off) % BL, by = y % CH;
    if (by < M || bx < M) {
      const f = by === M - 1 && bx >= M ? 0.8 : 1;   // the brick above shades the joint's top
      shade(c, x, y, f * (0.94 + hash01(x, y, salt + 61) * 0.12));
      setTint(c, x, y, mortar);
      lift(c, x, y, 0);
      return;
    }
    const id = course * 7 + Math.floor((x + off) / BL) % (TILE / BL);
    const h = hash01(id, 1, salt), h2 = hash01(id, 2, salt);
    let f = 0.86 + h * 0.26;
    if (by === CH - 1) f *= 1.12;
    else if (by === M) f *= 0.8;
    if (bx === M) f *= 1.05;
    else if (bx === BL - 1) f *= 0.88;
    f *= 1 + (vnoise(px, py, 16, 16, salt + 3) - 0.5) * 0.14;
    shade(c, x, y, f);
    tint(c, x, y, h2 < 0.22 ? [1.08, 0.92, 0.84] : h2 < 0.4 ? [0.9, 0.86, 0.9] : h2 < 0.5 ? [1.05, 1.0, 0.88] : [1, 1, 1]);
    lift(c, x, y, by === CH - 1 || by === M || bx === M || bx === BL - 1 ? 0.75 : 1);
  });
}

/**
 * Ashlar: big cut blocks, two courses to a face and a block wide, with a
 * fine dark joint and a chiselled bevel round each — a castle's masonry
 * rather than a mountain's rock, and twice the size of a brick, so a wall of
 * it is not mistaken for one. The joints sit at fixed places along each
 * course, so it tiles however long the wall.
 */
const ASHLAR_JOINTS = [[0], [16]];
function ashlar(c, recipe, salt, depth) {
  const CH = 16;
  each((x, y, px, py) => {
    const course = Math.floor(y / CH), by = y % CH, joints = ASHLAR_JOINTS[course % 2];
    if (by === 0 || joints.includes(x)) { shade(c, x, y, 1 - depth); lift(c, x, y, 0); return; }
    // Which stone, and where in it.
    let left = -Infinity, right = Infinity;
    for (const j of joints) for (const jj of [j - TILE, j, j + TILE]) { if (jj < x && jj > left) left = jj; if (jj > x && jj < right) right = jj; }
    const id = course * 13 + ((left % TILE) + TILE) % TILE;
    let f = 0.92 + hash01(id, 1, salt) * 0.16;
    if (by === CH - 1) f *= 1.14;
    else if (by === 1) f *= 0.82;
    if (x === left + 1) f *= 1.07;
    else if (x === right - 1) f *= 0.88;
    shade(c, x, y, f);
    const h2 = hash01(id, 2, salt);
    tint(c, x, y, h2 < 0.33 ? [0.94, 0.98, 1.06] : h2 < 0.5 ? [1.03, 1.0, 0.97] : [1, 1, 1]);
    lift(c, x, y, by === 1 || by === CH - 1 || x === left + 1 || x === right - 1 ? 0.6 : 0.95 + vnoise(px, py, 8, 8, salt) * 0.05);
  });
}

/**
 * Planks: four boards to a face, each its own cut of the tree — a shade and
 * hue of its own, grain running along it, a dark seam under it and a lit
 * edge along its top, a butt joint where two boards meet, nailed either side.
 */
function planks(c, recipe, salt, depth) {
  const BH = 8;
  const joints = [0, 1, 2, 3].map((b) => Math.floor(hash01(b, 17, salt) * TILE));
  each((x, y, px, py) => {
    const b = Math.floor(y / BH), by = y % BH, jx = joints[b];
    const h = hash01(b, 1, salt), h2 = hash01(b, 2, salt);
    if (by === 0) { shade(c, x, y, 1 - depth); lift(c, x, y, 0); return; }
    if (x === jx) { shade(c, x, y, 1 - depth * 0.85); lift(c, x, y, 0.1); return; }
    const piece = (x - jx + TILE) % TILE < TILE / 2 ? 0 : 1;   // the two boards either side of the joint
    let f = 0.9 + hash01(b * 2 + piece, 3, salt) * 0.16;
    // Grain: thin dark lines along the board, wandering a little.
    const g = 0.5 + 0.5 * Math.sin(py * 2.4 + h * 9 + (vnoise(px, py, 4, 8, salt + b) - 0.5) * 7);
    f *= 1 - depth * 0.45 * g ** 6;
    if (by === BH - 1) f *= 1.08;
    else if (by === 1) f *= 0.88;
    if (x === (jx + 1) % TILE) f *= 1.06;
    // Nails beside the joint.
    if ((by === 2 || by === BH - 3) && (x === (jx + 2) % TILE || x === (jx - 2 + TILE) % TILE)) f *= 1 - depth * 0.9;
    shade(c, x, y, f);
    tint(c, x, y, h2 < 0.3 ? [1.05, 0.98, 0.9] : h2 < 0.5 ? [0.95, 0.94, 0.96] : [1, 1, 1]);
    lift(c, x, y, by === 1 || by === BH - 1 ? 0.7 : 1);
  });
  // A knot in one board.
  const kb = Math.floor(hash01(9, 9, salt) * 4), kx = Math.floor(hash01(9, 10, salt) * TILE), ky = kb * BH + 4;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx / 3, dy / 2);
      if (d <= 1) shade(c, kx + dx, ky + dy, d > 0.6 ? 1 - depth * 0.5 : d < 0.3 ? 1 - depth * 0.7 : 1.04);
    }
  }
}

/**
 * Bark: ridges and furrows running up the trunk (wider cells across than up,
 * so they stretch), the furrows dark and a little cool, the ridges catching
 * the light, a crack or two across a ridge and a knot.
 */
function bark(c, recipe, salt, depth) {
  const k = recipe.bark;
  each((x, y, px, py) => {
    const v = 0.6 * vnoise(px, py, k, 1, salt) + 0.25 * vnoise(px, py, k * 2, 3, salt + 9) + 0.15 * vnoise(px, py, k * 4, 8, salt + 5);
    lift(c, x, y, v);
    if (v < 0.42) { shade(c, x, y, 1 - depth * Math.min(1, (0.42 - v) / 0.42 * 2.4)); tint(c, x, y, [0.88, 0.84, 0.84]); }
    else if (v > 0.6) shade(c, x, y, 1 + (v - 0.6) * 0.7);
  });
  // Breaks across the ridges, where the bark has split.
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(hash01(i, 79, salt) * TILE), y = Math.floor(hash01(i, 83, salt) * TILE);
    for (let d = 0; d < 2; d++) { shade(c, x + d, y, 1 - depth * 0.7); shade(c, x + d, y + 1, 1.06); }
  }
  for (let kn = 0; kn < (recipe.knots ?? 0); kn++) {
    const cx = Math.floor(hash01(kn, 89, salt) * TILE), cy = Math.floor(hash01(kn, 97, salt) * TILE);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx / 2.2, dy / 3.2);
        if (d <= 1) shade(c, cx + dx, cy + dy, d > 0.55 ? 1 - depth * 0.8 : 1.08);
      }
    }
  }
}

/** Birch: white bark with dark dashes across it and the odd black scar. */
function birch(c, recipe, salt, depth) {
  each((x, y, px, py) => shade(c, x, y, 1 - (vnoise(px, py, 8, 1, salt) - 0.3) * 0.12));
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash01(i, 31, salt) * TILE), y = Math.floor(hash01(i, 37, salt) * TILE);
    const len = 3 + Math.floor(hash01(i, 41, salt) * 5), thick = hash01(i, 43, salt) < 0.25 ? 2 : 1;
    for (let d = 0; d < len; d++) {
      for (let t = 0; t < thick; t++) {
        shade(c, x + d, y + t, 1 - depth * (0.6 + 0.4 * hash01(i, d, salt)));
        tint(c, x + d, y + t, [0.82, 0.8, 0.82]);
      }
    }
  }
  for (let s = 0; s < 2; s++) {
    const cx = Math.floor(hash01(s, 47, salt) * TILE), cy = Math.floor(hash01(s, 53, salt) * TILE);
    for (let row = 0; row < 3; row++) {
      for (let dx = -(3 - row); dx <= 3 - row; dx++) { shade(c, cx + dx, cy - row, 1 - depth * 1.3); tint(c, cx + dx, cy - row, [0.7, 0.66, 0.66]); }
    }
  }
}

/**
 * A log's cut end: bark round the rim, a pale line of sapwood inside it,
 * and growth rings round the pith in heartwood the colour of `heart`, with a
 * drying crack running out from the middle.
 */
function rings(c, recipe, salt, depth) {
  const n = TILE, mid = (n - 1) / 2, heart = recipe.heart ?? [1.4, 1.35, 1.25];
  const crackAngle = hash01(1, 59, salt) * Math.PI * 2;
  each((x, y, px, py) => {
    const e = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (e <= 1) { shade(c, x, y, 1 - depth * (e === 0 ? 1.2 : 0.4) * (0.8 + 0.4 * hash01(x, y, salt))); return; }
    setTint(c, x, y, heart);
    if (e === 2) { shade(c, x, y, 1.08); return; }
    const d = Math.hypot(x - mid, y - mid) + (vnoise(px, py, 4, 4, salt) - 0.5) * 2.4;
    let f = (d / recipe.rings) % 1 < 0.3 ? 1 - depth * 0.7 : 1 + 0.04 * Math.sin(d);
    if (d < 1.3) f = 1 - depth;
    const a = Math.atan2(y - mid, x - mid);
    const off = Math.abs(Math.sin(a - crackAngle)) * Math.hypot(x - mid, y - mid);
    if (off < 0.6 && Math.cos(a - crackAngle) > 0 && d < n * 0.38) f *= 1 - depth * 1.4;
    shade(c, x, y, f);
  });
}

/**
 * Timber framing (Phase 7a): dark oak beams round the edge and a brace
 * corner to corner, tinted brown over the plaster the block is coloured,
 * with grain along each beam and a shadowed edge where it meets the plaster.
 */
function beams(c, recipe, salt) {
  const n = TILE, w = recipe.beams;
  const tintOf = recipe.beamTint ?? [0.45, 0.32, 0.22];
  const isBeam = (x, y) => x < w || y < w || x >= n - w || y >= n - w || (y >= x - w / 2 && y < x + w / 2);
  each((x, y, px, py) => {
    if (!isBeam(x, y)) {
      // Plaster, shaded where a beam overhangs it.
      if (isBeam(x, y + 1) || isBeam(x - 1, y)) shade(c, x, y, 0.82);
      return;
    }
    // Grain along each beam: posts run up, rails and the brace across.
    const post = (x < w || x >= n - w) && y >= w && y < n - w;
    setTint(c, x, y, tintOf);
    shade(c, x, y, 0.94 + ((post ? vnoise(px, py, 16, 2, salt) : vnoise(px, py, 2, 16, salt)) - 0.5) * 0.4);
    if (!isBeam(x, y - 1) || !isBeam(x + 1, y)) shade(c, x, y, 0.8);
    lift(c, x, y, 1);
  });
}

/** Calçada: little stones packed edge to edge, a joint of mortar between, each a shade of its own. */
const WAVE_STONE = [0.16, 0.16, 0.18];
function setts(c, recipe, salt, depth) {
  const k = Math.round(TILE / (recipe.setts + 0.4)), pts = scatter(k, k, 0.36, salt), r = TILE / k / 2;
  c.stones = pts;
  each((x, y, px, py) => {
    const { d1, d2, p, dy } = nearest(pts, px, py);
    c.owner ??= new Int16Array(TILE * TILE);
    c.owner[at(x, y)] = d2 - d1 < 1.15 ? -1 : p.k;
    if (d2 - d1 < 1.15) { setTint(c, x, y, recipe.joint ?? [0.6, 0.6, 0.6]); shade(c, x, y, 0.94 + hash01(x, y, salt) * 0.1); lift(c, x, y, 0); return; }
    let f = 0.92 + p.h * 0.14;
    if (d2 - d1 < 2.2) f *= 1 - depth * 0.25;
    else if (d1 > r * 0.4) f *= dy > 0 ? 1.06 : 0.94;
    shade(c, x, y, f);
    lift(c, x, y, Math.min(1, (d2 - d1) / 3));
  });
}
function wave(c) {
  const n = TILE;
  for (let i = 0; i < n * n; i++) {
    if (c.owner[i] < 0) continue;   // the joints stay mortar
    const p = c.stones[c.owner[i]];
    const mid = n / 2 + Math.sin((p.x / n) * Math.PI * 2) * n * 0.22;
    if (Math.abs(wrapd(p.y - mid)) > n * 0.2) continue;
    c.T[i * 3] = WAVE_STONE[0]; c.T[i * 3 + 1] = WAVE_STONE[1]; c.T[i * 3 + 2] = WAVE_STONE[2];
  }
}

/**
 * Marble: veins that meander diagonally across the slab and meet themselves
 * at its edges, a soft main vein and a fainter one, coloured `vein`.
 */
function veins(c, recipe, salt, depth) {
  const vein = recipe.vein ?? [0.8, 0.8, 0.8];
  for (let v = 0; v < recipe.veins; v++) {
    // All one way, as marble's veins are — two directions cross into crazy paving.
    const k = 1, dir = -1, off = v / recipe.veins + hash01(v, 7, salt) * 0.2;
    const strength = v === 0 ? 0.8 : 0.4;
    each((x, y, px, py) => {
      const warp = (fbm(px, py, salt + v * 13, 2, 3) - 0.5) * 22;
      const phase = ((px + dir * py + warp) * k) / TILE + off;
      const dist = Math.abs(((phase % 1) + 1) % 1 - 0.5) * (TILE / k);
      // Thick where the warp bunches the vein up, wisp-thin where it stretches.
      const width = 0.35 + 1.1 * fbm(px, py, salt + v * 17 + 5, 2, 2);
      if (dist < width) { shade(c, x, y, 1 - depth * strength); tint(c, x, y, vein, strength); }
      else if (dist < width + 1.4) { shade(c, x, y, 1 - depth * strength * 0.35); tint(c, x, y, vein, strength * 0.35); }
    });
  }
}

/**
 * A metal block: a plate with a bevel lit along its top and left and in
 * shadow along its foot and right, brushed across, a sheen running
 * diagonally over it and a scratch or two.
 */
function plate(c, recipe, salt, depth) {
  const n = TILE, b = recipe.plate;
  each((x, y, px, py) => {
    const top = n - 1 - y, right = n - 1 - x;
    const e = Math.min(x, y, top, right);
    if (e < b) {
      const lit = Math.min(top, x) <= Math.min(y, right);
      shade(c, x, y, e === 0 ? 0.7 : lit ? 1.26 - 0.04 * e : 0.62 + 0.06 * e);
      tint(c, x, y, lit ? [1.06, 1.05, 0.92] : [0.92, 0.8, 0.66]);
      lift(c, x, y, e / b);
      return;
    }
    let f = 1 + (vnoise(px, py, 2, 16, salt) - 0.5) * 0.18;
    const s = (x + y) % n;
    if (s >= 9 && s < 14) { f *= 1.18; tint(c, x, y, [1.05, 1.05, 0.95]); }
    else if (s === 16) f *= 1.1;
    shade(c, x, y, f);
    lift(c, x, y, 1);
  });
  for (let i = 0; i < 3; i++) {
    let x = b + hash01(i, 3, salt) * (n - 2 * b), y = b + hash01(i, 5, salt) * (n - 2 * b);
    for (let d = 0; d < 5; d++, x += 1, y -= 0.6) shade(c, x, y, 1 - depth * 0.4);
  }
}

/** Gold trim: bevelled rails top and bottom, a groove along the middle, studs between. */
function trimBand(c, recipe, salt, depth) {
  const n = TILE, w = recipe.band;
  each((x, y, px, py) => {
    const fromTop = n - 1 - y;
    if (y < w || fromTop < w) {
      const r = y < w ? y : fromTop, upper = fromTop < w ? fromTop : w - 1 - y;
      shade(c, x, y, r === 0 ? 0.62 : upper <= 1 ? 1.24 : 0.82);
      lift(c, x, y, r / w);
      return;
    }
    if (y === n / 2 - 1) { shade(c, x, y, 1 - depth); lift(c, x, y, 0); return; }
    if (y === n / 2) { shade(c, x, y, 1.18); lift(c, x, y, 0.5); return; }
    if (y === w) shade(c, x, y, 0.84);
    let f = 1 + (vnoise(px, py, 2, 16, salt) - 0.5) * 0.14;
    // Studs every 8 along, one above and one below the groove.
    for (const sy of [n / 4 + 1, (3 * n) / 4 - 1]) {
      const sx = Math.round((x - 4) / 8) * 8 + 4, dx = x - sx, dy = y - sy;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) f *= dy >= 0 && dx <= 0 ? 1.3 : 0.75;
    }
    shade(c, x, y, f);
    lift(c, x, y, 0.8);
  });
}

/**
 * Obsidian and amethyst: glassy faces where the stone fractured, each sloping
 * its own way so it catches the light differently, a glint along the edges
 * and a sheen of colour (`sheen`) running across.
 */
function facets(c, recipe, salt, depth) {
  const k = recipe.facets, pts = scatter(k, k, 0.45, salt), r = TILE / k / 2;
  const sheen = recipe.sheen ?? [1.2, 1.2, 1.2];
  each((x, y, px, py) => {
    const { d1, d2, p, dx, dy } = nearest(pts, px, py);
    const a = p.h * Math.PI * 2;
    let f = 0.86 + p.h2 * 0.2 + 0.24 * ((dx * Math.cos(a) + dy * Math.sin(a)) / r);
    lift(c, x, y, 0.5 + 0.5 * ((dx * Math.cos(a) + dy * Math.sin(a)) / r));
    if (d2 - d1 < 1) { f = Math.cos(a) > 0 ? 1.55 : 1 - depth; if (f > 1) tint(c, x, y, sheen, 0.8); }
    const s = ((x - y) % TILE + TILE) % TILE;
    if (s >= 5 && s < 9) { f *= 1.3; tint(c, x, y, sheen, 0.7); }
    shade(c, x, y, Math.max(0.3, f));
  });
  for (let g = 0; g < 7; g++) {
    const x = Math.floor(hash01(g, 61, salt) * TILE), y = Math.floor(hash01(g, 67, salt) * TILE);
    shade(c, x, y, 1.9); tint(c, x, y, sheen);
  }
}

/**
 * Lava: molten rock swirling bright, with plates of darker crust floating on
 * it and the cracks round each plate glowing hottest.
 */
function crust(c, recipe, salt, depth) {
  const k = recipe.crust, pts = scatter(k, k, 0.42, salt);
  const glow = recipe.glow ?? [1.1, 1.6, 1.8];
  each((x, y, px, py) => {
    const { d1, d2, p } = nearest(pts, px, py);
    const edge = d2 - d1, swirl = fbm(px + 3 * Math.sin(py / 5), py, salt + 7, 2, 3);
    if (p.h < 0.45 && edge > 1.4) {
      // A crust plate: dark, rough, warming towards its rim.
      shade(c, x, y, 1 - depth * (0.7 + 0.3 * vnoise(px, py, 8, 8, salt)) * Math.min(1, (edge - 1.4) / 2.5));
      setTint(c, x, y, edge < 3 ? [1, 0.9, 0.85] : [0.82, 0.62, 0.56]);
      return;
    }
    shade(c, x, y, 0.92 + swirl * 0.3);
    if (edge < 1.4 || swirl > 0.62) tint(c, x, y, glow, edge < 1.4 ? 1 : (swirl - 0.62) * 2.5);
  });
}

/** Glass: a thin frame, a bright line inside it, and two streaks of reflection. */
function frame(c, recipe, depth) {
  const n = TILE, w = recipe.frame;
  each((x, y) => {
    const e = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (e < w) shade(c, x, y, 1 - depth * (e === 0 ? 1.4 : 1));
    else if (e === w) shade(c, x, y, 1.14);
    const s = x + y;
    if ((s >= 18 && s < 22) || (s >= 25 && s < 27)) shade(c, x, y, 1.2);
  });
}

/** Moss: soft cushions, each lit on top, darker where they meet. */
function clumps(c, recipe, salt, depth) {
  const k = Math.round(Math.sqrt(recipe.clumps)), pts = scatter(k, k, 0.45, salt), r = TILE / k / 2;
  const fl = recipe.flecks ?? [[1, 1, 1]];
  each((x, y, px, py) => {
    const { d1, d2, p, dy } = nearest(pts, px, py);
    let f = 0.86 + 0.24 * Math.sqrt(Math.max(0, 1 - (d1 / (r * 1.5)) ** 2));
    if (dy > r * 0.3) f *= 1.06;
    if (d2 - d1 < 1.1) f *= 1 - depth * 0.6;
    shade(c, x, y, f);
    tint(c, x, y, pick(fl, p.h2), 0.6);
  });
}

/** Forest floor: fallen leaves in the colours of autumn, and twigs. */
const LITTER = [[1.45, 1.0, 0.56], [1.32, 1.18, 0.72], [0.9, 1.08, 0.74], [0.62, 0.54, 0.5], [1.28, 0.82, 0.62]];
function litter(c, recipe, salt, depth) {
  for (let l = 0; l < recipe.litter; l++) {
    const cx = hash01(l, 3, salt) * TILE, cy = hash01(l, 5, salt) * TILE;
    const rx = 1 + hash01(l, 7, salt) * 1.3, ry = 0.7 + hash01(l, 9, salt) * 0.8, turn = hash01(l, 11, salt) < 0.5;
    const t = pick(LITTER, hash01(l, 13, salt)), f = 0.9 + hash01(l, 15, salt) * 0.25;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ex = turn ? dy : dx, ey = turn ? dx : dy;
        if ((ex / rx) ** 2 + (ey / ry) ** 2 > 1) continue;
        const i = at(cx + dx, cy + dy);
        c.L[i] = f * (dy > 0 ? 1.06 : 1);
        c.T[i * 3] = t[0]; c.T[i * 3 + 1] = t[1]; c.T[i * 3 + 2] = t[2];
      }
    }
  }
  for (let s = 0; s < 6; s++) {
    let x = hash01(s, 17, salt) * TILE, y = hash01(s, 19, salt) * TILE;
    const dx = hash01(s, 23, salt) - 0.5, dy = hash01(s, 29, salt) - 0.5, len = 4 + Math.floor(hash01(s, 31, salt) * 4);
    for (let d = 0; d < len; d++, x += dx * 2, y += dy * 2) { shade(c, x, y, 1 - depth * 0.8); tint(c, x, y, [0.8, 0.66, 0.54]); }
  }
}

/**
 * Leaves: a canopy of little leaves overlapping, each lit on its upper side,
 * coloured from `flecks` — yellow-green in the sun, blue-green in shade —
 * over the dark of the canopy behind them. `blossom` scatters flowers among
 * them; `holes` lets a pixel of light through.
 */
function leaves(c, recipe, salt, depth) {
  const fl = recipe.flecks ?? [[1, 1, 1]];
  each((x, y) => { const i = at(x, y); c.L[i] = 1 - depth * 0.8; setTint(c, x, y, [0.86, 0.96, 0.92]); });
  for (let l = 0; l < recipe.leaves; l++) {
    const cx = hash01(l, 3, salt) * TILE, cy = hash01(l, 5, salt) * TILE;
    const rx = 1.3 + hash01(l, 7, salt) * 1.1, ry = 0.9 + hash01(l, 9, salt) * 0.8, turn = hash01(l, 11, salt) < 0.5;
    const t = pick(fl, hash01(l, 13, salt)), tone = 0.9 + hash01(l, 15, salt) * 0.24;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const ex = turn ? dy : dx, ey = turn ? dx : dy;
        if ((ex / rx) ** 2 + (ey / ry) ** 2 > 1) continue;
        const i = at(cx + dx, cy + dy);
        c.L[i] = tone * (dy > 0 ? 1.12 : dy < 0 ? 0.92 : 1);
        c.T[i * 3] = t[0]; c.T[i * 3 + 1] = t[1]; c.T[i * 3 + 2] = t[2];
      }
    }
  }
  for (let b = 0; b < (recipe.blossom ?? 0); b++) {
    const x = Math.floor(hash01(b, 19, salt) * TILE), y = Math.floor(hash01(b, 23, salt) * TILE);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = at(x + dx, y + dy);
      c.L[i] = dx || dy ? 1.25 : 1.1;
      setTint(c, x + dx, y + dy, dx || dy ? [1.3, 1.0, 1.55] : [1.4, 1.25, 0.6]);
    }
  }
  for (let h = 0; h < (recipe.holes ?? 0); h++) {
    const x = Math.floor(hash01(h, 37, salt) * TILE), y = Math.floor(hash01(h, 41, salt) * TILE);
    c.L[at(x, y)] = 1.3;
  }
}

/** Grass from above: short blades, some lit, some in the shade of others. */
function blades(c, recipe, salt, depth) {
  const fl = recipe.flecks;
  for (let b = 0; b < recipe.blades; b++) {
    const x = Math.floor(hash01(b, 3, salt) * TILE), y = Math.floor(hash01(b, 5, salt) * TILE);
    const len = 2 + Math.floor(hash01(b, 7, salt) * 3), lit = hash01(b, 9, salt) < 0.45;
    const t = fl && hash01(b, 11, salt) < 0.5 ? pick(fl, hash01(b, 13, salt)) : null;
    const lean = hash01(b, 15, salt) < 0.5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      const px = x + (k === len - 1 && len > 2 ? lean : 0), py = y + k;
      shade(c, px, py, lit ? 1.08 + 0.08 * (k / len) : 1 - depth * (0.4 + 0.4 * (1 - k / len)));
      if (t) tint(c, px, py, t);
    }
  }
}

/** Ore: nuggets of metal (`nugget`) set in stone, with a dark rim and a glint. */
function ore(c, recipe, salt, depth) {
  const nug = recipe.nugget ?? [1.3, 1.3, 1.3];
  for (let o = 0; o < recipe.ore; o++) {
    const cx = hash01(o, 3, salt) * TILE, cy = hash01(o, 5, salt) * TILE;
    const bits = 2 + Math.floor(hash01(o, 7, salt) * 3);
    for (let b = 0; b < bits; b++) {
      const bx = cx + (hash01(o * 7 + b, 9, salt) - 0.5) * 4, by = cy + (hash01(o * 7 + b, 11, salt) - 0.5) * 4;
      const r = 1 + hash01(o * 7 + b, 13, salt) * 0.9;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = Math.floor(bx) + dx, y = Math.floor(by) + dy;
          const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
          const i = at(x, y);
          if (d <= r) {
            c.L[i] = (1.05 + hash01(x, y, salt + 3) * 0.2) * (y + 0.5 > by ? 1.12 : 0.92);
            setTint(c, x, y, nug);
            lift(c, x, y, 1);
          } else if (d <= r + 0.9 && c.T[i * 3] !== nug[0]) c.L[i] *= 1 - depth * 0.7;
        }
      }
    }
  }
}

/** Cracks: short wandering lines, a lit lip above each. */
function cracks(c, recipe, salt, depth) {
  for (let k = 0; k < recipe.cracks; k++) {
    let x = hash01(k, 11, salt) * TILE, y = hash01(k, 13, salt) * TILE;
    let a = hash01(k, 17, salt) * Math.PI * 2;
    const len = 10 + Math.floor(hash01(k, 19, salt) * 8);
    for (let i = 0; i < len; i++) {
      shade(c, x, y, 1 - depth * 0.9);
      shade(c, x, y + 1, 1 + depth * 0.25);
      a += (hash01(k, i, salt + 23) - 0.5) * 0.6;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
}

/**
 * Marks: the loose flecks that make a surface read as ground or rock rather
 * than paint, each tinted from `flecks` — warm and cool stones in grey rock,
 * grit and roots in earth. Two weights, so it does not look like even static,
 * and some lighter than the rest.
 */
function marks(c, recipe, salt, depth) {
  const fl = recipe.flecks;
  for (let m = 0; m < recipe.marks; m++) {
    const x = Math.floor(hash01(m, 23, salt) * TILE), y = Math.floor(hash01(m, 29, salt) * TILE);
    const heavy = hash01(m, 31, salt) < 0.35, light = hash01(m, 33, salt) < 0.3;
    const f = light ? 1 + depth * 0.4 : 1 - depth * (heavy ? 0.8 : 0.4);
    const t = fl ? pick(fl, hash01(m, 35, salt)) : null;
    const px = heavy ? [[0, 0], [1, 0], [0, 1], [1, 1]] : hash01(m, 37, salt) < 0.5 ? [[0, 0], [1, 0]] : [[0, 0]];
    for (const [dx, dy] of px) { shade(c, x + dx, y + dy, f); if (t) tint(c, x + dx, y + dy, t); }
  }
}

/** A bevel round a worked block: a dark outer line, lit along the top and left inside it. */
function edge(c, amount) {
  const n = TILE;
  each((x, y) => {
    const e = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (e === 0) shade(c, x, y, 1 - amount * 2);
    else if (e === 1) shade(c, x, y, y === n - 2 || x === 1 ? 1 + amount : 1 - amount * 0.6);
  });
}

/**
 * Cut-outs: pixels with nothing there at all, which the block shader
 * discards (see ChunkMesher's withBlockTextures). Small gaps of one or two
 * pixels, and the corners bitten off in a curve.
 */
function cutouts(c, recipe, salt) {
  const n = TILE;
  for (let g = 0; g < (recipe.gaps ?? 0); g++) {
    const x = 2 + Math.floor(hash01(g, 43, salt) * (n - 4)), y = 2 + Math.floor(hash01(g, 47, salt) * (n - 4));
    c.A[y * n + x] = 0;
    if (hash01(g, 53, salt) < 0.5) c.A[y * n + ((x + 1) % n)] = 0;
    else c.A[((y + 1) % n) * n + x] = 0;
  }
  const bite = recipe.bite ?? 0;
  each((x, y) => {
    if (Math.min(x, n - 1 - x) + Math.min(y, n - 1 - y) < bite) c.A[y * n + x] = 0;
  });
  // What a hole shows when it is blurred into the next mip down: canopy shadow.
  for (let i = 0; i < n * n; i++) if (!c.A[i]) c.L[i] = 0.5;
}

// --- into bytes ------------------------------------------------------------------

/**
 * A painted canvas as RGBA bytes, evened out so it averages to the block's
 * colour, with its heights hung on it.
 *
 * The evening out is what lets every recipe paint freely — lighter here,
 * darker there, a tint over that — without the block drifting off its
 * registry colour: the far hills (FarTerrain), the map, slabs and stairs all
 * use that colour plainly and still match the textured block, because the
 * texture's average is exactly it. A recipe with `lift: 0` keeps its own
 * brightness instead (a log's pale end against its dark bark), and so does a
 * grass side, whose earth is meant to be darker than its turf.
 */
function finish(c, recipe, spec) {
  const n = TILE, N = n * n;
  const light = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    for (let ch = 0; ch < 3; ch++) light[i * 3 + ch] = Math.max(0, c.L[i] * c.T[i * 3 + ch]) ** GAMMA;
  }
  const target = recipe.fringe ? 0 : recipe.lift ?? 1;
  if (target > 0) {
    // Weighted by how much each channel of this colour counts to the eye.
    const col = new THREE.Color(spec?.color ?? 0xffffff);
    const w = [0.2126 * col.r, 0.7152 * col.g, 0.0722 * col.b];
    const wsum = w[0] + w[1] + w[2] || 1;
    // A few rounds, since what is lifted past the byte's reach is clipped
    // and no longer counts in full (a dark block with bright glints).
    for (let round = 0; round < 4; round++) {
      let sum = 0, count = 0;
      for (let i = 0; i < N; i++) {
        if (!c.A[i]) continue;
        const v = (ch) => Math.min(TILE_SCALE, light[i * 3 + ch]);
        sum += (w[0] * v(0) + w[1] * v(1) + w[2] * v(2)) / wsum;
        count++;
      }
      const k = count && sum > 0 ? target / (sum / count) : 1;
      if (Math.abs(k - 1) < 0.005) break;
      for (let i = 0; i < N * 3; i++) light[i] *= k;
    }
  }
  const out = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = Math.round(Math.min(1, light[i * 3 + ch] / TILE_SCALE) * 255);
    out[i * 4 + 3] = c.A[i];
  }
  // Depth: the painter's own heights where it drew structure (stones,
  // mortar, seams); otherwise the dark parts are the low parts.
  let height = null;
  if (recipe.bump) {
    height = new Float32Array(N);
    if (c.H) height.set(c.H);
    else {
      let lo = Infinity, hi = -Infinity;
      for (const v of c.L) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let i = 0; i < N; i++) height[i] = hi > lo ? (c.L[i] - lo) / (hi - lo) : 0;
    }
    for (let i = 0; i < N; i++) height[i] *= recipe.bump;
  }
  // Shine: metal. Backlog batch 2: gold trim and gold ore "look like wood",
  // and should "shine a bit like gold". A tile can only change its block's
  // colour, so the shine is a mask of its own (see packBumps), which the
  // block shader turns into a highlight that follows the sun and your eye.
  // The bright parts of the tile shine, its dark lines and marks don't, and
  // `glints` are single pixels that shine at full strength — flecks in ore.
  let shine = null;
  if (recipe.shine || recipe.glints) {
    shine = new Float32Array(N);
    let lo = Infinity, hi = -Infinity;
    for (const v of c.L) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < N; i++) shine[i] = (recipe.shine ?? 0) * (hi > lo ? (c.L[i] - lo) / (hi - lo) : 1);
    const salt = spec?.id ?? 0;
    for (let g = 0; g < (recipe.glints ?? 0); g++) {
      const x = Math.floor(hash01(g, 59, salt) * TILE), y = Math.floor(hash01(g, 61, salt) * TILE);
      shine[at(x, y)] = 1; shine[at(x + 1, y)] = 1;
      // Most are a little patch, so they read at a distance.
      if (hash01(g, 67, salt) < 0.6) { shine[at(x, y + 1)] = 1; shine[at(x + 1, y + 1)] = 1; }
    }
  }
  out.height = height;
  out.shine = shine;
  return out;
}

/** What a tile byte means as a multiple of the block colour (for icons and tests). */
export const tileValue = (byte) => (byte / 255) * TILE_SCALE;

/**
 * The tiles' heights, as a second layered texture laid out like the first:
 * red is how high a pixel stands, alpha says whether the layer has any depth
 * at all (so a flat one costs the shader one lookup, not five), and green is
 * how much it shines (metal; see `shine` in paint).
 */
function packBumps(tiles) {
  const n = TILE;
  const data = new Uint8Array(n * n * 4 * tiles.length);
  tiles.forEach((tile, i) => {
    const h = tile.height, sh = tile.shine;
    for (let p = 0; p < n * n; p++) {
      const o = (i * n * n + p) * 4;
      if (h) {
        data[o] = Math.round(Math.max(0, Math.min(1, h[p])) * 255);
        data[o + 3] = 255;
      }
      if (sh) data[o + 1] = Math.round(Math.max(0, Math.min(1, sh[p])) * 255);
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

/** Stacks the tiles into one layered texture, with mipmaps for the distance. */
function pack(tiles) {
  const n = TILE;
  const data = new Uint8Array(n * n * 4 * tiles.length);
  tiles.forEach((tile, i) => data.set(tile, i * n * n * 4));
  const tex = new THREE.DataArrayTexture(data, n, n, tiles.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // Floors and walls are mostly seen at a slant; without this the mip for
  // the steep direction blurs a pavement flat a few blocks away.
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;   // multipliers, not colours to convert
  tex.needsUpdate = true;
  return tex;
}

/** Throws the tiles away. For a hard reset of the renderer. */
export function disposeTextures() {
  built?.texture?.dispose();
  built?.bumps?.dispose();
  built = null;
}
