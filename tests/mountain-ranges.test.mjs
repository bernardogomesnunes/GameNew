import assert from 'node:assert/strict';
import { BiomeMap } from '../src/world/biomeMap.js';
import { massifSite } from '../src/world/massifs.js';
import { mountainRangeAt, rangeDescriptor } from '../src/world/mountainRanges.js';
const map = new BiomeMap({ sizeX: 256, sizeZ: 256, seed: 42, homePull: 0 });
let site;
for (let x=-4; x<=4 && !site; x++) for(let z=-4; z<=4 && !site; z++) site=massifSite(map,x,z);
assert.ok(site);
const desc=rangeDescriptor(map,site);
assert.deepEqual(desc,rangeDescriptor(map,site));
let highest=0, occupied=0;
for(let u=-650;u<=650;u+=12) {
 const x=site.x+desc.cos*u, z=site.z+desc.sin*u;
 const range=mountainRangeAt(map,x,z);
 if(range){assert.ok(range.influence>=0&&range.influence<=1);assert.ok(range.ridge>=0&&range.ridge<=1);highest=Math.max(highest,range.ridge);occupied++;}
}
assert.ok(occupied>45,'long connected chain');
assert.ok(highest>.6,'multiple pronounced ridge summits');
console.log('PASS deterministic connected range has bounded influence and peaks');
for(let z=site.z-450;z<site.z+450;z+=23){
 const x=Math.round(site.x/1024)*1024;
 const left=mountainRangeAt(map,x-.001,z),right=mountainRangeAt(map,x+.001,z);
 assert.ok(Math.abs((left?.influence??0)-(right?.influence??0))<.001,'no region seam');
}
console.log('PASS neighbouring region boundary samples stay continuous');
map.homePull=1; assert.equal(mountainRangeAt(map,map.centreX,map.centreZ),null);
assert.equal(mountainRangeAt(map,map.centreX+120000,0),null);
assert.equal(mountainRangeAt(map,map.centreX-120000,0),null);
console.log('PASS home and era exclusions remain untouched');
const sky = (await import('../src/world/skyKingdom.js')).skyAt({seed:map.seed,biomes:map});
assert.equal(mountainRangeAt(map,sky.x,sky.z),null);
console.log('PASS sky island and its tower footprint remain excluded');
map.homePull=0;
let maxima=0,previous=0,rising=false,apronOnly=0;
for(let u=-desc.halfLength;u<desc.halfLength;u+=5){
 const v=Math.sin(u/185+desc.phase)*44+Math.sin(u/83+desc.phase*.7)*15;
 const x=site.x+desc.cos*u-desc.sin*v,z=site.z+desc.sin*u+desc.cos*v;
 const sample=mountainRangeAt(map,x,z),height=sample?.uplift??0;
 if(height>previous)rising=true;
 else if(height<previous&&rising){maxima++;rising=false;}
 previous=height;
}
assert.ok(maxima>=3,'connected backbone has distinct peaks and saddles');
for(let u=-400;u<=400;u+=25){
 const x=site.x+desc.cos*u-desc.sin*145,z=site.z+desc.sin*u+desc.cos*145;
 const sample=mountainRangeAt(map,x,z);
 if(sample&&sample.influence>.02&&sample.ridge<.25)apronOnly++;
}
assert.ok(apronOnly>8,'broad foothills lie beyond the narrow ridge');
console.log('PASS several ridge peaks, saddles and broad low foothills');
for(let x=site.x-600;x<=site.x+600;x+=29)for(let z=site.z-600;z<=site.z+600;z+=31){
 const a=mountainRangeAt(map,x,z),b=mountainRangeAt(map,x+.001,z+.001);
 assert.ok(Math.abs((a?.uplift??0)-(b?.uplift??0))<.01,'uplift is spatially continuous');
 assert.ok(Math.abs((a?.influence??0)-(b?.influence??0))<.001,'foothill mask is spatially continuous');
}
console.log('PASS dense foothill/ridge samples stay continuous across joins');
const started=performance.now();
for(let i=0;i<20000;i++) mountainRangeAt(map,site.x+(i%200)*6-600,site.z+Math.floor(i/200)*12-600);
console.log(`PASS 20,000 range samples in ${(performance.now()-started).toFixed(1)} ms (diagnostic, no timing assertion)`);
