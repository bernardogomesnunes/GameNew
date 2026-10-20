import {inPast} from './past.js';
import {inFuture} from './future.js';

export const MASSIF_REGION=1024;
const smooth=t=>t*t*(3-2*t);
function roll(x,z,seed) {
  let h=Math.imul(x,0x27d4eb2d)^Math.imul(z,0x165667b1)^Math.imul(seed,0x9e3779b1);
  h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);
  return ((h^(h>>>16))>>>0)/4294967296;
}

/** Sparse broad peaks, each completely inside its own region. */
export function massifSite(map,rx,rz) {
  if(map._massifHomeX!==map.centreX || map._massifHomeZ!==map.centreZ) {
    map._massifSites=new Map();map._massifHomeX=map.centreX;map._massifHomeZ=map.centreZ;
  }
  const cache=map._massifSites??=new Map(),key=`${rx},${rz}`;
  if(cache.has(key))return cache.get(key);
  if(cache.size>=256)cache.clear();
  const seed=map.seed??1;
  let site=null;
  if(roll(rx,rz,seed^0x3281)<.4) {
    const x=rx*MASSIF_REGION+512+Math.floor(roll(rx,rz,seed^0x12c3)*193)-96;
    const z=rz*MASSIF_REGION+512+Math.floor(roll(rx,rz,seed^0x75a1)*193)-96;
    const radius=210+Math.floor(roll(rx,rz,seed^0x48d3)*71);
    // A plateau-and-shoulder shape, broad enough to read from the horizon.
    site={rx,rz,x,z,radius,peak:174+Math.floor(roll(rx,rz,seed^0x49a7)*13)};
    if(inPast(x,map.centreX)||inFuture(x,map.centreX))site=null;
    if(site)for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius]) {
      if(map.climate(x+dx,z+dz).wet>.87)site=null;
    }
  }
  cache.set(key,site);return site;
}

/** Smooth 0..1 shoulder and summit profile, or null outside a peak. */
export function massifAt(map,x,z) {
  if(inPast(x,map.centreX)||inFuture(x,map.centreX))return null;
  const s=massifSite(map,Math.floor(x/MASSIF_REGION),Math.floor(z/MASSIF_REGION));
  if(!s)return null;
  const distance=Math.hypot((x-s.x)/s.radius,(z-s.z)/(s.radius*.85));
  if(distance>=1)return null;
  let influence=1-smooth(Math.max(0,(distance-.1)/.9));
  if(map.homePull>0) {
    const away=Math.hypot(x-map.centreX,z-map.centreZ);
    if(away<=180)return null;
    influence*=smooth(Math.min(1,(away-180)/160));
  }
  return {...s,influence};
}
