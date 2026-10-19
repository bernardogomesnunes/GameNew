import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { MINE_FLOOR } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';
import { mineStairs } from '../src/duilt/mineStairs.js';
import { AIR, shapeOf, isFluid } from '../src/config/blocks.js';

/**
 * Asked for directly: "Can we change the mine, I'd like to keep the placement
 * at 91 blocks deep, but it should open a stairs to the top".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3, GRASS = 1, WATER = 11, SURFACE = 100;
const design = DESIGN_FOR_STRUCTURE.get('mine');

/** Solid stone up to the grass at y 100, a cave and a pocket of water on the way. */
function land() {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 128 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    for (let y = 0; y < SURFACE; y++) world.setBlock(x, y, z, STONE);
    world.setBlock(x, SURFACE, z, GRASS);
  }
  for (let x = 20; x < 32; x++) for (let z = 26; z < 36; z++) for (let y = 40; y < 44; y++) world.setBlock(x, y, z, AIR);
  for (let x = 20; x < 32; x++) for (let z = 26; z < 36; z++) for (let y = 60; y < 62; y++) world.setBlock(x, y, z, WATER);
  return world;
}

function place(world, fits) {
  const x = 30, z = 30, y = MINE_FLOOR;
  for (const b of design.blocks) world.setBlock(x + b.dx, y + b.dy, z + b.dz, b.type);
  const region = { minX: x, maxX: x + design.extent.x, minY: y, maxY: y + design.extent.y, minZ: z, maxZ: z + design.extent.z };
  const res = mineStairs(world, region, { look: SURFACE + 40, fits });
  for (const c of res.changes) world.setBlock(c.x, c.y, c.z, c.next);
  return { region, ...res };
}

/**
 * Walking it: you stand where your feet's cell and the one over it are clear
 * and there's something under you; you step to the next cell level, down
 * one, or up one onto a stair. Can you get from inside the mine to the top?
 */
function walkUp(world, region, top) {
  const clear = (x, y, z) => { const id = world.getBlock(x, y, z); return id === AIR || shapeOf(id) === 'rug'; };
  const under = (x, y, z) => { const id = world.getBlock(x, y - 1, z); return id !== AIR && !isFluid(id); };
  const stands = (x, y, z) => clear(x, y, z) && clear(x, y + 1, z) && under(x, y, z);
  const start = [region.minX + 1, region.minY + 1, Math.floor((region.minZ + region.maxZ) / 2)];
  const seen = new Set([start.join()]);
  const queue = [start];
  let highest = 0;
  while (queue.length) {
    const [x, y, z] = queue.shift();
    highest = Math.max(highest, y);
    if (y >= top) return { up: true, highest };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const dy of [0, -1, 1]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (dy === 1 && shapeOf(world.getBlock(nx, y, nz)) !== 'stair') continue;
        if (!stands(nx, ny, nz) || seen.has(`${nx},${ny},${nz}`)) continue;
        seen.add(`${nx},${ny},${nz}`);
        queue.push([nx, ny, nz]);
      }
    }
  }
  return { up: false, highest };
}

{
  const world = land();
  const { region, side, top } = place(world);
  ok(`a stair is cut, on the first side tried (side ${side})`, side === 0);
  ok(`it comes out at the surface (y ${top})`, top === SURFACE + 1);
  const walk = walkUp(world, region, top);
  ok(`you can walk from the mine to the top (highest reached y ${walk.highest})`, walk.up);
  const check = validateStructure(world, region, 'mine');
  ok(`the mine works as placed${check.ok ? '' : ` — failed "${check.failed}": ${check.reason}`}`, check.ok);
  let wet = 0, lit = 0;
  for (let x = region.minX - 6; x <= region.minX; x++) for (let z = region.minZ - 3; z <= region.maxZ + 3; z++) for (let y = MINE_FLOOR; y <= SURFACE; y++) {
    const id = world.getBlock(x, y, z);
    if (isFluid(id)) {
      const inWell = x >= region.minX - 4 && x <= region.minX - 2 && Math.abs(z - Math.floor((region.minZ + region.maxZ) / 2)) <= 1;
      if (inWell) wet++;
    }
    if (id === 26) lit++;
  }
  ok('no water in the well, where it passes the pocket', wet === 0);
  ok(`lanterns on the way up (${lit})`, lit >= 8);
}
{
  // The -x side is outside your land: it goes round to another.
  const world = land();
  const { region, side, top } = place(world, (x) => x >= 30 - 1);
  ok(`no room on one side, it goes on another (side ${side})`, side != null && side !== 0);
  ok('  and still climbs all the way', walkUp(world, region, top).up);
}
{
  // No room anywhere: only the mine's inside is dug.
  const world = land();
  const { region, side, changes } = place(world, () => false);
  ok('no room anywhere: no stair', side === null);
  ok('  but the mine is still dug out and works', validateStructure(world, region, 'mine').ok && changes.every((c) => c.x > region.minX && c.x < region.maxX));
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('placed from the surface, a mine goes down to its depth', /if \(typeId === 'mine'\) b\.y = Math\.min\(b\.y, MINE_FLOOR\);/.test(game));
ok('  its stair is cut before it is claimed', /const stairs = typeId === 'mine' \? this\.digMineStairs\(region, aimedY\) : null;\s*const claim = this\.duilt\.claim\(region, typeId\);/.test(game));
ok('  free, the rock it cuts is not handed to you, and it is no challenge of yours', /this\.applyChanges\(dig, \{ chargeResources: false, gather: false \}\)/.test(game)
  && /const gained = gather \? this\.duilt\.onBlocksBroken\(changes\) : \{\};/.test(game)
  && /if \(!this\.duilt\?\.sandbox && gather\) \{\s*for \(const c of changes\) \{\s*if \(c\.next !== AIR\) this\.gamification\.onBlockPlaced/.test(game));

process.exit(f ? 1 : 0);
