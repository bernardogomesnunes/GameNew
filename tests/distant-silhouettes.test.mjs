import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FarTerrain } from '../src/render/FarTerrain.js';
const far = new FarTerrain({add(){},remove(){}});
const out = () => ({position:[],normal:[],color:[],index:[]});
let failed=0;
function check(name,fn){try{fn();console.log(`PASS ${name}`);}catch(e){failed++;console.error(`FAIL ${name}: ${e.message}`);}}
check('dense distant woods have stepped crowns instead of one leaf slab',()=>{
  const mesh=out();
  far.canopy(mesh,0,0,12,{top:20,canopy:{height:3,density:1,seed:42,colour:new THREE.Color(0x448844)}});
  const tops=[];
  for(let i=0;i<mesh.position.length;i+=3)if(mesh.normal[i+1]===1)tops.push(mesh.position[i+1]);
  assert.ok(new Set(tops).size>=2);
  assert.ok(mesh.position.length<2000,'bounded distant crown geometry');
});
check('a distant roof is sampled into small columns instead of a whole-cell prism',()=>{
  far.gen={heightAt:()=>10,waterLevelAt:()=>0,biomeIndexAt:()=>0,beachAt:()=>false};
  far.builtAt=(x,z,step)=> x<8 && z<8 ? {top:20-x/2,water:false,colour:new THREE.Color(0xaa6633),side:new THREE.Color(0x886633),canopy:null} : null;
  const column=far.column(0,0,12,2);
  assert.ok(column.detail?.length>1);
  assert.ok(column.detail.some(c=>c.top<column.detail[0].top));
  assert.ok(column.detail.every(c=>c.size<=4));
});
check('open country retains the inexpensive coarse sampling',()=>{
  far.builtAt=()=>null;
  assert.equal(far.column(0,0,24,0).detail,undefined);
});
far.dispose();
process.exitCode=failed?1:0;
