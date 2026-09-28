import { generateEndlessWorld, settleOrigin } from '../src/world/StarterWorld.js';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
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
 * 3. Mountains as fewer, bigger, wider ranges, with a "buff step" variant —
 *    biomeMap's rangeFactor/peaksFactor gate, and ChunkGen's stepped height
 *    blend.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WATER = 11;
const OCEAN_INDEX = BIOME_INDEX.get('ocean');
const PEAKS_INDEX = BIOME_INDEX.get('peaks');
const HIGHLANDS_INDEX = BIOME_INDEX.get('highlands');

// --- no more pinned river, but water is still always reachable --------------

{
  let worstNear = 0, dry = 0, farthestCentre = 0, centreMismatch = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { world, origin } = generateEndlessWorld({ height: 64, seed });
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
              for (let y = 0; y < 48; y++) if (world.getBlock(x + dx, y, z + dz) === WATER) { hit = true; break; }
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
  const { world, origin } = generateEndlessWorld({ height: 64, seed: 777 });
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
  const fakeWorld = new World({ height: 64, gen: new ChunkGen({ seed: 1, height: 64 }) });
  fakeWorld.gen.waterLevelAt = () => 0;
  const origin = settleOrigin(fakeWorld, 1);
  ok('with nothing findable, the plot simply stays at the origin rather than carving one',
    origin.minX === -16 && origin.minZ === -16);
  ok('and nothing calling itself a river is left in the returned origin',
    origin.rivers === undefined);
}

// --- the ocean actually floods, with its own bed material -------------------

{
  const gen = new ChunkGen({ seed: 9, height: 64, homePull: 0 });
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
  // seaLevelAt/riverLevelAt/waterLevelAt agree with each other.
  const gen = new ChunkGen({ seed: 9, height: 64 });
  let mismatches = 0;
  for (let x = -200; x < 200; x += 7) {
    for (let z = -200; z < 200; z += 7) {
      const river = gen.riverLevelAt(x, z);
      const sea = gen.seaLevelAt(x, z);
      const water = gen.waterLevelAt(x, z);
      if (water !== Math.max(river, sea)) mismatches++;
    }
  }
  ok('waterLevelAt is always the deeper of a river or the sea, never its own third answer', mismatches === 0);
}

// --- mountains: fewer, bigger, wider, with a stepped minority ---------------

{
  const gen = new ChunkGen({ seed: 13, height: 64, homePull: 0 });
  const biomeMap = gen.biomes;
  ok('highlands is gated by the range mechanism', BIOMES[HIGHLANDS_INDEX].range === true);
  ok('so is peaks, plus the narrower peaksOnly gate',
    BIOMES[PEAKS_INDEX].range === true && BIOMES[PEAKS_INDEX].peaksOnly === true);

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

  // Peaks is a minority of what mountain terrain there is, not half of it —
  // "some buff step mountains too", not "mountains are all stepped now".
  let peaksCols = 0, highlandsCols = 0;
  for (let x = -400; x < 400; x += 4) {
    for (let z = -400; z < 400; z += 4) {
      const idx = gen.biomeIndexAt(x, z);
      if (idx === PEAKS_INDEX) peaksCols++;
      else if (idx === HIGHLANDS_INDEX) highlandsCols++;
    }
  }
  ok(`peaks is a minority of the mountains (${peaksCols} peaks vs ${highlandsCols} highlands)`,
    peaksCols > 0 && peaksCols < highlandsCols);
}

{
  // The stepped-terrace blend actually changes the height, and only where
  // peaks carries real weight.
  const gen = new ChunkGen({ seed: 13, height: 64, homePull: 0 });
  let peakSamples = 0, stepAligned = 0;
  for (let x = -400; x < 400; x += 4) {
    for (let z = -400; z < 400; z += 4) {
      const { weights } = gen.biomes.weigh(x, z);
      if ((weights[PEAKS_INDEX] ?? 0) < 0.6) continue;
      peakSamples++;
      if (gen.heightAt(x, z) % 4 === 0) stepAligned++;
    }
  }
  // A quarter of heights would land on a multiple of 4 by chance alone;
  // the terracing should push that well above it wherever peaks dominates.
  ok(`heights inside a peaks patch cluster on the step (${peakSamples ? (stepAligned / peakSamples * 100).toFixed(0) : 0}% of ${peakSamples} on a multiple of 4, vs ~25% by chance)`,
    peakSamples > 5 && stepAligned / peakSamples > 0.4);
}

process.exit(f ? 1 : 0);
