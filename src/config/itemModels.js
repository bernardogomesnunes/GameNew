import { CROPS } from './crops.js';

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
  // A packet of seeds that could come up as anything.
  seeds: packet([
    [0.28, 0.3, 0.4, 0.42, 0xe8873a],
    [0.44, 0.44, 0.56, 0.56, 0xd84a3c],
    [0.6, 0.3, 0.72, 0.42, 0x6ea653],
  ]),
};

// A packet per crop, with the crop on the front and a leaf above it.
for (const c of CROPS) {
  ITEM_MODELS[`seeds_${c.kind}`] = packet([
    [0.46, 0.5, 0.54, 0.62, c.leaf],
    [0.34, 0.2, 0.66, 0.5, c.crop],
  ]);
}
