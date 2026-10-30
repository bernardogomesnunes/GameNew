import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
const previousLocation=globalThis.location;
let reloads=0;
globalThis.location={reload(){reloads++;}};
try{
  for(const result of [false,'throw']){
    reloads=0;const notices=[];
    const game={world:{},saveError:'Synthetic failed commit',ui:{toast:notice=>notices.push(notice)},
      saveAndWait:async()=>{if(result==='throw')throw new Error('Synthetic failed commit');return false;}};
    const reloaded=await Game.prototype.reloadForFeatures.call(game);
    assert.equal(reloads,0,'reload must not discard edits after a failed save');
    assert.equal(reloaded,false);
    assert.match(notices.at(-1).title,/save/i);
  }
  console.log('PASS optional-feature Reload keeps the world open after false or rejected saves');
  reloads=0;let finish;
  const game={world:{},saveAndWait:()=>new Promise(resolve=>{finish=resolve;})};
  const pending=Game.prototype.reloadForFeatures.call(game);
  await Promise.resolve();assert.equal(reloads,0);
  finish(true);assert.equal(await pending,true);assert.equal(reloads,1);
  console.log('PASS optional-feature Reload waits for a confirmed save');
  for(const flag of ['title','showcase','scenery','discarded']){
    reloads=0;
    assert.equal(await Game.prototype.reloadForFeatures.call({world:{},[flag]:true,
      saveAndWait(){throw new Error('No world progress needs saving');}}),true);
    assert.equal(reloads,1);
  }
  console.log('PASS unsaved scenery and deliberately discarded sessions can reload without a false save failure');
}finally{if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
