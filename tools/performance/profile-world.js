// Test-only workload, loaded by the local profiler; never imported by the game.
import { STARTER_DESIGNS } from '../../src/config/starterDesigns.js';
import { WAR_AGE } from '../../src/config/ages.js';

export function prepareProfileWorld(game) {
  game.newWorld({mode:'duilt',name:'Test world 1',seed:4242,silent:true});
  game.renderer.setAnimationLoop(null);
  const world=game.world,d=game.duilt;
  const home={x:world.centreX,z:world.centreZ};
  const floor=world.surfaceHeight(home.x,home.z);
  d.territory.setAge(WAR_AGE);game.applyTerritoryBounds();
  // Build a level town using actual designs and validated, free fixture claims.
  // This models a developed saved world without requiring hours of progression.
  for(let x=home.x-88;x<=home.x+48;x++)for(let z=home.z-112;z<=home.z+12;z++){
    for(let y=floor;y<=Math.min(world.height-1,floor+36);y++){
      if(world.getBlock(x,y,z)!==0)world.setBlock(x,y,z,0);
    }
    world.setBlock(x,floor-1,z,1);world.setSurfaceHeight(x,z,floor);
  }
  const types=[...Array(32).fill('house'),...Array(8).fill('townhouse'),
    ...Array(4).fill('storehouse'),...Array(4).fill('quarry'),
    ...Array(4).fill('workshop'),...Array(2).fill('storehouse'),...Array(2).fill('work_hall')];
  for(let i=0;i<types.length;i++){
    const type=types[i],design=STARTER_DESIGNS.find(d=>d.structure===type);
    const x=home.x-84+(i%8)*16,z=home.z-108+Math.floor(i/8)*16;
    for(const b of design.blocks)world.setBlock(x+b.dx,floor+b.dy,z+b.dz,b.type);
    const region={minX:x,maxX:x+design.extent.x,minY:floor,maxY:floor+design.extent.y,minZ:z,maxZ:z+design.extent.z};
    const result=d.structures.claim(region,type,{free:true});
    if(!result.ok)throw new Error(`Profile fixture ${type} failed validation: ${result.reason}`);
  }
  d.inventory.add('fruit',5000);
  while(d.settlers.hasRoom){if(!d.settlers.arrive())break;}
  const halls=d.structures.list().filter(s=>s.type==='work_hall');
  for(let i=0;i<Math.min(8,d.settlers.people.length);i++)d.jobs.assign(d.settlers.people[i].id,'hauler',halls[i%halls.length].id);
  for(const hall of halls)d.jobs.deposit(hall.id,'fruit',20);
  game.ui.refreshForMode();game.ui.hideBlocker();
  const view={x:home.x+2,y:floor+14,z:home.z+20};
  game.player.teleport(view.x,view.y,view.z);game.player.flying=true;
  game.player.yaw=0;game.player.pitch=-.15;
  game.streamedAt=null;game.streamChunks();game.generateQueued(Infinity);
  game.drainRemeshQueue(Infinity);game.updateDeep();game.drainRemeshQueue(Infinity);
  game.updateFarTerrain(Infinity);game.updateChunkVisibility();
  return {home,view,buildings:d.structures.list().length,population:d.settlers.population,
    fixture:'56 validated buildings; populated Duilt settlement; observer healed/fed between samples; actual war updates'};
}

export function profilePhase(game,fixture,name,step=0){
  const d=game.duilt;
  if(name==='war'&&!d.war.atWar){
    d.declareWar();d.war.round=7;d.war.stage='warned';d.war.due=d.days;
  }
  if(name==='settlement'||name==='war'||name==='return'||name==='recovery'){
    const at=fixture.view;game.player.teleport(at.x,at.y,at.z);
    game.player.yaw=0;game.player.pitch=-.15;
  }else{
    const x=name==='travel'?-744+step*32:340,z=name==='travel'?600:781;
    game.player.teleport(x,game.world.gen.heightAt(x,z)+5,z);
  }
  game.player.flying=true;
}
