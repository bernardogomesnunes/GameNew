/**
 * Fruit plants (FRUIT-3, FRUIT-4). A fruit seed goes in a Plant Pot and grows
 * over several game days into a plant four blocks high that bears fruit.
 *
 * The plant stands in the cells above the pot, one block per segment:
 *   sprout (1 cell)  ->  young (1 cell)  ->  grown (4 cells: base, low, mid, top)
 * and the grown plant's low, mid and top cells have a ripe variant that shows
 * fruit. Hitting a ripe plant picks the fruit (the plant stays, bare again);
 * it bears again after 1 to 2 game days. Breaking the pot, or the plant's
 * base, takes the whole plant away and gives the seed back.
 *
 * Block ids: the pot is POT_BLOCK. Kind k, segment s is
 * PLANT_BASE + k * SEGMENTS.length + s.
 */

export const POT_BLOCK = 572;
export const PLANT_BASE = 580;
/** Cell order in a block id's offset. */
export const SEGMENTS = ['sprout', 'young', 'base', 'low', 'mid', 'top', 'low_ripe', 'mid_ripe', 'top_ripe'];
/** The cells of a grown plant, bottom to top, above the pot. */
export const GROWN = ['base', 'low', 'mid', 'top'];

export const FRUIT_PLANTS = [
  { kind: 'apple', name: 'Apple Tree', fruit: 'apple', seed: 'seeds_apple', days: 5, leaf: 0x4f9a3f, leaf2: 0x66b04c, stem: 0x6f4d2f, crop: 0xd4443c },
  { kind: 'grape', name: 'Grape Vine', fruit: 'grape', seed: 'seeds_grape', days: 4, leaf: 0x5a9a3c, leaf2: 0x76b24a, stem: 0x7a5a3a, crop: 0x7b3f9c },
  { kind: 'raspberry', name: 'Raspberry Bush', fruit: 'raspberry', seed: 'seeds_raspberry', days: 3, leaf: 0x3f8a3a, leaf2: 0x58a24a, stem: 0x7a4a3a, crop: 0xc2305a },
  { kind: 'passion', name: 'Passion Fruit Vine', fruit: 'passion_fruit', seed: 'seeds_passion', days: 4, leaf: 0x3f8f52, leaf2: 0x5fad62, stem: 0x6b5a3a, crop: 0x8a4a86 },
];
export const FRUIT_PLANTS_BY_KIND = new Map(FRUIT_PLANTS.map((p) => [p.kind, p]));
export const FRUIT_SEEDS = FRUIT_PLANTS.map((p) => p.seed);

/** Fractions of the growing time at which a plant leaves each look. */
export const YOUNG_AT = 0.35, GROWN_AT = 0.7;
/** Fruit picked per hit on a ripe plant, and the days it takes to bear again. */
export const PICK_MIN = 2, PICK_MAX = 4;
export const REGROW_MIN = 1, REGROW_MAX = 2;

export const plantBlock = (kind, segment) => {
  const k = FRUIT_PLANTS.findIndex((p) => p.kind === kind);
  return PLANT_BASE + k * SEGMENTS.length + SEGMENTS.indexOf(segment);
};
/** Every plant block id, in order. */
export const PLANT_IDS = FRUIT_PLANTS.flatMap((p) => SEGMENTS.map((s) => plantBlock(p.kind, s)));

/** { kind, segment } for a plant block, or null. */
export function plantOf(id) {
  const n = id - PLANT_BASE;
  if (!(n >= 0 && n < FRUIT_PLANTS.length * SEGMENTS.length)) return null;
  return { kind: FRUIT_PLANTS[Math.floor(n / SEGMENTS.length)].kind, segment: SEGMENTS[n % SEGMENTS.length] };
}

/** The ripe variant of a grown segment, or the segment itself if it bears no fruit. */
export const ripeOf = (segment) => (segment === 'low' || segment === 'mid' || segment === 'top' ? `${segment}_ripe` : segment);
export const isRipeSegment = (segment) => segment.endsWith('_ripe');

// ---- how they look -------------------------------------------------------------

const box = (x0, y0, z0, x1, y1, z1, color) => ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, color });

/** A pot, standing in its cell: terracotta with a rim and dark soil. */
export function potBoxes() {
  return [
    box(0.22, 0, 0.22, 0.78, 0.1, 0.78, 0x9c4f33),
    box(0.16, 0.1, 0.16, 0.84, 0.48, 0.84, 0xb85f3c),
    box(0.12, 0.48, 0.12, 0.88, 0.6, 0.88, 0xc46c45),
    box(0.2, 0.6, 0.2, 0.8, 0.64, 0.8, 0x5a3b26),
  ];
}

/** Fruit spots per segment: [x, y, z] of the fruit's low corner, inside the foliage. */
const FRUIT_SPOTS = {
  apple: {
    low: [[0.22, 0.5, 0.3], [0.64, 0.6, 0.6]],
    mid: [[0.1, 0.3, 0.4], [0.7, 0.5, 0.2], [0.4, 0.2, 0.72], [0.72, 0.28, 0.66]],
    top: [[0.3, 0.3, 0.3], [0.6, 0.2, 0.55]],
  },
  grape: {
    low: [[0.3, 0.2, 0.34], [0.58, 0.3, 0.58]],
    mid: [[0.2, 0.15, 0.3], [0.62, 0.25, 0.3], [0.4, 0.1, 0.64]],
    top: [[0.34, 0.2, 0.4]],
  },
  raspberry: {
    low: [[0.2, 0.4, 0.3], [0.66, 0.5, 0.56]],
    mid: [[0.18, 0.3, 0.5], [0.66, 0.4, 0.26], [0.44, 0.55, 0.7]],
    top: [[0.32, 0.3, 0.32], [0.56, 0.2, 0.56]],
  },
  passion: {
    low: [[0.24, 0.4, 0.5], [0.64, 0.5, 0.28]],
    mid: [[0.18, 0.2, 0.28], [0.66, 0.35, 0.6], [0.4, 0.55, 0.7]],
    top: [[0.3, 0.3, 0.3], [0.58, 0.2, 0.58]],
  },
};
const FRUIT_SIZE = { apple: [0.16, 0.16], grape: [0.12, 0.22], raspberry: [0.1, 0.1], passion: [0.14, 0.16] };

/** Boxes (unit cell) of one segment of one kind of plant. */
export function plantBoxes(kind, segment) {
  const p = FRUIT_PLANTS_BY_KIND.get(kind);
  const ripe = isRipeSegment(segment);
  const seg = ripe ? segment.slice(0, -5) : segment;
  const out = [];
  const stem = (h, y0 = 0, y1 = 1) => {
    if (kind === 'apple') return [box(0.5 - h, y0, 0.5 - h, 0.5 + h, y1, 0.5 + h, p.stem)];
    if (kind === 'raspberry') {
      return [box(0.3, y0, 0.3, 0.3 + h, y1, 0.3 + h, p.stem), box(0.6, y0, 0.36, 0.6 + h, y1, 0.36 + h, p.stem), box(0.44, y0, 0.62, 0.44 + h, y1, 0.62 + h, p.stem)];
    }
    // Vines climb a stake.
    return [box(0.5 - h, y0, 0.5 - h, 0.5 + h, y1, 0.5 + h, p.stem), box(0.44, y0, 0.3, 0.46, y1, 0.32, 0x8a6a44)];
  };
  const stemW = { apple: 0.1, grape: 0.04, raspberry: 0.04, passion: 0.04 }[kind];
  if (seg === 'sprout') {
    out.push(box(0.46, 0, 0.46, 0.54, 0.22, 0.54, p.stem), box(0.3, 0.16, 0.44, 0.46, 0.22, 0.56, p.leaf2), box(0.54, 0.2, 0.44, 0.7, 0.26, 0.56, p.leaf2));
  } else if (seg === 'young') {
    out.push(...stem(stemW, 0, 0.8));
    out.push(box(0.24, 0.3, 0.24, 0.76, 0.5, 0.76, p.leaf), box(0.32, 0.5, 0.32, 0.68, 0.76, 0.68, p.leaf2), box(0.4, 0.76, 0.4, 0.6, 0.92, 0.6, p.leaf2));
  } else if (seg === 'base') {
    out.push(...stem(stemW * (kind === 'apple' ? 1.25 : 1)));
    out.push(box(0.2, 0, 0.3, 0.8, 0.12, 0.7, p.leaf), box(0.3, 0, 0.2, 0.7, 0.12, 0.8, p.leaf));
  } else if (seg === 'low') {
    out.push(...stem(stemW));
    out.push(box(0.2, 0.4, 0.2, 0.8, 0.7, 0.8, p.leaf), box(0.3, 0.7, 0.3, 0.7, 0.85, 0.7, p.leaf2));
  } else if (seg === 'mid') {
    out.push(...stem(stemW));
    if (kind === 'apple') out.push(box(0.04, 0.15, 0.04, 0.96, 0.6, 0.96, p.leaf), box(0.14, 0.6, 0.14, 0.86, 0.9, 0.86, p.leaf2));
    else out.push(box(0.12, 0.2, 0.12, 0.88, 0.55, 0.88, p.leaf), box(0.22, 0.55, 0.22, 0.78, 0.85, 0.78, p.leaf2));
  } else {
    out.push(...stem(stemW, 0, 0.5));
    if (kind === 'apple') out.push(box(0.14, 0.1, 0.14, 0.86, 0.55, 0.86, p.leaf), box(0.28, 0.55, 0.28, 0.72, 0.85, 0.72, p.leaf2));
    else out.push(box(0.2, 0.1, 0.2, 0.8, 0.5, 0.8, p.leaf), box(0.32, 0.5, 0.32, 0.68, 0.78, 0.68, p.leaf2));
  }
  if (ripe) {
    const [w, h] = FRUIT_SIZE[kind];
    for (const [x, y, z] of FRUIT_SPOTS[kind][seg] ?? []) out.push(box(x, y, z, x + w, y + h, z + w, p.crop));
    if (kind === 'passion') {
      const f = FRUIT_SPOTS.passion[seg][0];
      out.push(box(f[0] + 0.2, f[1] + 0.15, f[2] + 0.14, f[0] + 0.3, f[1] + 0.2, f[2] + 0.24, 0xf4eefa));
    }
  }
  return out;
}
