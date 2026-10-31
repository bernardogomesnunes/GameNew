import {groundAt,bodyFits,isLoaded} from '../world/Mobs.js';
import {doorPart} from '../config/blocks.js';

/**
 * The world as a villager sees it (IMP-16: "It seems that they can't open
 * doors"): a shut door is a way through, because they open it on the way
 * (Settlers.passDoors). Everything else is the world itself.
 */
const views=new WeakMap();
export function doorWise(world) {
  let v=views.get(world);
  if(!v) {
    v=Object.create(world);
    v.collisionBoxAt=(x,y,z)=>doorPart(world.getBlock(x|0,y|0,z|0))?null:world.collisionBoxAt(x,y,z);
    views.set(world,v);
  }
  return v;
}

const TALL=1.8, HALF=.28, SEARCH_LIMIT=512;

/** A reachable floor from the previous foot height; never streams new chunks. */
export function settlerFloor(world,x,z,fromY) {
  for(const dx of [-HALF,HALF])for(const dz of [-HALF,HALF]) {
    if(!world.inBounds(Math.floor(x+dx),0,Math.floor(z+dz)) || !isLoaded(world,x+dx,z+dz))return null;
  }
  const y=groundAt(world,x,z,fromY,TALL);
  return y!=null && bodyFits(world,x,z,y,TALL,HALF)?y:null;
}

/** Bounded A* on loaded, walkable cells. Used only when the direct walk blocks. */
export function settlerRoute(world,person,target) {
  const tx=Math.floor(target.x),tz=Math.floor(target.z);
  const sx=Math.floor(person.x),sz=Math.floor(person.z);
  if(Math.abs(tx-sx)+Math.abs(tz-sz)>96)return null;
  const key=(x,y,z)=>`${x},${y},${z}`;
  const heuristic=(x,z)=>Math.abs(tx-x)+Math.abs(tz-z);
  const first={x:sx,z:sz,y:person.y,g:0,f:heuristic(sx,sz),parent:null};
  const open=[first],cost=new Map([[key(sx,person.y,sz),0]]);
  for(let n=0;open.length&&n<SEARCH_LIMIT;n++) {
    open.sort((a,b)=>b.f-a.f);
    const at=open.pop();
    if(at.x===tx&&at.z===tz) {
      const route=[];
      for(let p=at;p.parent;p=p.parent)route.push({x:p.x+.5,z:p.z+.5});
      return route.reverse();
    }
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=at.x+dx,z=at.z+dz,y=settlerFloor(world,x+.5,z+.5,at.y);
      if(y==null)continue;
      const g=at.g+1+Math.abs(y-at.y)*.1,k=key(x,y,z);
      if(g>=(cost.get(k)??Infinity))continue;
      cost.set(k,g);open.push({x,y,z,g,f:g+heuristic(x,z),parent:at});
    }
  }
  return null;
}
