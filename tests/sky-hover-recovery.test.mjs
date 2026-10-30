import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/Game.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { CHAIN } from '../src/config/blocks.js';
import { gameFeature, loadGameFeature } from '../src/core/gameFeatures.js';

let hint, hit = { x:0, y:150, z:0, block:CHAIN };
const gen = new ChunkGen({seed:4242,sky:true});
const game = {
  armed:true,selectedItemId:null,raycast:()=>hit,world:{gen},
  duilt:{ring:'black',sandbox:false,army:{active:false},skyWar:{chainsCut:0,chains:[]},settlers:{people:[]},
    structures:{at:()=>null},waitingAt:()=>null},
  player:{eyePosition:()=>new THREE.Vector3(),lookDirection:()=>new THREE.Vector3(0,0,1)},
  settlerView:{pick:()=>null},hoverBox:{visible:false,position:new THREE.Vector3()},
  ui:{setAimedSwing(){},setBuildingHint(value){hint=value;},setToolReadout(){}},
  updateRoofPreview(){},updateTemplatePreview(){},selection:{hide(){}},
};
assert.equal(gameFeature('sky'),undefined);
Game.prototype.updateHover.call(game);
assert.equal(hint,null,'a cold optional feature must not crash a frame or invent a chain hint');
console.log('PASS looking at a chain while Sky code is still loading does not stop the game');
await loadGameFeature('sky');
const [x,y,z]=gameFeature('sky').skyFor(gen).towers[0].chain[0];
hit={x,y,z,block:CHAIN};
Game.prototype.updateHover.call(game);
assert.match(hint,/Anchor chain.*0 of 4 cut/);
assert.equal(game.hoverBox.visible,true);
hit={x:x+1000,y,z,block:CHAIN};Game.prototype.updateHover.call(game);assert.equal(hint,null);
console.log('PASS actual Sky anchor links retain their cut-chain hint after deferred loading');
