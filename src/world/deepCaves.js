import { hash01 } from './ChunkGen.js';
import { inFuture } from './future.js';

// One explorable complex per 512m region. Every query uses world coordinates,
// so galleries, entrances and ruins agree at chunk boundaries in either sign.
export const CAVE_REGION = 512;
const ENTRY_RUN = 180;
const MAIN_ENTRY = -44, UPPER_START = 36, UPPER_END = 96;
/**
 * How far a complex's passages reach from its site: the descent's mouth to
 * the upper hall's far wall, and the main gallery's sides. Nothing outside
 * this box is ever carved, so a column there is answered at once: asking it
 * for every block of every column made land a third slower to make.
 */
const REACH_MIN_X = MAIN_ENTRY - ENTRY_RUN - 3, REACH_MAX_X = UPPER_END + 25, REACH_MIN_Z = -30, REACH_MAX_Z = 40;
const NONE = Object.freeze([]);

export function caveSite(gen, rx, rz) {
  const x = rx * CAVE_REGION + 320 + Math.floor(hash01(rx, rz, gen.seed ^ 0x8c19) * 41) - 20;
  const z = rz * CAVE_REGION + 256 + Math.floor(hash01(rx, rz, gen.seed ^ 0x9d21) * 49) - 24;
  const home = gen.biomes;
  // Include the full descent, not just the hall, in the home exclusion.
  if (Math.hypot(x - home.centreX, z - home.centreZ) < 310
    || inFuture(x, home.centreX) || inFuture(x + MAIN_ENTRY - ENTRY_RUN, home.centreX)) return null;
  const y = 8 + Math.floor(hash01(rx, rz, gen.seed ^ 0xa341) * 7);
  const entryY = gen.heightAt(x + MAIN_ENTRY - ENTRY_RUN, z);
  if (entryY <= y + 12 || entryY - y > ENTRY_RUN) return null;
  return { x, y, z, entryY };
}

/** A region's site, worked out once (it reads the land's height) and kept. */
function siteFor(gen, rx, rz) {
  fresh(gen);
  // A number, not a string: this is asked for every block as land is made.
  const key = rx * 65536 + rz;
  const sites = gen._deepSites;
  if (!sites.has(key)) sites.set(key, caveSite(gen, rx, rz));
  return sites.get(key);
}

/** StarterWorld may relocate the settlement while finding its water source: forget what was worked out. */
function fresh(gen) {
  if (gen._deepHomeX === gen.biomes.centreX && gen._deepHomeZ === gen.biomes.centreZ && gen._deepSites) return;
  gen._deepColumns = new Map();
  gen._deepSites = new Map();
  gen._deepHomeX = gen.biomes.centreX;
  gen._deepHomeZ = gen.biomes.centreZ;
}

/** Inclusive open-air intervals in this column; floor is the first air cell. */
export function deepCaveColumn(gen, x, z) {
  const s = siteFor(gen, Math.floor(x / CAVE_REGION), Math.floor(z / CAVE_REGION));
  if (!s) return NONE;
  const ddx = x - s.x, ddz = z - s.z;
  if (ddx < REACH_MIN_X || ddx > REACH_MAX_X || ddz < REACH_MIN_Z || ddz > REACH_MAX_Z) return NONE;
  const key = `${x},${z}`;
  const cache = gen._deepColumns;
  if (cache.has(key)) return cache.get(key);
  if (cache.size >= 1024) cache.clear();
  const spans = [];
  {
    const dx = x - s.x, dz = z - s.z;
    // A 100m-long main gallery, with 15m of headroom in its central nave.
    const q = (dx / 52) ** 2 + (dz / 30) ** 2;
    if (q < 1) {
      const ceiling = Math.min(s.y + Math.floor(16 * Math.sqrt(1 - q)), gen.heightAt(x,z) - 10);
      if (ceiling >= s.y + 3) spans.push({floor:s.y, ceiling});
    }
    // A second, higher hall connected by a sloping passage.
    const upper = ((dx - UPPER_END) / 25) ** 2 + ((dz - 20) / 20) ** 2;
    if (upper < 1) {
      const floor = s.y + 25;
      const ceiling = Math.min(floor + Math.floor(11 * Math.sqrt(1-upper)),gen.heightAt(x,z)-10);
      if(ceiling >= floor+3) spans.push({floor,ceiling});
    }
    const upperT = (dx - UPPER_START) / (UPPER_END - UPPER_START);
    if (upperT >= 0 && upperT <= 1 && Math.abs(dz - Math.round(upperT * 20)) <= 3) {
      const floor = s.y + Math.floor(upperT * 25);
      const ceiling = Math.min(floor + 5,gen.heightAt(x,z)-10);
      if(ceiling>=floor+3) spans.push({floor,ceiling,ramp:true});
    }
    // A stair-height descent, with an open mouth where it meets the surface.
    if(dx >= MAIN_ENTRY-ENTRY_RUN-3 && dx <= MAIN_ENTRY && Math.abs(dz)<=3) {
      const t = Math.min(1,(MAIN_ENTRY-dx)/ENTRY_RUN);
      const floor = s.y + Math.floor((s.entryY-s.y)*t);
      spans.push({floor,ceiling:Math.min(gen.height-1,floor+5),ramp:true});
    }
  }
  cache.set(key,spans);
  return spans;
}

/** Clear the complete passages, including their surface mouths, after rock. */
export function stampDeepCaves(gen, chunk, size) {
  const ox=chunk.cx*size, oz=chunk.cz*size;
  for(let lx=0;lx<size;lx++) for(let lz=0;lz<size;lz++) {
    const spans=deepCaveColumn(gen,ox+lx,oz+lz);
    for(const s of spans) for(let y=s.floor;y<=s.ceiling;y++) chunk.set(lx,y,lz,0);
    // Preserve each stair tread where a sloping passage joins a taller hall.
    for(const s of spans) {
      const tread=s.floor-1;
      // A hall's level floor must yield to the rising doorway into it.
      if(!s.ramp && spans.some(r=>r.ramp && tread>=r.floor && tread<=r.ceiling)) continue;
      chunk.set(lx,tread,lz,3);
    }
  }
}

/** A broken pillared hall, flagstone floor and a chest using existing cave loot. */
export function stampCaveRuins(gen,chunk,size) {
  const ox=chunk.cx*size, oz=chunk.cz*size;
  const rx=Math.floor(ox/CAVE_REGION), rz=Math.floor(oz/CAVE_REGION);
  const s=siteFor(gen,rx,rz);
  if(!s) return;
  const put=(dx,y,dz,id)=>{
    const x=s.x+dx-ox,z=s.z+dz-oz;
    if(x>=0 && x<size && z>=0 && z<size && y>=3 && y<chunk.height) chunk.set(x,y,z,id);
  };
  for(let dx=-10;dx<=10;dx++) for(let dz=-8;dz<=8;dz++) {
    const worn=hash01(s.x+dx,s.z+dz,gen.seed^0xbe71);
    put(dx,s.y-1,dz,worn<0.15?22:worn<0.4?8:329);
  }
  for(const dx of [-8,8]) for(const dz of [-6,0,6]) {
    const height=4+Math.floor(hash01(s.x+dx,s.z+dz,gen.seed^0xc291)*5);
    for(let y=0;y<height;y++) put(dx,s.y+y,dz,329);
    put(dx,s.y+height,dz,8);
  }
  // Two remnants of a lintel, leaving the doorway and nave clear.
  for(let dx=-7;dx<=-3;dx++) put(dx,s.y+4,-6,329);
  for(let dx=3;dx<=7;dx++) put(dx,s.y+4,6,329);
  put(0,s.y,0,148);
  put(-7,s.y,5,26);
  put(7,s.y,-5,26);
}
