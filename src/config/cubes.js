import { BLOCKS_BY_ID, shapeOf } from './blocks.js';
import { GLYPHS, inkOn } from './glyphs.js';
import { boxesFor, fenceBoxes } from '../world/propShapes.js';
import { slopeGeometry, orient } from '../world/slopes.js';
import { tileFor, TILE_SIZE } from '../render/BlockTextures.js';

/**
 * Blocks drawn as blocks: a little isometric cube, three faces, one colour.
 *
 * A bag full of flat coloured squares with a line drawing on each says "this
 * is an icon for a thing". A bag full of cubes says "this is the thing" —
 * which it is, since every one of them is about to be a block in the world.
 * The slot and the world should be showing you the same object.
 *
 * Three faces from one colour, so adding a block needs no artwork: the top
 * lit, the left in half shadow, the right darker still. That is the whole of
 * the shading model in the world too, which is why a cube in the bag and a
 * cube on the ground read as the same material.
 *
 * Things that are not blocks — an axe, a bucket, a handful of seeds — keep
 * their line drawing. A cube would be a lie about what you are holding.
 */

/** Face brightness, top then left then right. Matches the world's lighting. */
const FACE = { top: 1.0, left: 0.74, right: 0.55 };

/**
 * A texture hint per material, drawn on the top face only.
 *
 * Deliberately small: a few marks at a quarter opacity, in the same ink the
 * glyphs use. Enough that grass reads as grass and stone as stone at 40
 * pixels, without turning a flat palette into a noisy one. Coordinates are in
 * the top face's own space, which is the diamond from (0,0) to (1,1).
 */
const GRAIN = {
  grass: [[0.30, 0.42], [0.55, 0.30], [0.70, 0.56], [0.42, 0.66]],
  moss: [[0.34, 0.36], [0.60, 0.44], [0.46, 0.62], [0.24, 0.55]],
  dirt: [[0.35, 0.40], [0.62, 0.52], [0.44, 0.65]],
  sand: [[0.30, 0.50], [0.52, 0.36], [0.66, 0.60]],
  gravel: [[0.28, 0.44], [0.50, 0.32], [0.64, 0.52], [0.40, 0.62], [0.58, 0.70]],
  clay: [[0.36, 0.46], [0.58, 0.54]],
  stone: [[0.32, 0.38], [0.58, 0.48], [0.46, 0.64]],
  cobble: [[0.30, 0.40], [0.56, 0.34], [0.64, 0.58], [0.38, 0.62]],
  snow: [[0.40, 0.44], [0.58, 0.58]],
  planks: [[0.26, 0.46], [0.46, 0.46], [0.66, 0.46]],
  log: [[0.44, 0.48], [0.56, 0.52]],
  leaf: [[0.32, 0.40], [0.56, 0.36], [0.62, 0.60], [0.38, 0.64]],
  brick: [[0.30, 0.40], [0.58, 0.40], [0.44, 0.60]],
  farmland: [[0.28, 0.44], [0.48, 0.44], [0.68, 0.44]],
};

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** A hex colour scaled towards black, as a CSS string. */
export function shade(color, amount) {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  return `rgb(${clamp(r * amount)},${clamp(g * amount)},${clamp(b * amount)})`;
}

const faceImages = new Map();

/**
 * A block's world texture as a tiny image, tinted its colour — a 16×16 BMP,
 * because a BMP is a header and the pixels, nothing to compress, and every
 * browser draws one.
 */
function tileImage(blockId, color) {
  if (faceImages.has(blockId)) return faceImages.get(blockId);
  const tile = tileFor(blockId);
  let url = null;
  if (tile) {
    const n = TILE_SIZE, row = n * 3, size = 54 + row * n;
    const bytes = new Uint8Array(size);
    const dv = new DataView(bytes.buffer);
    bytes[0] = 0x42; bytes[1] = 0x4d;
    dv.setUint32(2, size, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true);
    dv.setInt32(18, n, true); dv.setInt32(22, n, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, row * n, true);
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const level = tile[(y * n + x) * 4] / 255;
        const o = 54 + (n - 1 - y) * row + x * 3; // BMP rows run bottom up
        bytes[o] = Math.round(b * level); bytes[o + 1] = Math.round(g * level); bytes[o + 2] = Math.round(r * level);
      }
    }
    let bin = '';
    for (const byte of bytes) bin += String.fromCharCode(byte);
    url = `data:image/bmp;base64,${btoa(bin)}`;
  }
  faceImages.set(blockId, url);
  return url;
}

/**
 * The three faces of a textured cube: the tile laid onto each face of the
 * diamond, and a shadow over the two sides so it reads as lit from above.
 */
function texturedFaces(blockId, color) {
  const url = tileImage(blockId, color);
  if (!url) return null;
  // Each face as the unit square carried onto it: matrix(U, V, origin).
  const faces = [
    { m: [9.4, 5.3, -9.4, 5.3, 12, 2.6], path: 'M12 2.6 L21.4 7.9 L12 13.2 L2.6 7.9 Z', light: FACE.top },
    { m: [9.4, 5.3, 0, 8.2, 2.6, 7.9], path: 'M2.6 7.9 L12 13.2 L12 21.4 L2.6 16.1 Z', light: FACE.left },
    { m: [9.4, -5.3, 0, 8.2, 12, 13.2], path: 'M21.4 7.9 L21.4 16.1 L12 21.4 L12 13.2 Z', light: FACE.right },
  ];
  // The image once, and the three faces use it.
  // The same id for the same block everywhere: whichever copy a face finds,
  // it's the same picture.
  const id = `tile-${blockId}`;
  return `<defs><image id="${id}" href="${url}" width="1" height="1" preserveAspectRatio="none" style="image-rendering:pixelated"/></defs>`
    + faces.map((f) => `<use href="#${id}" transform="matrix(${f.m.join(' ')})"/>`
      + (f.light < 1 ? `<path d="${f.path}" fill="#000" opacity="${(1 - f.light).toFixed(2)}"/>` : '')).join('');
}

/**
 * An isometric cube for a block, as inline SVG.
 *
 * @param blockId  which block; its colour and grain come from the registry
 * @param size     the drawn size in pixels
 * @param glass    draw it translucent, for the see-through blocks
 */
export function cubeSvg(blockId, { size = 22 } = {}) {
  const spec = BLOCKS_BY_ID.get(blockId);
  if (!spec) return '';
  const c = spec.color ?? 0x888888;
  const alpha = spec.transparent ? 0.62 : 1;

  // A 24-wide box holding a cube two units tall at the corners. The numbers
  // are the standard 2:1 isometric diamond, fitted to the box with a margin.
  const top = `M12 2.6 L21.4 7.9 L12 13.2 L2.6 7.9 Z`;
  const left = `M2.6 7.9 L12 13.2 L12 21.4 L2.6 16.1 Z`;
  const right = `M21.4 7.9 L21.4 16.1 L12 21.4 L12 13.2 Z`;

  // Reported directly: "bricks icon is different from the brick itself, I
  // think it is worth it to review all of them." A block with a texture in
  // the world is drawn with that same texture here, on all three faces.
  const texture = texturedFaces(blockId, c);
  if (texture) {
    return `<svg class="cube" viewBox="0 0 24 24" width="${size}" height="${size}"`
      + ` aria-hidden="true" opacity="${alpha}">${texture}</svg>`;
  }

  const ink = inkOn(c);
  const grain = GRAIN[spec.glyph] ?? null;
  // Marks sit on the top face, mapped through the diamond so they lie flat on
  // it rather than floating over the drawing.
  const marks = (grain ?? []).map(([u, v]) => {
    const x = 12 + (u - 0.5) * 9.4 + (v - 0.5) * 9.4;
    const y = 7.9 + (u - 0.5) * 5.3 - (v - 0.5) * 5.3;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="0.72" fill="${ink}" opacity="0.28"/>`;
  }).join('');

  return `<svg class="cube" viewBox="0 0 24 24" width="${size}" height="${size}"`
    + ` aria-hidden="true" opacity="${alpha}">`
    + `<path d="${top}" fill="${shade(c, FACE.top)}"/>`
    + `<path d="${left}" fill="${shade(c, FACE.left)}"/>`
    + `<path d="${right}" fill="${shade(c, FACE.right)}"/>`
    + marks
    + `</svg>`;
}

/**
 * A shaped block — a slab, stairs, a table or chair, a rug, a fence or gate —
 * drawn as the thing it actually is, in the same projection and light as the
 * cube above. Reported directly: they all showed as plain cubes in the bag,
 * so a chair and a stone slab were two same-looking boxes in different
 * colours.
 *
 * Built from the very boxes the world draws them with (world/propShapes.js),
 * so the icon can't drift from the real thing. A fence is shown with its
 * rails running through, and a gate shut, the way you'd place them.
 */
export function shapeSvg(blockId, { size = 22 } = {}) {
  const spec = BLOCKS_BY_ID.get(blockId);
  if (!spec) return '';
  const shape = shapeOf(blockId);
  if (shape.startsWith('roof')) {
    const style = spec.roof?.mat === 1 ? 'slate' : 'clay';
    return facesSvg(slopeGeometry(shape, 0, null, { style }).faces, spec.color ?? 0x888888, size);
  }
  const boxes = shape === 'fence' || shape === 'gate' || shape === 'gate_open'
    ? fenceBoxes(shape, { px: 1, nx: 1 })
    : shape === 'door'
      // Both halves, squeezed into the one cell the icon has room for.
      ? [...boxesFor('door').map((b) => squeeze(b, 0)), ...boxesFor('door_top').map((b) => squeeze(b, 1))]
      : boxesFor(shape);
  const c = spec.color ?? 0x888888;
  // Unit cell to the cube icon's own frame: x runs down-right, z down-left,
  // y up — the same diamond cubeSvg draws, so a slab sits where half a cube
  // would.
  const p = (x, y, z) => `${(12 + (x - z) * 9.4).toFixed(2)} ${(2.6 + (x + z) * 5.3 + (1 - y) * 8.2).toFixed(2)}`;
  const poly = (pts, fill) => `<path d="M${pts.join(' L')} Z" fill="${fill}" stroke="rgba(0,0,0,0.14)" stroke-width="0.3" stroke-linejoin="round"/>`;
  // Far boxes first, so nearer ones paint over them.
  const order = [...boxes].sort((a, b) =>
    (a.minX + a.maxX + a.minZ + a.maxZ + a.minY + a.maxY) - (b.minX + b.maxX + b.minZ + b.maxZ + b.minY + b.maxY));
  let body = '';
  for (const b of order) {
    // A box can carry its own colour (a lantern's iron frame), and a lit one
    // (its glass) isn't shaded.
    const bc = b.color ?? c;
    const f = b.glow ? { top: 1, left: 1, right: 1 } : FACE;
    body += poly([p(b.minX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.maxZ), p(b.minX, b.maxY, b.maxZ)], shade(bc, f.top));
    body += poly([p(b.minX, b.maxY, b.maxZ), p(b.maxX, b.maxY, b.maxZ), p(b.maxX, b.minY, b.maxZ), p(b.minX, b.minY, b.maxZ)], shade(bc, f.left));
    body += poly([p(b.maxX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.maxZ), p(b.maxX, b.minY, b.maxZ), p(b.maxX, b.minY, b.minZ)], shade(bc, f.right));
  }
  return `<svg class="cube" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

/** A sloped piece drawn from its polygons: far ones first, backs left out. */
function facesSvg(faces, c, size) {
  const p = (x, y, z) => `${(12 + (x - z) * 9.4).toFixed(2)} ${(2.6 + (x + z) * 5.3 + (1 - y) * 8.2).toFixed(2)}`;
  const drawn = faces
    .map((f) => orient(f.pts, f.out).n && { ...f, ...orient(f.pts, f.out) })
    .filter((f) => f.n[0] + f.n[1] + f.n[2] > 1e-3)
    // The bed under the tiles goes first, whatever its middle says: it's one
    // big face under all of them.
    .map((f) => ({ ...f, depth: f.bed ? -Infinity : f.pts.reduce((s, [x, y, z]) => s + x + y + z, 0) / f.pts.length }))
    .sort((a, b) => a.depth - b.depth);
  let body = '';
  for (const f of drawn) {
    const [nx, ny, nz] = f.n;
    const light = (FACE.top * ny * ny + FACE.left * nz * nz + FACE.right * nx * nx) * (f.tone ?? 1);
    const fc = typeof f.color === 'number' ? f.color : c;
    body += `<path d="M${f.pts.map(([x, y, z]) => p(x, y, z)).join(' L')} Z" fill="${shade(fc, light)}" stroke="rgba(0,0,0,0.12)" stroke-width="0.2" stroke-linejoin="round"/>`;
  }
  return `<svg class="cube" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

/** A door box, half `half` of two, fitted into one cell a little narrower than it's tall. */
function squeeze(b, half) {
  return {
    minX: 0.2 + b.minX * 0.6, maxX: 0.2 + b.maxX * 0.6,
    minY: (half + b.minY) / 2, maxY: (half + b.maxY) / 2,
    minZ: b.minZ, maxZ: b.maxZ,
  };
}

/** A block's icon: a cube, or its real shape if it isn't one. */
export function blockIcon(blockId, { size = 22 } = {}) {
  return shapeOf(blockId) === 'cube' ? cubeSvg(blockId, { size }) : shapeSvg(blockId, { size });
}

/** Whether this block should be drawn as a cube rather than a line glyph. */
export function hasCube(blockId) {
  return BLOCKS_BY_ID.has(blockId) && !BLOCKS_BY_ID.get(blockId)?.system;
}

/**
 * The icon for a thing in a slot: a cube when it is a block, its drawing when
 * it is not.
 *
 * One place that decides, so the bag, the hotbar and the workbench cannot
 * disagree about what an item looks like. Returns null when the caller should
 * fall back to a line glyph — a tool or a handful of seeds is not a cube, and
 * drawing one would be a lie about what you are holding.
 */
export function itemIcon(spec, { size = 22 } = {}) {
  if (!spec) return null;
  // An item that places a block shows that block.
  if (spec.block != null) {
    if (!hasCube(spec.block)) return null;
    return blockIcon(spec.block, { size });
  }
  return null;
}
