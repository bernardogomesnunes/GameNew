import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { GrassView } from '../src/render/GrassView.js';

const scene={add(){},remove(){}};
let failures=0;
const check=(name,run)=>{try{run();console.log(`PASS ${name}`);}catch(error){failures++;console.error(`FAIL ${name}: ${error.message}`);}};
function flatEndless(){
  const gen={biomes:{centreX:32,centreZ:32},fills:0,fill(world,chunk){
    this.fills++;
    for(let x=0;x<16;x++)for(let z=0;z<16;z++){
      chunk.set(x,0,z,2);chunk.set(x,1,z,1);chunk.surface[z*16+x]=2;
    }
  }};
  return new World({height:8,gen});
}
check('grass over unloaded actual mountain terrain cannot synchronously generate chunks',()=>{
  const gen=new ChunkGen({seed:4242,height:200}),world=new World({height:200,gen});
  const view=new GrassView(scene);
  try{
    view.update(world,{x:-2521,y:gen.heightAt(-2521,-2720)+5,z:-2720},1000);
    assert.equal(world.chunks.size,0,'a visual-only update must leave generation to streaming');
    assert.equal(view.mesh.count,0);
  }finally{view.dispose();}
});
check('partial coverage and negative coordinates keep loaded tufts without creating neighbours',()=>{
  const world=flatEndless(),view=new GrassView(scene);
  world.getChunk(-1,-1);
  try{
    view.update(world,{x:0,y:2,z:0},1000);
    assert.equal(world.chunks.size,1);assert.equal(world.gen.fills,1);
    assert.ok(view.mesh.count>0);
    const matrices=view.mesh.instanceMatrix.array;
    for(let i=0;i<view.mesh.count;i++){
      assert.ok(matrices[i*16+12]<0);assert.ok(matrices[i*16+14]<0);
    }
    world.getChunk(0,0); // The normal generator/worker supplies another chunk.
    view.update(world,{x:0,y:2,z:0},2000);
    assert.equal(world.gen.fills,2);
    assert.ok(Array.from({length:view.mesh.count},(_,i)=>matrices[i*16+12]).some(x=>x>=0),
      'standing still must pick up terrain arriving after the earlier scan');
  }finally{view.dispose();}
});
check('fully loaded endless and finite turf produce identical tuft transforms and colours',()=>{
  const endless=flatEndless(),finite=new World({sizeX:64,sizeZ:64,height:8});
  for(let cx=0;cx<4;cx++)for(let cz=0;cz<4;cz++)endless.getChunk(cx,cz);
  for(let x=0;x<64;x++)for(let z=0;z<64;z++){
    finite.setBlock(x,0,z,2);finite.setBlock(x,1,z,1);finite.setSurfaceHeight(x,z,2);
  }
  const a=new GrassView(scene),b=new GrassView(scene),at={x:32,y:2,z:32};
  try{
    a.update(endless,at,1000);b.update(finite,at,1000);
    assert.ok(a.mesh.count>0);assert.equal(a.mesh.count,b.mesh.count);
    assert.deepEqual(a.mesh.instanceMatrix.array,b.mesh.instanceMatrix.array);
    assert.deepEqual(a.mesh.instanceColor.array,b.mesh.instanceColor.array);
  }finally{a.dispose();b.dispose();}
});
process.exitCode=failures?1:0;
