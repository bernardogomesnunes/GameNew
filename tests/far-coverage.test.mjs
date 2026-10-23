import assert from 'node:assert/strict';
import { FarTerrain } from '../src/render/FarTerrain.js';
const scene={add(){},remove(){}},gen={kingdomCache:null,heightAt:()=>30,biomeIndexAt:()=>0,waterLevelAt:()=>0};
let failures=0;
const check=(name,run)=>{try{run();console.log(`PASS ${name}`);}catch(error){failures++;console.error(`FAIL ${name}: ${error.message}`);}};
function fixture(tx=0,tz=0){const far=new FarTerrain(scene);far.gen=gen;return{far,tile:far.makeTile(far.layers[0],tx,tz)};}
check('fully shader-masked tiles are not submitted while their geometry stays reusable',()=>{
  const {far,tile}=fixture();
  try{
    const geometry=tile.geometry;
    far.setChunkMask(-2,-2,12,()=>true,16);
    assert.equal(tile.visible,false);assert.equal(tile.geometry,geometry);assert.equal(far.meshes.length,1);
  }finally{far.dispose();}
});
check('any missing covered chunk restores the tile without rebuilding',()=>{
  const {far,tile}=fixture();
  try{
    far.setChunkMask(-2,-2,12,()=>true,16);const geometry=tile.geometry;
    far.setChunkMask(-2,-2,12,(cx,cz)=>!(cx===1&&cz===2),16);
    assert.equal(tile.visible,true);assert.equal(tile.geometry,geometry);
  }finally{far.dispose();}
});
check('outer tile-edge walls require coverage in the next chunk too',()=>{
  const {far,tile}=fixture();
  try{
    far.setChunkMask(-2,-2,12,(cx,cz)=>cx>=0&&cx<4&&cz>=0&&cz<4,16);
    assert.equal(tile.visible,true);
    far.setChunkMask(-2,-2,12,(cx,cz)=>cx>=0&&cx<=4&&cz>=0&&cz<=4,16);
    assert.equal(tile.visible,false);
  }finally{far.dispose();}
});
check('tiles created after an unchanged mask are hidden immediately',()=>{
  const far=new FarTerrain(scene);far.gen=gen;
  try{
    far.setChunkMask(-2,-2,12,()=>true,16);
    const tile=far.makeTile(far.layers[0],0,0);
    const version=far.maskTexture.version;
    far.setChunkMask(-2,-2,12,()=>true,16);
    assert.equal(tile.visible,false);assert.equal(far.maskTexture.version,version);
  }finally{far.dispose();}
});
check('negative tile coordinates and a moved or resized mask restore visibility',()=>{
  const {far,tile}=fixture(-1,-1);
  try{
    far.setChunkMask(-6,-6,12,()=>true,16);assert.equal(tile.visible,false);
    far.setChunkMask(20,20,12,()=>true,16);assert.equal(tile.visible,true);
    far.setChunkMask(-6,-6,12,()=>true,16);assert.equal(tile.visible,false);
    far.setChunkMask(-6,-6,2,()=>true,16);assert.equal(tile.visible,true);
  }finally{far.dispose();}
});
check('uninitialised or out-of-mask terrain remains visible',()=>{
  const {far,tile}=fixture(50,50);
  try{assert.equal(tile.visible,true);far.setChunkMask(-2,-2,12,()=>true,16);assert.equal(tile.visible,true);}finally{far.dispose();}
});
process.exitCode=failures?1:0;
