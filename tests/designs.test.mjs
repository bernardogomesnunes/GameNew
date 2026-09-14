import { World } from '../src/world/World.js';
import { STARTER_DESIGNS, DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES, STRUCTURES_BY_ID } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID } from '../src/config/items.js';

/**
 * Every ready-made design has to pass the rules of the thing it is a design
 * for.
 *
 * This is the whole promise of them: "take a design that was made to pass".
 * A starter that stamps and is then refused is worse than no starter at all,
 * because you have spent the materials to find out. They are made of loops
 * rather than block lists, so a one-character change to a size can quietly
 * drop a design under a threshold — which is exactly what a count checks.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const DIRT = 2, STONE = 3, WOOD = 4, PLANKS = 7, WATER = 11, FARMLAND = 21;

/**
 * Drops a design into an empty world at a given height and returns the region
 * it occupies — the same bounding box the claim path uses.
 */
function stamp(world, design, { x = 20, y = 20, z = 20 } = {}) {
  for (const b of design.blocks) world.setBlock(x + b.dx, y + b.dy, z + b.dz, b.type);
  return {
    minX: x, maxX: x + design.extent.x,
    minY: y, maxY: y + design.extent.y,
    minZ: z, maxZ: z + design.extent.z,
  };
}

/** Ground under the build, since several rules look at what is around it. */
function bedrock(world, atY) {
  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      for (let y = 0; y < atY; y++) world.setBlock(x, y, z, y === atY - 1 ? DIRT : STONE);
    }
  }
}

// --- every building that has a design, and every design a building ----------

ok('every design names a real building',
  STARTER_DESIGNS.every((d) => STRUCTURES_BY_ID.has(d.structure)));
ok('no building has two designs',
  new Set(STARTER_DESIGNS.map((d) => d.structure)).size === STARTER_DESIGNS.length);

// Framing a build by hand with the selector is the fiddliest thing in the game,
// especially on a phone. Leaving seven of the ten buildings without a starter
// meant every age after the first was hand-framed only.
for (const spec of STRUCTURES) {
  ok(`the ${spec.id} has a ready-made design`, DESIGN_FOR_STRUCTURE.has(spec.id));
}

// --- each one passes its own rules ------------------------------------------

for (const design of STARTER_DESIGNS) {
  const spec = STRUCTURES_BY_ID.get(design.structure);
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  const groundY = design.structure === 'mine' ? 10 : 20;
  bedrock(world, groundY);

  // What each building needs from its surroundings rather than from itself.
  if (design.structure === 'farm') {
    for (let y = groundY; y < groundY + 2; y++) world.setBlock(18, y, 22, WATER);
  }
  if (design.structure === 'granary') {
    for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) world.setBlock(10 + dx, groundY, 10 + dz, FARMLAND);
  }
  if (design.structure === 'market') {
    // A neighbour, since a market has to stand among your town.
    for (let dy = 0; dy < 3; dy++) world.setBlock(15, groundY + dy, 15, PLANKS);
  }

  const region = stamp(world, design, { x: 20, y: groundY, z: 20 });
  const side = region.maxX - region.minX + 1;
  ok(`${design.structure}: the design is at least ${spec.minSize} across (it is ${side})`, side >= spec.minSize);
  ok(`  and no larger than ${spec.maxSize}`, side <= spec.maxSize);

  const check = validateStructure(world, region, design.structure);
  ok(`  "${design.name}" passes as a ${spec.name.toLowerCase()}`
    + (check.ok ? '' : ` — failed "${check.failed}": ${check.reason}`), check.ok);
}

// --- and the market's rule is not one it satisfies by existing --------------

{
  // Same design, nothing around it. The town rule used to search inside the
  // region too, so a market built of planks passed a plank rule by existing.
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  bedrock(world, 20);
  const design = DESIGN_FOR_STRUCTURE.get('market');
  const region = stamp(world, design, { x: 20, y: 20, z: 20 });
  const check = validateStructure(world, region, 'market');
  ok('a market alone in a field is refused', !check.ok && check.failed === 'town');
  ok('and it says why', /among your town/i.test(check.reason));
}

// A mine placed at the surface is refused however well it is built.
{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  bedrock(world, 30);
  const design = DESIGN_FOR_STRUCTURE.get('mine');
  const region = stamp(world, design, { x: 20, y: 30, z: 20 });
  const check = validateStructure(world, region, 'mine');
  ok('a mine dug at the surface is refused', !check.ok && check.failed === 'depth');
  ok('and it says how deep it has to go', /y 12/.test(check.reason));
}

// A monument with something built over it is refused.
{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  bedrock(world, 20);
  const design = DESIGN_FOR_STRUCTURE.get('monument');
  const region = stamp(world, design, { x: 20, y: 20, z: 20 });
  ok('the obelisk passes in the open', validateStructure(world, region, 'monument').ok);
  for (let dx = 0; dx <= design.extent.x; dx++) {
    for (let dz = 0; dz <= design.extent.z; dz++) world.setBlock(20 + dx, region.maxY + 3, 20 + dz, STONE);
  }
  const roofed = validateStructure(world, region, 'monument');
  ok('roofing it over is refused', !roofed.ok && roofed.failed === 'sky');
}

// --- the bill is payable in things that exist -------------------------------

for (const design of STARTER_DESIGNS) {
  const items = Object.keys(design.cost);
  ok(`${design.structure}: its bill is in real items (${items.join(', ')})`,
    items.length > 0 && items.every((id) => ITEMS_BY_ID.has(id)));
  // A design placing a block with no item behind it would be free, and the
  // player would be charged nothing for part of the build.
  const cells = new Map();
  for (const b of design.blocks) cells.set(`${b.dx},${b.dy},${b.dz}`, b.type);
  const unbilled = [...new Set(cells.values())].filter((t) => !ITEM_FOR_BLOCK.has(t));
  ok(`  and every block in it is something you can hold`, unbilled.length === 0);
}

process.exit(f ? 1 : 0);
