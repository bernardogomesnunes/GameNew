import { readFileSync } from 'node:fs';

/**
 * Reported directly: "I'm receiving a 'this browser does not have more
 * memory' message." A world made before the start-up sign-in check finished
 * was decided as this browser's, and only an explicit sign-in ever moved
 * browser worlds to the account — so for someone who stays signed in they
 * sat in the browser for good, growing until it was full.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const local = readFileSync(new URL('../src/storage/LocalWorlds.js', import.meta.url), 'utf8');

const resume = game.slice(game.indexOf('resumeSession() {'), game.indexOf('async cloudList('));
ok('signed in at start-up, browser worlds move to the account', /this\.adoptLocalWorlds\(\);/.test(resume));
globalThis.window??={addEventListener(){},removeEventListener(){}};
const {Game}=await import('../src/Game.js');
const {LocalWorlds}=await import('../src/storage/LocalWorlds.js');
const {World}=await import('../src/world/World.js');
for(const succeeds of [true,false]){
  const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const store=new LocalWorlds(),world=new World({sizeX:16,sizeZ:16,height:16});world.setBlock(1,2,3,4);
  let uploaded=0;
  const g={worldId:'open',world,worldIsLocal:true,discarded:false,local:store,
    gamification:{toJSON:()=>({})},bus:{emit(){}},forgetCloudList(){},
    saveLocally(){return Game.prototype.saveLocally.call(this);},
    migrateLocalWorlds(){return Game.prototype.migrateLocalWorlds.call(this);},
    cloud:{signedIn:true,async save(id,{world:saved}){
      ok('local original remains until upload commits',store.has(id));
      ok('migration includes the current open-world edits',saved.getBlock(1,2,3)===4);
      uploaded++;if(!succeeds)throw new Error('Synthetic upload failure');return{revision:1};
    }}};
  const moved=await Game.prototype.adoptLocalWorlds.call(g);
  ok('migration attempts the open world',uploaded===1);
  ok(succeeds?'successful adoption removes the committed local record':'failed adoption keeps the local world and identity',
    moved===(succeeds?1:0)&&store.has('open')===!succeeds&&g.worldIsLocal===!succeeds);
}
const fallback={worldId:'quota',world:{},worldIsLocal:true,local:{save(){throw new Error('Quota');},delete(){}},
  cloud:{signedIn:true},saveNow(){this.queued=true;return true;},bus:{emit(){}}};
ok('legacy quota fallback still queues the signed-in account save',
  Game.prototype.saveLocally.call(fallback)===true&&fallback.queued&&!fallback.worldIsLocal);
delete globalThis.localStorage;
ok('signed out, it says what to do about it', /This browser is full\. Sign in to keep your worlds in your account, or delete a world you don\\'t need\./.test(local));

process.exit(f ? 1 : 0);
