import { BLOCKS_BY_ID } from './blocks.js';
import { GLYPHS, inkOn } from './glyphs.js';

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
  if (spec.block != null) return hasCube(spec.block) ? cubeSvg(spec.block, { size }) : null;
  return null;
}
