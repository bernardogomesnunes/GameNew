import { BLOCKS_BY_ID, shapeOf } from './blocks.js';
import { GLYPHS, inkOn } from './glyphs.js';
import { boxesFor, fenceBoxes } from '../world/propShapes.js';

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
    body += poly([p(b.minX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.maxZ), p(b.minX, b.maxY, b.maxZ)], shade(c, FACE.top));
    body += poly([p(b.minX, b.maxY, b.maxZ), p(b.maxX, b.maxY, b.maxZ), p(b.maxX, b.minY, b.maxZ), p(b.minX, b.minY, b.maxZ)], shade(c, FACE.left));
    body += poly([p(b.maxX, b.maxY, b.minZ), p(b.maxX, b.maxY, b.maxZ), p(b.maxX, b.minY, b.maxZ), p(b.maxX, b.minY, b.minZ)], shade(c, FACE.right));
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
