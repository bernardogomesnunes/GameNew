import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { pickBuild } from '../src/tools/PointerPick.js';
import { claimRegion, footprintOf, spanOf, blocksIn, claimHint } from '../src/tools/ClaimArea.js';
import { readFileSync } from 'node:fs';

/**
 * Claiming an area you draw, rather than a build the game follows.
 *
 * Pointing at something and letting a flood fill find its edges works for a
 * house and cannot work for a quarry. A quarry is a hole, and the fill refuses
 * to go below the original ground — so "point at what you built" was the only
 * answer it could give for anything dug, wherever you stood. Age 2 asks for a
 * quarry. Age 5 asks for a mine. Neither was claimable at all.
 */

const STONE = 3, GRASS = 1, DIRT = 2, WOOD = 4;
const world = new World({ sizeX: 96, sizeZ: 96, height: 64 });
for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) {
  for (let y = 0; y < 20; y++) world.setBlock(x, y, z, y < 14 ? STONE : (y === 19 ? GRASS : DIRT));
  world.surfaceHeightMap[x * 96 + z] = 20;
}

// A quarry: a pit cut down into the rock, open to the sky.
for (let x = 40; x < 47; x++) for (let z = 40; z < 47; z++) {
  for (let y = 14; y < 20; y++) world.setBlock(x, y, z, 0);
}
// with stone showing in its floor and walls
for (let x = 40; x < 47; x++) for (let z = 40; z < 47; z++) world.setBlock(x, 13, z, STONE);

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the old way, for the record ---------------------------------------------
{
  const floor = { x: 43, y: 13, z: 43 };
  ok('pointing at the floor of a quarry finds nothing to claim',
    pickBuild(world, floor) === null);
  const wall = { x: 40, y: 15, z: 43 };
  ok('and pointing at its wall finds nothing either', pickBuild(world, wall) === null);
}

// --- drawing the area ---------------------------------------------------------
{
  const a = { x: 40, y: 13, z: 40 }, b = { x: 46, y: 13, z: 46 };
  const foot = footprintOf(a, b);
  ok(`two corners make a ${spanOf(foot)} × ${foot.maxZ - foot.minZ + 1} footprint`, spanOf(foot) === 7);
  ok('and the order of the taps does not matter',
    JSON.stringify(footprintOf(b, a)) === JSON.stringify(foot));

  const region = claimRegion(world, a, b);
  ok(`the region takes the pit: y ${region.minY}..${region.maxY}`, region.minY === 13 && region.maxY <= 20);
  const blocks = blocksIn(world, region);
  ok(`and holds ${blocks.length} solid blocks`, blocks.length > 24);
  ok('including the stone the claim asks for',
    blocks.filter((q) => q.type === STONE).length >= 24);

  // The real test: does it claim?
  const inventory = new Inventory();
  const structures = new StructureRegistry({ world, bus: null, inventory });
  const r = structures.claim(region, 'quarry');
  ok(`claiming it as a quarry: ${r.ok ? r.reason : r.reason}`, r.ok);
}

// --- the same two taps round a house take the house ---------------------------
{
  for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 5; dz++) {
    const edge = dx === 0 || dz === 0 || dx === 4 || dz === 4;
    for (let dy = 0; dy < 4; dy++) if (edge) world.setBlock(60 + dx, 20 + dy, 60 + dz, WOOD);
    world.setBlock(60 + dx, 24, 60 + dz, WOOD);
  }
  world.setBlock(62, 20, 60, 0);
  world.setBlock(62, 21, 60, 0);

  const region = claimRegion(world, { x: 60, y: 20, z: 60 }, { x: 64, y: 20, z: 64 });
  ok(`tapping two ground corners round a house takes it up to the roof (y ${region.minY}..${region.maxY})`,
    region.maxY === 24);
  const inventory = new Inventory();
  const structures = new StructureRegistry({ world, bus: null, inventory });
  const r = structures.claim(region, 'house');
  ok(`claiming it as a house: ${r.reason}`, r.ok);
}

// --- what it says while you draw ----------------------------------------------
{
  ok('before the first tap it asks for a corner', /corner/i.test(claimHint(null, null).target));
  ok('after it, for the opposite one', /opposite/i.test(claimHint({ x: 1, y: 1, z: 1 }, null).target));
  const h = claimHint({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 5 });
  ok(`and then the size: ${h.target}`, h.target === '4 × 6');
}

// --- it does not swallow the mountain behind the pit --------------------------
{
  for (let y = 20; y < 40; y++) for (let x = 30; x < 36; x++) for (let z = 40; z < 46; z++) {
    world.setBlock(x, y, z, STONE);
  }
  const region = claimRegion(world, { x: 40, y: 13, z: 40 }, { x: 46, y: 13, z: 46 });
  ok('a tower beside it is not in the claim', region.maxX < 40 + 7 && region.minX >= 40);
  const tall = claimRegion(world, { x: 30, y: 20, z: 40 }, { x: 35, y: 20, z: 45 });
  ok(`and reach bounds how far up it looks (y ${tall.minY}..${tall.maxY})`, tall.maxY - tall.minY <= 26);
}

// --- and it is reachable from the game ----------------------------------------

{
  const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
  const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
  ok('the Build panel offers it', /id="btn-claim-area"/.test(duiltUi));
  ok('and says what it is for', /anything you dug out/.test(duiltUi));
  ok('it arms a two-corner selection', /beginClaimSelection\(\)/.test(game));
  ok('the first press takes a corner', /if \(this\.pendingClaim\) return void this\.markClaimCorner\(\);/.test(game));
  ok('it counts as armed, so Break does not break underneath it',
    /pendingClear \|\| this\.pendingClaim/.test(game));
  ok('the box is outlined while you draw it', /updateClaimPreview\(\)/.test(game));
  ok('and the readout says which tap it is waiting for', /setToolReadout\(\{ claim: hint\.name/.test(game));
  ok('putting it away clears the outline', /this\.pendingClaim = null;[\s\S]{0,160}this\.selection\.hide\(\);/.test(game));
}

process.exit(f ? 1 : 0);
