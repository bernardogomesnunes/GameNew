import { World } from '../src/world/World.js';
import { validateStructure, inspect } from '../src/structures/validate.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};
const GRASS=1,DIRT=2,WOOD=4,LEAVES=5,WATER=11,FARMLAND=21;

const mk = () => new World({ sizeX: 32, sizeZ: 32, height: 32 });
const R = (x,y,z,s,h=s) => ({minX:x,maxX:x+s-1,minY:y,maxY:y+h-1,minZ:z,maxZ:z+s-1});

// --- FARM ---------------------------------------------------------------
let w = mk();
for (let x=4;x<8;x++) for (let z=4;z<8;z++) w.setBlock(x,10,z,FARMLAND);
let r = validateStructure(w, R(4,10,4,4,2), 'farm');
ok('farm without water is refused', !r.ok && r.failed === 'water');
ok('and the reason names water', /water/i.test(r.reason));
w.setBlock(10,10,6,WATER);
r = validateStructure(w, R(4,10,4,4,2), 'farm');
ok('farm beside the river passes', r.ok);

// too little tilled soil, and the message counts what's missing
w = mk();
w.setBlock(10,10,6,WATER);
for (let x=4;x<6;x++) w.setBlock(x,10,4,FARMLAND); // only 2
r = validateStructure(w, R(4,10,4,4,2), 'farm');
ok('short farm is refused', !r.ok && r.failed === 'tilled');
ok('message counts the shortfall', r.reason.includes('2 more'));

// --- size guards --------------------------------------------------------
r = validateStructure(mk(), R(4,10,4,2,2), 'house');
ok('house below min size refused', !r.ok && r.failed === 'too-small');

// --- HOUSE: the enclosure test is the hard one --------------------------
// a sealed 5x5x4 wooden box with a hollow interior
w = mk();
const build = (holeAt = null) => {
  for (let x=4;x<9;x++) for (let z=4;z<9;z++) for (let y=10;y<14;y++) {
    const shell = x===4||x===8||z===4||z===8||y===10||y===13;
    w.setBlock(x,y,z, shell ? WOOD : 0);
  }
  if (holeAt) w.setBlock(...holeAt, 0);
};
build();
r = validateStructure(w, R(4,10,4,5,4), 'house');
ok('sealed wooden box is a house', r.ok);
const ctx = inspect(w, R(4,10,4,5,4));
ok('interior measured as a sheltered room', ctx.shelteredVolume() >= 8);

// a doorway must NOT break it — every real house has one
w = mk(); build(); w.setBlock(6,11,4,0); w.setBlock(6,12,4,0);
r = validateStructure(w, R(4,10,4,5,4), 'house');
ok('a doorway does not break the claim', r.ok);

// but take the whole roof off and it is not shelter
w = mk();
for (let x=4;x<9;x++) for (let z=4;z<9;z++) for (let y=10;y<14;y++) {
  const wall = x===4||x===8||z===4||z===8||y===10;
  w.setBlock(x,y,z, wall ? WOOD : 0);
}
r = validateStructure(w, R(4,10,4,5,4), 'house');
ok('an open-topped box is not a house', !r.ok && r.failed === 'shelter');

// a wall of wood with no room inside is not a house
w = mk();
for (let x=4;x<9;x++) for (let z=4;z<9;z++) for (let y=10;y<14;y++) w.setBlock(x,y,z,WOOD);
r = validateStructure(w, R(4,10,4,5,4), 'house');
ok('a solid block of wood is not a house', !r.ok && r.failed === 'shelter');

// --- FOREST -------------------------------------------------------------
w = mk();
for (let x=4;x<12;x++) for (let z=4;z<12;z++) w.setBlock(x,9,z,GRASS);
for (let t=0;t<4;t++) {
  const tx = 5 + (t%2)*4, tz = 5 + Math.floor(t/2)*4;
  for (let y=10;y<14;y++) w.setBlock(tx,y,tz,WOOD);
  for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) for (let dy=13;dy<=15;dy++) w.setBlock(tx+dx,dy,tz+dz,LEAVES);
}
r = validateStructure(w, R(4,9,4,8,8), 'forest');
ok('a stand of four trees is a forest', r.ok);

w = mk();
for (let x=4;x<12;x++) for (let z=4;z<12;z++) w.setBlock(x,9,z,GRASS);
r = validateStructure(w, R(4,9,4,8,8), 'forest');
ok('bare ground is not a forest', !r.ok && r.failed === 'trunks');
ok('and it says to plant more', /wood|tree/i.test(r.reason));

process.exit(f?1:0);
