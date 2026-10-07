import { CROPS, RIPE, cropBoxes } from '../config/crops.js';
import { toneHex } from '../config/blocks.js';

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
  slab_top: [
    { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 },
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

// A catapult, drawn just after a throw: the arm up against its stop with
// the cup at the top and a stone ready in it. A frame on four wheels, two
// uprights and a crossbar, the arm on an iron axle. It throws towards -z,
// its front; the cup rises a little over the cell, so it reads from afar.
const FRAME = 0x8a6440, DARK_WOOD = 0x5e4128, SHOT = 0x9a9aa2;
PROP_SHAPES.catapult = [
  // Rails and cross-beams.
  { minX: 0.08, maxX: 0.2, minY: 0.12, maxY: 0.26, minZ: 0.04, maxZ: 0.96, color: FRAME },
  { minX: 0.8, maxX: 0.92, minY: 0.12, maxY: 0.26, minZ: 0.04, maxZ: 0.96, color: FRAME },
  { minX: 0.2, maxX: 0.8, minY: 0.14, maxY: 0.24, minZ: 0.08, maxZ: 0.18, color: FRAME },
  { minX: 0.2, maxX: 0.8, minY: 0.14, maxY: 0.24, minZ: 0.82, maxZ: 0.92, color: FRAME },
  // Wheels, with iron hubs.
  ...[[0, 0.08], [0.92, 1]].flatMap(([x0, x1]) => [0.1, 0.64].flatMap((z) => [
    { minX: x0, maxX: x1, minY: 0, maxY: 0.28, minZ: z, maxZ: z + 0.26, color: DARK_WOOD },
    { minX: x0 === 0 ? -0.02 : 1, maxX: x0 === 0 ? 0 : 1.02, minY: 0.1, maxY: 0.18, minZ: z + 0.09, maxZ: z + 0.17, color: IRON },
  ])),
  // Uprights and the crossbar the arm stops against.
  { minX: 0.2, maxX: 0.28, minY: 0.24, maxY: 0.92, minZ: 0.4, maxZ: 0.5, color: FRAME },
  { minX: 0.72, maxX: 0.8, minY: 0.24, maxY: 0.92, minZ: 0.4, maxZ: 0.5, color: FRAME },
  { minX: 0.2, maxX: 0.8, minY: 0.84, maxY: 0.94, minZ: 0.4, maxZ: 0.5, color: DARK_WOOD },
  // The axle, and the arm rising forward from it in steps.
  { minX: 0.2, maxX: 0.8, minY: 0.3, maxY: 0.38, minZ: 0.52, maxZ: 0.6, color: IRON },
  { minX: 0.44, maxX: 0.56, minY: 0.3, maxY: 0.52, minZ: 0.5, maxZ: 0.62, color: DARK_WOOD },
  { minX: 0.44, maxX: 0.56, minY: 0.52, maxY: 0.74, minZ: 0.44, maxZ: 0.56, color: DARK_WOOD },
  { minX: 0.44, maxX: 0.56, minY: 0.74, maxY: 0.96, minZ: 0.37, maxZ: 0.49, color: DARK_WOOD },
  { minX: 0.44, maxX: 0.56, minY: 0.96, maxY: 1.12, minZ: 0.3, maxZ: 0.42, color: DARK_WOOD },
  // The cup, and a stone in it.
  { minX: 0.34, maxX: 0.66, minY: 1.1, maxY: 1.16, minZ: 0.18, maxZ: 0.46, color: FRAME },
  { minX: 0.34, maxX: 0.66, minY: 1.16, maxY: 1.24, minZ: 0.16, maxZ: 0.2, color: FRAME },
  { minX: 0.34, maxX: 0.66, minY: 1.16, maxY: 1.24, minZ: 0.44, maxZ: 0.48, color: FRAME },
  { minX: 0.4, maxX: 0.6, minY: 1.16, maxY: 1.32, minZ: 0.22, maxZ: 0.42, color: SHOT },
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

// ---- Phase 7a: the decorative pack ------------------------------------------

/**
 * A stone wall: a post where the run turns, ends or meets another, and a
 * thick low wall out to each side it joins — one straight piece when it
 * just runs through. Like fenceBoxes, `joins` says which of the four sides
 * have another wall to join.
 *
 * Backlog batch 2: `up` — a wall stacked on this one — takes the arms to the
 * top of the cell, so a wall two high is one wall with no gap along it; and
 * `post` keeps the post even on a straight run, for where a fence comes in
 * from the side (the fence's rails run into the post — see fenceStubs —
 * rather than the wall reaching out to meet the fence).
 */
export function wallBoxes({ px = 0, nx = 0, pz = 0, nz = 0, up = 0, post = 0 } = {}) {
  const lo = 0.3125, hi = 0.6875, top = up ? 1 : 0.8125;
  if (!post && px && nx && !pz && !nz) return [{ minX: 0, maxX: 1, minY: 0, maxY: top, minZ: lo, maxZ: hi }];
  if (!post && pz && nz && !px && !nx) return [{ minX: lo, maxX: hi, minY: 0, maxY: top, minZ: 0, maxZ: 1 }];
  const out = [{ minX: 0.25, maxX: 0.75, minY: 0, maxY: 1, minZ: 0.25, maxZ: 0.75 }];
  if (px) out.push({ minX: 0.75, maxX: 1, minY: 0, maxY: top, minZ: lo, maxZ: hi });
  if (nx) out.push({ minX: 0, maxX: 0.25, minY: 0, maxY: top, minZ: lo, maxZ: hi });
  if (pz) out.push({ minX: lo, maxX: hi, minY: 0, maxY: top, minZ: 0.75, maxZ: 1 });
  if (nz) out.push({ minX: lo, maxX: hi, minY: 0, maxY: top, minZ: 0, maxZ: 0.25 });
  return out;
}

/**
 * The ends of a fence's rails that reach into a wall's cell, from the edge
 * on `side` ('px', 'nx', 'pz' or 'nz') to the wall's post — drawn in the
 * fence's colour, so the fence runs into the post and stops there.
 */
export function fenceStubs(side, shape = 'fence') {
  const rails = shape === 'fence' ? [[0.375, 0.5625], [0.75, 0.9375]] : [[0.25, 0.375], [0.5, 0.625], [0.75, 0.875]];
  return rails.map(([minY, maxY]) => {
    if (side === 'px') return { minX: 0.75, maxX: 1, minY, maxY, minZ: 0.4375, maxZ: 0.5625 };
    if (side === 'nx') return { minX: 0, maxX: 0.25, minY, maxY, minZ: 0.4375, maxZ: 0.5625 };
    if (side === 'pz') return { minX: 0.4375, maxX: 0.5625, minY, maxY, minZ: 0.75, maxZ: 1 };
    return { minX: 0.4375, maxX: 0.5625, minY, maxY, minZ: 0, maxZ: 0.25 };
  });
}

/**
 * A pillar: a fluted-looking shaft (two boxes crossed, so it reads round),
 * with a base when nothing pillar-like is under it and a capital when
 * nothing is over it — so a stack of them is one column, not a pile.
 */
export function pillarBoxes({ base = true, capital = true } = {}) {
  const y0 = base ? 0.22 : 0, y1 = capital ? 0.8 : 1;
  const out = [
    { minX: 0.22, maxX: 0.78, minY: y0, maxY: y1, minZ: 0.3, maxZ: 0.7 },
    { minX: 0.3, maxX: 0.7, minY: y0, maxY: y1, minZ: 0.22, maxZ: 0.78 },
  ];
  if (base) {
    out.push({ minX: 0.06, maxX: 0.94, minY: 0, maxY: 0.12, minZ: 0.06, maxZ: 0.94 });
    out.push({ minX: 0.14, maxX: 0.86, minY: 0.12, maxY: 0.22, minZ: 0.14, maxZ: 0.86 });
  }
  if (capital) {
    out.push({ minX: 0.14, maxX: 0.86, minY: 0.8, maxY: 0.88, minZ: 0.14, maxZ: 0.86 });
    out.push({ minX: 0.06, maxX: 0.94, minY: 0.88, maxY: 1, minZ: 0.06, maxZ: 0.94 });
  }
  return out;
}
/**
 * A chimney's flue: four walls round a hollow, a lip round the top of the
 * top one (`top`). Stacked, the walls run on unbroken (ChunkMesher looks
 * above each one, as it does for pillars).
 */
export function chimneyBoxes({ top = true } = {}) {
  const a = 0.14, b = 0.86, t = 0.16, y1 = top ? 0.84 : 1;
  const out = [
    { minX: a, maxX: b, minY: 0, maxY: y1, minZ: a, maxZ: a + t },
    { minX: a, maxX: b, minY: 0, maxY: y1, minZ: b - t, maxZ: b },
    { minX: a, maxX: a + t, minY: 0, maxY: y1, minZ: a + t, maxZ: b - t },
    { minX: b - t, maxX: b, minY: 0, maxY: y1, minZ: a + t, maxZ: b - t },
  ];
  if (top) {
    const c = 0.06, d = 0.94, w = 0.2;
    out.push(
      { minX: c, maxX: d, minY: y1, maxY: 1, minZ: c, maxZ: c + w },
      { minX: c, maxX: d, minY: y1, maxY: 1, minZ: d - w, maxZ: d },
      { minX: c, maxX: c + w, minY: y1, maxY: 1, minZ: c + w, maxZ: d - w },
      { minX: d - w, maxX: d, minY: y1, maxY: 1, minZ: c + w, maxZ: d - w },
    );
  }
  return out;
}
/**
 * A sand path (#33): a sixteenth under the ground beside it, its corners
 * rounded off wherever neither side round that corner runs on into more path
 * — so a single block is a rounded patch, and a run of them a winding track.
 * `joins` is { px, nx, pz, nz }, as for a rug.
 */
export const PATH_TOP = 0.9375;
export function pathBoxes(joins = {}) {
  const H = PATH_TOP, r = 0.25, q = 0.1;
  const nn = !joins.nx && !joins.nz, pn = !joins.px && !joins.nz, np = !joins.nx && !joins.pz, pp = !joins.px && !joins.pz;
  const out = [
    { minX: r, maxX: 1 - r, minY: 0, maxY: H, minZ: 0, maxZ: 1 },
    { minX: 0, maxX: r, minY: 0, maxY: H, minZ: nn ? r : 0, maxZ: np ? 1 - r : 1 },
    { minX: 1 - r, maxX: 1, minY: 0, maxY: H, minZ: pn ? r : 0, maxZ: pp ? 1 - r : 1 },
  ];
  // A step into each rounded corner, so it curves rather than notches.
  if (nn) out.push({ minX: q, maxX: r, minY: 0, maxY: H, minZ: q, maxZ: r });
  if (pn) out.push({ minX: 1 - r, maxX: 1 - q, minY: 0, maxY: H, minZ: q, maxZ: r });
  if (np) out.push({ minX: q, maxX: r, minY: 0, maxY: H, minZ: 1 - r, maxZ: 1 - q });
  if (pp) out.push({ minX: 1 - r, maxX: 1 - q, minY: 0, maxY: H, minZ: 1 - r, maxZ: 1 - q });
  return out;
}
PROP_SHAPES.path = pathBoxes();

/**
 * What a path's rounded corners leave open (asked for directly: "Rounded
 * sand paths should fill the space with the block around texture"): for
 * each corner it rounds, the boxes the rounding cut away, and which way the
 * ground beside it lies — so the mesher fills the gap with that ground,
 * rather than leaving a notch down to the block below. Full height: they
 * are part of the ground the path is cut into.
 *   [{ boxes, sides: [dx, dz][] }] — sides nearest first, then the diagonal.
 */
export function pathCornerGaps(joins = {}) {
  const r = 0.25, q = 0.1, out = [];
  const corner = (cx, cz) => {
    // The corner square at (cx, cz) ∈ {0,1}², less the step pathBoxes puts in it.
    const x0 = cx ? 1 - r : 0, x1 = cx ? 1 : r, z0 = cz ? 1 - r : 0, z1 = cz ? 1 : r;
    const ex0 = cx ? 1 - q : 0, ex1 = cx ? 1 : q, ez0 = cz ? 1 - q : 0, ez1 = cz ? 1 : q;
    return [
      { minX: ex0, maxX: ex1, minY: 0, maxY: 1, minZ: z0, maxZ: z1 },
      { minX: cx ? x0 : ex1, maxX: cx ? ex0 : x1, minY: 0, maxY: 1, minZ: ez0, maxZ: ez1 },
    ];
  };
  for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const xs = cx ? 'px' : 'nx', zs = cz ? 'pz' : 'nz';
    if (joins[xs] || joins[zs]) continue;
    const sx = cx ? 1 : -1, sz = cz ? 1 : -1;
    out.push({ boxes: corner(cx, cz), sides: [[sx, 0], [0, sz], [sx, sz]] });
  }
  return out;
}
// The wood mill (#32), facing 0 with its front to -z: a sawbench on four
// legs, a round blade standing up through the middle of it, a log on the
// bench waiting for it, and the crank on its side.
const MILL_DARK = 0x5e4128, BLADE = 0xc9ced6, BLADE_EDGE = 0xeef1f5;
PROP_SHAPES.wood_mill = [
  { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.72, minZ: 0.1, maxZ: 0.2, color: MILL_DARK },
  { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.72, minZ: 0.1, maxZ: 0.2, color: MILL_DARK },
  { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.72, minZ: 0.8, maxZ: 0.9, color: MILL_DARK },
  { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.72, minZ: 0.8, maxZ: 0.9, color: MILL_DARK },
  { minX: 0.12, maxX: 0.88, minY: 0.3, maxY: 0.36, minZ: 0.14, maxZ: 0.86, color: MILL_DARK },
  { minX: 0.04, maxX: 0.96, minY: 0.72, maxY: 0.84, minZ: 0.06, maxZ: 0.94 },
  // The blade: a disc, as a cross of two thin slabs, and its bright edge.
  { minX: 0.49, maxX: 0.51, minY: 0.62, maxY: 1.06, minZ: 0.34, maxZ: 0.66, color: BLADE },
  { minX: 0.49, maxX: 0.51, minY: 0.7, maxY: 0.98, minZ: 0.26, maxZ: 0.74, color: BLADE },
  { minX: 0.495, maxX: 0.505, minY: 1.04, maxY: 1.08, minZ: 0.42, maxZ: 0.58, color: BLADE_EDGE },
  // A log on the bench, and the crank.
  { minX: 0.14, maxX: 0.44, minY: 0.84, maxY: 1.0, minZ: 0.32, maxZ: 0.68, color: 0x93704c },
  { minX: 0.14, maxX: 0.16, minY: 0.86, maxY: 0.98, minZ: 0.36, maxZ: 0.64, color: 0xc9a072 },
  { minX: 0.94, maxX: 0.98, minY: 0.36, maxY: 0.66, minZ: 0.44, maxZ: 0.56, color: MILL_DARK },
  { minX: 0.94, maxX: 1, minY: 0.62, maxY: 0.68, minZ: 0.44, maxZ: 0.7, color: MILL_DARK },
];

// The stone mill, facing 0 with its front to -z: a block of dressed stone
// for a base, a grindstone standing up in a wooden frame on top of it, its
// axle through the frame, and a crank on the side.
const GRIND = 0xb9b4aa, GRIND_EDGE = 0xd6d1c6, MILL_FRAME = 0x6b4a33;
PROP_SHAPES.stone_mill = [
  { minX: 0.06, maxX: 0.94, minY: 0, maxY: 0.5, minZ: 0.1, maxZ: 0.9 },
  { minX: 0.02, maxX: 0.98, minY: 0.5, maxY: 0.56, minZ: 0.06, maxZ: 0.94, tone: 1.12 },
  // The frame: two uprights and the axle across between them.
  { minX: 0.16, maxX: 0.24, minY: 0.56, maxY: 1.04, minZ: 0.44, maxZ: 0.56, color: MILL_FRAME },
  { minX: 0.76, maxX: 0.84, minY: 0.56, maxY: 1.04, minZ: 0.44, maxZ: 0.56, color: MILL_FRAME },
  { minX: 0.24, maxX: 0.76, minY: 0.84, maxY: 0.9, minZ: 0.47, maxZ: 0.53, color: MILL_FRAME },
  // The grindstone: a thick disc, as a cross of two slabs, standing up across the axle.
  { minX: 0.4, maxX: 0.6, minY: 0.6, maxY: 1.14, minZ: 0.34, maxZ: 0.66, color: GRIND },
  { minX: 0.4, maxX: 0.6, minY: 0.7, maxY: 1.04, minZ: 0.24, maxZ: 0.76, color: GRIND },
  { minX: 0.38, maxX: 0.62, minY: 1.1, maxY: 1.16, minZ: 0.42, maxZ: 0.58, color: GRIND_EDGE },
  // A trough for what it grinds, at the front, and the crank.
  { minX: 0.28, maxX: 0.72, minY: 0.56, maxY: 0.66, minZ: 0.1, maxZ: 0.26, color: MILL_FRAME },
  { minX: 0.84, maxX: 0.9, minY: 0.84, maxY: 0.9, minZ: 0.47, maxZ: 0.53, color: MILL_FRAME },
  { minX: 0.88, maxX: 0.94, minY: 0.7, maxY: 0.9, minZ: 0.47, maxZ: 0.53, color: MILL_FRAME },
];

// Furniture from the mill, fronts to -z (they face you, like a chest).
// The top a shade lighter than the body, whatever wood it's in (`tone`, see
// boxColor); the handles and kick plate dark iron.
const HANDLE = 0x4a3a2c;
PROP_SHAPES.cabinet = [
  { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.86, minZ: 0.08, maxZ: 0.96 },
  { minX: 0, maxX: 1, minY: 0.86, maxY: 0.92, minZ: 0.04, maxZ: 1, tone: 1.18 },
  { minX: 0.08, maxX: 0.49, minY: 0.08, maxY: 0.8, minZ: 0.05, maxZ: 0.08 },
  { minX: 0.51, maxX: 0.92, minY: 0.08, maxY: 0.8, minZ: 0.05, maxZ: 0.08 },
  { minX: 0.43, maxX: 0.47, minY: 0.4, maxY: 0.54, minZ: 0.02, maxZ: 0.05, color: HANDLE },
  { minX: 0.53, maxX: 0.57, minY: 0.4, maxY: 0.54, minZ: 0.02, maxZ: 0.05, color: HANDLE },
  { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.06, minZ: 0.06, maxZ: 0.09, color: HANDLE },
];
// Taller than you: it stands up past its own block, the way a banner does.
PROP_SHAPES.wardrobe = [
  { minX: 0.02, maxX: 0.98, minY: 0, maxY: 1.86, minZ: 0.1, maxZ: 0.98 },
  { minX: 0, maxX: 1, minY: 1.86, maxY: 1.94, minZ: 0.06, maxZ: 1, tone: 1.35 },
  { minX: 0.06, maxX: 0.49, minY: 0.12, maxY: 1.8, minZ: 0.07, maxZ: 0.1 },
  { minX: 0.51, maxX: 0.94, minY: 0.12, maxY: 1.8, minZ: 0.07, maxZ: 0.1 },
  { minX: 0.43, maxX: 0.47, minY: 0.9, maxY: 1.1, minZ: 0.04, maxZ: 0.07, color: HANDLE },
  { minX: 0.53, maxX: 0.57, minY: 0.9, maxY: 1.1, minZ: 0.04, maxZ: 0.07, color: HANDLE },
  { minX: 0.02, maxX: 0.98, minY: 0, maxY: 0.08, minZ: 0.08, maxZ: 0.11, color: HANDLE },
];
PROP_SHAPES.bedside_table = [
  { minX: 0.16, maxX: 0.84, minY: 0.06, maxY: 0.54, minZ: 0.18, maxZ: 0.84 },
  { minX: 0.1, maxX: 0.9, minY: 0.54, maxY: 0.6, minZ: 0.12, maxZ: 0.9, tone: 1.13 },
  { minX: 0.2, maxX: 0.8, minY: 0.32, maxY: 0.5, minZ: 0.15, maxZ: 0.18 },
  { minX: 0.46, maxX: 0.54, minY: 0.38, maxY: 0.44, minZ: 0.12, maxZ: 0.15, color: HANDLE },
  { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.06, minZ: 0.2, maxZ: 0.28, color: HANDLE },
  { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.06, minZ: 0.2, maxZ: 0.28, color: HANDLE },
  { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.06, minZ: 0.74, maxZ: 0.82, color: HANDLE },
  { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.06, minZ: 0.74, maxZ: 0.82, color: HANDLE },
];

// Wall panels, facing 0: flat against the wall on their -z side, a
// sixteenth thick, like a painting.
const PANEL_T = 0.0625;
PROP_SHAPES.panel_plain = [
  { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: PANEL_T },
  // The boards: three seams down it.
  ...[0.25, 0.5, 0.75].map((x) => ({ minX: x - 0.008, maxX: x + 0.008, minY: 0, maxY: 1, minZ: PANEL_T, maxZ: PANEL_T + 0.004, tone: 0.62 })),
];
PROP_SHAPES.panel_pattern = [
  { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.04 },
  ...[[0.08, 0.08], [0.54, 0.08], [0.08, 0.54], [0.54, 0.54]].map(([x, y]) => (
    { minX: x, maxX: x + 0.38, minY: y, maxY: y + 0.38, minZ: 0.04, maxZ: 0.07, tone: 1.12 })),
  ...[[0.14, 0.14], [0.6, 0.14], [0.14, 0.6], [0.6, 0.6]].map(([x, y]) => (
    { minX: x, maxX: x + 0.26, minY: y, maxY: y + 0.26, minZ: 0.07, maxZ: 0.075, tone: 0.9 })),
];
PROP_SHAPES.panel_twotone = [
  { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: PANEL_T, color: 0x6e4a33 },
  { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: PANEL_T },
  { minX: 0, maxX: 1, minY: 0.46, maxY: 0.54, minZ: 0, maxZ: 0.09, color: 0x5a3b28 },
];

// Rail (trains, Age 5): wooden sleepers across, two iron rails along, flat
// on the ground. It runs on into the rail beside it: straight through along
// x or z, and where it meets rail on both an x side and a z side, a half
// length out to each — round the corner. On its own it lies along x.
const SLEEPER = 0x6b4a33;
const RAIL_H = 0.13, SLEEPER_H = 0.05;
function railRun(axis, from, to) {
  const out = [];
  const box = (a0, a1, b0, b1, y0, y1, color) => (axis === 'z'
    ? { minX: a0, maxX: a1, minY: y0, maxY: y1, minZ: b0, maxZ: b1, ...(color != null ? { color } : {}) }
    : { minX: b0, maxX: b1, minY: y0, maxY: y1, minZ: a0, maxZ: a1, ...(color != null ? { color } : {}) });
  for (let c = 0.125; c < 1; c += 0.25) {
    if (c < from || c > to) continue;
    out.push(box(0.06, 0.94, c - 0.06, c + 0.06, 0, SLEEPER_H, SLEEPER));
  }
  for (const r of [0.22, 0.72]) out.push(box(r, r + 0.06, from, to, SLEEPER_H, RAIL_H));
  return out;
}
export function railBoxes({ px = 0, nx = 0, pz = 0, nz = 0 } = {}) {
  const onX = px || nx, onZ = pz || nz;
  if (!onZ) return railRun('x', 0, 1);
  if (!onX) return railRun('z', 0, 1);
  return [
    ...(px ? railRun('x', 0.5, 1) : []), ...(nx ? railRun('x', 0, 0.5) : []),
    ...(pz ? railRun('z', 0.5, 1) : []), ...(nz ? railRun('z', 0, 0.5) : []),
  ];
}
PROP_SHAPES.rail = railBoxes();

PROP_SHAPES.wall = wallBoxes();
PROP_SHAPES.chimney = chimneyBoxes();
PROP_SHAPES.pillar = pillarBoxes();

// A trapdoor, shut: boards high in the cell (you stand on it), battens
// underneath, its hinges on the -z edge. Open, it stands up against that
// edge — the same boards, swung a quarter turn about the hinge.
const BATTEN = 0x8a6a48;
PROP_SHAPES.trapdoor = [
  { minX: 0, maxX: 1, minY: 0.8125, maxY: 1, minZ: 0, maxZ: 1 },
  { minX: 0.06, maxX: 0.94, minY: 0.76, maxY: 0.8125, minZ: 0.14, maxZ: 0.26, color: BATTEN },
  { minX: 0.06, maxX: 0.94, minY: 0.76, maxY: 0.8125, minZ: 0.74, maxZ: 0.86, color: BATTEN },
  { minX: 0.16, maxX: 0.32, minY: 1, maxY: 1.025, minZ: 0, maxZ: 0.22, color: IRON },
  { minX: 0.68, maxX: 0.84, minY: 1, maxY: 1.025, minZ: 0, maxZ: 0.22, color: IRON },
];
// Shut on the floor: the same boards, lying low in the cell, hinges on top.
PROP_SHAPES.trapdoor_low = [
  { minX: 0, maxX: 1, minY: 0, maxY: 0.1875, minZ: 0, maxZ: 1 },
  { minX: 0.16, maxX: 0.32, minY: 0.1875, maxY: 0.2125, minZ: 0, maxZ: 0.22, color: IRON },
  { minX: 0.68, maxX: 0.84, minY: 0.1875, maxY: 0.2125, minZ: 0, maxZ: 0.22, color: IRON },
];
PROP_SHAPES.trapdoor_open = [
  { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.1875 },
  { minX: 0.06, maxX: 0.94, minY: 0.74, maxY: 0.86, minZ: 0.1875, maxZ: 0.24, color: BATTEN },
  { minX: 0.06, maxX: 0.94, minY: 0.14, maxY: 0.26, minZ: 0.1875, maxZ: 0.24, color: BATTEN },
  { minX: 0.16, maxX: 0.32, minY: 0.78, maxY: 1, minZ: -0.025, maxZ: 0, color: IRON },
  { minX: 0.68, maxX: 0.84, minY: 0.78, maxY: 1, minZ: -0.025, maxZ: 0, color: IRON },
];

// A framed window: a wooden frame with a cross of glazing bars across the
// middle of its cell, and glass in it. `pane` boxes are drawn see-through
// (ChunkMesher's pane material).
const GLASS = 0xb9dce8;
/**
 * A framed window. Backlog batch 2: windows stacked one on another join into
 * one tall window — `below` and `above` (the same window, facing the same
 * way) drop the frame and sill between them, so the sides and the glass run
 * straight through. Side by side they stay separate windows.
 */
export function windowBoxes({ below = false, above = false } = {}) {
  const y0 = below ? 0 : 0.125, y1 = above ? 1 : 0.875;
  const out = [
    { minX: 0, maxX: 0.125, minY: 0, maxY: 1, minZ: 0.4, maxZ: 0.6 },
    { minX: 0.875, maxX: 1, minY: 0, maxY: 1, minZ: 0.4, maxZ: 0.6 },
  ];
  if (!below) {
    out.push({ minX: 0.125, maxX: 0.875, minY: 0, maxY: 0.125, minZ: 0.4, maxZ: 0.6 });
    // A sill that stands out a little each side.
    out.push({ minX: 0, maxX: 1, minY: 0, maxY: 0.06, minZ: 0.34, maxZ: 0.66 });
  }
  if (!above) out.push({ minX: 0.125, maxX: 0.875, minY: 0.875, maxY: 1, minZ: 0.4, maxZ: 0.6 });
  // The glazing bars.
  out.push({ minX: 0.46875, maxX: 0.53125, minY: y0, maxY: y1, minZ: 0.46, maxZ: 0.54 });
  out.push({ minX: 0.125, maxX: 0.875, minY: 0.46875, maxY: 0.53125, minZ: 0.46, maxZ: 0.54 });
  out.push({ minX: 0.125, maxX: 0.875, minY: y0, maxY: y1, minZ: 0.49, maxZ: 0.51, color: GLASS, pane: true });
  return out;
}
PROP_SHAPES.window = windowBoxes();

// A terracotta vase with a painted band, and a bronze urn with handles and
// a lid.
PROP_SHAPES.vase = [
  { minX: 0.34, maxX: 0.66, minY: 0, maxY: 0.08, minZ: 0.34, maxZ: 0.66 },
  { minX: 0.24, maxX: 0.76, minY: 0.08, maxY: 0.5, minZ: 0.24, maxZ: 0.76 },
  { minX: 0.235, maxX: 0.765, minY: 0.28, maxY: 0.34, minZ: 0.235, maxZ: 0.765, color: 0x8a4f35 },
  { minX: 0.3, maxX: 0.7, minY: 0.5, maxY: 0.58, minZ: 0.3, maxZ: 0.7 },
  { minX: 0.38, maxX: 0.62, minY: 0.58, maxY: 0.74, minZ: 0.38, maxZ: 0.62 },
  { minX: 0.33, maxX: 0.67, minY: 0.74, maxY: 0.8, minZ: 0.33, maxZ: 0.67 },
];
PROP_SHAPES.urn = [
  { minX: 0.34, maxX: 0.66, minY: 0, maxY: 0.1, minZ: 0.34, maxZ: 0.66 },
  { minX: 0.42, maxX: 0.58, minY: 0.1, maxY: 0.18, minZ: 0.42, maxZ: 0.58 },
  { minX: 0.22, maxX: 0.78, minY: 0.18, maxY: 0.62, minZ: 0.22, maxZ: 0.78 },
  { minX: 0.26, maxX: 0.74, minY: 0.62, maxY: 0.7, minZ: 0.26, maxZ: 0.74 },
  { minX: 0.3, maxX: 0.7, minY: 0.7, maxY: 0.76, minZ: 0.3, maxZ: 0.7 },
  { minX: 0.45, maxX: 0.55, minY: 0.76, maxY: 0.84, minZ: 0.45, maxZ: 0.55 },
  { minX: 0.12, maxX: 0.22, minY: 0.36, maxY: 0.56, minZ: 0.45, maxZ: 0.55 },
  { minX: 0.78, maxX: 0.88, minY: 0.36, maxY: 0.56, minZ: 0.45, maxZ: 0.55 },
];

// Banners on a pole, standing taller than a block: the cloth (the block's
// own colour) hangs from a crossbar with a swallowtail foot and its emblem
// on the face towards you — a gold sun on white, a red tower on black.
const POLE = 0x6b4a3a, GILT = 0xe2c26a, BLOOD = 0x9a2c2c;
const bannerFrame = (trim) => [
  { minX: 0.46, maxX: 0.54, minY: 0, maxY: 1.92, minZ: 0.46, maxZ: 0.54, color: POLE },
  { minX: 0.42, maxX: 0.58, minY: 1.92, maxY: 2, minZ: 0.42, maxZ: 0.58, color: GILT },
  { minX: 0.08, maxX: 0.92, minY: 1.8, maxY: 1.86, minZ: 0.5, maxZ: 0.56, color: POLE },
  { minX: 0.14, maxX: 0.86, minY: 0.62, maxY: 1.8, minZ: 0.56, maxZ: 0.6 },
  { minX: 0.14, maxX: 0.4, minY: 0.46, maxY: 0.62, minZ: 0.56, maxZ: 0.6 },
  { minX: 0.6, maxX: 0.86, minY: 0.46, maxY: 0.62, minZ: 0.56, maxZ: 0.6 },
  { minX: 0.14, maxX: 0.86, minY: 1.68, maxY: 1.74, minZ: 0.6, maxZ: 0.615, color: trim },
];
PROP_SHAPES.banner_white = [
  ...bannerFrame(GILT),
  { minX: 0.4, maxX: 0.6, minY: 1.08, maxY: 1.28, minZ: 0.6, maxZ: 0.62, color: GILT },
  { minX: 0.48, maxX: 0.52, minY: 0.96, maxY: 1.4, minZ: 0.6, maxZ: 0.615, color: GILT },
  { minX: 0.28, maxX: 0.72, minY: 1.16, maxY: 1.2, minZ: 0.6, maxZ: 0.615, color: GILT },
];
PROP_SHAPES.banner_black = [
  ...bannerFrame(BLOOD),
  { minX: 0.42, maxX: 0.58, minY: 0.9, maxY: 1.34, minZ: 0.6, maxZ: 0.62, color: BLOOD },
  { minX: 0.38, maxX: 0.44, minY: 1.34, maxY: 1.42, minZ: 0.6, maxZ: 0.62, color: BLOOD },
  { minX: 0.47, maxX: 0.53, minY: 1.34, maxY: 1.42, minZ: 0.6, maxZ: 0.62, color: BLOOD },
  { minX: 0.56, maxX: 0.62, minY: 1.34, maxY: 1.42, minZ: 0.6, maxZ: 0.62, color: BLOOD },
];

// A firefly lantern: a gilt frame round a glass case with fireflies in it.
const FIREFLY = 0xe6ff7a;
PROP_SHAPES.firefly = [
  { minX: 0.28, maxX: 0.72, minY: 0, maxY: 0.06, minZ: 0.28, maxZ: 0.72, color: GILT },
  ...[[0.3, 0.3], [0.64, 0.3], [0.3, 0.64], [0.64, 0.64]].map(([x, z]) => (
    { minX: x, maxX: x + 0.06, minY: 0.06, maxY: 0.58, minZ: z, maxZ: z + 0.06, color: GILT })),
  { minX: 0.26, maxX: 0.74, minY: 0.58, maxY: 0.64, minZ: 0.26, maxZ: 0.74, color: GILT },
  { minX: 0.44, maxX: 0.56, minY: 0.64, maxY: 0.76, minZ: 0.44, maxZ: 0.56, color: GILT },
  { minX: 0.33, maxX: 0.67, minY: 0.06, maxY: 0.58, minZ: 0.33, maxZ: 0.67, color: 0xdff2d0, pane: true },
  ...[[0.4, 0.2, 0.45], [0.55, 0.32, 0.4], [0.45, 0.44, 0.56], [0.58, 0.16, 0.58], [0.38, 0.36, 0.38]].map(([x, y, z]) => (
    { minX: x, maxX: x + 0.045, minY: y, maxY: y + 0.045, minZ: z, maxZ: z + 0.045, color: FIREFLY, glow: true })),
];

// The defence buildings' furnishings (White path). All face -z, the side
// you see them from; the back of a rack is against the wall behind it.
const STEEL = 0xb9bec6, HILT = 0x5a3b26, STRAW = 0xd9b866, SACK = 0xb59a6a, PAINT = 0xb33a2e;
// A weapon rack: two posts and two rails against the back of the cell, a
// sword, a spear and an axe stood in it, and a round shield hung beside.
PROP_SHAPES.weapon_rack = [
  { minX: 0.04, maxX: 0.12, minY: 0, maxY: 0.98, minZ: 0.8, maxZ: 0.9 },
  { minX: 0.88, maxX: 0.96, minY: 0, maxY: 0.98, minZ: 0.8, maxZ: 0.9 },
  { minX: 0.04, maxX: 0.96, minY: 0.12, maxY: 0.18, minZ: 0.76, maxZ: 0.84 },
  { minX: 0.04, maxX: 0.96, minY: 0.72, maxY: 0.78, minZ: 0.76, maxZ: 0.84 },
  // A sword: blade, crossguard, grip and pommel.
  { minX: 0.2, maxX: 0.25, minY: 0.2, maxY: 0.82, minZ: 0.7, maxZ: 0.74, color: STEEL },
  { minX: 0.15, maxX: 0.3, minY: 0.82, maxY: 0.85, minZ: 0.69, maxZ: 0.75, color: IRON },
  { minX: 0.205, maxX: 0.245, minY: 0.85, maxY: 0.96, minZ: 0.7, maxZ: 0.74, color: HILT },
  { minX: 0.195, maxX: 0.255, minY: 0.96, maxY: 0.99, minZ: 0.695, maxZ: 0.745, color: IRON },
  // A spear, taller than the rack.
  { minX: 0.4, maxX: 0.44, minY: 0.04, maxY: 1.18, minZ: 0.7, maxZ: 0.74, color: HILT },
  { minX: 0.39, maxX: 0.45, minY: 1.18, maxY: 1.34, minZ: 0.705, maxZ: 0.735, color: STEEL },
  // An axe: haft and head.
  { minX: 0.58, maxX: 0.62, minY: 0.06, maxY: 0.94, minZ: 0.7, maxZ: 0.74, color: HILT },
  { minX: 0.5, maxX: 0.6, minY: 0.74, maxY: 0.92, minZ: 0.705, maxZ: 0.735, color: STEEL },
  // A round shield: boss, face and rim, hung on the rail.
  { minX: 0.68, maxX: 0.94, minY: 0.24, maxY: 0.6, minZ: 0.7, maxZ: 0.76, color: 0x8a5a36 },
  { minX: 0.72, maxX: 0.9, minY: 0.2, maxY: 0.64, minZ: 0.7, maxZ: 0.76, color: 0x8a5a36 },
  { minX: 0.64, maxX: 0.98, minY: 0.3, maxY: 0.54, minZ: 0.7, maxZ: 0.76, color: 0x8a5a36 },
  { minX: 0.76, maxX: 0.86, minY: 0.36, maxY: 0.48, minZ: 0.66, maxZ: 0.7, color: IRON },
];
// A training dummy: a post in a cross-foot, a straw-stuffed sack of a body
// with arms out, a head with a red mark painted on it, and one on the chest.
PROP_SHAPES.training_dummy = [
  { minX: 0.2, maxX: 0.8, minY: 0, maxY: 0.06, minZ: 0.44, maxZ: 0.56, color: HILT },
  { minX: 0.44, maxX: 0.56, minY: 0, maxY: 0.06, minZ: 0.2, maxZ: 0.8, color: HILT },
  { minX: 0.45, maxX: 0.55, minY: 0.06, maxY: 0.5, minZ: 0.45, maxZ: 0.55, color: HILT },
  { minX: 0.3, maxX: 0.7, minY: 0.5, maxY: 1.12, minZ: 0.38, maxZ: 0.62 },
  { minX: 0.27, maxX: 0.73, minY: 0.52, maxY: 0.58, minZ: 0.36, maxZ: 0.64, color: SACK },
  { minX: 0.27, maxX: 0.73, minY: 1.04, maxY: 1.1, minZ: 0.36, maxZ: 0.64, color: SACK },
  { minX: 0.02, maxX: 0.98, minY: 0.92, maxY: 1.02, minZ: 0.45, maxZ: 0.55, color: HILT },
  { minX: 0.0, maxX: 0.12, minY: 0.84, maxY: 1.04, minZ: 0.42, maxZ: 0.58, color: STRAW },
  { minX: 0.88, maxX: 1.0, minY: 0.84, maxY: 1.04, minZ: 0.42, maxZ: 0.58, color: STRAW },
  { minX: 0.36, maxX: 0.64, minY: 1.12, maxY: 1.4, minZ: 0.38, maxZ: 0.62, color: SACK },
  { minX: 0.44, maxX: 0.56, minY: 1.22, maxY: 1.32, minZ: 0.36, maxZ: 0.38, color: PAINT },
  { minX: 0.42, maxX: 0.58, minY: 0.72, maxY: 0.88, minZ: 0.36, maxZ: 0.38, color: PAINT },
  { minX: 0.46, maxX: 0.54, minY: 0.76, maxY: 0.84, minZ: 0.35, maxZ: 0.36, color: 0xf2ede2 },
];
// An archery target: a straw boss painted in rings — white, black, blue,
// red and gold at the centre — on a three-legged stand, leaning back a
// little, with an arrow in it.
const TARGET_Z = 0.42;
const ring = (r, z, color) => ({ minX: 0.5 - r, maxX: 0.5 + r, minY: 0.82 - r, maxY: 0.82 + r, minZ: z, maxZ: z + 0.06, color });
PROP_SHAPES.archery_target = [
  { minX: 0.14, maxX: 0.2, minY: 0, maxY: 0.86, minZ: 0.5, maxZ: 0.56, color: HILT },
  { minX: 0.8, maxX: 0.86, minY: 0, maxY: 0.86, minZ: 0.5, maxZ: 0.56, color: HILT },
  { minX: 0.47, maxX: 0.53, minY: 0, maxY: 0.8, minZ: 0.82, maxZ: 0.88, color: HILT },
  { minX: 0.47, maxX: 0.53, minY: 0.74, maxY: 0.8, minZ: 0.5, maxZ: 0.88, color: HILT },
  // The boss, square-cut to a round: a cross of two boxes, then the rings.
  { minX: 0.12, maxX: 0.88, minY: 0.5, maxY: 1.14, minZ: TARGET_Z + 0.04, maxZ: TARGET_Z + 0.12, color: STRAW },
  { minX: 0.18, maxX: 0.82, minY: 0.44, maxY: 1.2, minZ: TARGET_Z + 0.04, maxZ: TARGET_Z + 0.12, color: STRAW },
  ring(0.34, TARGET_Z, 0xf2ede2),
  ring(0.27, TARGET_Z - 0.005, 0x2a2a2e),
  ring(0.2, TARGET_Z - 0.01, 0x3a6ab0),
  ring(0.13, TARGET_Z - 0.015, PAINT),
  ring(0.06, TARGET_Z - 0.02, 0xe6c45a),
  // An arrow, near the gold.
  { minX: 0.56, maxX: 0.59, minY: 0.86, maxY: 0.89, minZ: TARGET_Z - 0.3, maxZ: TARGET_Z, color: HILT },
  { minX: 0.55, maxX: 0.6, minY: 0.85, maxY: 0.9, minZ: TARGET_Z - 0.34, maxZ: TARGET_Z - 0.26, color: 0xf2ede2 },
];

// The dark path's camp. A war tent: canvas over a ridge pole in steps, the
// flap tied back on the side towards you (-z), a pennant on the pole, and
// guy ropes pegged out at the corners. A campfire: a ring of stones, logs
// crossed in it, and the embers glowing.
const CANVAS = 0x6b5a48, CANVAS_DARK = 0x52443a, ROPE = 0xc9b88f, FLAME_LOW = 0xff8a3a;
// Two blocks long (backlog batch 2): the front, with the flap and the
// pole, runs on into the back, which closes the canvas and is pegged out.
PROP_SHAPES.war_tent = [
  ...[0, 1, 2, 3, 4].map((k) => ({ minX: 0.04 + k * 0.09, maxX: 0.96 - k * 0.09, minY: k * 0.2, maxY: (k + 1) * 0.2, minZ: 0.06, maxZ: 1, color: k % 2 ? CANVAS_DARK : CANVAS })),
  { minX: 0.47, maxX: 0.53, minY: 0, maxY: 1.35, minZ: 0.02, maxZ: 0.08, color: HILT },
  { minX: 0.53, maxX: 0.78, minY: 1.18, maxY: 1.32, minZ: 0.04, maxZ: 0.06, color: 0x2a2430 },
  { minX: 0.3, maxX: 0.7, minY: 0, maxY: 0.62, minZ: 0.04, maxZ: 0.07, color: 0x1e1a18 },
  { minX: 0.18, maxX: 0.32, minY: 0, maxY: 0.6, minZ: 0.02, maxZ: 0.06, color: CANVAS_DARK },
  ...[[-0.06, 0.04], [1.0, 0.04]].map(([x, z]) => ({ minX: x, maxX: x + 0.06, minY: 0, maxY: 0.1, minZ: z, maxZ: z + 0.06, color: HILT })),
  ...[[0.0, 0.07], [0.94, 0.07]].map(([x, z]) => ({ minX: x, maxX: x + 0.06, minY: 0.08, maxY: 0.4, minZ: z, maxZ: z + 0.03, color: ROPE })),
];
PROP_SHAPES.war_tent_back = [
  ...[0, 1, 2, 3, 4].map((k) => ({ minX: 0.04 + k * 0.09, maxX: 0.96 - k * 0.09, minY: k * 0.2, maxY: (k + 1) * 0.2, minZ: 0, maxZ: 0.94, color: k % 2 ? CANVAS_DARK : CANVAS })),
  // The back pole, and the canvas laced shut at the end.
  { minX: 0.47, maxX: 0.53, minY: 0, maxY: 1.1, minZ: 0.9, maxZ: 0.96, color: HILT },
  { minX: 0.42, maxX: 0.58, minY: 0.1, maxY: 0.9, minZ: 0.93, maxZ: 0.95, color: CANVAS_DARK },
  ...[[-0.06, 0.9], [1.0, 0.9]].map(([x, z]) => ({ minX: x, maxX: x + 0.06, minY: 0, maxY: 0.1, minZ: z, maxZ: z + 0.06, color: HILT })),
  ...[[0.0, 0.88], [0.94, 0.88]].map(([x, z]) => ({ minX: x, maxX: x + 0.06, minY: 0.08, maxY: 0.4, minZ: z, maxZ: z + 0.03, color: ROPE })),
];
PROP_SHAPES.campfire = [
  ...[[0.1, 0.4], [0.8, 0.4], [0.4, 0.1], [0.4, 0.8], [0.18, 0.18], [0.7, 0.18], [0.18, 0.7], [0.7, 0.7]].map(([x, z]) => (
    { minX: x, maxX: x + 0.14, minY: 0, maxY: 0.12, minZ: z, maxZ: z + 0.14, color: 0x77736c })),
  { minX: 0.22, maxX: 0.78, minY: 0.04, maxY: 0.14, minZ: 0.44, maxZ: 0.56 },
  { minX: 0.44, maxX: 0.56, minY: 0.1, maxY: 0.2, minZ: 0.22, maxZ: 0.78 },
  // Only the embers are the block's: the flames over them move, and are
  // drawn apart from it (render/FlameView.js).
  { minX: 0.34, maxX: 0.66, minY: 0.12, maxY: 0.2, minZ: 0.34, maxZ: 0.66, color: FLAME_LOW, glow: true },
];

// The Sky Kingdom's chain: links of dark iron, one across and one along,
// stacked up the cell — a cell of it reads as chain from any side.
const LINK = 0x4e535a;
PROP_SHAPES.chain = [0, 0.25, 0.5, 0.75].flatMap((y, i) => i % 2
  ? [{ minX: 0.44, maxX: 0.56, minY: y, maxY: y + 0.3, minZ: 0.3, maxZ: 0.38, color: LINK }, { minX: 0.44, maxX: 0.56, minY: y, maxY: y + 0.3, minZ: 0.62, maxZ: 0.7, color: LINK }]
  : [{ minX: 0.3, maxX: 0.38, minY: y, maxY: y + 0.3, minZ: 0.44, maxZ: 0.56, color: LINK }, { minX: 0.62, maxX: 0.7, minY: y, maxY: y + 0.3, minZ: 0.44, maxZ: 0.56, color: LINK }]);
// The sky lift: a gilt winch on a marble plinth — a drum wound with chain
// between two posts, a crank on one side, a lamp of fireflies on top.
PROP_SHAPES.sky_lift = [
  { minX: 0.06, maxX: 0.94, minY: 0, maxY: 0.2, minZ: 0.06, maxZ: 0.94, color: 0xeef1f4 },
  { minX: 0.12, maxX: 0.22, minY: 0.2, maxY: 0.86, minZ: 0.42, maxZ: 0.58, color: GILT },
  { minX: 0.78, maxX: 0.88, minY: 0.2, maxY: 0.86, minZ: 0.42, maxZ: 0.58, color: GILT },
  { minX: 0.22, maxX: 0.78, minY: 0.44, maxY: 0.72, minZ: 0.36, maxZ: 0.64, color: LINK },
  { minX: 0.88, maxX: 0.96, minY: 0.54, maxY: 0.62, minZ: 0.46, maxZ: 0.54, color: GILT },
  { minX: 0.94, maxX: 1.0, minY: 0.36, maxY: 0.62, minZ: 0.46, maxZ: 0.54, color: GILT },
  { minX: 0.12, maxX: 0.88, minY: 0.86, maxY: 0.92, minZ: 0.4, maxZ: 0.6, color: GILT },
  { minX: 0.42, maxX: 0.58, minY: 0.92, maxY: 1.1, minZ: 0.42, maxZ: 0.58, color: 0xe6ff7a, glow: true },
];

// The ring ores: crystals breaking out of every face of a block of rock,
// glowing — drawn over the ordinary cube the rock is (blocks.js `overlay`).
function oreBoxes(crystal) {
  const out = [];
  // Three crystals a face, each standing proud of it.
  const spots = [[0.14, 0.2, 0.22], [0.58, 0.56, 0.24], [0.22, 0.66, 0.16]];
  for (const [a, b, w] of spots) {
    const d = 0.07;
    out.push({ minX: a, maxX: a + w, minY: b, maxY: b + w, minZ: -d, maxZ: 0.02, color: crystal, glow: true });
    out.push({ minX: b, maxX: b + w, minY: a, maxY: a + w, minZ: 0.98, maxZ: 1 + d, color: crystal, glow: true });
    out.push({ minX: -d, maxX: 0.02, minY: a, maxY: a + w, minZ: b, maxZ: b + w, color: crystal, glow: true });
    out.push({ minX: 0.98, maxX: 1 + d, minY: b, maxY: b + w, minZ: a, maxZ: a + w, color: crystal, glow: true });
    out.push({ minX: a, maxX: a + w, minY: 0.98, maxY: 1 + d, minZ: b, maxZ: b + w, color: crystal, glow: true });
    out.push({ minX: b, maxX: b + w, minY: -d, maxY: 0.02, minZ: a, maxZ: a + w, color: crystal, glow: true });
  }
  return out;
}
PROP_SHAPES.sunstone_ore = oreBoxes(0xffe08a);
PROP_SHAPES.nightstone_ore = oreBoxes(0xb48cff);

// A bed (playtest, P1), facing 0: the head towards -z. The foot half has
// the footboard and the blanket's end; the head half the headboard and the
// pillow. The blanket is the block's own colour.
const BED_WOOD = 0x8a6440, SHEET = 0xf2ede2, PILLOW = 0xfbfaf6;
PROP_SHAPES.bed_foot = [
  { minX: 0.04, maxX: 0.96, minY: 0.12, maxY: 0.3, minZ: 0, maxZ: 0.96, color: BED_WOOD },
  { minX: 0.04, maxX: 0.14, minY: 0, maxY: 0.12, minZ: 0.86, maxZ: 0.96, color: BED_WOOD },
  { minX: 0.86, maxX: 0.96, minY: 0, maxY: 0.12, minZ: 0.86, maxZ: 0.96, color: BED_WOOD },
  { minX: 0.04, maxX: 0.96, minY: 0.12, maxY: 0.52, minZ: 0.88, maxZ: 0.98, color: BED_WOOD },
  { minX: 0.07, maxX: 0.93, minY: 0.3, maxY: 0.48, minZ: 0, maxZ: 0.88, color: SHEET },
  { minX: 0.05, maxX: 0.95, minY: 0.48, maxY: 0.54, minZ: 0, maxZ: 0.86 },
];
PROP_SHAPES.bed_head = [
  { minX: 0.04, maxX: 0.96, minY: 0.12, maxY: 0.3, minZ: 0.04, maxZ: 1, color: BED_WOOD },
  { minX: 0.04, maxX: 0.14, minY: 0, maxY: 0.12, minZ: 0.04, maxZ: 0.14, color: BED_WOOD },
  { minX: 0.86, maxX: 0.96, minY: 0, maxY: 0.12, minZ: 0.04, maxZ: 0.14, color: BED_WOOD },
  { minX: 0.04, maxX: 0.96, minY: 0.12, maxY: 0.86, minZ: 0.02, maxZ: 0.13, color: BED_WOOD },
  { minX: 0.07, maxX: 0.93, minY: 0.3, maxY: 0.48, minZ: 0.13, maxZ: 1, color: SHEET },
  { minX: 0.18, maxX: 0.82, minY: 0.48, maxY: 0.62, minZ: 0.18, maxZ: 0.46, color: PILLOW },
  { minX: 0.05, maxX: 0.95, minY: 0.48, maxY: 0.54, minZ: 0.56, maxZ: 1 },
];

// A painting (playtest, P1), facing 0: flat against the wall on its -z
// side. A gilt-and-wood frame round a little landscape — sky, sun, hills
// and the sea.
PROP_SHAPES.painting = [
  { minX: 0.08, maxX: 0.92, minY: 0.14, maxY: 0.2, minZ: 0, maxZ: 0.07, color: 0x8a6440 },
  { minX: 0.08, maxX: 0.92, minY: 0.8, maxY: 0.86, minZ: 0, maxZ: 0.07, color: 0x8a6440 },
  { minX: 0.08, maxX: 0.14, minY: 0.2, maxY: 0.8, minZ: 0, maxZ: 0.07, color: 0x8a6440 },
  { minX: 0.86, maxX: 0.92, minY: 0.2, maxY: 0.8, minZ: 0, maxZ: 0.07, color: 0x8a6440 },
  { minX: 0.14, maxX: 0.86, minY: 0.2, maxY: 0.8, minZ: 0, maxZ: 0.04, color: 0x9ec9e8 },   // sky
  { minX: 0.14, maxX: 0.86, minY: 0.2, maxY: 0.34, minZ: 0.04, maxZ: 0.045, color: 0x5f8fc4 }, // sea
  { minX: 0.14, maxX: 0.6, minY: 0.3, maxY: 0.48, minZ: 0.045, maxZ: 0.05, color: 0x6fa857 },  // hills
  { minX: 0.4, maxX: 0.86, minY: 0.3, maxY: 0.42, minZ: 0.05, maxZ: 0.055, color: 0x82b86a },
  { minX: 0.64, maxX: 0.74, minY: 0.6, maxY: 0.7, minZ: 0.045, maxZ: 0.05, color: 0xffd76a },  // sun
];

// A sapling (playtest, P8): a thin stem with leaves coming off it in tiers,
// a small tuft at the top, in a little ring of turned earth.
const STEM = 0x7a5a3a, LEAF = 0x7fbf68, LEAF_DARK = 0x5fa052, EARTH = 0x7a5c42;
PROP_SHAPES.sapling = [
  { minX: 0.34, maxX: 0.66, minY: 0, maxY: 0.04, minZ: 0.34, maxZ: 0.66, color: EARTH },
  { minX: 0.46, maxX: 0.54, minY: 0, maxY: 0.78, minZ: 0.46, maxZ: 0.54, color: STEM },
  { minX: 0.2, maxX: 0.46, minY: 0.26, maxY: 0.32, minZ: 0.42, maxZ: 0.58, color: LEAF_DARK },
  { minX: 0.54, maxX: 0.8, minY: 0.36, maxY: 0.42, minZ: 0.42, maxZ: 0.58, color: LEAF_DARK },
  { minX: 0.42, maxX: 0.58, minY: 0.48, maxY: 0.54, minZ: 0.2, maxZ: 0.46, color: LEAF },
  { minX: 0.42, maxX: 0.58, minY: 0.56, maxY: 0.62, minZ: 0.54, maxZ: 0.8, color: LEAF },
  { minX: 0.32, maxX: 0.68, minY: 0.72, maxY: 0.9, minZ: 0.32, maxZ: 0.68, color: LEAF },
  { minX: 0.4, maxX: 0.6, minY: 0.9, maxY: 0.98, minZ: 0.4, maxZ: 0.6, color: LEAF },
];

/** The boxes for a shape, or the slab's if a new shape id has none registered yet. */
/**
 * A box's colour on a block whose colour is `base`: the box's own if it has
 * one (a handle's iron), else the block's, lighter or darker by its `tone` —
 * so one shape serves every wood (a cabinet's top a shade lighter than its
 * body in oak, white wood or dark).
 */
export function boxColor(box, base) {
  if (box.color != null) return box.color;
  return box.tone ? toneHex(base, box.tone) : base;
}

export function boxesFor(shape) {
  return PROP_SHAPES[shape] ?? PROP_SHAPES.slab;
}
