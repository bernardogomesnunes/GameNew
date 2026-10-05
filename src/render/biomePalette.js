import { BIOMES } from '../config/biomes.js';
import { BLOCKS_BY_ID, WATER } from '../config/blocks.js';

/**
 * What colour to paint a biome, on anything that draws the land from above
 * or from a distance rather than block by block — FarTerrain's coarse mesh,
 * the minimap, the full map.
 *
 * Read from the block registry rather than written out again here, so every
 * one of these views is made of the same greens and greys as the ground
 * underfoot and cannot drift out of step with it or each other.
 */

/** One CSS colour per biome, in BIOMES order, taken from whatever it puts on top. */
export function biomeCssColours() {
  return BIOMES.map((b) => {
    let c = BLOCKS_BY_ID.get(b.surface.top)?.color ?? 0x5b9c3f;
    // Two biomes on the same ground (birch woods and plains are both grass)
    // still read apart: one is tinted with its own leaves (`mapTint`).
    const tint = b.mapTint != null ? BLOCKS_BY_ID.get(b.mapTint)?.color : null;
    if (tint != null) c = mix(c, tint, 0.4);
    return cssHex(darken(c, 0.92));
  });
}

/** The same blue the real water blocks are, so no view of the land invents its own. */
export function waterCssColour() {
  return cssHex(BLOCKS_BY_ID.get(WATER)?.color ?? 0x83add7);
}

function mix(a, b, t) {
  const ch = (h, s) => (h >> s) & 255;
  const at = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (at(16) << 16) | (at(8) << 8) | at(0);
}

function darken(hex, factor) {
  const r = Math.round(((hex >> 16) & 255) * factor);
  const g = Math.round(((hex >> 8) & 255) * factor);
  const b = Math.round((hex & 255) * factor);
  return (r << 16) | (g << 8) | b;
}

function cssHex(hex) {
  return `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
}
