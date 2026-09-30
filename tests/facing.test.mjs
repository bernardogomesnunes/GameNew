import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import {
  PLACEABLE_BLOCKS, BLOCKS_BY_ID, facingOf, turned, doorPart, doorBlock, shapeOf,
} from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { boxesFor, turn, rugBoxes } from '../src/world/propShapes.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Requested directly: "chairs are only placed on one direction, would be
 * nice to have them placed in multiple directions, same for stairs and
 * doors", "also rugs should connect to each other when they are placed next
 * side by side", and "stairs need three steps, and to have stair until the
 * end of the block, filling the back until the top, or else there will be a
 * hole when doing stairs."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

const STONE = 3, STAIR = 29, PLANK_STAIR = 30, CHAIR = 33, RED_RUG = 35, BLUE_RUG = 36, DOOR = 69;
const RECIPE_LIST = Array.isArray(RECIPES) ? RECIPES : Object.values(RECIPES);

// --- the registry ---------------------------------------------------------------------------

{
  const ids = [STAIR, PLANK_STAIR, CHAIR, 34, DOOR];
  ok('every turning block comes in four facings', ids.every((id) => new Set([0, 1, 2, 3].map((r) => turned(id, r))).size === 4));
  ok('and each facing knows which it is', ids.every((id) => [0, 1, 2, 3].every((r) => facingOf(turned(id, r)) === r)));
  ok('turning a turned block turns the block, not its base', turned(turned(STAIR, 3), 1) === turned(STAIR, 1));
  ok('facing 0 is the block you hold', turned(STAIR, 0) === STAIR && turned(DOOR, 0) === DOOR);
  ok('a turned stair is still a stair', [1, 2, 3].every((r) => shapeOf(turned(STAIR, r)) === 'stair'));
  ok('only the facing-0 block is in the bag', PLACEABLE_BLOCKS.filter((b) => b.shape === 'stair').length === 2);
  ok('breaking a turned stair or chair gives the same item back',
    ITEM_FOR_BLOCK.get(turned(STAIR, 2)) === ITEM_FOR_BLOCK.get(STAIR) && ITEM_FOR_BLOCK.get(turned(CHAIR, 1)) === 'chair_oak');
  ok('every block id still fits in a byte', Math.max(...BLOCKS_BY_ID.keys()) < 256);
  ok('the door is an item with a recipe', ITEMS_BY_ID.get('door')?.block === DOOR && RECIPE_LIST.some((r) => r.output?.id === 'door'));
  ok('only the bottom half of a door is the item', ITEM_FOR_BLOCK.get(doorBlock({ top: true })) == null
    && ITEM_FOR_BLOCK.get(doorBlock({ open: true, facing: 2 })) === 'door');
  ok('the door has a real preview in the bag', /<path/.test(itemIcon(ITEMS_BY_ID.get('door'))));
}

// --- stairs: three steps, the back to the top -------------------------------------------------

{
  const boxes = boxesFor('stair');
  const tops = boxes.map((b) => b.maxY).sort();
  ok(`three steps, a third each (${tops.map((t) => t.toFixed(2)).join(', ')})`, boxes.length === 3
    && Math.abs(tops[0] - 1 / 3) < 1e-9 && Math.abs(tops[1] - 2 / 3) < 1e-9 && tops[2] === 1);
  const back = boxes.find((b) => b.maxY === 1);
  ok('the back step reaches the top of the cell, so a flight has no hole', back.minZ === 0);
  const coversBack = boxes.every((b) => b.minX === 0 && b.maxX === 1 && b.minZ === 0);
  ok('every step runs the full width and down to the back', coversBack);

  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(4, 1, 4, STAIR);
  const box = world.collisionBoxAt(4, 1, 4);
  ok('a stair is a full block to walk into, flagged so you walk up it', box.maxY === 2 && box.stair);
}

// --- turning -----------------------------------------------------------------------------------

{
  const highest = (boxes) => boxes.reduce((a, b) => (b.maxY > a.maxY ? b : a));
  const mid = (b) => [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
  const at = [0, 1, 2, 3].map((r) => mid(highest(turn(boxesFor('stair'), r))));
  ok('a stair at facing 0 climbs towards -z', at[0][1] < 0.5);
  ok('at 1 towards +x', at[1][0] > 0.5);
  ok('at 2 towards +z', at[2][1] > 0.5);
  ok('at 3 towards -x', at[3][0] < 0.5);
  const inCell = [0, 1, 2, 3].every((r) => turn(boxesFor('chair'), r).every((b) =>
    b.minX >= 0 && b.maxX <= 1 && b.minZ >= 0 && b.maxZ <= 1 && b.minX < b.maxX && b.minZ < b.maxZ));
  ok('turned boxes stay inside their cell', inCell);
}

// --- rugs join up -----------------------------------------------------------------------------

{
  const lone = rugBoxes({})[0];
  ok('a rug on its own keeps its border', lone.minX > 0 && lone.maxX < 1 && lone.minZ > 0 && lone.maxZ < 1);
  const joined = rugBoxes({ px: 1, nz: 1 })[0];
  ok('with rugs beside it, it runs to those edges and only those', joined.maxX === 1 && joined.minZ === 0 && joined.minX > 0 && joined.maxZ < 1);

  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(4, 1, 4, RED_RUG);
  world.setBlock(5, 1, 4, BLUE_RUG);
  world.setBlock(9, 1, 9, RED_RUG);
  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const P = chunk.propMesh.geometry.attributes.position.array;
  let seam = 0, loneEdge = 0;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] === 5 && P[i + 2] > 4 && P[i + 2] < 5) seam++;
    if (P[i] === 10 && P[i + 2] > 9 && P[i + 2] < 10) loneEdge++;
  }
  ok(`two rugs side by side meet at the seam (${seam} vertices on it)`, seam > 0);
  ok('a rug alone stops short of its cell edge', loneEdge === 0);
}

// --- placing: the way you look ------------------------------------------------------------------

function fakeGame(world, yaw) {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    world,
    player: { yaw, position: { x: 8.5, y: 1, z: 12.5 } },
    symmetryTool: { mode: 'off' },
    toasts: [],
    gamification: { isBlockUnlocked: () => true, onBlockPlaced() {}, onBlockBroken() {} },
    remeshDirty() {},
  });
  g.ui = { toast: (t) => g.toasts.push(t) };
  return g;
}

function flat() {
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.setBlock(x, 0, z, STONE);
  return world;
}

function place(g, id, at) {
  g.selectedBlockId = id;
  g.raycast = () => ({ x: at.x, y: at.y - 1, z: at.z, block: STONE, placeX: at.x, placeY: at.y, placeZ: at.z });
  g.placeBlock();
  return g.world.getBlock(at.x, at.y, at.z);
}

// yaw 0 looks along -z, π/2 along -x, π along +z, -π/2 along +x
const LOOKS = [[0, 0], [-Math.PI / 2, 1], [Math.PI, 2], [Math.PI / 2, 3]];
for (const [yaw, look] of LOOKS) {
  const world = flat();
  const g = fakeGame(world, yaw);
  ok(`looking ${['-z', '+x', '+z', '-x'][look]}, you face ${look}`, g.lookFacing() === look);
  ok(`  a stair climbs away from you (facing ${look})`, facingOf(place(g, STAIR, { x: 8, y: 1, z: 8 })) === look);
  ok('  a chair faces you', facingOf(place(g, CHAIR, { x: 6, y: 1, z: 8 })) === (look + 2) % 4);
  const bottom = place(g, DOOR, { x: 4, y: 1, z: 8 });
  ok('  a door stands across your way', doorPart(bottom)?.facing === look && !doorPart(bottom).top);
}

// --- a door: two blocks, one thing ------------------------------------------------------------

{
  const world = flat();
  const g = fakeGame(world, 0);
  place(g, DOOR, { x: 8, y: 1, z: 8 });
  const lo = doorPart(world.getBlock(8, 1, 8)), hi = doorPart(world.getBlock(8, 2, 8));
  ok('placing a door puts down both halves', lo && hi && !lo.top && hi.top && !lo.open && !hi.open);
  ok('a shut door is a wall', world.collisionBoxAt(8, 1, 8)?.maxY === 2 && world.collisionBoxAt(8, 2, 8)?.maxY === 3);

  g.toggleGate({ x: 8, y: 2, z: 8, block: world.getBlock(8, 2, 8) });
  ok('Place on either half opens the whole door', doorPart(world.getBlock(8, 1, 8)).open && doorPart(world.getBlock(8, 2, 8)).open);
  ok('an open door is walked through', world.collisionBoxAt(8, 1, 8) === null && world.collisionBoxAt(8, 2, 8) === null);
  g.toggleGate({ x: 8, y: 1, z: 8, block: world.getBlock(8, 1, 8) });
  ok('and again shuts it', !doorPart(world.getBlock(8, 1, 8)).open && !doorPart(world.getBlock(8, 2, 8)).open);

  // Holding Place against a door swings it (secondaryAction), never builds on it.
  g.selectedBlockId = STONE;
  g.raycast = () => ({ x: 8, y: 1, z: 8, block: world.getBlock(8, 1, 8), placeX: 8, placeY: 1, placeZ: 9 });
  g.placeBlock();
  ok('Place held against a door doesn\'t build onto it', world.getBlock(8, 1, 9) === 0);

  g.applyChanges([{ x: 8, y: 2, z: 8, prev: world.getBlock(8, 2, 8), next: 0 }]);
  ok('breaking the top half takes the bottom with it', world.getBlock(8, 1, 8) === 0 && world.getBlock(8, 2, 8) === 0);

  place(g, DOOR, { x: 8, y: 1, z: 8 });
  g.applyChanges([{ x: 8, y: 1, z: 8, prev: world.getBlock(8, 1, 8), next: 0 }]);
  ok('and the bottom takes the top', world.getBlock(8, 1, 8) === 0 && world.getBlock(8, 2, 8) === 0);

  world.setBlock(6, 2, 8, STONE);
  const got = place(g, DOOR, { x: 6, y: 1, z: 8 });
  ok('no door where there isn\'t room for its top half', got === 0 && g.toasts.some((t) => /room/i.test(t.title)));
}

{
  // You can't shut a door on yourself.
  const world = flat();
  const g = fakeGame(world, 0);
  place(g, DOOR, { x: 8, y: 1, z: 8 });
  g.toggleGate({ x: 8, y: 1, z: 8, block: world.getBlock(8, 1, 8) });
  g.player.position = { x: 8.5, y: 1, z: 8.5 };
  g.toggleGate({ x: 8, y: 1, z: 8, block: world.getBlock(8, 1, 8) });
  ok('standing in the doorway, it stays open', doorPart(world.getBlock(8, 1, 8)).open);
}

process.exit(f ? 1 : 0);
