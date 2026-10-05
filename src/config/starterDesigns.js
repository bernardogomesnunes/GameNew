/**
 * One ready-made design per building type.
 *
 * These are the second route in from the notebook: build it yourself and claim
 * it, or take a design that was made to pass. They earn their place twice over
 * — as a shortcut for anyone who would rather get on with it, and as a worked
 * example, because stamping the starter farm once makes the rules stop being
 * abstract.
 *
 * Blocks are offsets from the design's corner, so a design drops straight into
 * the same stamping path saved templates already use.
 */

import { ITEM_FOR_BLOCK } from './items.js';
import { doorBlock, roofBlock, turned, CHEST, BED, BED_HEAD, FACING_STEP, PAINTING, WEAPON_RACK, TRAINING_DUMMY, ARCHERY_TARGET } from './blocks.js';
import { ROOFS_BY_ID } from './roofs.js';
import { roofBlocks, roofTypeFor } from '../tools/RoofTool.js';

const DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, PLANKS = 7, COBBLE = 8,
      BRICK = 9, GOLD = 13, MARBLE = 17, SAPLING = 20, FARMLAND = 21, FENCE = 47, GATE = 48;

// Furniture for the houses (playtest, P1) — see blocks.js.
const WINDOW = 176, OAK_TABLE = 31, OAK_CHAIR = 33, RED_RUG = 35, LANTERN_BLOCK = 26;

// Requested directly: "we should revisit improving the templates of the
// buildings, adding a roof and door to every building is minimum." Every
// building you walk into has a door hung in its doorway and a pitched roof
// of tiles over its ceiling — slate on the early ones, since brick doesn't
// exist until the workshop, brick from then on.
const SLATE = roofBlock({ mat: 1 }), TILE = roofBlock({ mat: 0 });

/** A door in a doorway at (dx, dy, dz) — both halves, facing in from -z. */
function door(dx, dy, dz) {
  return [
    { dx, dy, dz, type: doorBlock({ facing: 2 }) },
    { dx, dy: dy + 1, dz, type: doorBlock({ facing: 2, top: true }) },
  ];
}

/**
 * A gable of roof tiles over a w × d footprint whose top is at dy — laid by
 * the Roof tool's own rules (tools/RoofTool.js), so a design's roof is the
 * roof you'd get pointing the tool at it. The ridge runs the long way; the
 * gable ends are filled in the building's own walling.
 */
function gable(x0, z0, w, d, dy, tile, wall) {
  const spans = new Map();
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) spans.set(`${x0 + x},${z0 + z}`, { xm: x + 1, xp: w - x, zm: z + 1, zp: d - z });
  }
  return roofBlocks({ spans }, { shape: ROOFS_BY_ID.get('gable'), turn: w > d ? 1 : 0 })
    .map((b) => ({ dx: b.x, dy: dy + b.dy, dz: b.z, type: b.slope ? roofTypeFor(tile, b) : wall }));
}

/** A solid rectangle of one block, at one height. */
function slab(x0, z0, w, d, dy, type) {
  const out = [];
  for (let dx = x0; dx < x0 + w; dx++) for (let dz = z0; dz < z0 + d; dz++) out.push({ dx, dy, dz, type });
  return out;
}

/** The outline of a rectangle — walls without a floor inside them. */
function ring(x0, z0, w, d, dy, type) {
  return slab(x0, z0, w, d, dy, type)
    .filter((b) => b.dx === x0 || b.dx === x0 + w - 1 || b.dz === z0 || b.dz === z0 + d - 1);
}

/** Moves a block list to a corner other than its own — how a compound design is built from smaller pieces. */
function shifted(blocks, dx0, dz0) {
  return blocks.map((b) => ({ ...b, dx: b.dx + dx0, dz: b.dz + dz0 }));
}

/**
 * A walled room with a doorway, which is what most of these are.
 *
 * The doorway matters to more than looks: the shelter test asks for cells with
 * a roof and four walls, and every cell in line with the door has three. A 5×5
 * shell loses six of its eighteen sheltered cells that way and lands exactly on
 * the limit, so these are all a size up from where they look like they should
 * be.
 */
function room({ w, h, wall, floor = null, roof = wall, door: hasDoor = true, tiles = null }) {
  const blocks = [];
  if (floor != null) blocks.push(...slab(0, 0, w, w, 0, floor));
  const base = floor != null ? 1 : 0;
  for (let dy = base; dy < base + h; dy++) blocks.push(...ring(0, 0, w, w, dy, wall));
  blocks.push(...slab(0, 0, w, w, base + h, roof));
  if (tiles != null) blocks.push(...gable(0, 0, w, w, base + h + 1, tiles, wall));
  if (!hasDoor) return blocks;
  const mid = Math.floor(w / 2);
  return [
    ...blocks.filter((b) => !(b.dz === 0 && b.dx === mid && b.dy >= base && b.dy < base + Math.min(2, h))),
    ...(h >= 2 ? door(mid, base, 0) : []),
  ];
}

/** A trunk with a leafy crown, at a local offset. */
function tree(ox, oz, h = 4) {
  const blocks = [];
  for (let y = 0; y < h; y++) blocks.push({ dx: ox, dy: y, dz: oz, type: WOOD });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = h - 1; dy <= h + 1; dy++) {
        if (dy === h + 1 && (dx !== 0 || dz !== 0)) continue;
        blocks.push({ dx: ox + dx, dy, dz: oz + dz, type: LEAVES });
      }
    }
  }
  return blocks;
}

function farmBlocks() {
  // Four rows of soil, and nothing sown in it. Backlog batch 2: a farm takes
  // no seeds to build — what it grows is the seeds put into it from its own
  // pop-up afterwards (duilt/Crops.js), so the plot doesn't spend yours.
  const blocks = [];
  for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) blocks.push({ dx, dy: 0, dz, type: FARMLAND });
  return blocks;
}

function forestBlocks() {
  // Four trees on a bed of soil — comfortably past the trunk and canopy counts.
  const blocks = [];
  for (let dx = 0; dx < 8; dx++) for (let dz = 0; dz < 8; dz++) blocks.push({ dx, dy: 0, dz, type: DIRT });
  return [
    ...blocks,
    ...tree(1, 1, 5), ...tree(6, 1, 4), ...tree(1, 6, 4), ...tree(6, 6, 5),
    { dx: 3, dy: 1, dz: 3, type: SAPLING }, { dx: 4, dy: 1, dz: 4, type: SAPLING },
  ];
}

function houseBlocks() {
  // A 5x5 shell, four high, with a doorway punched in one wall.
  const blocks = [];
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 5; dz++) {
      for (let dy = 0; dy < 4; dy++) {
        const shell = dx === 0 || dx === 4 || dz === 0 || dz === 4 || dy === 0 || dy === 3;
        if (shell) blocks.push({ dx, dy, dz, type: WOOD });
      }
    }
  }
  // The doorway, with its door. A house needs a way in, and the rules only
  // ask that the room above it stays sealed.
  return [
    ...blocks.filter((b) => !(b.dz === 0 && b.dx === 2 && (b.dy === 1 || b.dy === 2))),
    ...door(2, 1, 0),
    ...gable(0, 0, 5, 5, 4, SLATE, WOOD),
    // Somewhere to sleep, and a painting over it — where you wake after a
    // fall, once you've chosen it (playtest, P1). Both are first-age things;
    // windows and the rest come with the townhouse.
    ...bed(1, 1, 2, 2),
    { dx: 3, dy: 2, dz: 3, type: PAINTING + 2 },
  ];
}

/**
 * A cut face of rock, open to the sky.
 *
 * A quarry has to be a hole in something — the rules ask for air inside it as
 * well as stone, so this places a pad and takes a bite out of the top of it.
 */
function quarryBlocks() {
  return [
    ...slab(0, 0, 6, 6, 0, STONE),
    ...slab(0, 0, 6, 6, 1, STONE).filter((b) => b.dx < 1 || b.dx > 3 || b.dz < 1 || b.dz > 3),
  ];
}

/** A stone hearth with a sealed cobble chamber standing on it. */
function kilnBlocks() {
  const blocks = [...slab(0, 0, 5, 5, 0, DIRT)];
  blocks.push(...slab(1, 1, 3, 3, 1, COBBLE));
  blocks.push(...ring(1, 1, 3, 3, 2, COBBLE));
  blocks.push(...ring(1, 1, 3, 3, 3, COBBLE));
  blocks.push(...slab(1, 1, 3, 3, 4, COBBLE));
  // A tiled roof, with the chimney coming up through it.
  blocks.push(...withChimney(gable(1, 1, 3, 3, 5, TILE, COBBLE), 3, 3, 5, 2, BRICK));
  return blocks;   // the two cells left at (2,2,2) and (2,2,3) are the chamber
}

/** A taller, thicker-walled kiln — the chamber holds three cells instead of two. */
function foundryBlocks() {
  const blocks = [...slab(0, 0, 5, 5, 0, STONE)];
  blocks.push(...slab(1, 1, 3, 3, 1, STONE));
  blocks.push(...ring(1, 1, 3, 3, 2, STONE));
  blocks.push(...ring(1, 1, 3, 3, 3, STONE));
  blocks.push(...ring(1, 1, 3, 3, 4, STONE));
  blocks.push(...slab(1, 1, 3, 3, 5, STONE));
  // Slate over it, and a taller chimney than the kiln's — it runs hotter.
  blocks.push(...withChimney(gable(1, 1, 3, 3, 6, SLATE, STONE), 3, 3, 6, 3, BRICK));
  return blocks;   // three cells left, at (2,2,2), (2,2,3) and (2,2,4)
}

/**
 * A chimney `h` blocks tall standing at (dx, dz) from `dy` up, through
 * whatever roof is there.
 */
function withChimney(roof, dx, dz, dy, h, type) {
  const chimney = [];
  for (let y = dy; y < dy + h; y++) chimney.push({ dx, dy: y, dz, type });
  return [...roof.filter((b) => !(b.dx === dx && b.dz === dz)), ...chimney];
}

/**
 * A market hall (batch: "a market building should be improved to be bigger,
 * and a bit more detailed. Windows, different areas inside. One that is
 * important is the place where a new mob will live. The trader"). Outside
 * is -z: a cobbled yard with two awninged stalls, then the hall — framed
 * windows all round, a chandelier, a counter with the stock chest behind it
 * on the left, and on the right the traders' corner, rugged and fenced off,
 * where the goblins who keep the market live (config/traders.js).
 */
function marketBlocks() {
  const g = grid();
  const W = 11, Z0 = 4, Z1 = 10;                                 // the hall, z 4..10
  // The yard, and a stall either side of the way in.
  g.box(0, 0, 0, W - 1, 0, Z0 - 1, COBBLE);
  for (const x0 of [0, 8]) {
    for (const x of [x0, x0 + 2]) g.box(x, 1, 0, x, 2, 0, WOOD);
    g.box(x0, 3, 0, x0 + 2, 3, 1, PLANKS);
    g.put(x0 + 1, 1, 0, OAK_TABLE_);
  }
  // The hall: floor, walls with posts at the corners and either side of the
  // door, a ceiling, and a tiled roof.
  g.box(0, 0, Z0, W - 1, 0, Z1, PLANKS);
  for (let y = 1; y <= 3; y++) {
    for (let x = 0; x < W; x++) { g.put(x, y, Z0, PLANKS); g.put(x, y, Z1, PLANKS); }
    for (let z = Z0; z <= Z1; z++) { g.put(0, y, z, PLANKS); g.put(W - 1, y, z, PLANKS); }
  }
  for (const [x, z] of [[0, Z0], [W - 1, Z0], [0, Z1], [W - 1, Z1], [4, Z0], [6, Z0]]) g.box(x, 1, z, x, 3, z, WOOD);
  g.box(0, 4, Z0, W - 1, 4, Z1, PLANKS);
  g.add(gable(0, Z0, W, Z1 - Z0 + 1, 5, TILE, PLANKS));
  // Windows: two at the front, three at the back, two each end.
  for (const x of [2, 8]) g.put(x, 2, Z0, WINDOW);
  for (const x of [2, 5, 8]) g.put(x, 2, Z1, WINDOW);
  for (const z of [6, 8]) { g.put(0, 2, z, WINDOW + 1); g.put(W - 1, 2, z, WINDOW + 1); }
  g.add(door(5, 1, Z0));
  // The counter, on the left, with the stock chest behind it.
  for (const x of [1, 2, 3]) g.put(x, 1, 7, OAK_TABLE_);
  g.put(2, 2, 7, LANTERN);
  g.put(1, 1, 9, CHEST);
  // The traders' corner, on the right: rugs, a seat, a chest of their own,
  // fenced off from the way through.
  for (const x of [7, 8, 9]) for (const z of [7, 8, 9]) g.put(x, 1, z, RED_RUG);
  g.put(9, 1, 9, turned(OAK_CHAIR, 2));
  g.put(9, 1, 5, CHEST);
  for (const z of [7, 8, 9]) g.put(6, 1, z, FENCE);
  // A light over the middle, hung from the ceiling.
  g.put(5, 3, 7, CHANDELIER);
  return g.blocks();
}

/** A working with timber holding the roof up. Aim it deep — the rules check. */
function mineBlocks() {
  const blocks = [...slab(0, 0, 6, 6, 0, STONE)];
  for (const dy of [1, 2]) {
    blocks.push(...ring(0, 0, 6, 6, dy, STONE));
    for (const [dx, dz] of [[1, 1], [4, 1], [1, 4], [4, 4]]) blocks.push({ dx, dy, dz, type: PLANKS });
  }
  return blocks;
}

/**
 * A stepped obelisk. Brick at the base where the bulk is, marble up the shaft,
 * gold at the cap — the rule counts all three, and doing it in marble alone
 * would cost four hundred stone.
 */
/**
 * A shrine (Phase 7c): a marble room with an altar and a lantern, on a
 * stone platform wide enough to build the rest of a temple on — pillars at
 * its corners, and room on every side for more.
 */
function templeBlocks() {
  const MARBLE_TABLE = 32, LANTERN = 26, STONE_PILLAR = 165;
  const blocks = [...slab(0, 0, 9, 9, 0, STONE)];
  for (const dy of [1, 2, 3]) {
    blocks.push(...ring(2, 2, 5, 5, dy, MARBLE).filter((b) => !(b.dz === 2 && b.dx === 4 && dy < 3)));
  }
  blocks.push(...slab(2, 2, 5, 5, 4, MARBLE));
  blocks.push(...gable(2, 2, 5, 5, 5, SLATE, MARBLE));
  blocks.push({ dx: 4, dy: 1, dz: 5, type: MARBLE_TABLE });
  blocks.push({ dx: 5, dy: 1, dz: 5, type: LANTERN });
  for (const [dx, dz] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
    for (const dy of [1, 2, 3, 4]) blocks.push({ dx, dy, dz, type: STONE_PILLAR });
  }
  return blocks;
}

/**
 * The White Sanctuary (Phase 7d): a sky-marble floor open to the sky,
 * marble pillars at its corners each crowned with a firefly lantern, and
 * a gold altar in the middle.
 */
function whiteSanctuaryBlocks() {
  const SKY_MARBLE = 158, GOLD_TRIM = 159, MARBLE_PILLAR = 166, FIREFLY = 190;
  const blocks = [...slab(0, 0, 7, 7, 0, SKY_MARBLE)];
  blocks.push(...ring(0, 0, 7, 7, 0, GOLD_TRIM));
  for (const [dx, dz] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
    for (const dy of [1, 2, 3]) blocks.push({ dx, dy, dz, type: MARBLE_PILLAR });
    blocks.push({ dx, dy: 4, dz, type: FIREFLY });
  }
  blocks.push({ dx: 3, dy: 1, dz: 3, type: GOLD });
  return blocks;
}

/**
 * The Black Sanctuary (Phase 7d): an obsidian ring round an open pit, with
 * dark pillars at its corners and black banners on them.
 */
function blackSanctuaryBlocks() {
  const OBSIDIAN = 14, DARK_STONE = 156, DARK_PILLAR = 167;
  const blocks = [...ring(0, 0, 7, 7, 0, DARK_STONE), ...ring(1, 1, 5, 5, 0, OBSIDIAN)];
  blocks.push(...ring(0, 0, 7, 7, 1, OBSIDIAN).filter((b) => !(b.dz === 0 && b.dx === 3)));
  for (const [dx, dz] of [[0, 0], [6, 0], [0, 6], [6, 6]]) {
    for (const dy of [2, 3]) blocks.push({ dx, dy, dz, type: DARK_PILLAR });
  }
  // The pit: the middle three by three is left open, and the region runs
  // up over it — that open middle is the pit the rules ask for.
  return blocks;
}

function monumentBlocks() {
  const blocks = [...ring(0, 0, 7, 7, 0, BRICK)];
  blocks.push(...ring(1, 1, 5, 5, 1, BRICK));
  blocks.push(...ring(1, 1, 5, 5, 2, BRICK));
  for (const dy of [3, 4, 5]) blocks.push(...slab(2, 2, 3, 3, dy, MARBLE));
  blocks.push({ dx: 3, dy: 6, dz: 3, type: GOLD });
  blocks.push({ dx: 3, dy: 7, dz: 3, type: GOLD });
  return blocks;
}

/** A bigger, better-finished room than a house's — three households' worth. */
function townhouseBlocks() {
  // Furnished (playtest, P1): framed windows front, back and sides, two
  // beds, a table with chairs, a rug, a lantern and a painting.
  const shell = room({ w: 8, h: 3, wall: PLANKS, floor: STONE, tiles: TILE });
  const windows = [[2, 2, 7, 0], [5, 2, 7, 0], [0, 2, 3, 1], [0, 2, 5, 1], [7, 2, 3, 1], [7, 2, 5, 1]];
  const at = new Set(windows.map(([x, y, z]) => `${x},${y},${z}`));
  return [
    ...shell.filter((b) => !at.has(`${b.dx},${b.dy},${b.dz}`)),
    ...windows.map(([dx, dy, dz, f]) => ({ dx, dy, dz, type: WINDOW + f })),
    ...bed(2, 1, 5, 2),
    ...bed(5, 1, 5, 2),
    { dx: 5, dy: 1, dz: 2, type: OAK_TABLE },
    { dx: 6, dy: 1, dz: 2, type: OAK_CHAIR },
    { dx: 4, dy: 1, dz: 2, type: OAK_CHAIR },
    { dx: 3, dy: 1, dz: 3, type: RED_RUG },
    { dx: 4, dy: 1, dz: 3, type: RED_RUG },
    { dx: 1, dy: 1, dz: 1, type: LANTERN_BLOCK },
    { dx: 3, dy: 2, dz: 6, type: PAINTING + 2 },
  ];
}

/** A bed with its foot at (dx, dy, dz), facing `f` — both halves (playtest, P1). */
function bed(dx, dy, dz, f) {
  const [sx, sz] = FACING_STEP[f];
  return [
    { dx, dy, dz, type: BED + f },
    { dx: dx + sx, dy, dz: dz + sz, type: BED_HEAD + f },
  ];
}

/** A room with a brick hearth for a floor — the brick is the hearth the rule asks for. */
function tavernBlocks() {
  return room({ w: 6, h: 2, wall: PLANKS, floor: BRICK, tiles: TILE });
}

/**
 * A stone shell tall enough to watch from, under a slate roof. The rules'
 * "open sky" asks that nothing is built over the building — its own roof is
 * part of it.
 */
function militaryBlocks() {
  return room({ w: 6, h: 5, wall: STONE, tiles: SLATE });
}

/**
 * A forest, a farm, three houses and a shed, laid out side by side rather
 * than stacked — big enough that the pieces read as their own buildings
 * rather than one room wearing four labels.
 */
function villageBlocks() {
  const house = () => room({ w: 5, h: 2, wall: WOOD, floor: PLANKS, tiles: TILE });
  const shed = () => room({ w: 5, h: 2, wall: PLANKS, floor: PLANKS, tiles: TILE });
  return [
    ...shifted(farmBlocks(), 0, 0),
    ...shifted(forestBlocks(), 0, 5),
    ...shifted(house(), 9, 3),
    ...shifted(house(), 9, 9),
    ...shifted(house(), 15, 3),
    ...shifted(shed(), 15, 9),
  ];
}

// ---- Defence (White path) ------------------------------------------------------
//
// Asked for directly: "use this opportunity to make them detailed." So these
// are drawn the way a mason would: a plinth course and a string course, quoins
// at the corners, arrow slits, battlements, a walk along the top and a stair
// to reach it. Each is laid on a grid, later cells over earlier ones, so a
// stair or a slit is just a cell written again.

const DARK_STONE = 156, DARK_BRICK = 157, STONE_WALL_POST = 162, STONE_PILLAR = 165;
const STONE_STAIRS = 29, LANTERN = 26, CHANDELIER = 85, WHITE_BANNER = 182;
const CALCADA = 209, GRAVEL = 23, TIMBER = 160, DARK_WOOD = 43, OAK_TABLE_ = 31;

/** A grid of cells, later writes over earlier — the way these are drawn. */
function grid() {
  const cells = new Map();
  const put = (dx, dy, dz, type) => {
    if (type == null) cells.delete(`${dx},${dy},${dz}`);
    else cells.set(`${dx},${dy},${dz}`, { dx, dy, dz, type });
  };
  return {
    put,
    box(x0, y0, z0, x1, y1, z1, type) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, type);
    },
    add(blocks) { for (const b of blocks) put(b.dx, b.dy, b.dz, b.type); },
    blocks: () => [...cells.values()],
  };
}

/** A stair you climb going `facing` (0 -z, 1 +x, 2 +z, 3 -x). */
const stair = (facing) => turned(STONE_STAIRS, facing);

/**
 * A length of wall, 16 long and 3 thick: a cobble plinth, dressed stone
 * faces with a dark string course and dark quoins at the ends, a rubble
 * core, and on top a walk behind a parapet with merlons and arrow slits.
 * A stair climbs to the walk at one end; a lantern and a banner on it.
 * The outside is -z.
 */
function wallBlocks() {
  const g = grid(), L = 16;
  g.box(0, 0, 0, L - 1, 0, 2, COBBLE);                          // footing
  g.box(0, 1, 0, L - 1, 3, 2, STONE);                           // the body
  g.box(0, 1, 0, L - 1, 1, 0, COBBLE);                          // plinth course, outside
  g.box(0, 1, 1, L - 1, 3, 1, COBBLE);                          // rubble core
  g.box(0, 3, 0, L - 1, 3, 0, DARK_STONE);                      // string course
  for (const x of [0, L - 1]) g.box(x, 1, 0, x, 3, 2, DARK_BRICK); // quoins at the ends
  g.box(0, 4, 0, L - 1, 4, 0, STONE);                           // the parapet
  for (let x = 0; x < L; x += 2) g.put(x, 5, 0, STONE);         // merlons
  for (let x = 3; x < L; x += 4) g.put(x, 4, 0, STONE_WALL_POST); // arrow slits
  // The stair up, along the inside face at the near end: you climb +x.
  for (let i = 0; i < 3; i++) { g.put(i, 1 + i, 2, stair(1)); g.box(i, 2 + i, 2, i, 3, 2, null); }
  g.put(8, 4, 2, LANTERN);
  g.put(12, 4, 2, turned(WHITE_BANNER, 0));
  return g.blocks();
}

/**
 * A gatehouse, 13 wide: two towers with guardrooms over a vaulted passage,
 * a gate of three doors in a dressed frame, the walk across the top from
 * tower to tower behind battlements, a stair in the left tower to reach
 * it, arrow slits, lanterns at the gate and banners above. Outside is -z.
 */
function gatehouseBlocks() {
  const g = grid();
  const TOWERS = [0, 9];                                         // each 4 wide, 6 deep
  g.box(0, 0, 0, 12, 0, 5, COBBLE);                             // footing
  g.box(4, 0, 0, 8, 0, 5, CALCADA);                             // the road through
  for (const x0 of TOWERS) {
    const x1 = x0 + 3;
    g.box(x0, 1, 0, x1, 8, 5, STONE);
    g.box(x0 + 1, 1, 1, x1 - 1, 3, 4, null);                    // guardroom
    g.box(x0 + 1, 4, 1, x1 - 1, 4, 4, PLANKS);                  // its ceiling, the upper room's floor
    g.box(x0 + 1, 5, 1, x1 - 1, 7, 4, null);                    // the upper room
    g.box(x0, 1, 0, x1, 1, 5, COBBLE);                          // plinth course
    g.box(x0, 1, 1, x1, 1, 4, null);                            // (not inside)
    g.box(x0 + 1, 1, 1, x1 - 1, 1, 4, null);
    g.box(x0, 4, 0, x1, 4, 0, DARK_STONE);                      // string course, front
    g.box(x0, 4, 5, x1, 4, 5, DARK_STONE);                      // and back
    for (const [x, z] of [[x0, 0], [x1, 0], [x0, 5], [x1, 5]]) g.box(x, 1, z, x, 8, z, DARK_BRICK); // quoins
    for (const y of [2, 6]) g.put(x0 + 1, y, 0, STONE_WALL_POST); // arrow slits, front
    g.put(x0 + 2, 6, 5, STONE_WALL_POST);                       // and one at the back
    // The tower top: battlements all round, and a taller merlon at each corner.
    for (let x = x0; x <= x1; x++) for (const z of [0, 5]) if ((x - x0) % 2 === 0 || x === x1) g.put(x, 9, z, STONE);
    for (let z = 1; z < 5; z++) for (const x of [x0, x1]) if (z % 2 === 0) g.put(x, 9, z, STONE);
    for (const [x, z] of [[x0, 0], [x1, 0], [x0, 5], [x1, 5]]) g.put(x, 10, z, DARK_BRICK);
  }
  g.put(1, 1, 1, null);
  // Guardroom doors, off the passage.
  g.add([{ dx: 3, dy: 1, dz: 3, type: doorBlock({ facing: 1 }) }, { dx: 3, dy: 2, dz: 3, type: doorBlock({ facing: 1, top: true }) }]);
  g.add([{ dx: 9, dy: 1, dz: 3, type: doorBlock({ facing: 3 }) }, { dx: 9, dy: 2, dz: 3, type: doorBlock({ facing: 3, top: true }) }]);
  // The passage's vault and the walk over it, joining the tower tops.
  g.box(4, 5, 0, 8, 8, 5, STONE);
  g.box(4, 5, 0, 8, 5, 5, DARK_STONE);                          // the vault's soffit
  g.box(4, 8, 0, 8, 8, 5, COBBLE);                              // the walk
  for (let x = 4; x <= 8; x++) if (x % 2 === 0) { g.put(x, 9, 0, STONE); g.put(x, 9, 5, STONE); }
  // The gate: a dressed frame of dark brick, three doors, a lintel over them.
  g.box(4, 1, 1, 4, 4, 1, DARK_BRICK);
  g.box(8, 1, 1, 8, 4, 1, DARK_BRICK);
  g.box(5, 3, 1, 7, 4, 1, DARK_BRICK);
  g.add([5, 6, 7].flatMap((x) => door(x, 1, 1)));
  // Lanterns either side of the gate, outside; banners over the walk.
  g.put(4, 1, 0, LANTERN);
  g.put(8, 1, 0, LANTERN);
  g.put(5, 9, 3, turned(WHITE_BANNER, 0));
  g.put(7, 9, 3, turned(WHITE_BANNER, 0));
  // The stair up, in the left tower: three steps to the upper room...
  for (let i = 0; i < 3; i++) g.put(1, 1 + i, 1 + i, stair(2));
  for (let i = 0; i < 3; i++) g.put(1, 4, 1 + i, null);
  // ...and three more, the other way, out onto the top.
  for (let i = 0; i < 3; i++) g.put(2, 5 + i, 4 - i, stair(0));
  for (let i = 0; i < 3; i++) g.put(2, 8, 3 - i, null);
  g.put(2, 8, 1, null);
  return g.blocks();
}

/**
 * A watchtower: a five-square stone shaft on a wide plinth, dark quoins
 * and a string course, a door, a stair winding up round a central pillar
 * inside to a lookout that overhangs the shaft on every side, with
 * battlements, a merlon raised at each corner, a signal lantern, a banner,
 * and a slate roof on four posts over it all.
 */
function watchtowerBlocks() {
  const g = grid();
  g.box(0, 0, 0, 6, 0, 6, COBBLE);                              // the plinth
  g.box(1, 1, 1, 5, 10, 5, STONE);                              // the shaft
  g.box(2, 1, 2, 4, 10, 4, null);                               // hollow
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) g.box(x, 1, z, x, 10, z, DARK_BRICK); // quoins
  g.box(1, 1, 1, 5, 1, 5, COBBLE);                              // plinth course
  g.box(2, 1, 2, 4, 1, 4, null);
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) g.put(x, 1, z, DARK_BRICK);
  g.box(1, 6, 1, 5, 6, 1, DARK_STONE); g.box(1, 6, 5, 5, 6, 5, DARK_STONE);  // string course
  g.box(1, 6, 1, 1, 6, 5, DARK_STONE); g.box(5, 6, 1, 5, 6, 5, DARK_STONE);
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) g.put(x, 6, z, DARK_BRICK);
  // Arrow slits, two up each face.
  for (const y of [4, 8]) {
    g.put(3, y, 1, STONE_WALL_POST); g.put(3, y, 5, STONE_WALL_POST);
    g.put(1, y, 3, STONE_WALL_POST); g.put(5, y, 3, STONE_WALL_POST);
  }
  g.add(door(3, 1, 1));
  // The stair, winding up round a pillar: eight cells round it, a step a
  // cell, climbing the way it turns. In by the door at (3, 2).
  g.box(3, 1, 3, 3, 10, 3, STONE_PILLAR);
  const RING = [[2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3]];
  const towards = (a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? 3 : b[1] > a[1] ? 2 : 0);
  for (let k = 0; k < 11; k++) {
    const i = (2 + k) % 8, prev = RING[(i + 7) % 8], at = RING[i];
    g.put(at[0], 1 + k, at[1], stair(towards(prev, at)));
  }
  // The lookout floor, overhanging the shaft, open over the top of the stair.
  g.box(0, 11, 0, 6, 11, 6, STONE);
  for (const [x, z] of [[4, 2], [4, 3]]) g.put(x, 11, z, null);
  g.put(4, 11, 4, stair(2));
  // Corbels under the overhang.
  for (const i of [1, 3, 5]) { g.put(i, 10, 0, COBBLE); g.put(i, 10, 6, COBBLE); g.put(0, 10, i, COBBLE); g.put(6, 10, i, COBBLE); }
  // Battlements round it, and a raised merlon at each corner.
  for (let i = 0; i <= 6; i += 2) { g.put(i, 12, 0, STONE); g.put(i, 12, 6, STONE); g.put(0, 12, i, STONE); g.put(6, 12, i, STONE); }
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) g.put(x, 13, z, DARK_BRICK);
  // A slate roof on four posts, the signal lantern under it, a banner.
  for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) g.box(x, 12, z, x, 14, z, STONE_PILLAR);
  g.add(gable(1, 1, 5, 5, 15, SLATE, STONE));
  g.put(3, 12, 3, LANTERN);
  g.put(2, 12, 4, turned(WHITE_BANNER, 2));
  return g.blocks();
}

/**
 * A barracks: a timber-framed hall on a cobble plinth under a slate roof,
 * with six bunks along the back, racks of arms on the walls, a mess table
 * with benches under a chandelier, framed windows, and in front a fenced
 * yard with a gate, training dummies, archery targets and banners.
 * Outside is -z, through the yard.
 */
function barracksBlocks() {
  const g = grid();
  const W = 13, Z0 = 6, Z1 = 13;                                // the hall, z 6..13
  // The yard.
  g.box(0, 0, 0, W - 1, 0, Z0 - 1, GRAVEL);
  for (let x = 0; x < W; x++) g.put(x, 1, 0, FENCE);
  for (let z = 0; z < Z0; z++) { g.put(0, 1, z, FENCE); g.put(W - 1, 1, z, FENCE); }
  g.put(6, 1, 0, GATE);
  g.put(5, 2, 0, LANTERN); g.put(7, 2, 0, LANTERN);              // on the gateposts
  g.put(2, 1, 3, turned(TRAINING_DUMMY, 0));
  g.put(4, 1, 3, turned(TRAINING_DUMMY, 0));
  g.put(9, 1, 1, turned(ARCHERY_TARGET, 2));
  g.put(11, 1, 1, turned(ARCHERY_TARGET, 2));
  g.put(5, 1, 1, turned(WHITE_BANNER, 0));
  g.put(7, 1, 1, turned(WHITE_BANNER, 0));
  // The hall: floor, plinth, timber-framed walls with dark posts, a wall
  // plate, a ceiling and a slate roof.
  g.box(0, 0, Z0, W - 1, 0, Z1, PLANKS);
  for (let y = 1; y <= 4; y++) {
    for (let x = 0; x < W; x++) { g.put(x, y, Z0, TIMBER); g.put(x, y, Z1, TIMBER); }
    for (let z = Z0; z <= Z1; z++) { g.put(0, y, z, TIMBER); g.put(W - 1, y, z, TIMBER); }
  }
  for (let x = 0; x < W; x++) { g.put(x, 1, Z0, COBBLE); g.put(x, 1, Z1, COBBLE); g.put(x, 4, Z0, DARK_WOOD); g.put(x, 4, Z1, DARK_WOOD); }
  for (let z = Z0; z <= Z1; z++) { g.put(0, 1, z, COBBLE); g.put(W - 1, 1, z, COBBLE); g.put(0, 4, z, DARK_WOOD); g.put(W - 1, 4, z, DARK_WOOD); }
  for (const x of [0, 4, 8, 12]) for (const z of [Z0, Z1]) g.box(x, 2, z, x, 3, z, DARK_WOOD);
  for (const z of [Z0, 9, Z1]) for (const x of [0, W - 1]) g.box(x, 2, z, x, 3, z, DARK_WOOD);
  g.box(0, 5, Z0, W - 1, 5, Z1, PLANKS);
  g.add(gable(0, Z0, W, Z1 - Z0 + 1, 6, SLATE, TIMBER));
  // Windows: three each long side, two each end.
  for (const x of [2, 10]) g.put(x, 2, Z0, WINDOW);
  for (const x of [2, 6, 10]) g.put(x, 2, Z1, WINDOW);
  for (const z of [8, 11]) { g.put(0, 2, z, WINDOW + 1); g.put(W - 1, 2, z, WINDOW + 1); }
  g.add(door(6, 1, Z0));
  // Six bunks along the back, heads to the wall.
  for (const x of [1, 3, 5, 7, 9, 11]) g.add(bed(x, 1, Z1 - 2, 2));
  // Racks of arms on the side walls.
  for (const z of [8, 9]) { g.put(1, 1, z, turned(WEAPON_RACK, 1)); g.put(W - 2, 1, z, turned(WEAPON_RACK, 3)); }
  // The mess: a long table, benches either side, a chandelier over it.
  for (const x of [4, 5, 7, 8]) g.put(x, 1, 9, OAK_TABLE_);
  for (const x of [4, 5, 7, 8]) { g.put(x, 1, 8, turned(OAK_CHAIR, 2)); }
  g.put(6, 4, 9, CHANDELIER);
  g.put(1, 1, 7, LANTERN); g.put(W - 2, 1, 7, LANTERN);
  g.put(6, 3, Z1 - 1, PAINTING + 2);
  return g.blocks();
}

export const STARTER_DESIGNS = [
  {
    id: 'starter_forest',
    structure: 'forest',
    name: 'Starter grove',
    size: 8,
    footprint: '8 × 8',
    blocks: forestBlocks(),
  },
  {
    id: 'starter_farm',
    structure: 'farm',
    name: 'Starter plot',
    size: 4,
    footprint: '4 × 4',
    note: 'Place it within 6 blocks of the river.',
    blocks: farmBlocks(),
  },
  {
    id: 'starter_pen',
    structure: 'pen',
    name: 'Paddock',
    size: 6,
    footprint: '6 × 6',
    note: 'Then lead animals in through the gate with vegetables or seeds in your hand.',
    // A ring of fence with a gate in the middle of one side.
    blocks: ring(0, 0, 6, 6, 0, FENCE).map((b) => (b.dx === 2 && b.dz === 0 ? { ...b, type: GATE } : b)),
  },
  {
    id: 'starter_house',
    structure: 'house',
    name: 'Starter cabin',
    size: 5,
    footprint: '5 × 5',
    blocks: houseBlocks(),
  },
  {
    id: 'starter_quarry',
    structure: 'quarry',
    name: 'Starter cut',
    size: 6,
    footprint: '6 × 6',
    note: 'Put it where the sky can see it — not in a cave.',
    blocks: quarryBlocks(),
  },
  {
    id: 'starter_storehouse',
    structure: 'storehouse',
    name: 'Starter shed',
    size: 5,
    footprint: '5 × 5',
    note: 'Put it where you walk past it — your buildings deliver here when your bag is full.',
    blocks: room({ w: 5, h: 2, wall: WOOD, floor: PLANKS, tiles: SLATE }),
  },
  {
    id: 'starter_workshop',
    structure: 'workshop',
    name: 'Starter workshop',
    size: 6,
    footprint: '6 × 6',
    note: 'Stand inside it to use the recipes it unlocks.',
    blocks: room({ w: 6, h: 2, wall: PLANKS, floor: STONE, tiles: TILE }),
  },
  // Backlog batch 2: the University and the Engineering Centre.
  {
    id: 'starter_university',
    structure: 'university',
    name: 'Starter university',
    size: 6,
    footprint: '6 × 6',
    note: 'Stand inside it to study.',
    blocks: [
      ...room({ w: 6, h: 2, wall: PLANKS, floor: STONE, tiles: TILE }),
      // Two desks to study at.
      { dx: 2, dy: 1, dz: 3, type: 31 }, { dx: 3, dy: 1, dz: 3, type: 31 },
    ],
  },
  {
    id: 'starter_engineering',
    structure: 'engineering',
    name: 'Starter engineering centre',
    size: 7,
    footprint: '7 × 7',
    note: 'Study engineering at a university first.',
    blocks: room({ w: 7, h: 3, wall: PLANKS, floor: STONE, tiles: TILE }),
  },
  {
    id: 'starter_kiln',
    structure: 'kiln',
    name: 'Starter kiln',
    size: 5,
    footprint: '5 × 5',
    note: 'Needs sand or earth within 6 blocks; the hearth it sits on counts.',
    blocks: kilnBlocks(),
  },
  {
    id: 'starter_market',
    structure: 'market',
    name: 'Market hall',
    size: 11,
    footprint: '11 × 11',
    note: 'Put it among your buildings — it will not count on its own in a field.',
    blocks: marketBlocks(),
  },
  {
    id: 'starter_townhouse',
    structure: 'townhouse',
    name: 'Starter townhouse',
    size: 8,
    footprint: '8 × 8',
    blocks: townhouseBlocks(),
  },
  {
    id: 'starter_tavern',
    structure: 'tavern',
    name: 'Starter tavern',
    size: 6,
    footprint: '6 × 6',
    note: 'Put it among your buildings — it will not count on its own in a field.',
    blocks: tavernBlocks(),
  },
  {
    id: 'starter_foundry',
    structure: 'foundry',
    name: 'Starter foundry',
    size: 5,
    footprint: '5 × 5',
    note: 'Put it among your buildings, near the workbench you already visit.',
    blocks: foundryBlocks(),
  },
  {
    id: 'starter_mine',
    structure: 'mine',
    name: 'Starter working',
    size: 6,
    footprint: '6 × 6',
    note: 'Aim it low. The floor has to reach y 12 or below.',
    blocks: mineBlocks(),
  },
  {
    id: 'starter_granary',
    structure: 'granary',
    name: 'Starter granary',
    size: 6,
    footprint: '6 × 6',
    note: 'Build it within 16 blocks of your fields.',
    blocks: room({ w: 6, h: 3, wall: PLANKS, tiles: TILE }),
  },
  {
    id: 'starter_military',
    structure: 'military',
    name: 'Starter garrison',
    size: 6,
    footprint: '6 × 6',
    note: 'Nothing may stand over the watch.',
    blocks: militaryBlocks(),
  },
  {
    id: 'starter_wall',
    structure: 'wall',
    name: 'Curtain wall',
    size: 16,
    footprint: '16 × 3',
    note: 'The outside is the side with the battlements. Lay several end to end round your land.',
    blocks: wallBlocks(),
  },
  {
    id: 'starter_gatehouse',
    structure: 'gatehouse',
    name: 'Gatehouse',
    size: 13,
    footprint: '13 × 6',
    note: 'Put it in your wall where the road comes in — the gate shuts itself when a round is coming.',
    blocks: gatehouseBlocks(),
  },
  {
    id: 'starter_watchtower',
    structure: 'watchtower',
    name: 'Watchtower',
    size: 7,
    footprint: '7 × 7',
    note: 'Two archers keep the lookout. Put it where it can see the side the Stone Kingdom comes from.',
    blocks: watchtowerBlocks(),
  },
  {
    id: 'starter_barracks',
    structure: 'barracks',
    name: 'Barracks',
    size: 13,
    footprint: '13 × 14',
    note: 'A soldier for every bunk. They train while you play, and march out to meet the army.',
    blocks: barracksBlocks(),
  },
  {
    id: 'starter_village',
    structure: 'village',
    name: 'Starter village',
    size: 20,
    footprint: '20 × 14',
    note: 'Needs fresh water within 8 blocks — build nearer the river.',
    blocks: villageBlocks(),
  },
  {
    id: 'starter_temple',
    structure: 'temple',
    name: 'Shrine',
    size: 9,
    footprint: '9 × 9',
    note: 'A shrine on a platform with room to grow — build it up into a temple where it stands.',
    blocks: templeBlocks(),
  },
  {
    id: 'starter_sanctuary_white',
    structure: 'sanctuary_white',
    name: 'White Sanctuary',
    size: 7,
    footprint: '7 × 7',
    note: 'Open to the sky. Only the bearer of the White Ring can raise it.',
    blocks: whiteSanctuaryBlocks(),
  },
  {
    id: 'starter_sanctuary_black',
    structure: 'sanctuary_black',
    name: 'Black Sanctuary',
    size: 7,
    footprint: '7 × 7',
    note: 'A pit ringed in obsidian. Only the bearer of the Black Ring can raise it.',
    blocks: blackSanctuaryBlocks(),
  },
  {
    id: 'starter_monument',
    structure: 'monument',
    name: 'Obelisk',
    size: 7,
    footprint: '7 × 7',
    note: 'Nothing may stand over it.',
    blocks: monumentBlocks(),
  },
];

// The real bounding box of each design's blocks. Claiming a cube instead would
// wrap a house in an empty layer and break the "is it sealed?" test.
for (const d of STARTER_DESIGNS) {
  let mx = 0, my = 0, mz = 0;
  for (const b of d.blocks) {
    if (b.dx > mx) mx = b.dx;
    if (b.dy > my) my = b.dy;
    if (b.dz > mz) mz = b.dz;
  }
  d.extent = { x: mx, y: my, z: mz };
  d.cost = costOf(d.blocks);
}

/**
 * What a design costs, counted from the blocks it actually places.
 *
 * These used to be written out by hand beside each design, and every one of
 * them had drifted: the grove asked for 64 dirt, 18 wood and 40 leaves while
 * really taking 60, 14 and 76 — and two saplings it never mentioned at all.
 * The panel would light the button up, and then placing it would refuse and
 * name a material the player had never been told about.
 *
 * A count from the block list cannot drift, so nothing here is written twice.
 * Overlapping entries — two tree crowns sharing a leaf — are counted once,
 * because the world only stores one block per cell and only charges for one.
 */
function costOf(blocks) {
  const cells = new Map();
  for (const b of blocks) cells.set(`${b.dx},${b.dy},${b.dz}`, b.type);
  const bill = {};
  for (const type of cells.values()) {
    const item = ITEM_FOR_BLOCK.get(type);
    if (item) bill[item] = (bill[item] ?? 0) + 1;
  }
  return bill;
}

export const DESIGN_FOR_STRUCTURE = new Map(STARTER_DESIGNS.map((d) => [d.structure, d]));
