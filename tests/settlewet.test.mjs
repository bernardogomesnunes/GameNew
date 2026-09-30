import { generateEndlessWorld } from '../src/world/StarterWorld.js';

/**
 * Reported directly: "It was pretty much one time I generated one world
 * that was full of water and the spawn was deep inside the water and
 * stone." Traced to settleOrigin's own setback: it finds the nearest real
 * water to the world's raw origin, then steps back a fixed 8 blocks from it
 * in a random direction and trusts that's dry — a distance tuned for a
 * river a few blocks wide. The terrain overhaul roughly tripled every
 * non-mountain biome's footprint (see biomeMap.js's FREQ), the ocean
 * included, so a random 8-block step off the edge of a much bigger body of
 * water can land right back in it. When that happens nothing in the whole
 * 32-block plot is standable, and the fallback used to plant the settlement
 * — spawn included — on the seabed, with the real sea on top of it.
 *
 * findNearbyDryLand (StarterWorld.js) is the fix: the same expanding-ring
 * search findNearbyWater already uses, inverted, run from that setback
 * candidate only when it's still wet — so an ordinary river settlement,
 * the overwhelming majority, never even calls it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

let bad = 0, worstSubmerged = 0;
const N = 150;
for (let i = 1; i <= N; i++) {
  // Sequential seeds, not random ones: a fixed range keeps this test
  // deterministic rather than gambling on whichever seeds happen to expose
  // the bug on a given run — 12 of a random 300 did, in the investigation
  // that found this.
  const { world, origin } = generateEndlessWorld({ seed: i * 7919 });
  const centreWet = world.gen.waterLevelAt(world.centreX, world.centreZ) > 0;
  const s = origin.spawn;
  const sx = Math.floor(s.x), sz = Math.floor(s.z);
  const waterThere = world.gen.waterLevelAt(sx, sz);
  const submerged = waterThere > s.y;
  if (centreWet || submerged) {
    bad++;
    console.log(`  seed=${i * 7919} centreWet=${centreWet} spawn=(${sx},${s.y},${sz}) waterLevel=${waterThere} submerged=${submerged}`);
  }
  worstSubmerged = Math.max(worstSubmerged, submerged ? waterThere - s.y : 0);
}
ok(`the settlement centre is never left underwater (${bad}/${N} bad seeds)`, bad === 0);
ok(`and nobody spawns submerged (worst depth ${worstSubmerged})`, worstSubmerged === 0);

process.exit(f ? 1 : 0);
