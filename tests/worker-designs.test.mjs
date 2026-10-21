import assert from 'node:assert/strict';
import { workerDesigns } from '../src/prefabs/WorkerDesigns.js';
import { STARTER_DESIGNS, DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { World } from '../src/world/World.js';
import { validateStructure } from '../src/structures/validate.js';
for(const d of [...workerDesigns,DESIGN_FOR_STRUCTURE.get('work_hall')]) {
 const world = new World({sizeX:48,sizeZ:48,height:32});
 for(const b of d.blocks)world.setBlock(10+b.dx,3+b.dy,10+b.dz,b.type);
 const result=validateStructure(world,{minX:10,maxX:10+d.extent.x,minY:3,maxY:3+d.extent.y,minZ:10,maxZ:10+d.extent.z},d.structure);
 assert.ok(result.ok,d.name+': '+result.reason);
 const cost={};for(const b of d.blocks){const id=ITEM_FOR_BLOCK.get(b.type);if(id)cost[id]=(cost[id]??0)+1;}
 assert.deepEqual(d.cost,cost);
 if(d.workers){const original=STARTER_DESIGNS.find(x=>x.structure===d.structure);assert.ok(d.blocks.length>original.blocks.length);}
 console.log('PASS '+d.name+' is fully costed and passes its claim rules');
}
