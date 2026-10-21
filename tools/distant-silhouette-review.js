import * as THREE from 'three';
import { FarTerrain } from '/src/render/FarTerrain.js';
import { World } from '/src/world/World.js';
import { DESIGN_FOR_STRUCTURE } from '/src/config/starterDesigns.js';
import { houseDesigns } from '/src/prefabs/HouseDesigns.js';
import { BIOME_INDEX } from '/src/config/biomes.js';
import { hash01 } from '/src/world/ChunkGen.js';
function quad(out,a,b,c,d,n,col){
 const start=out.position.length/3;
 for(const p of[a,b,c,d]){out.position.push(...p);out.normal.push(...n);out.color.push(col.r,col.g,col.b);}
 const ab=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)),ac=new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a));
 if(ab.cross(ac).dot(new THREE.Vector3(...n))>=0)out.index.push(start,start+1,start+2,start,start+2,start+3);else out.index.push(start,start+2,start+1,start,start+3,start+2);
}
function box(o,x,z,w,b,t,c){quad(o,[x,t,z],[x,t,z+w],[x+w,t,z+w],[x+w,t,z],[0,1,0],c);quad(o,[x+w,b,z],[x+w,t,z],[x+w,t,z+w],[x+w,b,z+w],[1,0,0],c);quad(o,[x,b,z+w],[x,t,z+w],[x,t,z],[x,b,z],[-1,0,0],c);quad(o,[x,b,z+w],[x+w,b,z+w],[x+w,t,z+w],[x,t,z+w],[0,0,1],c);quad(o,[x+w,b,z],[x,b,z],[x,t,z],[x+w,t,z],[0,0,-1],c);}
// The two original approximation methods, retained only for this comparison.
class Before extends FarTerrain {
 column(x,z,step,canopy){const built=this.builtAt(x,z,step);return built??super.column(x,z,step,canopy,false);}
 canopy(out,x,z,step,c){
  const half=step/2,wooded=[];
  for(let qx=0;qx<2;qx++)for(let qz=0;qz<2;qz++){const xa=x+qx*half,za=z+qz*half;if(hash01(xa,za,c.canopy.seed^0x7ee5)<c.canopy.density)wooded.push([xa,za]);}
  if(wooded.length===4)box(out,x,z,step,c.top+1,c.top+c.canopy.height,c.canopy.colour);
  else for(const[a,b]of wooded)box(out,a,b,half,c.top+1,c.top+c.canopy.height,c.canopy.colour);
 }
}
const world=new World({sizeX:192,sizeZ:192,height:64});
// Only the actual building plots are touched; untouched forest uses canopy sampling.
const designs=[DESIGN_FOR_STRUCTURE.get('house'),houseDesigns[0],DESIGN_FOR_STRUCTURE.get('townhouse'),houseDesigns[2]];
for(const[i,d]of designs.entries())for(const b of d.blocks)world.setBlock(30+i*32+b.dx,10+b.dy,50+b.dz,b.type);
const gen={seed:42,kingdomCache:null,heightAt:()=>10,waterLevelAt:()=>0,beachAt:()=>false,treeAt:()=>null,
 biomeIndexAt:(x,z)=>BIOME_INDEX.get(z>=86?'forestOak':'plains')};
const results=[];
for(const[Class,id]of[[Before,'before'],[FarTerrain,'after']]){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xc4dceb);scene.add(new THREE.HemisphereLight(0xf2f5ff,0x778168,2));const light=new THREE.DirectionalLight(0xfff0dd,2.1);light.position.set(-100,200,90);scene.add(light);
 const far=new Class(scene);far.gen=gen;far.world=world;
 const layer={step:12,tile:192,canopy:3,material:new THREE.MeshLambertMaterial({vertexColors:true}),tiles:new Map()};
 const started=performance.now();far.makeTile(layer,0,0);const ms=performance.now()-started;
 const camera=new THREE.OrthographicCamera(-108,108,70,-70,.1,1000);camera.position.set(250,115,-170);camera.lookAt(90,10,90);
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,420);renderer.setPixelRatio(1);document.querySelector('#'+id).append(renderer.domElement);renderer.render(scene,camera);
 results.push(`${id}: ${layer.tiles.get('0,0').geometry.index.count/3} triangles, ${ms.toFixed(1)} ms for one tile`);
}
document.querySelector('#status').textContent=results.join(' · ');window.reviewMetrics=results;window.reviewReady=true;

