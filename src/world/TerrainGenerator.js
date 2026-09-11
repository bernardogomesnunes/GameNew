import { createNoise2D } from 'simplex-noise';
import { GROUND } from '../config/blocks.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Campaign start: a bare indestructible plane. Nothing to harvest, nothing in
 * the way — the settlement is entirely what the player pays for.
 */
export function generateFlat(world, groundY = 0) {
  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      world.setBlock(x, groundY, z, GROUND);
      world.surfaceHeightMap[x * world.sizeZ + z] = groundY + 1;
    }
  }
  for (const chunk of world.allChunks()) chunk.dirty = true;
}

/** Fills a freshly created World with rolling-hill terrain and scattered trees. */
export function generateTerrain(world, seed = Date.now() % 1000000) {
  const rand = mulberry32(seed);
  const noise = createNoise2D(rand);
  const noiseDetail = createNoise2D(mulberry32(seed + 1337));
  const treeRand = mulberry32(seed + 7);

  const baseHeight = 20;
  const amplitude = 8;
  const freq = 0.045;
  const detailFreq = 0.12;

  const treeSpots = [];

  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      const n = noise(x * freq, z * freq);
      const d = noiseDetail(x * detailFreq, z * detailFreq);
      let h = Math.round(baseHeight + n * amplitude + d * 3);
      h = Math.max(4, Math.min(world.height - 10, h));
      world.surfaceHeightMap[x * world.sizeZ + z] = h;

      for (let y = 0; y < h; y++) {
        let block;
        if (y < h - 4) block = 3; // stone
        else if (y < h - 1) block = 2; // dirt
        else block = 1; // grass
        world.setBlock(x, y, z, block);
      }

      const edge = x < 3 || z < 3 || x >= world.sizeX - 3 || z >= world.sizeZ - 3;
      if (!edge && treeRand() < 0.012) {
        treeSpots.push([x, h, z]);
      }
    }
  }

  for (const [x, y, z] of treeSpots) {
    plantTree(world, x, y, z);
  }

  for (const chunk of world.allChunks()) chunk.dirty = true;
}

function plantTree(world, x, groundY, z) {
  const trunkHeight = 4 + Math.floor((x * 13 + z * 7) % 3);
  for (let i = 0; i < trunkHeight; i++) {
    world.setBlock(x, groundY + i, z, 4); // wood
  }
  const topY = groundY + trunkHeight;
  for (let dy = -1; dy <= 1; dy++) {
    const ry = dy === 1 ? 1 : 2;
    for (let dx = -ry; dx <= ry; dx++) {
      for (let dz = -ry; dz <= ry; dz++) {
        if (Math.abs(dx) === ry && Math.abs(dz) === ry) continue;
        const bx = x + dx, by = topY + dy, bz = z + dz;
        if (world.getBlock(bx, by, bz) === 0) world.setBlock(bx, by, bz, 5); // leaves
      }
    }
  }
  world.setBlock(x, topY + 2, z, 5);
}
