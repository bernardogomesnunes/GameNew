import { ChunkGen, TREE_SPACING, LEAF_CLEARANCE, sizedTree, treeShape, TREE_SIZES } from '../src/world/ChunkGen.js';
import { BIOMES } from '../src/config/biomes.js';

/**
 * Asked for directly: "It's impossible to run inside forests, i want them with
 * leaves taller and space between logs".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const gen = new ChunkGen({ seed: 11 });
const FORESTS = new Set(['forestOak', 'forestBirch', 'forestDark'].map((id) => BIOMES.findIndex((b) => b.id === id)));

// Every tree in a big patch of land, and the forest ones.
const trees = [];
for (let x = -600; x < 600; x += 1) {
  for (let z = -600; z < 600; z += 3) {
    const t = gen.treeAt(x, z);
    if (t) trees.push({ x, z, t, forest: FORESTS.has(gen.biomeIndexAt(x, z)) });
  }
}
// Rows three apart miss neighbours along z, so check spacing on a full square too.
const square = [];
for (let x = 0; x < 300; x++) for (let z = 0; z < 300; z++) { const t = gen.treeAt(x, z); if (t) square.push({ x, z }); }
const at = new Set(square.map((p) => `${p.x},${p.z}`));
const close = square.filter((p) => {
  for (let dx = -TREE_SPACING; dx <= TREE_SPACING; dx++) for (let dz = -TREE_SPACING; dz <= TREE_SPACING; dz++) {
    if ((dx || dz) && at.has(`${p.x + dx},${p.z + dz}`)) return true;
  }
  return false;
});
ok(`no two trunks closer than ${TREE_SPACING + 1} (${square.length} trees, ${close.length} too close)`, square.length > 20 && close.length === 0);

// The lowest leaf of every ordinary tree, over its ground.
let lowest = Infinity, counted = 0;
for (const { x, z, t } of trees.filter((p) => !p.t.giant)) {
  treeShape((px, py, pz, block) => {
    if (block === t.style.leaves) lowest = Math.min(lowest, py - t.ground);
  }, x, z, t, 11);
  counted++;
}
ok(`no leaves lower than ${LEAF_CLEARANCE} blocks over the ground (${counted} trees, lowest ${lowest})`, counted > 50 && lowest >= LEAF_CLEARANCE);

// Every size, every biome's trunk range: a sapling grows by the same rule.
let worst = Infinity;
for (const b of BIOMES) {
  const s = b.trees;
  if (!s?.chance) continue;
  const [lo, hi] = s.trunk ?? [4, 6];
  for (let base = lo; base <= hi; base++) {
    for (const { size } of TREE_SIZES) {
      const tree = sizedTree(s, 0, base, size);
      treeShape((px, py, pz, block) => { if (block === s.leaves) worst = Math.min(worst, py); }, 0, 0, tree, 1);
    }
  }
}
ok(`every size of tree in every biome, and every sapling, clears ${LEAF_CLEARANCE} blocks (lowest ${worst})`, worst >= LEAF_CLEARANCE);

// Still forests: plenty of trees where the forests are.
const forest = trees.filter((p) => p.forest).length, elsewhere = trees.length - forest;
ok(`the forests are still the woodiest places (${forest} trees in them, ${elsewhere} elsewhere)`, forest > elsewhere);

process.exit(f ? 1 : 0);
