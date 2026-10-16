import { BLOCKS, BLOCKS_BY_ID } from '../config/blocks.js';
import { room, SLATE } from '../config/starterDesigns.js';

/**
 * The texture lab: two things put up in the showcase (world/showcase.js) for
 * judging how blocks look, asked for directly: "setup a creative world and
 * build a couple of buildings, from template and one by yourself, for us to
 * test this properly."
 *
 * - The material stand: every full block, each a 2×2×2 cube, in stepped rows
 *   like seats in a stand, so the whole set faces one camera at once.
 * - A storybook cottage: timber-framed, slate-roofed, with a chimney,
 *   shutters, lanterns on posts, blossom bushes, moss and a sand path. The
 *   template buildings stand in the showcase's rows beside it.
 *
 * Both as [dx, dy, dz, id], the way world/landmarks.js writes its places.
 */

const byName = (name) => BLOCKS.find((b) => b.name === name && b.stateOf == null)?.id;

/** Every block that's a plain cube, once each: no shapes, no plants, no fluids, nothing the world keeps for itself. */
export function standBlocks() {
  const seen = new Set();
  return BLOCKS.filter((b) => {
    if (b.shape || b.system || b.stateOf != null || seen.has(b.name)) return false;
    if (/Water|Lava|Plant|Ripe|Sapling|Egg|Way Out|Godstone|Time Machine/.test(b.name)) return false;
    seen.add(b.name);
    return true;
  }).map((b) => b.id);
}

const ACROSS = 12;

function stand() {
  const out = [];
  const ids = standBlocks();
  ids.forEach((id, i) => {
    const col = i % ACROSS, row = Math.floor(i / ACROSS);
    const x0 = col * 3, z0 = row * 3, y0 = row * 2;
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) {
      // The step under each row, so a cube never floats.
      for (let y = 0; y < y0; y++) out.push([x0 + dx, y, z0 + dz, byName('Stone Brick') ?? 3]);
      for (let dy = 0; dy < 2; dy++) out.push([x0 + dx, y0 + dy, z0 + dz, id]);
    }
  });
  return out;
}

function cottage() {
  const TIMBER = byName('Timber Frame') ?? 160, PLANKS = 7, COBBLE = 8;
  const house = room({ w: 7, h: 4, wall: TIMBER, floor: PLANKS, tiles: SLATE, chimney: { h: 2 }, shutters: true, plinth: COBBLE, hood: true });
  // room() lays its own blocks from (0, 0): the eaves make the house 9 wide.
  const out = house.map((b) => [b.dx + 4, b.dy, b.dz + 6, b.type]);
  const blossom = byName('White Leaves') ?? 42, leaves = 5, moss = 22, path = byName('Sand Path') ?? 6;
  const fence = byName('White Fence') ?? 47, lantern = 26, log = 4;
  // A path from the door down to the front of the garden.
  const doorX = 4 + 1 + 3;
  for (let z = 0; z < 6; z++) out.push([doorX, -1, z, path]);
  // Blossom bushes and moss either side of it.
  for (const [x, z, h, id] of [[2, 2, 2, blossom], [3, 1, 1, blossom], [12, 2, 2, blossom], [11, 3, 1, leaves], [5, 3, 1, leaves], [10, 1, 1, blossom]]) {
    for (let y = 0; y < h; y++) out.push([x, y, z, id]);
  }
  for (const [x, z] of [[1, 4], [2, 5], [6, 2], [9, 4], [13, 5], [12, 0], [4, 0]]) out.push([x, -1, z, moss]);
  // A white picket fence along the front, open at the path.
  for (let x = 0; x <= 16; x++) if (Math.abs(x - doorX) > 1) out.push([x, 0, -1, fence]);
  // Lanterns on posts at the gate.
  for (const x of [doorX - 2, doorX + 2]) { out.push([x, 0, 0, log], [x, 1, 0, fence], [x, 2, 0, lantern]); }
  // A little blossom tree beside the house.
  for (let y = 0; y < 4; y++) out.push([15, y, 9, log]);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 3; dy <= 5; dy++) {
    if (dy === 5 && (dx || dz)) continue;
    if (dx === 0 && dz === 0 && dy < 4) continue;
    out.push([15 + dx, dy, 9 + dz, blossom]);
  }
  return out.filter((b) => BLOCKS_BY_ID.has(b[3]));
}

/** The lab's designs, in the shape showcase.js lays out. */
export function labDesigns() {
  return [
    { id: 'lab_cottage', name: 'Storybook cottage', place: 'lab', blocks: cottage() },
    { id: 'lab_materials', name: 'Every block', place: 'lab', blocks: stand() },
  ];
}
