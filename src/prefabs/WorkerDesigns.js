import { room, MINT, TEAL, LILAC } from '../config/starterDesigns.js';
import { ITEM_FOR_BLOCK } from '../config/items.js';
import { BED, BED_HEAD } from '../config/blocks.js';

function finish(id,structure,name,blocks) {
  const unique=[...new Map(blocks.map(b=>[`${b.dx},${b.dy},${b.dz}`,b])).values()];
  const extent={x:0,y:0,z:0},cost={};
  for(const b of unique) {
    extent.x=Math.max(extent.x,b.dx);extent.y=Math.max(extent.y,b.dy);extent.z=Math.max(extent.z,b.dz);
    const item=ITEM_FOR_BLOCK.get(b.type);if(item)cost[item]=(cost[item]??0)+1;
  }
  return {id,structure,name,description:'A larger design for villagers to build in stages.',workers:true,blocks:unique,extent,cost,size:extent.x+1,footprint:`${extent.x+1} × ${extent.z+1}`};
}
const home=room({w:9,h:4,wall:4,floor:7,tiles:MINT,shape:'hip',shutters:true,chimney:{h:2,type:3}});
home.push({dx:3,dy:1,dz:3,type:BED+2},{dx:3,dy:1,dz:4,type:BED_HEAD+2},{dx:5,dy:1,dz:3,type:31},{dx:6,dy:1,dz:3,type:33});
const shed=room({w:11,h:4,wall:7,floor:3,tiles:TEAL,shape:'gable',shutters:true});
// Shelves line the back wall, leaving the door and central aisle free.
for(let x=2;x<=9;x+=2)shed.push({dx:x,dy:1,dz:9,type:354});
const shop=room({w:11,h:4,wall:4,floor:7,tiles:LILAC,shape:'gable',shutters:true,chimney:{h:3,type:3}});
shop.push({dx:3,dy:1,dz:3,type:31},{dx:8,dy:1,dz:3,type:31},{dx:9,dy:1,dz:8,type:354});
export const workerDesigns=[
  finish('house_homestead','house','Timber homestead',home),
  finish('storehouse_goods_hall','storehouse','Goods hall',shed),
  finish('workshop_great_workshop','workshop','Great workshop',shop),
];
