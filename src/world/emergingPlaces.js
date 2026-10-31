import { hash01 } from './ChunkGen.js';
import { landmarksFor, siteNear, emergingDesign, emergingLandmark } from './landmarks.js';
import { inPast } from './past.js';
import { inFuture } from './future.js';
import { skyAt, TOWER_OUT } from './skyKingdom.js';

import { EMERGING_INTERVAL, EMERGING_LIMIT, EMERGING_KINDS, emergingState, installEmergingPlaces } from './emergingPlaceState.js';
export { EMERGING_INTERVAL, EMERGING_LIMIT, emergingState, installEmergingPlaces } from './emergingPlaceState.js';
const KINDS=EMERGING_KINDS, CHUNK=16;

function freeSite(d, x, z, half) {
  const {world,territory}=d, margin=half+4;
  const minX=x-margin,maxX=x+margin,minZ=z-margin,maxZ=z+margin;
  // A place never rewrites an already generated chunk, even one untouched by
  // the player. This also prevents a camp appearing around a visible player.
  for(let cz=Math.floor(minZ/CHUNK);cz<=Math.floor(maxZ/CHUNK);cz++)for(let cx=Math.floor(minX/CHUNK);cx<=Math.floor(maxX/CHUNK);cx++){
    if(world.hasChunk(cx,cz))return false;
  }
  if(!d.sandbox&&territory?.contains){
    for(const px of[minX,x,maxX])for(const pz of[minZ,z,maxZ])if(territory.contains(px,pz))return false;
  }
  for(const s of d.structures?.list?.()??[]){const r=s.region;if(r&&minX<=r.maxX&&maxX>=r.minX&&minZ<=r.maxZ&&maxZ>=r.minZ)return false;}
  const gen=world.gen,homeX=gen.biomes.centreX??0;
  if(inPast(x,homeX)||inFuture(x,homeX))return false;
  const sky=skyAt(gen);
  return Math.hypot(x-sky.x,z-sky.z)>TOWER_OUT+margin+32;
}

/** One finite event per game day, with one slot due every ten days.
 * Returns real landmarks for notifications/actor refresh. New blocks are laid
 * by ordinary chunk generation, never by editing existing or claimed chunks.
 */
export function ensureEmergingPlaces(d) {
  if(!d?.world?.gen||!d.world.endless||!Number.isFinite(d.days))return [];
  d.emergingPlaces=emergingState(d.emergingPlaces);
  const state=d.emergingPlaces,day=Math.floor(d.days);
  installEmergingPlaces(d.world.gen,state);
  if(state.checkedDay>=day)return [];
  state.checkedDay=day;
  if(state.nextSlot>=Math.min(EMERGING_LIMIT,Math.floor(day/EMERGING_INTERVAL)))return [];
  // Failed slots are consumed as well: no unbounded retry work in hostile
  // terrain and no giant catch-up wave when loading an older day-100 save.
  const slot=state.nextSlot++,gen=d.world.gen,kind=KINDS[slot%KINDS.length];
  const seed=Math.floor(hash01(gen.seed,slot,8402)*0x7fffffff),design=emergingDesign(kind,seed);
  const taken=landmarksFor(gen);
  const homeX=gen.biomes.centreX??0,homeZ=gen.biomes.centreZ??0;
  for(let attempt=0;attempt<24;attempt++){
    const angle=hash01(seed,attempt,8403)*Math.PI*2;
    const radius=560+slot*65+hash01(seed,attempt,8404)*420;
    const x=Math.round(homeX+Math.cos(angle)*radius),z=Math.round(homeZ+Math.sin(angle)*radius);
    if(!freeSite(d,x,z,design.half))continue;
    const site=siteNear(gen,x,z,design.half,taken,24);
    if(!site||!freeSite(d,site.x,site.z,design.half))continue;
    const descriptor={id:`emerging:${slot}`,kind,...site,seed,day};
    state.places.push(descriptor);
    installEmergingPlaces(gen,state);
    return [emergingLandmark(descriptor)];
  }
  return [];
}
