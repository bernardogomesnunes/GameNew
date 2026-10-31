import assert from 'node:assert/strict';
import {World} from '../src/world/World.js';
import {Settlers} from '../src/duilt/Settlers.js';

function setup() {
  const world=new World({sizeX:32,sizeZ:32,height:24});
  for(let x=0;x<32;x++)for(let z=0;z<32;z++){
    world.setBlock(x,4,z,3);world.surfaceHeightMap[x*32+z]=5;
  }
  const settlers=new Settlers({world,structures:{list:()=>[]},rand:()=>.5});
  const p={x:5.5,z:10.5,y:5,wait:0,target:{x:18.5,z:10.5},homeId:1,workId:1};
  return {world,settlers,p};
}
{
  const {world,settlers,p}=setup();
  for(let z=8;z<=12;z++)for(let y=5;y<9;y++)world.setBlock(10,y,z,3);
  let reached=false;
  for(let i=0;i<400;i++){
    settlers.walk(p,.05);
    assert.ok(p.y<=6,'villager cannot climb a four-block wall');
    assert.ok(!(p.x>=10&&p.x<11&&p.z>=8&&p.z<13),'villager cannot pass through the wall');
    if(Math.hypot(p.x-18.5,p.z-10.5)<.2){reached=true;break;}
  }
  assert.ok(reached,'villager finds a route around a house-sized obstacle');
}
{
  const {world,settlers,p}=setup();
  for(let x=10;x<=18;x++)for(let z=8;z<=12;z++)world.setBlock(x,5,z,3);
  for(let i=0;i<300&&p.target;i++)settlers.walk(p,.05);
  assert.ok(p.x>18 && p.y===6,'ordinary one-block platforms remain reachable');
}
{
  const {world,settlers,p}=setup();
  for(let z=0;z<32;z++)for(let y=5;y<10;y++)world.setBlock(10,y,z,3);
  settlers.walk(p,10);
  assert.ok(p.x<10 && p.y===5,'a large frame delta cannot tunnel through a wall');
  for(let i=0;i<150;i++){settlers.walk(p,.1);assert.ok(p.x<10 && p.y===5,'unreachable targets do not cause teleporting');}
}
{
  const gen={biomes:{centreX:0,centreZ:0},fill:(_world,c)=>{for(let x=0;x<16;x++)for(let z=0;z<16;z++){c.set(x,4,z,3);c.surface[z*16+x]=5;}}};
  const world=new World({height:24,gen});world.getChunk(0,0);
  const settlers=new Settlers({world,structures:{list:()=>[]},rand:()=>.5});
  const p={x:14.5,z:5.5,y:5,wait:0,target:{x:20.5,z:5.5},workId:1};
  for(let i=0;i<30;i++)settlers.walk(p,.1);
  assert.equal([...world.allChunks()].length,1,'navigation never generates unloaded destination chunks');
  assert.ok(p.x<16,'villager stops at the loaded-world edge');
}
{
  const {world,settlers,p}=setup();p.wait=10;p.target=null;
  world.setBlock(5,5,10,3);world.setBlock(5,6,10,3);
  settlers.walk(p,.1);
  // IMP-16: lifted onto what was built round them is how villagers ended up
  // on roofs; they step out beside it instead, at their own height.
  assert.equal(p.y,5,'construction round an idle villager moves them out beside it');
  assert.ok(!(Math.floor(p.x)===5&&Math.floor(p.z)===10),'out of the built cell');
}
console.log('PASS settlers route around tall walls, step onto platforms and resist large-dt tunnelling');
