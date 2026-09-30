import { generateEndlessWorld, settleOrigin } from '../src/world/StarterWorld.js';
import { World } from '../src/world/World.js';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { BIOMES, BIOME_INDEX } from '../src/config/biomes.js';

/**
 * Phase 3: terrain regen. Three things asked for, in order.
 *
 * 1. No more guaranteed starting river — rivers and the sea are pure noise
 *    everywhere now, so the settlement moves to meet real water instead of
 *    water being carved to meet the settlement (see StarterWorld's own top
 *    note and findNearbyWater/settleOrigin).
 * 2. An ocean biome, "rare, like a plains biome" — an ordinary niche like
 *    every other biome, tuned the same way (see biomes.test.mjs's coverage
 *    check, which this doesn't repeat).
 * 3. Mountains as fewer, bigger, wider ranges — biomeMap's rangeFactor gate.
 *
 * Rewritten for the terrain overhaul (world height tripled, biomes renamed
 * and rebuilt — see config/biomes.js and ChunkGen.js): the water scan window
 * below has to reach the new, much higher SEA_LEVEL, and every `height: 64`
 * override here is gone — a 64-tall world can no longer fit the new biomes'
 * own numbers, so the point of most of these checks is to run at the real
 * default. The "buff step" terracing test is dropped outright: that
 * mechanic (and the `peaks` biome it belonged to) doesn't exist any more —
 * the mountain range now has exactly two tiers, tested below as "Mountains 2
 * is a minority of the mountain terrain."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WATER = 11;
const OCEAN_INDEX = BIOME_INDEX.get('ocean');
const MOUNTAINS1_INDEX = BIOME_INDEX.get('mountains1');
const MOUNTAINS2_INDEX = BIOME_INDEX.get('mountains2');

// --- no more pinned river, but water is still always reachable --------------

{
  let worstNear = 0, dry = 0, farthestCentre = 0, centreMismatch = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { world, origin } = generateEndlessWorld({ seed });
    const { minX, minZ } = origin;
    let nearest = Infinity;
    for (let lx = 0; lx < 32 && nearest > 0; lx++) {
      for (let lz = 0; lz < 32 && nearest > 0; lz++) {
        const x = minX + lx, z = minZ + lz;
        for (let r = 0; r <= 12 && r < nearest; r++) {
          let hit = false;
          for (let dx = -r; dx <= r && !hit; dx++) {
            for (let dz = -r; dz <= r; dz++) {
              if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
              for (let y = 0; y < world.height; y++) if (world.getBlock(x + dx, y, z + dz) === WATER) { hit = true; break; }
              if (hit) break;
            }
          }
          if (hit) { nearest = Math.min(nearest, r); break; }
        }
      }
    }
    if (nearest === Infinity) dry++;
    worstNear = Math.max(worstNear, nearest === Infinity ? 0 : nearest);
    farthestCentre = Math.max(farthestCentre, Math.hypot(world.centreX, world.centreZ));
    // The border, the biome bias and the plot itself all have to agree on
    // where the settlement actually is — see World.js's own note on why.
    if (world.centreX !== minX + 16 || world.centreZ !== minZ + 16) centreMismatch++;
  }
  ok(`water is still always reachable from the plot (worst ${worstNear} blocks, farm needs <= 6, 0 dry seeds)`,
    worstNear <= 6 && dry === 0);
  ok(`the settlement actually moves to find it, not always the origin (farthest ${farthestCentre.toFixed(0)} blocks)`,
    farthestCentre > 0);
  ok('world.centreX/Z (the border) always agrees with where the plot actually landed',
    centreMismatch === 0);
}

// --- moving the settlement moves the border and the biome bias with it -----

{
  const { world, origin } = generateEndlessWorld({ seed: 777 });
  ok('the biome home-bias followed the settlement, not the raw origin',
    world.gen.biomes.centreX === world.centreX && world.gen.biomes.centreZ === world.centreZ);

  // Save and reload has to bring the same centre back, not reset to (0, 0) —
  // a reloaded world whose border silently moved would strand any building
  // claimed near the edge of it.
  const saved = JSON.parse(JSON.stringify(world.serialize()));
  const back = World.deserialize(saved, { makeGen: (o) => new ChunkGen(o) });
  ok('a reloaded world brings the same settlement location back',
    back.centreX === world.centreX && back.centreZ === world.centreZ);
}

// --- a truly dry seed (none findable) is left dry, not silently carved -----

{
  // A world with no water anywhere findNearbyWater would ever reach — fake
  // it by handing settleOrigin a ChunkGen whose waterLevelAt never says yes.
  const fakeWorld = new World({ height: WORLD_HEIGHT, gen: new ChunkGen({ seed: 1 }) });
  fakeWorld.gen.waterLevelAt = () => 0;
  const origin = settleOrigin(fakeWorld, 1);
  ok('with nothing findable, the plot simply stays at the origin rather than carving one',
    origin.minX === -16 && origin.minZ === -16);
  ok('and nothing calling itself a river is left in the returned origin',
    origin.rivers === undefined);
}

// --- the ocean actually floods, with its own bed material -------------------

{
  const gen = new ChunkGen({ seed: 9, homePull: 0 });
  let floodedOcean = 0, sampled = 0;
  for (let x = -400; x < 400; x += 5) {
    for (let z = -400; z < 400; z += 5) {
      sampled++;
      if (gen.biomeIndexAt(x, z) !== OCEAN_INDEX) continue;
      if (gen.waterLevelAt(x, z) > 0) floodedOcean++;
    }
  }
  ok(`the ocean biome turns up and is actually flooded where it does (${floodedOcean} columns)`, floodedOcean > 5);
}

{
  // seaLevelAt/riverLevelAt/streamLevelAt/waterLevelAt agree with each other.
  const gen = new ChunkGen({ seed: 9 });
  let mismatches = 0;
  for (let x = -200; x < 200; x += 7) {
    for (let z = -200; z < 200; z += 7) {
      const river = gen.riverLevelAt(x, z);
      const stream = gen.streamLevelAt(x, z);
      const sea = gen.seaLevelAt(x, z);
      const water = gen.waterLevelAt(x, z);
      if (water !== Math.max(river, stream, sea)) mismatches++;
    }
  }
  ok('waterLevelAt is always the deepest of a river, a mountain stream or the sea, never its own third answer', mismatches === 0);
}

// --- mountains: fewer, bigger, wider, with a rarer tall tier ----------------

{
  const gen = new ChunkGen({ seed: 13, homePull: 0 });
  const biomeMap = gen.biomes;
  ok('Mountains 1 is gated by the range mechanism', BIOMES[MOUNTAINS1_INDEX].range === true);
  ok('so is Mountains 2, plus the narrower summitOnly gate',
    BIOMES[MOUNTAINS2_INDEX].range === true && BIOMES[MOUNTAINS2_INDEX].summitOnly === true);

  // Most of the map should be firmly outside any range at all.
  let eligible = 0, sampled = 0;
  for (let x = -300; x < 300; x += 3) {
    for (let z = -300; z < 300; z += 3) {
      sampled++;
      if (biomeMap.rangeFactor(x, z) > 0.05) eligible++;
    }
  }
  ok(`most of the map is not eligible for a range at all (${(eligible / sampled * 100).toFixed(0)}% is)`,
    eligible / sampled < 0.3);

  // Mountains 2 is a minority of what mountain terrain there is, not half of
  // it — "a very high mountain," not "mountains are all that tall now."
  let m2Cols = 0, m1Cols = 0;
  for (let x = -400; x < 400; x += 4) {
    for (let z = -400; z < 400; z += 4) {
      const idx = gen.biomeIndexAt(x, z);
      if (idx === MOUNTAINS2_INDEX) m2Cols++;
      else if (idx === MOUNTAINS1_INDEX) m1Cols++;
    }
  }
  ok(`Mountains 2 is a minority of the mountains (${m2Cols} Mountains 2 vs ${m1Cols} Mountains 1)`,
    m2Cols > 0 && m2Cols < m1Cols);
}

process.exit(f ? 1 : 0);
