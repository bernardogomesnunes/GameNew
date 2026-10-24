import assert from 'node:assert/strict';
import {World} from '../src/world/World.js';
import {ChunkGen} from '../src/world/ChunkGen.js';
import {BLOCKS_BY_ID} from '../src/config/blocks.js';
const snapshot=await import('../src/storage/WorldSnapshot.js').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;
});
assert.equal(typeof snapshot.captureWorldSnapshot,'function','binary capture must exist before saves can leave the game thread');
const {captureWorldSnapshot,completeWorldSnapshot,restoreWorldSnapshot}=snapshot;
const world=new World({height:32,gen:new ChunkGen({seed:4242,height:32})});
world.setBlock(-1,14,-1,3);
const bounds={minX:-16,maxX:15,minZ:-16,maxZ:15};
const size=world.chunks.size;
let fills=0;const fill=world.gen.fill.bind(world.gen);
world.gen.fill=(...args)=>{fills++;return fill(...args);};
const captured=captureWorldSnapshot(world,bounds);
assert.equal(world.chunks.size,size);assert.equal(fills,0);
assert.equal(captured.chunks.length,4);
const owned=captured.chunks.find(c=>c.cx===-1&&c.cz===-1);
const live=world.getChunk(-1,-1,false);
assert.notEqual(owned.data.buffer,live.data.buffer);
world.setBlock(-1,14,-1,4);
assert.equal(owned.data[live.index(15,14,15)],3);
await completeWorldSnapshot(captured);
assert.equal(world.chunks.size,size);assert.equal(fills,0);
assert.ok(captured.chunks.every(c=>c.data?.byteLength));
console.log('PASS binary capture owns its buffers and missing claimed generation never touches the live world');
const back=restoreWorldSnapshot(captured);
assert.equal(back.getBlock(-1,14,-1),3);
assert.equal(back.chunks.size,4);
for(const c of captured.chunks){
  const restored=back.getChunk(c.cx,c.cz,false);
  assert.deepEqual(restored.data,c.data);assert.deepEqual(restored.surface,c.surface);
  assert.deepEqual(restored.biomes,c.biomes);assert.equal(restored.touched,true);
}
const legacy=world.serialize({keepBounds:bounds});
const old=restoreWorldSnapshot(legacy);
assert.equal(old.getBlock(-1,14,-1),4);
console.log('PASS binary and legacy worlds restore claimed terrain, negative edits, surfaces and biomes');
const lamp=[...BLOCKS_BY_ID].find(([,b])=>b.light&&!/Ore$/.test(b.name))[0];
world.setBlock(2,15,2,lamp);world.setBlock(40,10,40,3);
const lit=restoreWorldSnapshot(await completeWorldSnapshot(captureWorldSnapshot(world,bounds)));
assert.equal(lit.getBlock(40,10,40),3);
assert.ok([...lit.lights.values()].some(p=>p.x===2&&p.y===15&&p.z===2));
assert.equal(lit.chunks.size,5);
console.log('PASS edits outside claimed land and placed lights survive without adding unrelated terrain');
const finite=new World({sizeX:16,sizeZ:16,height:16});
finite.setBlock(3,4,5,3);finite.setSurfaceHeight(3,5,5);
const fixed=restoreWorldSnapshot(await completeWorldSnapshot(captureWorldSnapshot(finite)));
assert.equal(fixed.endless,false);assert.equal(fixed.getBlock(3,4,5),3);
assert.deepEqual(fixed.surfaceHeightMap,finite.surfaceHeightMap);
assert.deepEqual(fixed.biomeMap,finite.biomeMap);
console.log('PASS finite worlds retain blocks and full surface/biome maps');
const first=await completeWorldSnapshot(captureWorldSnapshot(new World({height:32,gen:new ChunkGen({seed:8,height:32})}),
  {minX:0,maxX:15,minZ:0,maxZ:15}));
first.chunks[0].data[0]=77; // Saved claimed land from an earlier generator version.
const next=captureWorldSnapshot(new World({height:32,gen:new ChunkGen({seed:8,height:32})}),
  {minX:0,maxX:15,minZ:0,maxZ:15});
await completeWorldSnapshot(next,null,first);
assert.equal(next.chunks[0].data[0],77,'missing claimed chunks must reuse the committed terrain instead of regenerating it');
console.log('PASS later saves reuse committed missing claimed terrain');
