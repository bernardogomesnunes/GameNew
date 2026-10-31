import { MASSIF_REGION, massifSite } from './massifs.js';
import { inPast } from './past.js';
import { inFuture } from './future.js';
import { skyAt, TOWER_OUT } from './skyKingdom.js';

// Connected terrain-first ranges shared by ChunkGen and BiomeMap.
// One scalar landform, evaluated in world coordinates, with no chunk state,
// heightAt recursion, or added noise generators. Existing sites keep the seed's
// broad geography; neighbouring sites are considered because ridges cross cells.
const cache = new WeakMap();
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t=clamp(v); return t*t*(3-2*t); };
function roll(n) { let h=Math.imul(n|0,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967296; }

export function rangeDescriptor(map, site) {
  let records=cache.get(map);
  if(!records){records=new Map();cache.set(map,records);}
  const key=`${site.rx},${site.rz},${site.x},${site.z}`;
  if(records.has(key))return records.get(key);
  const salt=Math.imul(site.rx,73856093)^Math.imul(site.rz,19349663)^(map.seed??1);
  const angle=roll(salt)*Math.PI, phase=roll(salt^8191)*Math.PI*2;
  const d={cos:Math.cos(angle),sin:Math.sin(angle),halfLength:500+roll(salt^127)*95,
    width:225+roll(salt^451)*55,phase,branches:[]};
  // Spurs leave the backbone in alternating directions rather than becoming
  // separate circular peaks. Each tapers into the same broad foothill apron.
  for(let i=0;i<4;i++) {
    const u=(-.56+i*.37)*d.halfLength;
    const v=backbone(d,u), side=i%2?1:-1;
    d.branches.push({u,v,endU:u+70+roll(salt^(i+311))*60,endV:v+side*(140+roll(salt^(i+997))*75)});
  }
  if(records.size>=256)records.clear();
  records.set(key,d);return d;
}
function backbone(d,u){return Math.sin(u/185+d.phase)*44+Math.sin(u/83+d.phase*.7)*15;}
function segmentDistance(u,v,b){
  const dx=b.endU-b.u,dz=b.endV-b.v;
  const t=clamp(((u-b.u)*dx+(v-b.v)*dz)/(dx*dx+dz*dz));
  return {distance:Math.hypot(u-b.u-dx*t,v-b.v-dz*t),t};
}
function sampleSite(map,site,x,z){
  const d=rangeDescriptor(map,site),dx=x-site.x,dz=z-site.z;
  // Broad-phase reject before trigonometry and spur distances.
  if(Math.abs(dx)>820||Math.abs(dz)>820)return null;
  const u=dx*d.cos+dz*d.sin,v=-dx*d.sin+dz*d.cos;
  if(Math.abs(u)>=d.halfLength)return null;
  const lateral=Math.abs(v-backbone(d,u));
  if(lateral>=d.width)return null;
  const end=1-smooth((Math.abs(u)/d.halfLength-.58)/.42);
  const apron=1-smooth(lateral/d.width);
  // Rounded narrow crests, alternating peaks and saddles, and a modest
  // ruggedness modulation shared with the biome map's existing summit noise.
  const peak=.45+.55*(.5+.5*Math.sin(u/59+d.phase));
  let crest=Math.pow(1-smooth(lateral/(86+Math.sin(u/125+d.phase)*24)),1.25)*peak;
  for(const branch of d.branches){
    const s=segmentDistance(u,v,branch);
    crest=Math.max(crest,(1-smooth(s.distance/65))*(.75-.40*s.t));
  }
  const noise=map.summit?.(x*.014,z*.014)??0;
  const ridge=clamp((.18*apron+.82*crest)*end*(.98+.02*noise));
  return {influence:apron*end,ridge};
}

/** Broad foothill mask and narrow ridge relief, both continuous 0..1.
 * Consumers should raise a lowland foundation by the continuous `uplift`;
 * using influence alone for height would recreate the old rounded plateau.
 */
export function mountainRangeAt(map,x,z,wet=null){
  if(inPast(x,map.centreX)||inFuture(x,map.centreX))return null;
  let protect=1;
  if(map.homePull>0){const away=Math.hypot(x-map.centreX,z-map.centreZ);if(away<=180)return null;protect*=smooth((away-180)/160);}
  const sky=skyAt({seed:map.seed??1,biomes:map});
  const skyDistance=Math.hypot(x-sky.x,z-sky.z);
  if(skyDistance<=TOWER_OUT+32)return null;
  protect*=smooth((skyDistance-TOWER_OUT-32)/180);
  const rx=Math.floor(x/MASSIF_REGION),rz=Math.floor(z/MASSIF_REGION);
  let best=null, influence=0, uplift=0;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const site=massifSite(map,rx+ox,rz+oz);if(!site)continue;
    const p=sampleSite(map,site,x,z);if(!p)continue;
    // Max is continuous at joins and avoids stacking neighbouring ranges
    // above the world's 200-block ceiling. Keep the broad apron separately.
    const relief=p.ridge*protect;
    influence=Math.max(influence,p.influence*protect);
    uplift=Math.max(uplift,(site.peak-104)*relief);
    if(!best||relief>best.ridge)best={...site,influence:p.influence*protect,ridge:relief};
  }
  // Combine each scalar separately: switching the nearest/highest spine
  // must not switch its foothill mask or introduce a different peak target.
  if (!best) return null;
  // Existing anchor checks protect their old circular footprint from sea.
  // Long spurs can extend beyond it: fade their relief before deep ocean.
  const coast=1-smooth(((wet??map.climate(x,z).wet)-.78)/.09);
  if(coast<=0)return null;
  return {...best,influence:influence*coast,ridge:best.ridge*coast,uplift:uplift*coast};
}


