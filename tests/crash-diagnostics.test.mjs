import assert from 'node:assert/strict';
import { Diagnostics } from '../src/core/Diagnostics.js';
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
let failures=0;
const check=(name,run)=>{try{run();console.log(`PASS ${name}`);}catch(error){failures++;console.error(`FAIL ${name}: ${error.message}`);}};
function frameFixture(initial=0){
  const diagnostics=new Diagnostics({events:{}}), stops=[];
  const game={diagnostics,tick(){throw new Error('Synthetic frame failure');},crashed(reason,details){stops.push({reason,details});}};
  if(initial!==undefined)game.tickErrors=initial;
  return {game,diagnostics,stops};
}
check('caught frame failures are recorded with bounded stacks and a frame-error kind',()=>{
  const {game,diagnostics,stops}=frameFixture();
  const log=console.error;console.error=()=>{};
  try{for(let i=0;i<3;i++)Game.prototype.safeTick.call(game);}finally{console.error=log;}
  const report=diagnostics.report();
  assert.equal(report.errors.length,3);
  assert.equal(report.errors[0].kind,'frame-error');
  assert.match(report.errors[0].stack,/Synthetic frame failure/);
  assert.equal(stops.length,1);
  assert.equal(stops[0].details.kind,'frame-error');
});
check('three failures before the first successful frame still stop the game',()=>{
  const {game,stops}=frameFixture();delete game.tickErrors;
  const log=console.error;console.error=()=>{};
  try{for(let i=0;i<3;i++)Game.prototype.safeTick.call(game);}finally{console.error=log;}
  assert.equal(stops.length,1);
});
check('a successful frame resets the consecutive failure threshold',()=>{
  const {game,stops}=frameFixture();
  const fail=game.tick,log=console.error;console.error=()=>{};
  try{
    Game.prototype.safeTick.call(game);Game.prototype.safeTick.call(game);
    game.tick=()=>{};Game.prototype.safeTick.call(game);game.tick=fail;
    Game.prototype.safeTick.call(game);Game.prototype.safeTick.call(game);
  }finally{console.error=log;}
  assert.equal(stops.length,0);
});
check('fatal context loss is distinct from script failure and snapshots resource counts',()=>{
  const diagnostics=new Diagnostics({events:{},now:()=>1234});
  diagnostics.recordCrash('Graphics context lost','webgl-context-lost',{loadedChunks:20,renderer:{geometries:42}});
  const crash=diagnostics.report().crash;
  assert.equal(crash.kind,'webgl-context-lost');
  assert.equal(crash.at,1234);
  assert.equal(crash.context.renderer.geometries,42);
});
check('stack and fatal-message details remain bounded and redact URLs/tokens',()=>{
  const diagnostics=new Diagnostics({events:{}}),error=new Error('Failure https://example.invalid/private?secret=abc eyJabcdefgh.ijklmnop.qrstuv');
  error.stack=error.message+'\n'+ 'x'.repeat(10000);
  diagnostics.recordError(error,'frame-error');
  diagnostics.recordCrash(error,'frame-error',{});
  const report=diagnostics.report(),json=JSON.stringify(report);
  assert.ok(!json.includes('secret=abc'));assert.ok(!json.includes('eyJabcdefgh'));
  assert.ok(report.errors[0].stack.length<=4000);
  assert.ok(report.crash.stack.length<=4000);
});
check('runtime context remains readable after the graphics context is lost',()=>{
  const context=Game.prototype.diagnosticContext.call({mode:'creative',world:{chunks:new Map([[1,{}]])},
    renderDistance:234,graphicsBackend:{renderer:'Test adapter'},renderer:{
      getContext:()=>({isContextLost:()=>true}),getPixelRatio:()=>1,
      info:{memory:{geometries:4,textures:2},render:{calls:7,triangles:300}},
    }});
  assert.equal(context.graphics.contextLost,true);assert.equal(context.renderer.triangles,300);
  assert.equal(context.graphics.backend.renderer,'Test adapter');assert.equal(context.loadedChunks,1);
  assert.ok(!Object.hasOwn(context,'worldId'));
});
process.exitCode=failures?1:0;
