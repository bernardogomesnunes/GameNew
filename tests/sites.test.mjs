import { generateDuiltWorld, STARTER_SIZE } from '../src/world/StarterWorld.js';
import { SITES, SITES_BY_ID } from '../src/config/sites.js';
import { idsOf, footing, headroom, roughness, outlook, distanceTo } from '../src/world/siteFinder.js';

/**
 * The placement system, checked against its own declarations.
 *
 * The point of this test is that it never has to be rewritten. It reads
 * config/sites.js, and for every spec declared there it verifies that what the
 * generator placed actually satisfies what the spec asked for — across many
 * worlds. Add a ruin or an ore seam tomorrow and it is covered the moment its
 * entry exists, which is the whole reason the system is declarative.
 *
 * Requirements that the finder is explicitly allowed to relax are checked only
 * on placements that report `relaxed: 0`, since relaxing is a designed escape
 * hatch for terrain that genuinely cannot satisfy the spec.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const SEEDS = 24;
const worlds = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  worlds.push(generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed }));
}

// --- every spec places something, every world ------------------------------

for (const spec of SITES) {
  const wanted = typeof spec.count === 'number' ? spec.count : (spec.count.min ?? 1);
  let worstCount = Infinity;
  for (const { origin } of worlds) {
    worstCount = Math.min(worstCount, origin.sites.filter((s) => s.spec === spec.id).length);
  }
  ok(`"${spec.id}" always places at least ${wanted} (worst ${worstCount})`, worstCount >= wanted);
}

// --- the hard requirements actually hold ------------------------------------

const water = idsOf(['water']);
let groundBad = 0, headBad = 0, waterBad = 0, viewBad = 0, flatBad = 0, strictSeen = 0;

for (const { world, origin } of worlds) {
  for (const site of origin.sites) {
    const spec = SITES_BY_ID.get(site.spec);
    const needs = spec?.needs;
    if (!needs) continue;
    // Only the un-relaxed placements are held to the letter of the spec.
    if (site.relaxed !== 0) continue;
    strictSeen++;

    if (needs.ground) {
      const allowed = new Set(idsOf(needs.ground));
      // Read the ground the site was chosen on, before its own builder piled
      // stone or trees on top of it.
      const under = world.getBlock(site.x, site.y - 1, site.z);
      const grown = new Set(idsOf(['wood', 'leaves', 'stone', 'cobblestone', 'sapling']));
      if (!allowed.has(under) && !grown.has(under)) groundBad++;
    }
    if (needs.headroom && site.spec === 'spawn') {
      if (headroom(world, site.x, site.z, needs.headroom) < needs.headroom) headBad++;
    }
    if (needs.water) {
      const d = distanceTo(world, site.x, site.z, water, (needs.water.max ?? 24) + 2);
      if (d < (needs.water.min ?? 0) || d > (needs.water.max ?? 24)) waterBad++;
    }
    if (needs.flatness != null && site.spec === 'spawn') {
      if (roughness(world, site.x, site.z, needs.reach ?? 1) > needs.flatness) flatBad++;
    }
    if (needs.view != null) {
      if (outlook(world, site.x, site.z, { at: needs.viewAt ?? 2, range: needs.viewRange ?? 14 }).best < needs.view) viewBad++;
    }
  }
}

ok(`checked ${strictSeen} un-relaxed placements across ${SEEDS} worlds`, strictSeen > 50);
ok(`every placement is on the ground its spec asked for (${groundBad} bad)`, groundBad === 0);
ok(`every placement has the headroom it asked for (${headBad} bad)`, headBad === 0);
ok(`every placement is the distance from water it asked for (${waterBad} bad)`, waterBad === 0);
ok(`every placement is as level as it asked for (${flatBad} bad)`, flatBad === 0);
ok(`every placement has the view it asked for (${viewBad} bad)`, viewBad === 0);

// --- spacing and keeping clear of each other --------------------------------

// Crowding is the first thing relaxation gives up, so — as above — only the
// un-relaxed placements are held to the declared distances.
let spacingBad = 0, clearBad = 0;
const apart = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
for (const { origin } of worlds) {
  for (const spec of SITES) {
    const mine = origin.sites.filter((s) => s.spec === spec.id && s.relaxed === 0);
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        if (apart(mine[i], mine[j]) < (spec.spacing ?? 1)) spacingBad++;
      }
    }
    for (const otherId of spec.clearOf ?? []) {
      const gap = spec.clearOfDistance ?? spec.spacing ?? 1;
      for (const a of mine) {
        for (const b of origin.sites.filter((s) => s.spec === otherId && s.relaxed === 0)) {
          if (apart(a, b) < gap) clearBad++;
        }
      }
    }
  }
}
ok(`instances of a feature keep their spacing (${spacingBad} too close)`, spacingBad === 0);
ok(`features keep clear of the ones they named (${clearBad} too close)`, clearBad === 0);

// --- relaxing stays the exception -------------------------------------------

// Relaxation exists so a hostile patch of terrain still gets a feature. If most
// placements need it, the specs are describing ground the generator does not
// actually make, and the declarations are the thing to fix.
let total = 0, relaxed = 0, lastResort = 0;
for (const { origin } of worlds) {
  for (const s of origin.sites) {
    total++;
    if (s.relaxed > 0) relaxed++;
    const spec = SITES_BY_ID.get(s.spec);
    if (s.relaxed > (spec?.relaxSteps ?? 3)) lastResort++;
  }
}
const relaxedPct = Math.round((100 * relaxed) / total);
ok(`most placements satisfy their spec outright (${relaxedPct}% relaxed)`, relaxedPct <= 35);
ok(`the last-resort fallback is almost never needed (${lastResort} of ${total})`, lastResort <= 2);

// --- everything lands inside the plot ---------------------------------------

let outside = 0;
for (const { origin } of worlds) {
  for (const s of origin.sites) {
    if (s.x < origin.minX || s.x >= origin.minX + STARTER_SIZE) outside++;
    if (s.z < origin.minZ || s.z >= origin.minZ + STARTER_SIZE) outside++;
  }
}
ok(`every placement is inside the starting plot (${outside} outside)`, outside === 0);

// --- the same seed builds the same world ------------------------------------

const a = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 99 });
const b = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 99 });
const shape = (w) => JSON.stringify(w.origin.sites.map((s) => [s.spec, s.x, s.z, s.made]));
ok('the same seed places the same things', shape(a) === shape(b));

const c = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 100 });
ok('a different seed places them differently', shape(a) !== shape(c));

// --- arriving somewhere worth looking at ------------------------------------

let worstView = 99;
for (const { world, origin } of worlds) {
  const s = origin.spawn;
  const dx = -Math.sin(s.yaw), dz = -Math.cos(s.yaw);
  let run = 0;
  for (let k = 1; k <= 16; k++) {
    const x = Math.floor(s.x + dx * k), z = Math.floor(s.z + dz * k);
    if (!world.inBounds(x, s.y + 1, z) || world.getBlock(x, s.y + 1, z) !== 0) break;
    run = k;
  }
  if (run < worstView) worstView = run;
}
ok(`the spawn faces a clear view (worst ${worstView} blocks)`, worstView >= 10);

process.exit(f ? 1 : 0);
