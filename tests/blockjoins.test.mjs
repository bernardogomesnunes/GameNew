import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { BLOCKS_BY_ID, WAR_TENT, WAR_TENT_BACK, isTent, pairPart, pairOther } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { textureFor } from '../src/config/textures.js';
import { tileFor } from '../src/render/BlockTextures.js';
import { wallBoxes, fenceStubs, windowBoxes, boxesFor } from '../src/world/propShapes.js';
import { STRUCTURES } from '../src/config/structures.js';

/**
 * Backlog batch 2, the block fixes: gold that shines, walls that stack into
 * one, a fence that runs into a wall's post, windows that stack into one tall
 * window, tents two blocks long, and a wood farm making 20 a day.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const hue = (hex) => { const r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255; return { r, g, b }; };

// --- gold ------------------------------------------------------------------------

{
  for (const id of [13, 40, 159]) {
    const b = BLOCKS_BY_ID.get(id);
    const { r, g, b: bl } = hue(b.color);
    ok(`${b.name} is yellow, not wood-brown (blue well under red and green)`, bl < g * 0.7 && g > r * 0.8);
    ok(`${b.name} shines`, (textureFor(b.texture ?? b.glyph).shine ?? 0) > 0 || (textureFor(b.texture ?? b.glyph).glints ?? 0) > 0);
  }
  ok('gold ore keeps the gold icon but has a rock surface of its own',
    BLOCKS_BY_ID.get(40).glyph === 'gold' && BLOCKS_BY_ID.get(40).texture === 'gold_ore' && textureFor('gold_ore').glints > 0);
  ok('its bag item matches its colour', ITEMS_BY_ID.get('gold_ore').color === BLOCKS_BY_ID.get(40).color
    && ITEMS_BY_ID.get('gold_trim').color === BLOCKS_BY_ID.get(159).color);
  ok('the shine mask is painted with the tile', tileFor(159)?.shine?.some((v) => v > 0.5) && tileFor(40)?.shine?.some((v) => v === 1));
  ok('stone does not shine', !tileFor(BLOCKS_BY_ID.get(3) ? 3 : 1)?.shine);
}

// --- walls -----------------------------------------------------------------------

const mesher = new ChunkMesher({ add() {}, remove() {} });
const propVerts = (world) => { const c = world.getChunk(0, 0); mesher.rebuild(world, c); return c.propMesh?.geometry.attributes.position.count ?? 0; };
const propBoxes = (world) => propVerts(world) / 24;

{
  const lone = wallBoxes({ px: 1, nx: 1 });
  const stacked = wallBoxes({ px: 1, nx: 1, up: 1 });
  ok('a wall with another on top runs to the top of its cell — no gap', stacked[0].maxY === 1 && lone[0].maxY < 1);
  ok('and a lone post is a post either way', wallBoxes({ up: 1 }).length === 1);
  ok('a fence beside it keeps its post on a straight run', wallBoxes({ px: 1, nx: 1, post: 1 }).some((b) => b.maxY === 1 && b.minX === 0.25));
  ok('fence rails run from the edge to the post', fenceStubs('px').every((b) => b.minX === 0.75 && b.maxX === 1) && fenceStubs('px').length === 2);
  ok('a gate\'s three rails do the same', fenceStubs('nz', 'gate').length === 3 && fenceStubs('nz', 'gate').every((b) => b.minZ === 0 && b.maxZ === 0.25));

  // A wall, a fence to its east: the wall is a post with the fence's two rail
  // ends — no arm reaching out to the fence — and the fence grows its own two
  // rails towards the wall: 1 + 2 + 2.
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  w.setBlock(4, 1, 4, 161);
  w.setBlock(5, 1, 4, 47);
  const fenceOnly = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  fenceOnly.setBlock(5, 1, 4, 47);
  ok(`the wall meeting a fence is post + rail ends (${propBoxes(w) - propBoxes(fenceOnly)} boxes)`, propBoxes(w) - propBoxes(fenceOnly) === 5);
}

// --- windows ---------------------------------------------------------------------

{
  const alone = windowBoxes(), mid = windowBoxes({ below: true, above: true });
  ok('the shape on its own is the framed window it always was', boxesFor('window').length === alone.length && alone.length === 8);
  ok('in the middle of a stack: no sill, no top or bottom frame', mid.length === 5 && !mid.some((b) => b.minZ <= 0.4 && b.maxY - b.minY < 0.2));
  ok('and its glass runs the whole height', mid.find((b) => b.pane).minY === 0 && mid.find((b) => b.pane).maxY === 1);
  const two = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  two.setBlock(6, 1, 6, 176); two.setBlock(6, 2, 6, 176);
  const side = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  side.setBlock(6, 1, 6, 176); side.setBlock(7, 1, 6, 176);
  // Bottom: sides, bottom frame, sill, bars, glass (7); top: sides, top frame, bars, glass (6).
  ok(`stacked, two windows join (${propBoxes(two)} boxes, not 16)`, propBoxes(two) === 13);
  ok('side by side they stay two windows', propBoxes(side) === 16);
  const turnedOne = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  turnedOne.setBlock(6, 1, 6, 176); turnedOne.setBlock(6, 2, 6, 177);
  ok('nor do two facing different ways', propBoxes(turnedOne) === 16);
}

// --- tents and the wood farm -----------------------------------------------------

{
  ok('a tent is two blocks: the front and the back', isTent(WAR_TENT) && isTent(WAR_TENT_BACK) && pairPart(WAR_TENT_BACK)?.second);
  const front = pairPart(WAR_TENT);
  const back = pairOther(front, 5, 5);
  ok('the back stands behind the front', back.x === 5 && back.z === 6);
  ok('and returns to the front', (({ x, z }) => x === 5 && z === 5)(pairOther(pairPart(WAR_TENT_BACK), back.x, back.z)));
  const forest = STRUCTURES.find?.((s) => s.id === 'forest') ?? STRUCTURES.forest;
  ok('a wood farm makes 20 wood a day', forest && forest.produces.wood * (86400 / forest.everySeconds) === 20);
}

process.exit(f ? 1 : 0);
