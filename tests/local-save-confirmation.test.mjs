import assert from 'node:assert/strict';
globalThis.window??={addEventListener(){},removeEventListener(){}};
const {Game}=await import('../src/Game.js');
for(const succeeds of [true,false]){
  let finish;const persistence=new Promise((resolve,reject)=>{finish=()=>succeeds?resolve({revision:1}):reject(new Error('Synthetic transaction abort'));});
  const game={worldId:'local',world:{},mode:'creative',worldIsLocal:true,
    local:{save:()=>persistence,saveProgression(){}},gamification:{toJSON:()=>({})},bus:{emit(){}},
    saveNow(){return Game.prototype.saveLocally.call(this);}};
  const accepted=game.saveNow();assert.equal(accepted,true);
  assert.equal(typeof game.saving?.then,'function','queued local writes must expose their commit promise');
  let settled=false;const result=Game.prototype.saveAndWait.call(game).then(saved=>{settled=true;return saved;});
  await Promise.resolve();assert.equal(settled,false,'Save and leave must wait for the transaction');
  finish();assert.equal(await result,succeeds);
  if(!succeeds){assert.match(game.saveError,/transaction abort/);assert.equal(game.worldIsLocal,true);}
  console.log(`PASS local Save and leave waits for ${succeeds?'a committed write':'an aborted write and stays local'}`);
}
const previousDocument=globalThis.document,previousWindow=globalThis.window;
try{
  const events={};globalThis.window={addEventListener:(name,fn)=>events[name]=fn};
  globalThis.document={addEventListener(){}};
  const game={renderer:{domElement:{addEventListener(){}}},saveNow:()=>true,
    isPlaying:true,pointerLocked:false,worldIsLocal:true,saving:new Promise(()=>{}),discarded:false};
  let checkpointed=false;
  Object.assign(game,{worldId:'local',worldName:'Current',saveState:()=>({world:{}}),
    local:{saveEmergency(){checkpointed=true;}}});
  Game.prototype.wireSaveOnLeave.call(game);let warned=false;
  events.beforeunload({preventDefault(){warned=true;}});
  assert.equal(warned,true,'closing a window must warn about a local save awaiting commit even without pointer lock');
  assert.equal(checkpointed,true,'page closure must preserve the previously synchronous emergency save path');
  console.log('PASS an unconfirmed local save warns before browser closure without pointer lock');
}finally{globalThis.document=previousDocument;globalThis.window=previousWindow;}
{
  const error=new Error('Synthetic denied local storage');let listed=0,opened=0;
  const g={local:{storageError:error,refresh:async()=>{throw error;},list:()=>[],has:()=>false},
    cloud:{signedIn:true},cloudAuth:{ready:true},cloudList:async()=>{listed++;return[{id:'cloud'}];},
    rememberWorlds(){},rememberedWorlds:()=>[],worldIsLocal:true,discarded:true,
    restoreFromCloud:async()=>{opened++;},ui:{toast(){}}};
  let partial;try{await Game.prototype.listAllWorlds.call(g);}catch(e){partial=e.partial;}
  assert.equal(listed,1,'local failure must not skip the healthy cloud library');
  assert.ok(partial.some(row=>row.id==='cloud'));
  g.local.refresh=async()=>{throw error;};
  assert.equal(await Game.prototype.openWorld.call(g,'cloud'),true);assert.equal(opened,1);
  console.log('PASS denied local storage preserves healthy cloud listing and opening');
}
let finish;const pending=new Promise(resolve=>{finish=resolve;});
const other={worldId:'old',world:{},local:{save:()=>pending,saveProgression(){}},
  gamification:{toJSON:()=>({})},saveError:'new world status',bus:{emit(){}}};
Game.prototype.saveLocally.call(other);const saving=other.saving;
other.worldId='new';other.world={};finish({revision:1});await saving;
assert.equal(other.saveError,'new world status');
console.log('PASS a late local commit cannot replace the current world save status');
for(const succeeds of [true,false]){
  let finish;const commit=new Promise(resolve=>{finish=resolve;});let opened=false;
  const game={worldIsLocal:true,discarded:false,local:{refresh:async()=>{},has:()=>true},
    saveLocally(){this.saving=commit;return true;},restoreFromLocal:async()=>{opened=true;}};
  const opening=Game.prototype.openWorld.call(game,'next');await Promise.resolve();
  assert.equal(opened,false);finish(succeeds);assert.equal(await opening,succeeds);assert.equal(opened,succeeds);
  console.log(`PASS world switching ${succeeds?'waits for the previous commit':'stays on a failed save'}`);
}
