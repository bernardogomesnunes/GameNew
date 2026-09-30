import { ChunkGen, TREE_SIZES, GIANT_ONE_IN, FEATURE_MARGIN } from '../src/world/ChunkGen.js';
import { World } from '../src/world/World.js';
import { BiomeMap } from '../src/world/biomeMap.js';
import { BIOMES, BIOMES_BY_ID, BIOME_INDEX } from '../src/config/biomes.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';

/**
 * Trees. Requested directly: "trees definitely need more range of sizes in
 * height, cause look they are smaller than a house. One cool rule ... 1 in
 * 50 trees to be a gigantic tree, 4 blocks for the trunk. And we can have a
 * biome full of gigantic trees that is rare."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const gen = new ChunkGen({ seed: 11 });
const GROVE = BIOME_INDEX.get('giantGrove');

// --- sizes -----------------------------------------------------------------------

{
  const sizes = {}; let trees = 0, giants = 0, outsideGrove = 0, giantsOutside = 0, tallest = 0;
  for (let x = -500; x < 500; x++) {
    for (let z = -500; z < 500; z++) {
      const t = gen.treeAt(x, z);
      if (!t) continue;
      trees++;
      const inGrove = gen.biomeIndexAt(x, z) === GROVE;
      if (!inGrove) outsideGrove++;
      if (t.giant) { giants++; if (!inGrove) giantsOutside++; tallest = Math.max(tallest, t.trunk); continue; }
      sizes[t.size] = (sizes[t.size] ?? 0) + 1;
    }
  }
  const share = (k) => (sizes[k] ?? 0) / trees;
  ok(`trees come in sizes: small ${(share('small') * 100).toFixed(0)}%, normal ${(share('normal') * 100).toFixed(0)}%, tall ${(share('tall') * 100).toFixed(0)}%, towering ${(share('towering') * 100).toFixed(0)}%`,
    share('small') > 0.1 && share('normal') > 0.35 && share('tall') > 0.15 && share('towering') > 0.03);
  ok('the size classes cover every roll', TREE_SIZES.at(-1).upTo === 1);
  const rate = giantsOutside / outsideGrove;
  ok(`about 1 in ${GIANT_ONE_IN} trees is a giant (1 in ${Math.round(1 / rate)})`, rate > 0.6 / GIANT_ONE_IN && rate < 1.4 / GIANT_ONE_IN);
  ok(`a giant stands far taller than a house (${tallest} blocks of trunk)`, tallest >= 18);
}

{
  // A tall tree is taller than a two-storey house with its roof on.
  let found = null;
  for (let x = 0; x < 400 && !found; x++) for (let z = 0; z < 400 && !found; z++) {
    const t = gen.treeAt(x, z);
    if (t?.size === 'towering') found = t;
  }
  ok(`a towering tree's trunk alone is taller than a house (${found?.trunk})`, found && found.trunk >= 8);
  ok('and it has a bigger crown to match', found && found.canopy >= 3);
}

// --- a giant, as blocks ----------------------------------------------------------

{
  let at = null;
  for (let x = 80; x < 2000 && !at; x++) for (let z = -300; z < 300 && !at; z++) {
    const t = gen.treeAt(x, z);
    if (t?.giant) at = { x, z, t };
  }
  const { x, z, t } = at;
  const world = new World({ height: 200, gen });
  const wood = t.style.wood, leaves = t.style.leaves;
  const mid = t.ground + Math.floor(t.trunk / 2);
  ok('a giant\'s trunk is 2 by 2 — four blocks across', [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dz]) => world.getBlock(x + dx, mid, z + dz) === wood));
  ok('and nothing round it at that height is trunk', world.getBlock(x - 1, mid, z) !== wood || world.getBlock(x + 2, mid, z + 1) !== wood);
  let wide = 0;
  const top = t.ground + t.trunk + 2;
  for (let d = 0; d <= FEATURE_MARGIN; d++) if (world.getBlock(x + 1 + d, top, z) === leaves) wide = d;
  ok(`its crown spreads ${wide} blocks out from the trunk`, wide >= 6);
  ok('and stays inside the margin a chunk looks past', wide < FEATURE_MARGIN);

  // Made in a different order, the same giant is the same blocks: every
  // chunk works it out for itself.
  const other = new World({ height: 200, gen: new ChunkGen({ seed: 11 }) });
  for (let dx = 2; dx >= -2; dx--) for (let dz = 2; dz >= -2; dz--) other.getChunk((x >> 4) + dx, (z >> 4) + dz);
  let same = true;
  for (let bx = x - 10; bx <= x + 11 && same; bx++) {
    for (let bz = z - 10; bz <= z + 11 && same; bz++) {
      for (let by = t.ground - 2; by < t.ground + t.trunk + 10; by++) {
        if (world.getBlock(bx, by, bz) !== other.getBlock(bx, by, bz)) { same = false; break; }
      }
    }
  }
  ok('a giant across chunk borders is the same whatever order the chunks are made in', same);
}

{
  // The starting plot is for building.
  const home = new ChunkGen({ seed: 11, homeX: 0, homeZ: 0 });
  let near = 0;
  for (let x = -50; x < 50; x++) for (let z = -50; z < 50; z++) if (home.treeAt(x, z)?.giant) near++;
  ok('no giants on the starting plot', near === 0);
}

// --- the grove -------------------------------------------------------------------

{
  const grove = BIOMES_BY_ID.get('giantGrove');
  ok('there is a Giant Grove', !!grove);
  ok('most of its trees are giants', grove.trees.giants >= 0.5);
  ok('on its own floor of fallen leaves', BLOCKS_BY_ID.get(grove.surface.top)?.name === 'Forest Floor');
  ok('which trees take root in', BLOCKS_BY_ID.get(grove.surface.top)?.soil === true);
  ok('it only takes over wooded, grassy or wet country',
    grove.rare.in.every((id) => ['plains', 'forestOak', 'forestBirch', 'forestDark', 'wetland'].includes(id)));

  const map = new BiomeMap({ sizeX: 1, sizeZ: 1, seed: 5, homePull: 0 });
  let total = 0, inGrove = 0, core = 0;
  const isG = (x, z) => map.weigh(x, z).index === GROVE;
  for (let x = -3000; x < 3000; x += 20) {
    for (let z = -3000; z < 3000; z += 20) {
      total++;
      if (!isG(x, z)) continue;
      inGrove++;
      if (isG(x + 30, z) && isG(x - 30, z) && isG(x, z + 30) && isG(x, z - 30)) core++;
    }
  }
  ok(`it is rare (${(inGrove / total * 100).toFixed(1)}% of the land)`, inGrove / total > 0.005 && inGrove / total < 0.08);
  ok('but big enough to walk into when you find one', core > 0);

  // Never out at sea: wherever the grove wins, the same map with no grove
  // in it would have had country the grove is allowed to take.
  const allowed = new Set(grove.rare.in.map((id) => BIOME_INDEX.get(id)));
  const without = new BiomeMap({ sizeX: 1, sizeZ: 1, seed: 5, homePull: 0 });
  without.rareIndexes = [];
  let wrong = 0, checked = 0;
  for (let x = -3000; x < 3000 && checked < 400; x += 20) {
    for (let z = -3000; z < 3000 && checked < 400; z += 20) {
      if (map.weigh(x, z).index !== GROVE) continue;
      checked++;
      if (!allowed.has(without.weigh(x, z).index)) wrong++;
    }
  }
  ok(`a grove never stands on the sea, the desert or a mountain (${checked} checked)`, checked > 0 && wrong === 0);
}

// Every biome with trees still has them, and none has lost its own look.
ok('every tree biome keeps its own wood', BIOMES.filter((b) => b.trees?.chance).every((b) => b.trees.wood && b.trees.leaves));

process.exit(f ? 1 : 0);
