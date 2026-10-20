import assert from 'node:assert/strict';
import {ChunkGen,giantProfile,FEATURE_MARGIN} from '../src/world/ChunkGen.js';
const seen=new Map();
for(let x=0;x<100;x++) {
  const a=giantProfile(x,17,42);
  assert.deepEqual(a,giantProfile(x,17,42),'tree profile is seeded');
  seen.set(a.form,a);
}
assert.equal(seen.size,3,'spreading, spire and tiered giants all occur');
const gen=new ChunkGen({seed:42});
gen.heightAt=()=>10;
const shapes=new Set();
for(const [form,profile]of seen) {
  const cells=new Map();
  const put=(x,y,z,id,airOnly)=>{const k=`${x},${y},${z}`;if(!airOnly||!cells.has(k))cells.set(k,id);};
  gen.plantGiant(put,0,0,{...profile,ground:10,style:{wood:4,leaves:5}});
  let leaves=0;
  for(const [k,id]of cells) {
    const [x,y,z]=k.split(',').map(Number);
    assert.ok(Math.abs(x)<=FEATURE_MARGIN && Math.abs(z)<=FEATURE_MARGIN,`${form} stays inside generation margin`);
    if(id===5){leaves++;assert.ok(y>=14,`${form} keeps walking clearance`);}
    assert.ok(y<70,`${form} fits below the world ceiling`);
  }
  assert.ok(leaves>500,`${form} has a substantial crown`);
  shapes.add([...cells].sort().join('|'));
}
assert.equal(shapes.size,3,'forms produce distinct geometry');
assert.ok([...seen.values()].some(p=>p.trunk>=30),'some giants tower well above normal trees');
console.log('PASS three seeded giant silhouettes fit chunk margins and keep paths clear');
