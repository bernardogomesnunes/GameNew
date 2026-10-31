// IMP-16: "they are able to go to roofs of the house. It seems that they
// can't open doors."
import assert from 'node:assert/strict';
import {World} from '../src/world/World.js';
import {Settlers} from '../src/duilt/Settlers.js';
import {doorBlock,doorPart} from '../src/config/blocks.js';

function flat() {
  const world=new World({sizeX:32,sizeZ:32,height:24});
  for(let x=0;x<32;x++)for(let z=0;z<32;z++){world.setBlock(x,4,z,3);world.surfaceHeightMap[x*32+z]=5;}
  return world;
}

{
  // A wall across the way with a shut door in it, and no way round.
  const world=flat();
  for(let z=0;z<32;z++)for(let y=5;y<9;y++)world.setBlock(10,y,z,3);
  world.setBlock(10,5,10,doorBlock({facing:1}));world.setBlock(10,6,10,doorBlock({facing:1,top:true}));
  const settlers=new Settlers({world,structures:{list:()=>[]},rand:()=>.5});
  const swings=[];
  settlers.doors={
    open:(x,y,z)=>{swings.push('open');for(const h of [5,6])world.setBlock(x,h,z,doorBlock({facing:1,top:h===6,open:true}));return true;},
    close:(x,y,z)=>{swings.push('close');for(const h of [5,6])world.setBlock(x,h,z,doorBlock({facing:1,top:h===6}));return true;},
  };
  const p={x:5.5,z:10.5,y:5,wait:0,target:{x:16.5,z:10.5},homeId:1,workId:1};
  settlers.people.push(p);
  for(let i=0;i<300&&p.x<16;i++){settlers.walk(p,.05);settlers.closeDoors(.05);}
  assert.ok(p.x>15,`they get through the door (x ${p.x.toFixed(1)})`);
  assert.equal(p.y,5,'on the floor, not over the wall');
  for(let i=0;i<60;i++)settlers.closeDoors(.05);
  assert.deepEqual(swings,['open','close'],'opened on the way, shut behind them');
  assert.equal(doorPart(world.getBlock(10,5,10)).open,false);
  console.log('PASS villagers open a door on their way and shut it behind them');
}
{
  // Saved standing under a roof: they load on their floor, not on the roof.
  const world=flat();
  for(let x=4;x<9;x++)for(let z=4;z<9;z++){world.setBlock(x,8,z,3);world.surfaceHeightMap[x*32+z]=9;}
  const settlers=new Settlers({world,structures:{list:()=>[{id:1,valid:true,region:{minX:4,maxX:8,minZ:4,maxZ:8,minY:5,maxY:8}}],capacity:()=>5},rand:()=>.5});
  settlers.loadJSON({people:[{id:0,name:'Ana',homeId:1,x:6.5,y:5,z:6.5}]});
  assert.equal(settlers.people[0].y,5,'kept on their floor under the roof');
  console.log('PASS a villager saved indoors loads indoors, not on the roof');
}
