import assert from 'node:assert/strict';
import {observeSave} from '../tools/performance/profile-report.js';
import {undergroundView} from '../tools/performance/profile-world.js';
import {World} from '../src/world/World.js';
import {ChunkGen} from '../src/world/ChunkGen.js';
import {LocalWorlds} from '../src/storage/LocalWorlds.js';
globalThis.window??={addEventListener(){},removeEventListener(){}};
const {Game}=await import('../src/Game.js');
const counters=()=>({saveAttempts:0,saves:0,failedSaves:0});
const state=counters();
assert.equal(observeSave(state,()=>true),true);
assert.equal(observeSave(state,()=>false),false);
assert.throws(()=>observeSave(state,()=>{throw new Error('Synthetic save failure');}));
assert.deepEqual(state,{saveAttempts:3,saves:1,failedSaves:2});
console.log('PASS save attempts, false results and thrown errors cannot count as successful saves');
const previous=globalThis.localStorage;
try{
  globalThis.localStorage={setItem(){throw new Error('Synthetic quota failure');}};
  const game={local:new LocalWorlds(),world:{serialize:()=>({chunks:[]})},
    cloud:{signedIn:false},bus:{emit(){}}};
  const quota=counters();
  assert.equal(observeSave(quota,()=>Game.prototype.saveLocally.call(game)),false);
  assert.equal(quota.saves,0);assert.equal(quota.failedSaves,1);assert.match(game.saveError,/browser is full/i);
}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
console.log('PASS the actual local-storage quota catch remains a failed save in profiler evidence');
const world=new World({height:200,gen:new ChunkGen({seed:4242,height:200})});
const view=undergroundView(world);
assert.ok(view.y+3<view.surface);
for(let dy=0;dy<4;dy++)assert.equal(world.getBlock(Math.floor(view.x),view.y+dy,Math.floor(view.z)),0);
console.log('PASS cave workload selects actual underground air with headroom rather than a surface label');
