import { World } from './World.js';
import { generateTerrain } from './TerrainGenerator.js';

/**
 * The opening 32×32 of Duilt, authored rather than rolled.
 *
 * The first ten minutes decide whether anyone plays the eleventh, and the two
 * things the first ten minutes need — a river and trees — are exactly the two
 * things noise will not reliably give you. So the surrounding world is
 * generated as usual and the middle is built by hand on top of it.
 *
 * Variation comes from a seed picking between authored arrangements, not from
 * hoping the noise lands well.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, WATER = 11;

export const STARTER_SIZE = 32;
const GROUND_Y = 20;      // the settlement's floor, with room to dig beneath it
const RIVER_DEPTH = 2;

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the world for a new game: ordinary terrain everywhere, then the
 * authored settlement stamped into the middle.
 */
export function generateDuiltWorld({ sizeX = 256, sizeZ = 256, height = 64, seed = Date.now() % 1000000 } = {}) {
  const world = new World({ sizeX, sizeZ, height });
  generateTerrain(world, seed);
  const origin = carveSettlement(world, seed);
  return { world, origin };
}

/**
 * Flattens the middle 32×32 to a buildable plain, runs a river through it, and
 * plants a stand of trees clear of the water.
 */
export function carveSettlement(world, seed = 1) {
  const rand = rng(seed);
  const half = STARTER_SIZE / 2;
  const cx = Math.floor(world.sizeX / 2);
  const cz = Math.floor(world.sizeZ / 2);
  const minX = cx - half, minZ = cz - half;

  // The river is a sine running the full depth of the plot, so it always
  // crosses it and always reaches both edges — no dead-end streams.
  const bend = 3 + rand() * 3;
  const phase = rand() * Math.PI * 2;
  const riverAt = (z) => half + Math.sin((z / STARTER_SIZE) * Math.PI * 2 + phase) * bend;
  const halfWidth = 1.5 + rand();

  for (let lx = 0; lx < STARTER_SIZE; lx++) {
    for (let lz = 0; lz < STARTER_SIZE; lz++) {
      const x = minX + lx, z = minZ + lz;
      const dist = Math.abs(lx - riverAt(lz));

      // Clear everything above the floor so the plot reads as open ground.
      for (let y = GROUND_Y + 1; y < world.height; y++) world.setBlock(x, y, z, 0);
      for (let y = 0; y < GROUND_Y - 3; y++) world.setBlock(x, y, z, STONE);
      for (let y = GROUND_Y - 3; y < GROUND_Y; y++) world.setBlock(x, y, z, DIRT);

      if (dist <= halfWidth) {
        // Channel: cut down, fill with water to just below the bank.
        for (let y = GROUND_Y - RIVER_DEPTH; y <= GROUND_Y; y++) world.setBlock(x, y, z, 0);
        for (let y = GROUND_Y - RIVER_DEPTH; y < GROUND_Y; y++) world.setBlock(x, y, z, WATER);
      } else if (dist <= halfWidth + 1.4) {
        world.setBlock(x, GROUND_Y, z, SAND); // bank — and the source of glass later
      } else {
        world.setBlock(x, GROUND_Y, z, GRASS);
      }
      world.surfaceHeightMap[x * world.sizeZ + z] = GROUND_Y + 1;
    }
  }

  plantStarterTrees(world, minX, minZ, riverAt, halfWidth, rand);
  return { minX, minZ, size: STARTER_SIZE, groundY: GROUND_Y, riverAt, spawn: findSpawn(world, minX, minZ, riverAt, halfWidth) };
}

/**
 * A dozen trees, always on the wider bank so the first axe swing is never
 * across water, and never so dense that there's nowhere to build.
 */
function plantStarterTrees(world, minX, minZ, riverAt, halfWidth, rand) {
  const planted = [];
  let attempts = 0;
  while (planted.length < 12 && attempts < 400) {
    attempts++;
    const lx = 2 + Math.floor(rand() * (STARTER_SIZE - 4));
    const lz = 2 + Math.floor(rand() * (STARTER_SIZE - 4));
    if (Math.abs(lx - riverAt(lz)) < halfWidth + 3) continue;          // keep the banks clear
    if (planted.some((p) => Math.abs(p.lx - lx) < 3 && Math.abs(p.lz - lz) < 3)) continue;
    plantTree(world, minX + lx, GROUND_Y + 1, minZ + lz, rand);
    planted.push({ lx, lz });
  }
}

function plantTree(world, x, groundY, z, rand) {
  const trunk = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < trunk; i++) world.setBlock(x, groundY + i, z, WOOD);
  const top = groundY + trunk;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // round the corners off
        if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
        const tx = x + dx, ty = top + dy, tz = z + dz;
        if (!world.inBounds(tx, ty, tz)) continue;
        if (world.getBlock(tx, ty, tz) === 0) world.setBlock(tx, ty, tz, LEAVES);
      }
    }
  }
}

/** Somewhere flat, dry, and on a block centre — corners trap the player's hitbox. */
function findSpawn(world, minX, minZ, riverAt, halfWidth) {
  for (let radius = 0; radius < STARTER_SIZE / 2; radius++) {
    for (let lx = 0; lx < STARTER_SIZE; lx++) {
      for (let lz = 0; lz < STARTER_SIZE; lz++) {
        const fromCentre = Math.max(Math.abs(lx - STARTER_SIZE / 2), Math.abs(lz - STARTER_SIZE / 2));
        if (Math.round(fromCentre) !== radius) continue;
        if (Math.abs(lx - riverAt(lz)) < halfWidth + 2) continue;
        const x = minX + lx, z = minZ + lz;
        if (world.getBlock(x, GROUND_Y, z) !== GRASS) continue;
        if (world.getBlock(x, GROUND_Y + 1, z) !== 0 || world.getBlock(x, GROUND_Y + 2, z) !== 0) continue;
        return { x: x + 0.5, y: GROUND_Y + 1, z: z + 0.5 };
      }
    }
  }
  return { x: minX + STARTER_SIZE / 2 + 0.5, y: GROUND_Y + 1, z: minZ + STARTER_SIZE / 2 + 0.5 };
}

export { GROUND_Y };
