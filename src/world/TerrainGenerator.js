import { createNoise2D } from 'simplex-noise';
import { BIOMES, biomeAt, surfaceFor } from '../config/biomes.js';
import { BiomeMap } from './biomeMap.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fills a freshly created World with land.
 *
 * Every column asks the biome map what kind of country it is in, blends the
 * height across the biomes that have a claim on it — so a border is a slope
 * rather than a step — and then takes its surface, its trees and its scatter
 * from whichever biome actually won.
 *
 * The world remembers which biome each column ended up in, because everything
 * placed later wants to know: the site finder, the settlers, and anything else
 * that cares whether it is standing in a wood or on a dune.
 */
export function generateTerrain(world, seed = Date.now() % 1000000, { homePull = 1 } = {}) {
  const rand = mulberry32(seed);
  const noise = createNoise2D(rand);
  const noiseDetail = createNoise2D(mulberry32(seed + 1337));
  const featureRand = mulberry32(seed + 7);
  const biomes = new BiomeMap({ sizeX: world.sizeX, sizeZ: world.sizeZ, seed, homePull });

  const freq = 0.045;
  const detailFreq = 0.12;
  world.biomeMap = new Uint8Array(world.sizeX * world.sizeZ);

  const trees = [];

  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      const { weights, index } = biomes.weigh(x, z);
      const biome = BIOMES[index];
      const base = biomes.blend(weights, 'base');
      const amplitude = biomes.blend(weights, 'amplitude');
      const rough = biomes.blend(weights, 'rough');

      const n = noise(x * freq, z * freq);
      const d = noiseDetail(x * detailFreq, z * detailFreq);
      let h = Math.round(base + n * amplitude + d * rough);
      h = Math.max(4, Math.min(world.height - 10, h));

      const at = x * world.sizeZ + z;
      world.surfaceHeightMap[at] = h;
      world.biomeMap[at] = index;

      const s = biome.surface;
      const top = surfaceFor(biome, h);
      for (let y = 0; y < h; y++) {
        let block;
        if (y < h - 1 - s.depth) block = s.rock;
        else if (y < h - 1) block = s.under;
        else block = top;
        world.setBlock(x, y, z, block);
      }

      const edge = x < 3 || z < 3 || x >= world.sizeX - 3 || z >= world.sizeZ - 3;
      if (edge) continue;

      // Trees are queued rather than planted here: a canopy reaches into
      // columns the loop has not reached yet, and planting mid-pass would have
      // the ground overwrite its own leaves.
      const t = biome.trees;
      if (t?.chance && featureRand() < t.chance) trees.push([x, h, z, t]);

      for (const sc of biome.scatter ?? []) {
        if (featureRand() < sc.chance) world.setBlock(x, h, z, sc.block);
      }
    }
  }

  for (const [x, y, z, style] of trees) plantTree(world, x, y, z, style, featureRand);

  for (const chunk of world.allChunks()) chunk.dirty = true;
  return biomes;
}

/**
 * One tree, in the shape its biome asks for.
 *
 * A tall narrow crown reads as a pine, a wide low one as broadleaf, and that
 * difference is most of what tells a snowfield from a forest at a distance.
 */
export function plantTree(world, x, groundY, z, style, rand = Math.random) {
  const [lo, hi] = style.trunk ?? [4, 6];
  const trunk = lo + Math.floor(rand() * (hi - lo + 1));
  const canopy = style.canopy ?? 2;

  for (let i = 0; i < trunk; i++) world.setBlock(x, groundY + i, z, style.wood);

  const topY = groundY + trunk;
  for (let dy = -1; dy <= 1; dy++) {
    const r = dy === 1 ? Math.max(1, canopy - 1) : canopy;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r > 1 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
        const bx = x + dx, by = topY + dy, bz = z + dz;
        if (world.getBlock(bx, by, bz) === 0) world.setBlock(bx, by, bz, style.leaves);
      }
    }
  }
  world.setBlock(x, topY + 2, z, style.leaves);
}

/** The biome a column ended up in. Falls back to the first for ungenerated worlds. */
export function biomeOf(world, x, z) {
  if (!world.biomeMap) return BIOMES[0];
  if (x < 0 || z < 0 || x >= world.sizeX || z >= world.sizeZ) return BIOMES[0];
  return biomeAt(world.biomeMap[(x | 0) * world.sizeZ + (z | 0)]);
}
