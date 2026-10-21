import { Chunk } from './World.js';
import { ChunkGen } from './ChunkGen.js';
import { emergingState, installEmergingPlaces } from './emergingPlaceState.js';

/** Everything that changes procedural blocks; caches are rebuilt from this. */
export function terrainConfig(world) {
  const gen = world.gen;
  return {
    seed: gen.seed, height: world.height, homePull: gen.biomes.homePull,
    homeX: gen.biomes.centreX, homeZ: gen.biomes.centreZ,
    homeRadius: gen.biomes.homeRadius, sky: !!gen.sky, battle: !!gen.battle,
    skyCut: [...(gen.skyCut ?? [])].sort(),
    emergingPlaces: emergingState(gen.emergingPlaces).places,
  };
}

export function terrainGenerator(config) {
  const gen = new ChunkGen(config);
  gen.biomes.homeRadius = config.homeRadius;
  gen.sky = config.sky;
  gen.battle = config.battle;
  gen.skyCut = new Set(config.skyCut);
  installEmergingPlaces(gen, config.emergingPlaces);
  return gen;
}

export function generateTerrainChunk(config, cx, cz, gen = terrainGenerator(config)) {
  const chunk = new Chunk(cx, cz, config.height);
  gen.fill(null, chunk);
  return { cx, cz, height: config.height, data: chunk.data, surface: chunk.surface, biomes: chunk.biomes };
}
