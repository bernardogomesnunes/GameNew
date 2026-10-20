import assert from 'node:assert/strict';
import {World} from '../src/world/World.js';
import {Wanderers} from '../src/world/Wanderers.js';
const world=new World({sizeX:128,sizeZ:64,height:16});
for(let x=0;x<128;x++)for(let z=0;z<64;z++){world.setBlock(x,4,z,3);world.surfaceHeightMap[x*64+z]=5;}
for(let x=67;x<=73;x++)for(let z=29;z<=35;z++)world.setBlock(x,5,z,11);
const wanderers=new Wanderers({world,rand:()=>.5});
wanderers.landmarks=[{kind:'camp',x:120,z:32,y:5}];
const raiders=wanderers.sendRaid({x:20,z:32});
assert.ok(raiders?.length,'a pond at the projected spawn does not cancel every raid');
for(const p of raiders)assert.equal(world.getBlock(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)),0,'raiders start on dry ground');
console.log('PASS raids use a nearby dry shore when their projected spawn is water');
