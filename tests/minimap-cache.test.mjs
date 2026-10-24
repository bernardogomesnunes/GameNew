import assert from 'node:assert/strict';
import { Minimap } from '../src/render/Minimap.js';

const rotations=[],paint=[];let cleared;
const ctx={clearRect(...args){paint.length=0;cleared=args;},fillRect(){paint.push(this.fillStyle);},
  save(){},restore(){},translate(){},rotate(yaw){rotations.push(yaw);},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}};
const canvas={width:120,height:120,getContext:()=>ctx};
const map=new Minimap(canvas,{radius:4,step:2});
let samples=0;
const gen={waterLevelAt(){samples++;return 0;},biomeIndexAt:()=>0};
map.update(gen,-1.25,3.75,0);
const firstPaint=[...paint],initial=samples;
assert.ok(initial>0);
map.update(gen,-1.25,3.75,1);
assert.equal(samples,initial,'turning in place must reuse the terrain sample');
assert.deepEqual(paint,firstPaint);
assert.equal(rotations.at(-1),-1);
console.log('PASS a stationary minimap preserves terrain pixels and updates heading without resampling');
map.update(gen,-.25,3.75,1);
assert.ok(samples>initial);
const moved=samples;
const otherGen={...gen};map.update(otherGen,-.25,3.75,1);
assert.ok(samples>moved,'a different world generator must invalidate the cache');
map.radius=8;
const previous=samples;map.update(otherGen,-.25,3.75,1);
assert.ok(samples>previous,'map sampling settings must invalidate the cache');
console.log('PASS movement, world changes and sampling settings refresh minimap terrain');
const cached=samples;canvas.width=180;canvas.height=140;
map.update(otherGen,-.25,3.75,2);
assert.equal(samples,cached);assert.deepEqual(cleared,[0,0,180,140]);
assert.equal(rotations.at(-1),-2);
console.log('PASS resizing repaints the new canvas dimensions without invalidating terrain');
