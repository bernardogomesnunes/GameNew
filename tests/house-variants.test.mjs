import assert from 'node:assert/strict';
import { houseDesigns, designsForStructure, starterDesign } from '../src/prefabs/HouseDesigns.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { World } from '../src/world/World.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { bedPart, FACING_STEP, roofPart } from '../src/config/blocks.js';
import { validateStructure } from '../src/structures/validate.js';
for (const d of houseDesigns) {
 const world = new World({ sizeX: 48, sizeZ: 48, height: 48 });
 for (const b of d.blocks) world.setBlock(10+b.dx, 10+b.dy, 10+b.dz, b.type);
 const result = validateStructure(world, {minX:10,maxX:10+d.extent.x,minY:10,maxY:10+d.extent.y,minZ:10,maxZ:10+d.extent.z}, d.structure);
 assert.ok(result.ok, `${d.name}: ${JSON.stringify(result)}`);
 assert.equal(new Set(d.blocks.map(b=>`${b.dx},${b.dy},${b.dz}`)).size, d.blocks.length);
 const cost = {};
 for (const b of d.blocks) { const item = ITEM_FOR_BLOCK.get(b.type); if (item) cost[item] = (cost[item] ?? 0) + 1; }
 assert.deepEqual(d.cost, cost, 'display bill matches placed blocks');
 for (const b of d.blocks.filter(b => bedPart(b.type) && !bedPart(b.type).head)) {
   const part = bedPart(b.type), [x, z] = FACING_STEP[part.facing];
   assert.ok(d.blocks.some(other => other.dx === b.dx+x && other.dz === b.dz+z && other.dy === b.dy && bedPart(other.type)?.head));
 }
 assert.ok(d.blocks.some(b => roofPart(b.type)), 'proper shaped roof tiles');
 console.log(`PASS ${d.name} has unique blocks and passes its original structure rules`);
}
assert.ok(designsForStructure('house').length >= 3);
assert.ok(designsForStructure('townhouse').length >= 2);
assert.equal(starterDesign('house'), DESIGN_FOR_STRUCTURE.get('house'));
assert.equal(starterDesign('house', 'starter_townhouse'), null);
console.log('PASS variant lookup preserves default designs and rejects wrong structure');

