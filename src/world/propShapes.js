import { CROPS, RIPE, cropBoxes } from '../config/crops.js';

/**
 * What a non-cube block actually looks like: a handful of boxes in unit-cell
 * space (0..1 on every axis), assembled by PropRenderer into real geometry
 * instead of the plain cube ChunkMesher draws for everything else.
 *
 * Every shape here is drawn at facing 0; a block placed facing another way
 * (a stair, a chair, a door — see blocks.js's TURNS) has its boxes put
 * through `turn` first.
 */
/** Where a shut door stands across its cell: 3/16 thick, in the middle. */
const DOOR_Z0 = 0.40625, DOOR_Z1 = 0.59375;

export const PROP_SHAPES = {
  slab: [
    { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 },
  ],
  // Requested directly: "stairs need three steps, and to have stair until
  // the end of the block, filling the back until the top, or else there
  // will be a hole when doing stairs." Three steps of a third, climbing
  // towards -z, the back one reaching the top of the cell — so the next
  // stair up a flight starts level with where this one ends.
  stair: [
    { minX: 0, maxX: 1, minY: 0, maxY: 1 / 3, minZ: 0, maxZ: 1 },
    { minX: 0, maxX: 1, minY: 1 / 3, maxY: 2 / 3, minZ: 0, maxZ: 2 / 3 },
    { minX: 0, maxX: 1, minY: 2 / 3, maxY: 1, minZ: 0, maxZ: 1 / 3 },
  ],
  table: [
    { minX: 0.06, maxX: 0.94, minY: 0.52, maxY: 0.62, minZ: 0.06, maxZ: 0.94 }, // top
    { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.52, minZ: 0.08, maxZ: 0.18 },
    { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.52, minZ: 0.08, maxZ: 0.18 },
    { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.52, minZ: 0.82, maxZ: 0.92 },
    { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.52, minZ: 0.82, maxZ: 0.92 },
  ],
  chair: [
    { minX: 0.15, maxX: 0.85, minY: 0.42, maxY: 0.5, minZ: 0.15, maxZ: 0.85 }, // seat
    { minX: 0.15, maxX: 0.85, minY: 0.5, maxY: 0.95, minZ: 0.75, maxZ: 0.85 }, // backrest
    { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.42, minZ: 0.18, maxZ: 0.26 },
    { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.42, minZ: 0.18, maxZ: 0.26 },
    { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.42, minZ: 0.74, maxZ: 0.82 },
    { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.42, minZ: 0.74, maxZ: 0.82 },
  ],
  // Unjoined defaults; the mesher uses fenceBoxes, which joins them up.
  fence: [
    { minX: 0.375, maxX: 0.625, minY: 0, maxY: 1, minZ: 0.375, maxZ: 0.625 },
  ],
  gate: [
    { minX: 0, maxX: 1, minY: 0.25, maxY: 0.375, minZ: 0.4375, maxZ: 0.5625 },
    { minX: 0, maxX: 1, minY: 0.5, maxY: 0.625, minZ: 0.4375, maxZ: 0.5625 },
    { minX: 0, maxX: 1, minY: 0.75, maxY: 0.875, minZ: 0.4375, maxZ: 0.5625 },
  ],
  gate_open: [
    { minX: 0.0625, maxX: 0.1875, minY: 0.25, maxY: 0.875, minZ: 0, maxZ: 1 },
  ],
  rug: [
    { minX: 0.03, maxX: 0.97, minY: 0, maxY: 0.04, minZ: 0.03, maxZ: 0.97 },
  ],
  // A door, shut, across the middle of its cell, hinged at x = 0. The
  // bottom half has a handle on both faces; the top half a window.
  door: [
    { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: DOOR_Z0, maxZ: DOOR_Z1 },
    { minX: 0.78, maxX: 0.9, minY: 0.86, maxY: 0.96, minZ: DOOR_Z0 - 0.06, maxZ: DOOR_Z1 + 0.06 },
  ],
  door_top: [
    { minX: 0, maxX: 0.2, minY: 0, maxY: 1, minZ: DOOR_Z0, maxZ: DOOR_Z1 },
    { minX: 0.8, maxX: 1, minY: 0, maxY: 1, minZ: DOOR_Z0, maxZ: DOOR_Z1 },
    { minX: 0.2, maxX: 0.8, minY: 0, maxY: 0.3, minZ: DOOR_Z0, maxZ: DOOR_Z1 },
    { minX: 0.2, maxX: 0.8, minY: 0.8, maxY: 1, minZ: DOOR_Z0, maxZ: DOOR_Z1 },
    { minX: 0.47, maxX: 0.53, minY: 0.3, maxY: 0.8, minZ: DOOR_Z0 + 0.06, maxZ: DOOR_Z1 - 0.06 },
  ],
};

/** Dark iron, for the metal of a lantern or a chandelier. */
const IRON = 0x4a4340;
/** Glass with a flame behind it, and candle wax: drawn lit, whatever the time of day. */
const FLAME = 0xffd98f, WAX = 0xf6eedc, WICK = 0xffb347;

// A lantern standing on the floor: an iron base and cap, four corner posts,
// lit glass between them, and a handle on top.
PROP_SHAPES.lantern = [
  { minX: 0.3, maxX: 0.7, minY: 0, maxY: 0.06, minZ: 0.3, maxZ: 0.7, color: IRON },
  { minX: 0.35, maxX: 0.65, minY: 0.06, maxY: 0.5, minZ: 0.35, maxZ: 0.65, color: FLAME, glow: true },
  ...[[0.3, 0.3], [0.64, 0.3], [0.3, 0.64], [0.64, 0.64]].map(([x, z]) =>
    ({ minX: x, maxX: x + 0.06, minY: 0.06, maxY: 0.5, minZ: z, maxZ: z + 0.06, color: IRON })),
  { minX: 0.28, maxX: 0.72, minY: 0.5, maxY: 0.57, minZ: 0.28, maxZ: 0.72, color: IRON },
  { minX: 0.4, maxX: 0.6, minY: 0.57, maxY: 0.64, minZ: 0.4, maxZ: 0.6, color: IRON },
  { minX: 0.42, maxX: 0.46, minY: 0.64, maxY: 0.78, minZ: 0.48, maxZ: 0.52, color: IRON },
  { minX: 0.54, maxX: 0.58, minY: 0.64, maxY: 0.78, minZ: 0.48, maxZ: 0.52, color: IRON },
  { minX: 0.42, maxX: 0.58, minY: 0.74, maxY: 0.78, minZ: 0.48, maxZ: 0.52, color: IRON },
];

// A chandelier hanging from the top of its cell: a chain, a hub, a cross of
// arms, and a candle burning at the end of each.
PROP_SHAPES.chandelier = [
  { minX: 0.47, maxX: 0.53, minY: 0.7, maxY: 1, minZ: 0.47, maxZ: 0.53, color: IRON },
  { minX: 0.4, maxX: 0.6, minY: 0.6, maxY: 0.7, minZ: 0.4, maxZ: 0.6, color: IRON },
  { minX: 0.1, maxX: 0.9, minY: 0.6, maxY: 0.64, minZ: 0.47, maxZ: 0.53, color: IRON },
  { minX: 0.47, maxX: 0.53, minY: 0.6, maxY: 0.64, minZ: 0.1, maxZ: 0.9, color: IRON },
  ...[[0.1, 0.44], [0.78, 0.44], [0.44, 0.1], [0.44, 0.78]].flatMap(([x, z]) => [
    { minX: x, maxX: x + 0.12, minY: 0.64, maxY: 0.67, minZ: z, maxZ: z + 0.12, color: IRON },
    { minX: x + 0.03, maxX: x + 0.09, minY: 0.67, maxY: 0.79, minZ: z + 0.03, maxZ: z + 0.09, color: WAX, glow: true },
    { minX: x + 0.045, maxX: x + 0.075, minY: 0.79, maxY: 0.85, minZ: z + 0.045, maxZ: z + 0.075, color: WICK, glow: true },
  ]),
];

// A chest: a wooden body and a slightly wider lid, iron bands over both, iron
// corners, and a latch on the front (-z, so it faces you the way a chair
// does — see Game.placedBlock).
const OAK = 0x9a6b3f, LID = 0xa87a4a;
PROP_SHAPES.chest = [
  { minX: 0.07, maxX: 0.93, minY: 0, maxY: 0.58, minZ: 0.12, maxZ: 0.88, color: OAK },
  { minX: 0.05, maxX: 0.95, minY: 0.58, maxY: 0.8, minZ: 0.1, maxZ: 0.9, color: LID },
  // Bands, front to back over the lid and down both faces.
  ...[0.22, 0.72].flatMap((x) => [
    { minX: x, maxX: x + 0.06, minY: 0.8, maxY: 0.83, minZ: 0.09, maxZ: 0.91, color: IRON },
    { minX: x, maxX: x + 0.06, minY: 0, maxY: 0.8, minZ: 0.09, maxZ: 0.11, color: IRON },
    { minX: x, maxX: x + 0.06, minY: 0, maxY: 0.8, minZ: 0.89, maxZ: 0.91, color: IRON },
  ]),
  // The rim where the lid meets the body.
  { minX: 0.06, maxX: 0.94, minY: 0.56, maxY: 0.6, minZ: 0.105, maxZ: 0.895, color: IRON },
  // The latch.
  { minX: 0.44, maxX: 0.56, minY: 0.48, maxY: 0.68, minZ: 0.06, maxZ: 0.1, color: 0xc9a44c },
];

// Crops: every stage of every one — see config/crops.js.
for (const c of CROPS) for (let s = 0; s <= RIPE; s++) PROP_SHAPES[`crop_${c.kind}_${s}`] = cropBoxes(c.kind, s);

// Swung open on its hinge: the same door, lying flat against the side of
// the doorway rather than across it.
PROP_SHAPES.door_open = PROP_SHAPES.door.map(swing);
PROP_SHAPES.door_open_top = PROP_SHAPES.door_top.map(swing);

function swing(b) {
  return {
    minX: Math.max(0, b.minZ - DOOR_Z0), maxX: b.maxZ - DOOR_Z0,
    minY: b.minY, maxY: b.maxY,
    minZ: b.minX, maxZ: b.maxX,
  };
}

/**
 * Boxes turned by `facing` quarter-turns about the middle of the cell —
 * each turn takes a point at (x, z) to (1 - z, x), so what faces -z at
 * facing 0 faces +x at 1, +z at 2 and -x at 3.
 */
export function turn(boxes, facing) {
  facing &= 3;
  if (!facing) return boxes;
  return boxes.map((b) => {
    let { minX, maxX, minZ, maxZ } = b;
    for (let i = 0; i < facing; i++) {
      [minX, maxX, minZ, maxZ] = [1 - maxZ, 1 - minZ, minX, maxX];
    }
    return { ...b, minX, maxX, minZ, maxZ };
  });
}

/**
 * A rug, run out to the edge of its cell on each side with another rug
 * beside it — requested directly: "rugs should connect to each other when
 * they are placed next side by side." A floor of them reads as one carpet
 * instead of a grid of mats.
 */
export function rugBoxes(joins) {
  return [{
    minX: joins.nx ? 0 : 0.03, maxX: joins.px ? 1 : 0.97,
    minY: 0, maxY: 0.04,
    minZ: joins.nz ? 0 : 0.03, maxZ: joins.pz ? 1 : 0.97,
  }];
}

/**
 * A fence or gate, joined to whichever of its four sides has another fence,
 * a gate or a wall beside it — so a line of them reads as one fence rather
 * than a row of posts. `joins` is { px, nx, pz, nz } (east, west, south,
 * north). A fence always has its post; a gate has no post and spans its
 * cell along whichever way it joins, as three rails.
 */
export function fenceBoxes(shape, joins) {
  const boxes = [];
  if (shape === 'fence') {
    boxes.push({ minX: 0.375, maxX: 0.625, minY: 0, maxY: 1, minZ: 0.375, maxZ: 0.625 });
    for (const [lo, hi] of [[0.375, 0.5625], [0.75, 0.9375]]) {
      if (joins.px) boxes.push({ minX: 0.625, maxX: 1, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
      if (joins.nx) boxes.push({ minX: 0, maxX: 0.375, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
      if (joins.pz) boxes.push({ minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0.625, maxZ: 1 });
      if (joins.nz) boxes.push({ minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0, maxZ: 0.375 });
    }
    return boxes;
  }
  // A gate runs along z only when it joins that way and not along x.
  const alongZ = (joins.pz || joins.nz) && !(joins.px || joins.nx);
  if (shape === 'gate_open') {
    // Swung open on its hinge at one end: the same three rails, turned to
    // lie against the side of the gap rather than across it.
    const out = [];
    for (const [lo, hi] of [[0.25, 0.375], [0.5, 0.625], [0.75, 0.875]]) {
      out.push(alongZ
        ? { minX: 0, maxX: 1, minY: lo, maxY: hi, minZ: 0.0625, maxZ: 0.1875 }
        : { minX: 0.0625, maxX: 0.1875, minY: lo, maxY: hi, minZ: 0, maxZ: 1 });
    }
    out.push(alongZ
      ? { minX: 0.45, maxX: 0.55, minY: 0.2, maxY: 0.9, minZ: 0.0625, maxZ: 0.1875 }
      : { minX: 0.0625, maxX: 0.1875, minY: 0.2, maxY: 0.9, minZ: 0.45, maxZ: 0.55 });
    return out;
  }
  for (const [lo, hi] of [[0.25, 0.375], [0.5, 0.625], [0.75, 0.875]]) {
    boxes.push(alongZ
      ? { minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0, maxZ: 1 }
      : { minX: 0, maxX: 1, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
  }
  // A brace across the middle, so it reads as a gate and not a gap in the rails.
  boxes.push(alongZ
    ? { minX: 0.4375, maxX: 0.5625, minY: 0.2, maxY: 0.9, minZ: 0.45, maxZ: 0.55 }
    : { minX: 0.45, maxX: 0.55, minY: 0.2, maxY: 0.9, minZ: 0.4375, maxZ: 0.5625 });
  return boxes;
}

/** The boxes for a shape, or the slab's if a new shape id has none registered yet. */
export function boxesFor(shape) {
  return PROP_SHAPES[shape] ?? PROP_SHAPES.slab;
}
