import * as THREE from 'three';
import { ChunkGen } from '/src/world/ChunkGen.js';


import { BIOMES, surfaceFor } from '/src/config/biomes.js';
import { BLOCKS_BY_ID } from '/src/config/blocks.js';
const span=1500,step=8,n=Math.ceil(span/step),views=[];
const rows=document.querySelector('#comparisons');
function build(gen,site,proposed,baseline){
 const positions=[],colours=[],heights=[],indices=[];
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
  const wx=site.x-span/2+x*step,wz=site.z-span/2+z*step;
  const i=z*(n+1)+x; const p=proposed?{height:gen.heightAt(wx,wz),index:gen.biomeIndexAt(wx,wz)}:{height:baseline.heights[i],index:baseline.indices[i]};
  heights.push(p.height);indices.push(p.index);
 }
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
  const i=z*(n+1)+x,h=heights[i],b=BIOMES[indices[i]],id=h<100?11:surfaceFor(b,h);
  const c=new THREE.Color(BLOCKS_BY_ID.get(id).color);
  positions.push(x*step-span/2,Math.max(100,h),z*step-span/2);colours.push(c.r,c.g,c.b);
 }
 const triangles=[];
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+n+1;triangles.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setIndex(triangles);g.computeVertexNormals();
 return {geometry:g,highest:Math.max(...heights),lowest:Math.min(...heights)};
}
function show(mesh,id){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xc1d9e8);
 scene.add(new THREE.HemisphereLight(0xf3f6ff,0x73816d,2));const light=new THREE.DirectionalLight(0xfff0dc,2.1);light.position.set(-600,700,300);scene.add(light);
 scene.add(new THREE.Mesh(mesh.geometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(660,410);renderer.setPixelRatio(1);document.querySelector(id).append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-850,850,528,-528,1,6000);
 views.push({scene,renderer,camera});
}
function render(view='oblique'){
 for(const {scene,renderer,camera}of views){
  const p=view==='top'?[0,2200,.01]:view==='profile'?[1000,215,1400]:[1050,660,1400];
  camera.position.set(...p);camera.lookAt(0,105,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 window.reviewView=view;
}
const started=performance.now();
const snapshots=await fetch('/art/review/terrain-range-baseline.json').then(r=>r.json());
for(const baseline of snapshots.records){
 const {seed,site}=baseline;
 const current=new ChunkGen({seed,homePull:0});
 const a=build(current,site,false,baseline),b=build(current,site,true);
 const section=document.createElement('section');section.innerHTML=`<h2>Seed ${seed} · mountain anchor (${site.x}, ${site.z})</h2><p class="note">${span} × ${span} metres · samples every ${step} m · current elevation ${a.lowest}–${a.highest} m / candidate ${b.lowest}–${b.highest} m</p><div class="pair"><div><div class="label">Before · recorded isolated rounded uplift</div><div id="current-${seed}"></div></div><div><div class="label">After · live connected ridges and foothills</div><div id="candidate-${seed}"></div></div></div>`;
 rows.append(section);show(a,`#current-${seed}`);show(b,`#candidate-${seed}`);
 await new Promise(resolve=>setTimeout(resolve,0));
}
render(new URLSearchParams(location.search).get('view')??'oblique');document.querySelector('#views').addEventListener('click',e=>{if(e.target.dataset.view)render(e.target.dataset.view);});
document.querySelector('#status').textContent=`Three same-seed pairs rendered. Heightfield sampling and six WebGL views: ${((performance.now()-started)/1000).toFixed(1)} s on this browser. Live generator compared with recorded pre-change heights; river-network and erosion work are not included.`;
window.reviewReady=true;
