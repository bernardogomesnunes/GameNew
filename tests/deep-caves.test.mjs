import assert from 'node:assert/strict';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { Chunk, World } from '../src/world/World.js';
import { caveSite, deepCaveColumn, stampCaveRuins } from '../src/world/deepCaves.js';

const gen = new ChunkGen({seed: 42});
const site = caveSite(gen, 0, 0);
assert.ok(site, 'a regional gallery exists');
assert.ok(site.y >= 5 && site.y < 20, 'gallery reaches deep mine levels');
assert.deepEqual(site, caveSite(new ChunkGen({seed:42}), 0,0));
assert.notDeepEqual(site, caveSite(new ChunkGen({seed:43}), 0,0));
for (let dx=-24; dx<=24; dx++) {
  const spans = deepCaveColumn(gen, site.x+dx, site.z);
  assert.ok(spans.some(s => s.floor === site.y && s.ceiling >= site.y+9), 'wide walkable gallery');
}
let last;
for (let dx=-224; dx<=-44; dx++) {
  const spans = deepCaveColumn(gen, site.x+dx, site.z);
  const ramp = spans.find(s=>s.ramp);
  assert.ok(ramp, 'continuous passage from entrance to gallery');
  if (last != null) assert.ok(Math.abs(ramp.floor-last)<=1, 'walkable descent');
  last=ramp.floor;
}
const at = (cx,cz) => {
  const chunk = new Chunk(cx,cz,200);
  stampCaveRuins(gen,chunk,16);
  return chunk;
};
const chunks = new Map();
for(let cz=Math.floor((site.z-12)/16);cz<=Math.floor((site.z+12)/16);cz++)
  for(let cx=Math.floor((site.x-12)/16);cx<=Math.floor((site.x+12)/16);cx++) chunks.set(`${cx},${cz}`,at(cx,cz));
const block=(x,y,z)=>chunks.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)?.get(((x%16)+16)%16,y,((z%16)+16)%16)??0;
assert.ok(block(site.x,site.y-1,site.z), 'ruin has a floor');
assert.ok(block(site.x,site.y,site.z)>=148 && block(site.x,site.y,site.z)<=151,'ruin has a chest');
assert.equal(block(site.x+1,site.y,site.z),0,'chest has a walkable approach');
assert.ok(block(site.x-8,site.y+3,site.z-6),'ruin has standing pillars');
for (const c of chunks.values()) assert.deepEqual(c.data,at(c.cx,c.cz).data,'chunk order independent ruins');
const homeGen=new ChunkGen({seed:42,homeX:site.x,homeZ:site.z});
assert.equal(caveSite(homeGen,0,0),null,'settlement foundations protected');
const relocated = new ChunkGen({seed:42});
assert.ok(deepCaveColumn(relocated,site.x,site.z).length);
relocated.biomes.centreX=site.x;relocated.biomes.centreZ=site.z;
assert.equal(deepCaveColumn(relocated,site.x,site.z).length,0,'moving the settlement invalidates cached cave columns');
for(const [x,z] of [[site.x,site.z],[-192,-192],[0,0]]) for(const span of deepCaveColumn(gen,x,z)) {
  assert.ok(span.floor>=3,'bedrock protected');
  if(!span.ramp) assert.ok(span.ceiling<gen.heightAt(x,z)-6,'surface roof protected');
}
// Exercise the actual terrain/stamping order, not only the feature descriptors.
const world = new World({height:200,gen});
for(let dx=-224;dx<=-44;dx++) {
  const x=site.x+dx,z=site.z+1;
  const ramp=deepCaveColumn(gen,x,z).find(s=>s.ramp);
  assert.ok(world.getBlock(x,ramp.floor-1,z),'descent has solid treads');
  assert.equal(world.getBlock(x,ramp.floor,z),0,'descent foot space stays clear');
  assert.equal(world.getBlock(x,ramp.floor+1,z),0,'descent headroom stays clear');
}
assert.equal(world.getBlock(site.x,site.y,site.z),148,'real terrain contains the ruin chest');
for(let dx=36;dx<=96;dx++) {
  const x=site.x+dx,z=site.z+Math.round((dx-36)*20/60);
  const ramp=deepCaveColumn(gen,x,z).find(s=>s.ramp);
  assert.ok(world.getBlock(x,ramp.floor-1,z),'upper passage has treads');
  assert.equal(world.getBlock(x,ramp.floor,z),0,'upper passage has foot space');
  assert.equal(world.getBlock(x,ramp.floor+1,z),0,'upper passage has headroom');
}
assert.equal(world.getBlock(site.x+2,2,site.z),3,'bedrock layers remain solid');
for(const [rx,rz] of [[-1,-1],[0,0]]) {
  const s=caveSite(gen,rx,rz);
  assert.ok(s);
  const coords=[];
  for(let dz=-16;dz<=16;dz+=16) for(let dx=-16;dx<=16;dx+=16) coords.push([Math.floor((s.x+dx)/16),Math.floor((s.z+dz)/16)]);
  const reverseWorld=new World({height:200,gen:new ChunkGen({seed:42})});
  for(const [cx,cz] of coords.toReversed()) reverseWorld.getChunk(cx,cz);
  for(const [cx,cz] of coords) assert.deepEqual(world.getChunk(cx,cz).data,reverseWorld.getChunk(cx,cz).data,'real chunks agree across positive and negative boundaries');
}
console.log('PASS deep galleries, walkable entrance, supported ruins and deterministic chunks');
