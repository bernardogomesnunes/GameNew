import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FarTerrain } from '../src/render/FarTerrain.js';
const scene=new THREE.Scene(),far=new FarTerrain(scene),colour=new THREE.Color(0x778855);
const plain=top=>({top,water:false,colour,side:colour,canopy:null});
far.column=(x,z)=>{
 if(x!==12||z!==0)return plain(10);
 return {...plain(20),detail:Array.from({length:9},(_,i)=>({...plain(i<3?5:20),dx:i%3,dz:Math.floor(i/3),size:4}))};
};
const layer={step:12,tile:24,canopy:0,material:new THREE.MeshBasicMaterial({vertexColors:true}),tiles:new Map()};
far.makeTile(layer,0,0);
const geo=layer.tiles.get('0,0').geometry,p=geo.attributes.position,n=geo.attributes.normal;
let covered=false;
for(let i=0;i<p.count;i++)if(p.getX(i)===12&&p.getY(i)===5&&p.getZ(i)<=4&&n.getX(i)===1)covered=true;
assert.ok(covered,'coarse ground has a wall facing the lower boundary strip of a detailed neighbour');
console.log('PASS coarse/fine building boundary emits the missing wall strip');
far.dispose();layer.material.dispose();
