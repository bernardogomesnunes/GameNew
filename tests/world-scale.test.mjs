import assert from 'node:assert/strict';
import {ChunkGen} from '../src/world/ChunkGen.js';
import {BIOMES,BIOME_INDEX} from '../src/config/biomes.js';
import {massifSite,massifAt} from '../src/world/massifs.js';
import {World} from '../src/world/World.js';
import {skyAt,ISLAND_R,TOWER_OUT} from '../src/world/skyKingdom.js';

const gen=new ChunkGen({seed:42,homePull:0});
assert.ok(Math.abs(gen.heightAt(165,-3579)-gen.heightAt(166,-3579))<=4,'massif boundary blends from low terrain, not a fixed sea-level pedestal');
let site;
for(let rx=-4;rx<=4&&!site;rx++)for(let rz=-4;rz<=4&&!site;rz++)site=massifSite(gen.biomes,rx,rz);
assert.ok(site,'rare peaks exist');
assert.deepEqual(site,massifSite(new ChunkGen({seed:42,homePull:0}).biomes,site.rx,site.rz));
assert.ok(site.radius>=200,'huge mountains have broad foothills');
assert.ok(gen.heightAt(site.x,site.z)>=170,'rare summit towers above the ordinary ranges');
assert.ok(gen.heightAt(site.x,site.z)<200-5,'summits leave headroom');
for(let d=0;d<site.radius+20;d++) {
  assert.ok(Math.abs(gen.heightAt(site.x+d+1,site.z)-gen.heightAt(site.x+d,site.z))<=4,'no hard cliff at massif boundary');
}
const home=new ChunkGen({seed:42,homeX:site.x,homeZ:site.z});
assert.equal(massifAt(home.biomes,site.x,site.z),null,'starting plot protected');
const index=gen.biomeIndexAt(site.x,site.z);
assert.ok(['mountains1','mountains2'].includes(BIOMES[index].id),'summit uses a mountain biome');
assert.equal(massifAt(gen.biomes,120000,0),null,'Past terrain retains its own generation');
assert.equal(massifAt(gen.biomes,-120000,0),null,'Future terrain retains its own generation');
const world=new World({height:200,gen}),other=new World({height:200,gen:new ChunkGen({seed:42,homePull:0})});
const cx=Math.floor(site.x/16),cz=Math.floor(site.z/16);
for(const [dx,dz]of [[1,0],[0,0],[-1,0]])other.getChunk(cx+dx,cz+dz);
for(const [dx,dz]of [[-1,0],[0,0],[1,0]])assert.deepEqual(world.getChunk(cx+dx,cz+dz).data,other.getChunk(cx+dx,cz+dz).data,'mountain chunks agree regardless of generation order');
for(const name of ['plains','desert']) {
  const g=new ChunkGen({seed:13,homePull:0});
  const weights=BIOMES.map((b,i)=>i===BIOME_INDEX.get(name)?1:0);
  g.biomes.weigh=()=>({weights,index:BIOME_INDEX.get(name)});
  g.riverCut=()=>0;g.streamCut=()=>0;
  let lo=Infinity,hi=-Infinity,level=0,n=0;
  for(let x=0;x<240;x+=3)for(let z=0;z<240;z+=3){
    const h=g.heightAt(x,z);lo=Math.min(lo,h);hi=Math.max(hi,h);
    if(h===g.heightAt(x+1,z))level++;n++;
  }
  assert.ok(hi-lo<=5,`${name} has broad, gentle relief`);
  assert.ok(level/n>.8,`${name} is mostly level at walking scale`);
}
// A summit stands above the floating island's floor: never under it or its towers.
for(let seed=1;seed<=60;seed++) {
  const g=new ChunkGen({seed});
  const sky=skyAt(g);
  for(let k=0;k<32;k++) {
    const a=k/32*Math.PI*2;
    for(const r of [0,ISLAND_R,TOWER_OUT]) {
      const x=Math.round(sky.x+Math.cos(a)*r),z=Math.round(sky.z+Math.sin(a)*r);
      assert.equal(g.biomes.weigh(x,z).massif,null,`no huge peak under the sky island (seed ${seed})`);
    }
  }
}
console.log('PASS broad rare mountains, protected home and flatter open country');
