/**
 * Crops. Requested directly: "Farm should be dirt, and should have crops to
 * plant there, so add a couple of seeds from crops like carrots that we
 * already have, potatoes, cabbage, lettuce, peppers, zucchini and broccoli.
 * Seeds and fruit."
 *
 * Each crop is three things: its seeds (an item you plant), the plant (four
 * blocks, one per stage of growth, standing on farmland), and what it gives
 * (an item you eat). Carrots are the vegetables the game already had.
 *
 * A planted seed grows a stage every STAGE_SECONDS, whether you're watching
 * or not (see duilt/Crops.js). Broken ripe, a plant gives its crop and seeds
 * to plant again; broken early, just its seed back.
 */

/** Seconds a crop spends in each stage — ripe in about four and a half minutes. */
export const STAGE_SECONDS = 90;
/** The last stage: ripe, ready to pick. */
export const RIPE = 3;

export const CROPS = [
  { kind: 'carrot', name: 'Carrot', produce: 'vegetables', leaf: 0x6ea653, crop: 0xe8873a },
  { kind: 'potato', name: 'Potato', produce: 'potato', leaf: 0x75a55a, crop: 0xc9a46c },
  { kind: 'cabbage', name: 'Cabbage', produce: 'cabbage', leaf: 0x7fae5e, crop: 0xa9cf86 },
  { kind: 'lettuce', name: 'Lettuce', produce: 'lettuce', leaf: 0x8cc463, crop: 0xb6de86 },
  { kind: 'pepper', name: 'Pepper', produce: 'pepper', leaf: 0x5c9a48, crop: 0xd84a3c },
  { kind: 'zucchini', name: 'Zucchini', produce: 'zucchini', leaf: 0x5f9a4c, crop: 0x3f7a35 },
  { kind: 'broccoli', name: 'Broccoli', produce: 'broccoli', leaf: 0x5a8f4a, crop: 0x3e7b3c },
];
export const CROPS_BY_KIND = new Map(CROPS.map((c) => [c.kind, c]));

/** Block ids: stage s of crop k is CROP_BASE + 4k + s. */
export const CROP_BASE = 119;
export const cropBlock = (kind, stage = 0) => CROP_BASE + 4 * CROPS.findIndex((c) => c.kind === kind) + stage;
/** { kind, stage } for a crop block, or null. */
export function cropOf(id) {
  const i = id - CROP_BASE;
  if (!Number.isInteger(i) || i < 0 || i >= CROPS.length * 4) return null;
  return { kind: CROPS[i >> 2].kind, stage: i & 3 };
}

// ---- how they look -------------------------------------------------------------

const box = (x0, y0, z0, x1, y1, z1, color) => ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, color });

/** A tuft of leaves `h` tall and `w` across, centred in the cell. */
function tuft(h, w, color) {
  const a = 0.5 - w / 2, b = 0.5 + w / 2, t = 0.07;
  return [
    box(0.5 - t, 0, a, 0.5 + t, h, b, color),
    box(a, 0, 0.5 - t, b, h * 0.85, 0.5 + t, color),
    box(0.5 - w * 0.35, 0, 0.5 - w * 0.35, 0.5 + w * 0.35, h * 0.55, 0.5 + w * 0.35, color),
  ];
}

/** What a crop looks like at each stage, in unit-cell boxes each with its own colour. */
export function cropBoxes(kind, stage) {
  const c = CROPS_BY_KIND.get(kind);
  if (stage === 0) {
    // Two sprouts just through the soil.
    return [box(0.3, 0, 0.44, 0.36, 0.1, 0.5, c.leaf), box(0.62, 0, 0.52, 0.68, 0.12, 0.58, c.leaf)];
  }
  if (stage === 1) return tuft(0.22, 0.3, c.leaf);
  if (stage === 2) return tuft(0.4, 0.5, c.leaf);
  switch (kind) {
    case 'carrot': return [...tuft(0.55, 0.45, c.leaf), box(0.42, 0, 0.42, 0.58, 0.1, 0.58, c.crop)];
    case 'potato': return [...tuft(0.45, 0.6, c.leaf), box(0.12, 0, 0.14, 0.28, 0.1, 0.28, c.crop), box(0.7, 0, 0.66, 0.86, 0.11, 0.82, c.crop), box(0.66, 0, 0.14, 0.8, 0.09, 0.28, c.crop)];
    case 'cabbage': return [
      box(0.14, 0, 0.14, 0.86, 0.1, 0.86, c.leaf),
      box(0.24, 0.08, 0.24, 0.76, 0.42, 0.76, c.crop),
      box(0.32, 0.42, 0.32, 0.68, 0.5, 0.68, c.crop),
    ];
    case 'lettuce': return [
      box(0.16, 0, 0.3, 0.84, 0.16, 0.7, c.leaf),
      box(0.3, 0, 0.16, 0.7, 0.16, 0.84, c.leaf),
      box(0.3, 0.1, 0.3, 0.7, 0.3, 0.7, c.crop),
    ];
    case 'pepper': return [
      ...tuft(0.6, 0.55, c.leaf),
      box(0.22, 0.24, 0.4, 0.34, 0.42, 0.52, c.crop),
      box(0.62, 0.3, 0.56, 0.74, 0.48, 0.68, c.crop),
      box(0.46, 0.36, 0.2, 0.58, 0.52, 0.32, c.crop),
    ];
    case 'zucchini': return [
      box(0.12, 0, 0.12, 0.88, 0.14, 0.88, c.leaf),
      box(0.3, 0.14, 0.3, 0.7, 0.34, 0.7, c.leaf),
      box(0.1, 0, 0.62, 0.72, 0.16, 0.8, c.crop),
    ];
    case 'broccoli': return [
      box(0.2, 0, 0.2, 0.8, 0.18, 0.8, c.leaf),
      box(0.44, 0, 0.44, 0.56, 0.42, 0.56, 0xa6c98a),
      box(0.26, 0.36, 0.26, 0.74, 0.62, 0.74, c.crop),
      box(0.34, 0.62, 0.34, 0.66, 0.7, 0.66, c.crop),
    ];
    default: return tuft(0.5, 0.5, c.leaf);
  }
}
