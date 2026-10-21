import assert from 'node:assert/strict';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { massifSite } from '../src/world/massifs.js';
import { mountainRangeAt } from '../src/world/mountainRanges.js';
let worst=0,changed=0;
for(const seed of[1,13,42,79,137,991]){
 const g=new ChunkGen({seed,homePull:0}),same=new ChunkGen({seed,homePull:0});let site;
 for(let x=-4;x<=4&&!site;x++)for(let z=-4;z<=4&&!site;z++)site=massifSite(g.biomes,x,z);
 // Isolate landform continuity; river cuts have their own regression tests.
 assert.ok(site); g.riverCut=()=>0;g.streamCut=()=>0;same.riverCut=()=>0;same.streamCut=()=>0;
 for(let x=site.x-650;x<=site.x+650;x+=19)for(let z=site.z-450;z<=site.z+450;z+=23){
  const h=g.heightAt(x,z);assert.ok(h>=1&&h<=190,'terrain remains inside 200-block height');
  const jump=Math.max(Math.abs(h-g.heightAt(x+1,z)),Math.abs(h-g.heightAt(x,z+1)));
  const range=mountainRangeAt(g.biomes,x,z); if(range?.influence>.01){worst=Math.max(worst,jump);assert.ok(jump<=6,`seed ${seed}: at ${x},${z}: neighbouring landform jump ${jump}`);}
  if(mountainRangeAt(g.biomes,x,z)?.uplift>35)changed++;
 }
 assert.equal(g.heightAt(site.x,site.z),same.heightAt(site.x,site.z));
 assert.equal(g.heightAt(-120000,0),108,'future ground unchanged');
}
assert.ok(changed>100);
console.log(`PASS six seed range footprints remain bounded, deterministic and smooth (worst adjacent step ${worst})`);
