import { CROPS } from './crops.js';
import { ARMOUR_PIECES, BACKPACKS } from './armour.js';
import { UPGRADES, UPGRADABLE_SWORDS, upgradedId } from './upgrades.js';
import { TOOL_TIERS } from './tiers.js';

/**
 * Little voxel models for the things you carry that aren't blocks — the
 * food, and the seeds you plant it from. Requested directly: "improve the
 * icons to the 3D version of each fruit and veggie, now they are cards,
 * weird, not matching the rest." Every block in the bag is a small
 * isometric cube; a flat line drawing on a coloured tile next to them read
 * as a different game.
 *
 * Each model is boxes in a unit cell, each with its own colour, drawn by
 * cubes.js the same way a chair or a lantern is. Rounded things are stacks
 * of layers, widest in the middle, all on one centre — which is also what
 * keeps the painter's order right without a depth buffer.
 */

const box = (x0, y0, z0, x1, y1, z1, color) => ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, color });

/** Layers stacked on the cell's centre: [halfWidthX, halfWidthZ, y0, y1, colour]. */
const stack = (layers, cx = 0.5, cz = 0.5) =>
  layers.map(([hx, hz, y0, y1, color]) => box(cx - hx, y0, cz - hz, cx + hx, y1, cz + hz, color));

const STEM = 0x7a5a3a, LEAF = 0x6ea653;

/** A seed packet: paper, a folded top, and a picture of what's inside. */
function packet(patches) {
  const PAPER = 0xeadcb4, FOLD = 0xc9b88f;
  return [
    box(0.2, 0, 0.36, 0.8, 0.72, 0.62, PAPER),
    box(0.2, 0.72, 0.38, 0.8, 0.86, 0.6, FOLD),
    // The picture, on the face towards you (+z).
    ...patches.map(([x0, y0, x1, y1, color]) => box(x0, y0, 0.62, x1, y1, 0.66, color)),
  ];
}

export const ITEM_MODELS = {
  // An apple.
  fruit: [
    ...stack([
      [0.16, 0.16, 0, 0.08, 0xc24a44], [0.25, 0.25, 0.08, 0.24, 0xd4584f], [0.3, 0.3, 0.24, 0.6, 0xdc5f55],
      [0.26, 0.26, 0.6, 0.76, 0xe0746a], [0.16, 0.16, 0.76, 0.84, 0xe4857b],
    ]),
    box(0.47, 0.84, 0.47, 0.53, 1, 0.53, STEM),
    box(0.53, 0.92, 0.46, 0.72, 0.97, 0.54, LEAF),
  ],
  // Carrots lie along x, tip to the back, leaves at the front.
  // A carrot stood on its tip, leaves up.
  vegetables: [
    ...stack([
      [0.05, 0.05, 0, 0.12, 0xd9702a], [0.09, 0.09, 0.12, 0.3, 0xe07c30],
      [0.13, 0.13, 0.3, 0.48, 0xe8873a], [0.16, 0.16, 0.48, 0.64, 0xee9446],
    ]),
    box(0.36, 0.64, 0.46, 0.43, 0.86, 0.53, 0x5f9a48),
    box(0.46, 0.64, 0.46, 0.54, 1, 0.54, LEAF),
    box(0.57, 0.64, 0.47, 0.64, 0.9, 0.54, 0x7fb65e),
  ],
  potato: [
    ...stack([[0.2, 0.26, 0, 0.06, 0xae8a55], [0.28, 0.36, 0.06, 0.3, 0xc9a46c], [0.24, 0.3, 0.3, 0.42, 0xd0ac74], [0.14, 0.2, 0.42, 0.47, 0xd4b27c]]),
    box(0.78, 0.14, 0.34, 0.8, 0.2, 0.4, 0x8a6a40),
    box(0.78, 0.2, 0.58, 0.8, 0.26, 0.64, 0x8a6a40),
  ],
  cabbage: stack([
    [0.24, 0.24, 0, 0.08, 0x5f8f46],
    [0.38, 0.38, 0.08, 0.26, 0x6f9f52],
    [0.33, 0.33, 0.26, 0.58, 0xa9cf86],
    [0.26, 0.26, 0.58, 0.74, 0xb6d792],
    [0.14, 0.14, 0.74, 0.82, 0xcde7b2],
  ]),
  lettuce: stack([
    [0.44, 0.44, 0, 0.18, 0x7fbf55],
    [0.36, 0.36, 0.18, 0.38, 0x96cf68],
    [0.26, 0.26, 0.38, 0.56, 0xb6de86],
    [0.14, 0.14, 0.56, 0.64, 0xd2eca8],
  ]),
  pepper: [
    ...stack([[0.18, 0.18, 0, 0.12, 0xb93a2f], [0.28, 0.28, 0.12, 0.66, 0xd84a3c], [0.24, 0.24, 0.66, 0.76, 0xe2604f]]),
    box(0.36, 0.76, 0.36, 0.64, 0.8, 0.64, 0x4e8a3a),
    box(0.45, 0.8, 0.45, 0.55, 1, 0.55, 0x4e8a3a),
  ],
  // A zucchini lies along x, stalk at the front.
  zucchini: [
    box(0.06, 0.14, 0.38, 0.12, 0.34, 0.62, 0x356a2c),
    box(0.12, 0.1, 0.34, 0.82, 0.4, 0.66, 0x3f7a35),
    box(0.2, 0.4, 0.44, 0.74, 0.41, 0.48, 0x7fae5e),
    box(0.3, 0.4, 0.54, 0.7, 0.41, 0.58, 0x7fae5e),
    box(0.82, 0.18, 0.44, 0.94, 0.32, 0.56, 0x9cbf74),
  ],
  broccoli: [
    box(0.43, 0, 0.43, 0.57, 0.5, 0.57, 0xa6c98a),
    ...stack([[0.18, 0.18, 0.44, 0.54, 0x356f34], [0.3, 0.3, 0.54, 0.78, 0x3e7b3c], [0.22, 0.22, 0.78, 0.9, 0x4b8c46], [0.1, 0.1, 0.9, 0.96, 0x5a9b52]]),
  ],
  raw_meat: [
    box(0.12, 0, 0.18, 0.74, 0.2, 0.82, 0xd9716b),
    box(0.12, 0.2, 0.18, 0.74, 0.24, 0.82, 0xeab0a8),
    box(0.74, 0.06, 0.42, 0.96, 0.16, 0.58, 0xf1ead8),
  ],
  cooked_meat: [
    box(0.12, 0, 0.18, 0.74, 0.22, 0.82, 0x9c6a45),
    box(0.12, 0.22, 0.18, 0.74, 0.26, 0.82, 0xb7825c),
    box(0.74, 0.06, 0.42, 0.96, 0.16, 0.58, 0xf1ead8),
  ],
  egg: stack([
    [0.13, 0.13, 0, 0.08, 0xe4d6bb],
    [0.21, 0.21, 0.08, 0.24, 0xece0c6],
    [0.25, 0.25, 0.24, 0.56, 0xf2e6cf],
    [0.21, 0.21, 0.56, 0.78, 0xf5ebd7],
    [0.15, 0.15, 0.78, 0.92, 0xf8f0e0],
    [0.07, 0.07, 0.92, 1, 0xfaf3e6],
  ]),
  milk: [
    ...stack([[0.24, 0.24, 0, 0.2, 0xf4f1ea], [0.24, 0.24, 0.2, 0.42, 0x7fa6d6], [0.24, 0.24, 0.42, 0.62, 0xf4f1ea]]),
    ...stack([[0.13, 0.13, 0.62, 0.8, 0xf4f1ea], [0.15, 0.15, 0.8, 0.88, 0x5b86c2]]),
  ],
};

// A packet per crop, with the crop on the front and a leaf above it.
for (const c of CROPS) {
  ITEM_MODELS[`seeds_${c.kind}`] = packet([
    [0.46, 0.5, 0.54, 0.62, c.leaf],
    [0.34, 0.2, 0.66, 0.5, c.crop],
  ]);
}

// Armour (Phase 7b): a helm, a cuirass and a pair of greaves, in each set's
// metal (or leather) with its trim.
const ARMOUR_MODEL = {
  head: (m, t) => [
    ...stack([[0.3, 0.3, 0.1, 0.42, m], [0.26, 0.26, 0.42, 0.6, m], [0.16, 0.16, 0.6, 0.7, m]]),
    box(0.18, 0.1, 0.78, 0.82, 0.2, 0.82, t),          // the rim
    box(0.3, 0.2, 0.79, 0.7, 0.34, 0.81, 0x2a2a2e),    // the eye slit
    box(0.46, 0.7, 0.46, 0.54, 0.8, 0.54, t),          // the crest
  ],
  body: (m, t) => [
    box(0.2, 0.06, 0.32, 0.8, 0.74, 0.68, m),
    box(0.06, 0.52, 0.34, 0.2, 0.74, 0.66, m), box(0.8, 0.52, 0.34, 0.94, 0.74, 0.66, m), // shoulders
    box(0.36, 0.74, 0.34, 0.64, 0.82, 0.66, t),        // the collar
    box(0.2, 0.3, 0.68, 0.8, 0.36, 0.7, t),            // a band across the front
    box(0.46, 0.36, 0.68, 0.54, 0.7, 0.7, t),
  ],
  legs: (m, t) => [
    box(0.22, 0.72, 0.34, 0.78, 0.86, 0.66, t),        // the belt
    box(0.22, 0.06, 0.36, 0.46, 0.72, 0.64, m), box(0.54, 0.06, 0.36, 0.78, 0.72, 0.64, m),
    box(0.22, 0.34, 0.64, 0.46, 0.42, 0.66, t), box(0.54, 0.34, 0.64, 0.78, 0.42, 0.66, t), // knee plates
  ],
  // A pair of boots (playtest, P6), side by side, toes towards you.
  feet: (m, t) => [
    box(0.16, 0, 0.3, 0.44, 0.12, 0.84, m), box(0.16, 0.12, 0.3, 0.44, 0.5, 0.56, m),
    box(0.56, 0, 0.3, 0.84, 0.12, 0.84, m), box(0.56, 0.12, 0.3, 0.84, 0.5, 0.56, m),
    box(0.16, 0.44, 0.3, 0.44, 0.52, 0.56, t), box(0.56, 0.44, 0.3, 0.84, 0.52, 0.56, t),
  ],
};
for (const p of ARMOUR_PIECES) ITEM_MODELS[p.id] = ARMOUR_MODEL[p.slot](p.main, p.trim);

// Backpacks (batch 3, #1): a pack with a rolled flap over its top, a pocket
// on the front, two straps down its back, and its trim on the buckles.
const backpackModel = (m, t) => [
  box(0.22, 0.04, 0.3, 0.78, 0.72, 0.7, m),
  box(0.2, 0.62, 0.28, 0.8, 0.8, 0.72, t),           // the flap
  box(0.3, 0.12, 0.7, 0.7, 0.42, 0.8, m),            // the pocket
  box(0.46, 0.4, 0.8, 0.54, 0.48, 0.82, t),          // its buckle
  box(0.28, 0.08, 0.24, 0.36, 0.76, 0.3, t), box(0.64, 0.08, 0.24, 0.72, 0.76, 0.3, t), // the straps
];
for (const b of BACKPACKS) ITEM_MODELS[b.id] = backpackModel(b.main, b.trim);

// Swords (the playtest list, P6/P7): a blade standing on its point's end,
// a crossguard and a wrapped grip with a pommel.
const swordModel = (blade, edge, guard, grip) => [
  box(0.44, 0, 0.44, 0.56, 0.2, 0.56, grip),
  box(0.42, -0.04, 0.42, 0.58, 0.02, 0.58, guard),
  box(0.26, 0.2, 0.42, 0.74, 0.27, 0.58, guard),
  box(0.42, 0.27, 0.46, 0.58, 0.92, 0.54, blade),
  box(0.47, 0.27, 0.45, 0.53, 0.98, 0.55, edge),
];
ITEM_MODELS.sword_wood = swordModel(0xcbaa8a, 0xdcc0a0, 0x8a6440, 0x5e4128);
ITEM_MODELS.sword_stone = swordModel(0x9a9aa2, 0xb9b9c1, 0x6b6b72, 0x5e4128);
ITEM_MODELS.sword_iron = swordModel(0xc9ced6, 0xeef1f5, 0xe2c26a, 0x3a2a20);
// The tiers past iron (config/tiers.js).
for (const t of TOOL_TIERS) if (t.key !== 'iron') ITEM_MODELS[`sword_${t.key}`] = swordModel(t.color, t.edge, t.guard, 0x3a2a20);

// The bow and what it's made of (asked for directly). A bow stands curved,
// its string straight across its back; an arrow lies along it.
const WOODY = 0x9a6c40, DARKWOOD = 0x6b4a2e, TWINE = 0xe6dcc0;
// The wood bows out towards -x, the way a tool's head faces, with the
// string behind it on the hand's side (reported directly: the bow "should
// have the wood going for the opposite direction").
ITEM_MODELS.bow = [
  box(0.46, 0.02, 0.46, 0.56, 0.18, 0.54, DARKWOOD), box(0.4, 0.16, 0.46, 0.5, 0.34, 0.54, WOODY),
  box(0.34, 0.32, 0.46, 0.44, 0.68, 0.54, WOODY), box(0.4, 0.66, 0.46, 0.5, 0.84, 0.54, WOODY),
  box(0.46, 0.82, 0.46, 0.56, 0.98, 0.54, DARKWOOD), box(0.55, 0.06, 0.48, 0.58, 0.94, 0.52, TWINE),
];
ITEM_MODELS.arrow = [
  box(0.47, 0.04, 0.47, 0.53, 0.84, 0.53, 0xb08a5a), box(0.45, 0.82, 0.45, 0.55, 0.98, 0.55, 0x8c9096),
  box(0.4, 0.04, 0.48, 0.6, 0.22, 0.52, 0xe8e2d4), box(0.48, 0.04, 0.4, 0.52, 0.22, 0.6, 0xc94a3e),
];
ITEM_MODELS.string = stack([[0.26, 0.26, 0, 0.12, TWINE], [0.2, 0.2, 0.12, 0.24, 0xd8cdb0], [0.26, 0.26, 0.24, 0.34, TWINE], [0.06, 0.06, 0.34, 0.5, 0x8a6440]]);
ITEM_MODELS.hemp_fibre = [
  box(0.3, 0, 0.4, 0.38, 0.9, 0.48, 0xc9b98a), box(0.42, 0, 0.44, 0.5, 0.95, 0.52, 0xd6c79a),
  box(0.54, 0, 0.4, 0.62, 0.86, 0.48, 0xbcaa78), box(0.62, 0, 0.5, 0.7, 0.8, 0.58, 0xc9b98a),
  box(0.26, 0.4, 0.38, 0.74, 0.48, 0.6, 0x6b8a45),
];

// Tools, and the rest of what was still a flat drawing on a tile (backlog
// batch 2: "3D icons in the bag for weapons and other items — feathers,
// bucket, chalk line"). The same models are what the hand holds (see
// render/heldModel.js, which reads these first): a tool's head faces -x,
// the way the hand swings it.
const HAFT = 0x8a6440, GRIP = 0x5e4128;
const axeModel = (metal, edge) => [
  box(0.45, 0, 0.45, 0.55, 0.9, 0.55, HAFT),
  box(0.22, 0.58, 0.42, 0.45, 0.88, 0.58, metal),
  box(0.15, 0.54, 0.43, 0.23, 0.92, 0.57, edge),
  box(0.44, 0, 0.44, 0.56, 0.1, 0.56, GRIP),
];
const pickaxeModel = (metal, edge) => [
  box(0.45, 0, 0.45, 0.55, 0.86, 0.55, HAFT),
  box(0.14, 0.78, 0.43, 0.86, 0.92, 0.57, metal),
  box(0.07, 0.68, 0.44, 0.15, 0.84, 0.56, edge),
  box(0.85, 0.68, 0.44, 0.93, 0.84, 0.56, edge),
  box(0.44, 0, 0.44, 0.56, 0.1, 0.56, GRIP),
];
// The blade up, like the axe's and the pick's heads: the hand holds the
// bottom of every model, so a blade at the bottom was held upside down
// (reported directly: "the shovel when in hand is wrong, it's turned down").
const shovelModel = (metal, edge) => [
  box(0.36, 0, 0.45, 0.64, 0.08, 0.55, GRIP),
  box(0.46, 0.06, 0.46, 0.54, 0.68, 0.54, HAFT),
  box(0.34, 0.64, 0.45, 0.66, 0.94, 0.55, metal),
  box(0.38, 0.94, 0.46, 0.62, 1, 0.54, edge),
];
const STONE_HEAD = 0x9a9aa2, STONE_EDGE = 0xc2c2c9;
ITEM_MODELS.axe = axeModel(STONE_HEAD, STONE_EDGE);
ITEM_MODELS.pickaxe = pickaxeModel(STONE_HEAD, STONE_EDGE);
ITEM_MODELS.shovel = shovelModel(STONE_HEAD, STONE_EDGE);
for (const t of TOOL_TIERS) {
  ITEM_MODELS[`axe_${t.key}`] = axeModel(t.color, t.edge);
  ITEM_MODELS[`pickaxe_${t.key}`] = pickaxeModel(t.color, t.edge);
  ITEM_MODELS[`shovel_${t.key}`] = shovelModel(t.color, t.edge);
}

// A pail: staves of metal, a rim, a wire handle — and with water in it, water.
const pail = (water) => [
  ...stack([[0.2, 0.2, 0, 0.08, 0x9aa3a8], [0.24, 0.24, 0.08, 0.52, 0xb5bec3], [0.26, 0.26, 0.52, 0.58, 0x8b9398]]),
  ...(water ? [box(0.26, 0.5, 0.26, 0.74, 0.56, 0.74, 0x5f8fc4)] : []),
  box(0.24, 0.58, 0.48, 0.28, 0.82, 0.52, 0x6b7378), box(0.72, 0.58, 0.48, 0.76, 0.82, 0.52, 0x6b7378),
  box(0.24, 0.8, 0.48, 0.76, 0.84, 0.52, 0x6b7378),
];
ITEM_MODELS.bucket = pail(false);
ITEM_MODELS.bucket_water = pail(true);

// A feather: a quill, and its vane — wider below, narrowing to the tip.
ITEM_MODELS.feather = [
  box(0.48, 0, 0.47, 0.52, 0.96, 0.53, 0xcfc6b4),
  box(0.34, 0.22, 0.48, 0.48, 0.62, 0.52, 0xf4f0e8), box(0.52, 0.26, 0.48, 0.64, 0.66, 0.52, 0xe9e4da),
  box(0.38, 0.62, 0.48, 0.48, 0.86, 0.52, 0xf4f0e8), box(0.52, 0.66, 0.48, 0.6, 0.88, 0.52, 0xe9e4da),
];
// A hide, laid flat: the skin and its four legs.
ITEM_MODELS.hide = [
  box(0.18, 0, 0.2, 0.82, 0.08, 0.8, 0xa07850),
  box(0.26, 0.08, 0.28, 0.74, 0.1, 0.72, 0xb88a5e),
  box(0.06, 0, 0.12, 0.2, 0.06, 0.26, 0xa07850), box(0.8, 0, 0.12, 0.94, 0.06, 0.26, 0xa07850),
  box(0.06, 0, 0.74, 0.2, 0.06, 0.88, 0xa07850), box(0.8, 0, 0.74, 0.94, 0.06, 0.88, 0xa07850),
];
// A ball of wool, and a loose end.
ITEM_MODELS.wool = [
  ...stack([[0.2, 0.2, 0, 0.1, 0xe8e2d6], [0.3, 0.3, 0.1, 0.4, 0xf2ede4], [0.22, 0.22, 0.4, 0.56, 0xe8e2d6]]),
  box(0.66, 0, 0.46, 0.86, 0.04, 0.52, 0xe8e2d6),
];
// A jar of fireflies: glass, a cork, and the lights inside.
ITEM_MODELS.fireflies = [
  ...stack([[0.22, 0.22, 0, 0.62, 0xcfe6d8]]),
  ...stack([[0.14, 0.14, 0.62, 0.74, 0xa98058]]),
  box(0.34, 0.2, 0.77, 0.4, 0.26, 0.79, 0xe8ff7a), box(0.56, 0.38, 0.77, 0.62, 0.44, 0.79, 0xe8ff7a), box(0.42, 0.48, 0.77, 0.48, 0.54, 0.79, 0xe8ff7a),
];
// An empty jar: the same glass and cork, nothing lit inside.
ITEM_MODELS.jar = [
  ...stack([[0.22, 0.22, 0, 0.62, 0xd6ebe0]]),
  ...stack([[0.14, 0.14, 0.62, 0.74, 0xa98058]]),
];
// Ingots: a bar with a narrower top.
const ingot = (main, top) => [box(0.16, 0, 0.3, 0.84, 0.14, 0.7, main), box(0.22, 0.14, 0.35, 0.78, 0.24, 0.65, top)];
ITEM_MODELS.iron_ingot = ingot(0xb3b8bf, 0xd6dae0);
ITEM_MODELS.copper_ingot = ingot(0xc27a4e, 0xdd9a6c);
// Coins: a short stack, and one more lying beside it.
ITEM_MODELS.coin = [
  ...stack([[0.2, 0.2, 0, 0.08, 0xd9a92e], [0.2, 0.2, 0.08, 0.16, 0xe8bf3a], [0.2, 0.2, 0.16, 0.24, 0xd9a92e], [0.2, 0.2, 0.24, 0.32, 0xf0cf55]], 0.42, 0.45),
  ...stack([[0.17, 0.17, 0, 0.07, 0xe8bf3a]], 0.74, 0.7),
];
// The pry bar and the chalk line, though nothing makes them any more.
ITEM_MODELS.pry_bar = [box(0.46, 0, 0.46, 0.54, 0.86, 0.54, 0x5a5f66), box(0.28, 0.8, 0.46, 0.54, 0.88, 0.54, 0x5a5f66)];
ITEM_MODELS.chalk_line = [box(0.3, 0.2, 0.4, 0.7, 0.6, 0.6, 0xc94a3e), box(0.46, 0.6, 0.48, 0.54, 0.95, 0.52, 0xf2ede2), box(0.36, 0.3, 0.6, 0.64, 0.5, 0.62, 0x8e2f27)];

// An upgraded piece looks like its plain self — the glint is drawn over
// it (see cubes.js itemIcon).
for (const [key, e] of Object.entries(UPGRADES)) {
  const bases = e.weapon ? UPGRADABLE_SWORDS : ARMOUR_PIECES.filter((p) => e.slots.includes(p.slot)).map((p) => p.id);
  for (const id of bases) ITEM_MODELS[upgradedId(id, key)] = ITEM_MODELS[id];
}

// The Temple's things (Phase 7c): a flask of holy water, and the two rings
// — a band with a stone set in it.
ITEM_MODELS.holy_water = [
  ...stack([[0.22, 0.22, 0, 0.42, 0xbfe3f5], [0.16, 0.16, 0.42, 0.52, 0xd6eef8], [0.08, 0.08, 0.52, 0.74, 0xd6eef8]]),
  ...stack([[0.1, 0.1, 0.74, 0.86, 0xa8835a]]),
];
// The drinks (playtest, P5): a mug of beer with its head, a bottle of
// kombucha, a cup of coffee on its saucer — and the beans it's made from.
ITEM_MODELS.beer = [
  ...stack([[0.2, 0.2, 0, 0.56, 0xe0a83a], [0.21, 0.21, 0.56, 0.7, 0xfaf3e0]], 0.44),
  box(0.64, 0.14, 0.44, 0.76, 0.5, 0.56, 0xc98f2a), box(0.6, 0.14, 0.44, 0.7, 0.2, 0.56, 0xc98f2a), box(0.6, 0.44, 0.44, 0.7, 0.5, 0.56, 0xc98f2a),
];
ITEM_MODELS.kombucha = [
  ...stack([[0.18, 0.18, 0, 0.5, 0xd0705a], [0.18, 0.18, 0.5, 0.56, 0xe7a184], [0.1, 0.1, 0.56, 0.72, 0xd8e8e4], [0.08, 0.08, 0.72, 0.84, 0x4a7a52]]),
];
ITEM_MODELS.coffee = [
  ...stack([[0.34, 0.34, 0, 0.06, 0xf2ede2], [0.2, 0.2, 0.06, 0.4, 0xfbfaf6], [0.18, 0.18, 0.4, 0.42, 0x4a2c1c]]),
  box(0.7, 0.14, 0.46, 0.8, 0.32, 0.54, 0xfbfaf6),
];
ITEM_MODELS.coffee_beans = [
  box(0.16, 0, 0.3, 0.42, 0.16, 0.5, 0x6b4630), box(0.5, 0, 0.18, 0.76, 0.16, 0.38, 0x7a5236),
  box(0.42, 0, 0.52, 0.68, 0.16, 0.72, 0x6b4630), box(0.3, 0.14, 0.36, 0.56, 0.3, 0.56, 0x8a5e3e),
  box(0.28, 0.16, 0.44, 0.3, 0.3, 0.48, 0x3a2418), box(0.62, 0.16, 0.26, 0.64, 0.17, 0.32, 0x3a2418),
];
const ringModel = (band, gem) => [
  box(0.2, 0.1, 0.44, 0.32, 0.6, 0.56, band), box(0.68, 0.1, 0.44, 0.8, 0.6, 0.56, band),
  box(0.2, 0.04, 0.44, 0.8, 0.14, 0.56, band), box(0.2, 0.56, 0.44, 0.8, 0.66, 0.56, band),
  box(0.38, 0.62, 0.38, 0.62, 0.84, 0.62, gem),
];
ITEM_MODELS.ring_white = ringModel(0xe6c45a, 0xffe08a);
ITEM_MODELS.ring_black = ringModel(0x2a2430, 0xb48cff);
ITEM_MODELS.devotion = [
  ...stack([[0.2, 0.2, 0, 0.1, 0xc9a44c], [0.12, 0.12, 0.1, 0.5, 0xf6eedc]]),
  ...stack([[0.08, 0.08, 0.5, 0.66, 0xffd98f], [0.04, 0.04, 0.66, 0.78, 0xffb347]]),
];
// The war horn (the Ten Rounds): a curved horn widening to its bell, bound in brass.
{
  const IVORY = 0xe8dcc0, BRASS = 0xc9a24a;
  ITEM_MODELS.war_horn = [
    box(0.08, 0.62, 0.46, 0.16, 0.7, 0.54, BRASS),
    box(0.16, 0.56, 0.44, 0.32, 0.68, 0.56, IVORY),
    box(0.3, 0.46, 0.42, 0.48, 0.62, 0.58, IVORY),
    box(0.46, 0.42, 0.4, 0.52, 0.64, 0.6, BRASS),
    box(0.5, 0.34, 0.38, 0.68, 0.6, 0.62, IVORY),
    box(0.66, 0.24, 0.34, 0.86, 0.62, 0.66, IVORY),
    box(0.86, 0.22, 0.32, 0.92, 0.64, 0.68, BRASS),
  ];
}

// The flying machine: a wooden keel, ribbed canvas wings either side, a tail.
ITEM_MODELS.flying_machine = [
  box(0.46, 0.38, 0.1, 0.54, 0.46, 0.9, 0x8a6440),
  box(0.04, 0.46, 0.3, 0.46, 0.5, 0.62, 0xefe6d2), box(0.54, 0.46, 0.3, 0.96, 0.5, 0.62, 0xefe6d2),
  box(0.04, 0.5, 0.3, 0.46, 0.53, 0.33, 0x8a6440), box(0.54, 0.5, 0.3, 0.96, 0.53, 0.33, 0x8a6440),
  box(0.36, 0.46, 0.82, 0.64, 0.49, 0.94, 0xefe6d2),
];

// The cart: a plank box on two wheels, shafts out the front.
ITEM_MODELS.cart = [
  box(0.18, 0.32, 0.22, 0.82, 0.62, 0.72, 0xa77b4f),
  box(0.06, 0.12, 0.38, 0.18, 0.5, 0.56, 0x5e4129), box(0.82, 0.12, 0.38, 0.94, 0.5, 0.56, 0x5e4129),
  box(0.3, 0.4, 0.72, 0.36, 0.46, 0.98, 0x8a6440), box(0.64, 0.4, 0.72, 0.7, 0.46, 0.98, 0x8a6440),
];
