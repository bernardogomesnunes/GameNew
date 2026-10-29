// Local-only sustained full-game workload. No environment files or live accounts.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {PROFILE_PHASES,validateProfileReport} from './profile-report.js';

const durationSeconds=Number(process.env.PROFILE_DURATION_SECONDS??1800);
const sampleMs=Number(process.env.PROFILE_SAMPLE_MS??10000);
assert.ok(Number.isFinite(durationSeconds)&&durationSeconds>=30&&durationSeconds<=3600);
assert.ok(Number.isFinite(sampleMs)&&sampleMs>=1000&&sampleMs<=durationSeconds*1000/12);
const output=process.env.PROFILE_REPORT??'artifacts/performance/long-session.json';
mkdirSync('artifacts/performance',{recursive:true});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  config:{durationSeconds,sampleMs,viewport:{width:1920,height:1080},seed:4242},
  completed:false,samples:[],errors:[],contextLosses:[]};
const server=await createServer({configFile:false,envDir:false,
  define:{'import.meta.env.VITE_NEON_URL':JSON.stringify('')},
  server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
let browser;
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
    args:process.env.PROFILE_ALLOW_SOFTWARE?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  const page=await browser.newPage({viewport:report.config.viewport});
  page.on('pageerror',error=>{if(report.errors.length<20)report.errors.push(error.message.slice(0,2000));});
  page.on('crash',()=>{report.pageCrash=true;});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.hostname==='127.0.0.1'||['blob:','data:'].includes(url.protocol)?route.continue():route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>window.__game&&!window.__game.booting&&document.querySelector('#loading')?.classList.contains('ld-gone'),null,{timeout:120000});
  report.fixture=await page.evaluate(async()=>{
    const fixture=await import('/tools/performance/profile-world.js');
    window.__profileFixtureModule=fixture;
    return window.__profileFixture=fixture.prepareProfileWorld(window.__game);
  });
  report.backend=await page.evaluate(()=>window.__game.graphicsBackend);
  report.browserVersion=browser.version();
  report.renderConfig=await page.evaluate(()=>{
    const g=window.__game;
    return{graphics:{...g.graphics},renderDistance:g.renderDistance,
      contextAttributes:g.renderer.getContext().getContextAttributes()};
  });
  if(!process.env.PROFILE_ALLOW_SOFTWARE)assert.doesNotMatch(report.backend.renderer,/swiftshader|llvmpipe|software/i,'Use actual hardware or explicitly label software profiling');
  report.persistence=await page.evaluate(async()=>{
    const g=window.__game;
    const native=Storage.prototype.setItem;let storageFailure=null;
    Storage.prototype.setItem=function(key,value){
      try{return native.call(this,key,value);}
      catch(error){storageFailure={kind:error.name,characters:value.length};throw error;}
    };
    let saved;
    try{saved=g.worldIsLocal&&await g.saveAndWait();}finally{Storage.prototype.setItem=native;}
    // A profiler must retain a discovered workload failure, not shrink the
    // fixture until it passes. Continue collecting; validation will reject it.
    if(!saved)return{initialSavedAt:null,preflightError:g.saveError,storageFailure};
    const restored=await g.local.restore(g.worldId);
    if(restored.mode!=='duilt'||!restored.world.chunks.length)throw new Error('Profile fixture did not restore its saved payload');
    return{initialSavedAt:restored.updatedAt};
  });
  if(report.persistence.preflightError)console.log('PREFLIGHT SAVE FAILURE '+JSON.stringify(report.persistence));
  console.log('PROFILE '+JSON.stringify({revision:report.revision,backend:report.backend,fixture:report.fixture,config:report.config}));
  await page.evaluate(()=>{
    const g=window.__game;
    const state=window.__sessionProfile={histogram:new Uint32Array(2001),frames:0,maxFrameMs:0,
      warFrames:0,saves:0,saveAttempts:0,failedSaves:0,deepDraws:0,costs:{},losses:[],previousFrame:null,
      renderedFrames:0,previousRender:null,maxRenderGapMs:0};
    g.renderer.domElement.addEventListener('webglcontextlost',event=>state.losses.push({at:performance.now(),status:event.statusMessage}));
    const watchDeep=mesh=>{
      if(!mesh.userData.deep)return;
      const original=mesh.onBeforeRender;
      mesh.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
        state.deepDraws++;original.call(this,renderer,scene,camera,geometry,material,group);
      };
    };
    for(const mesh of g.mesher.activeMeshes)watchDeep(mesh);
    const rebuild=g.mesher.rebuild;
    g.mesher.rebuild=function(world,chunk){
      const result=rebuild.call(this,world,chunk);
      for(const mesh of chunk.mesh?.values()??[])watchDeep(mesh);
      return result;
    };
    for(const [object,names,label] of [[g,['tick','streamChunks','generateQueued','drainRemeshQueue','updateFarTerrain','updateMinimap','tickWar','saveNow'],'game'],
      [g.duilt,['tick'],'simulation'],[g.duilt.settlers,['tick'],'settlers'],[g.grass,['update'],'grass'],[g.renderer,['render'],'renderer']]){
      for(const name of names){
        const original=object[name];
        object[name]=function(...args){const start=performance.now();try{
          if(label==='renderer'){
            if(state.previousRender!=null)state.maxRenderGapMs=Math.max(state.maxRenderGapMs,start-state.previousRender);
            state.previousRender=start;state.renderedFrames++;
          }
          return name==='saveNow'
            ?window.__profileFixtureModule.observeSave(state,()=>original.apply(this,args),()=>g.saving??true)
            :original.apply(this,args);
        }finally{
          const ms=performance.now()-start,c=state.costs[`${label}.${name}`]??={calls:0,totalMs:0,maxMs:0};
          c.calls++;c.totalMs+=ms;c.maxMs=Math.max(c.maxMs,ms);
        }};
      }
    }
    const tick=g.safeTick.bind(g);
    g.safeTick=()=>{
      const now=performance.now();
      if(state.previousFrame!=null){const ms=now-state.previousFrame;state.histogram[Math.min(2000,Math.floor(ms))]++;state.maxFrameMs=Math.max(state.maxFrameMs,ms);state.frames++;}
      state.previousFrame=now;
      if(g.wanderers.warParty?.band.some(person=>!person.dead&&!person.done))state.warFrames++;
      tick();
    };
    g.renderer.setAnimationLoop(()=>g.safeTick());
  });
  const start=Date.now();let previousPhase=null,phaseStep=0;
  while(Date.now()-start<durationSeconds*1000){
    const phase=PROFILE_PHASES[Math.min(PROFILE_PHASES.length-1,Math.floor((Date.now()-start)/(durationSeconds*1000)*PROFILE_PHASES.length))];
    if(phase!==previousPhase){phaseStep=0;console.log('PHASE '+phase);}
    // Travel changes location on each sample; other phases use fixed viewpoints.
    if(phase!==previousPhase||phase==='travel')await page.evaluate(({phase,step})=>window.__profileFixtureModule.profilePhase(window.__game,window.__profileFixture,phase,step),{phase,step:phaseStep++});
    previousPhase=phase;
    await new Promise(resolve=>setTimeout(resolve,Math.min(sampleMs,durationSeconds*1000-(Date.now()-start))));
    const sample=await page.evaluate(phase=>{
      const g=window.__game,s=window.__sessionProfile;
      const buffers=new Set();let geometryBytes=0;
      g.scene.traverse(object=>{for(const attribute of [...Object.values(object.geometry?.attributes??{}),object.geometry?.index]){
        const buffer=attribute?.array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}
      }});
      const sample={phase,playing:g.isPlaying,stop:g.crashedWith??null,chunks:g.world.chunks.size,
        geometryBytes,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
        ...g.renderer.info.memory,population:g.duilt.settlers.population,buildings:g.duilt.structures.list().length,
        warStage:g.duilt.war.stage,warParty:g.wanderers.warParty?.band.filter(p=>!p.dead&&!p.done).length??0,
        warActors:g.wanderers.warParty?.band.map(p=>({kind:p.kind,x:p.x,y:p.y,z:p.z,stage:p.stage,hp:p.hp,done:!!p.done,dead:!!p.dead}))??[],
        pixelRatio:g.renderer.getPixelRatio(),health:g.duilt.health.value,
        position:{x:g.player.position.x,y:g.player.position.y,z:g.player.position.z},
        surfaceHeight:g.world.gen.heightAt(g.player.position.x,g.player.position.z),
        deepDraws:s.deepDraws,saveError:g.saveError??null,
        heap:performance.memory?.usedJSHeapSize??null,costs:s.costs};
      const x=Math.floor(g.player.position.x),y=Math.floor(g.player.position.y),z=Math.floor(g.player.position.z);
      sample.headroom=g.world.hasChunk(x>>4,z>>4)&&[0,1,2].every(dy=>g.world.getBlock(x,y+dy,z)===0);
      s.costs={};s.deepDraws=0;
      // Fixture maintenance keeps the observer alive; it does not disable any
      // update system, revive a dead player or hide a stopped/paused game.
      if(!g.duilt.health.dead)g.duilt.health.value=20;
      g.duilt.hunger.value=100;
      return sample;
    },phase);
    sample.elapsedSeconds=(Date.now()-start)/1000;report.samples.push(sample);
    save();console.log('SAMPLE '+JSON.stringify({...sample,costs:undefined}));
    if(sample.stop||!sample.playing||sample.geometryBytes>1024**3)break;
  }
  report.elapsedSeconds=(Date.now()-start)/1000;
  const totals=await page.evaluate(async()=>{
    const s=window.__sessionProfile;
    await Promise.all(s.pendingSaves??[]);
    return {frames:s.frames,maxFrameMs:s.maxFrameMs,warFrames:s.warFrames,saves:s.saves,
      saveAttempts:s.saveAttempts,failedSaves:s.failedSaves,
      histogram:Array.from(s.histogram),losses:s.losses,saveCompletionMs:s.saveCompletions??[],
      renderedFrames:s.renderedFrames,maxRenderGapMs:s.maxRenderGapMs};
  });
  report.contextLosses=totals.losses;delete totals.losses;report.totals=totals;
  report.persistence.lastSavedAt=await page.evaluate(async()=>{
    try{return (await window.__game.local.restore(window.__game.worldId)).updatedAt;}catch{return null;}
  });
  report.completed=report.elapsedSeconds>=durationSeconds;
  report.failures=validateProfileReport(report);save();
  await page.screenshot({path:'artifacts/performance/long-session.png'});
  console.log(`PROFILE COMPLETE: ${report.elapsedSeconds}s, ${report.failures.length} validation failure(s); report ${output}`);
  assert.deepEqual(report.failures,[]);
  console.log(`PASS ${durationSeconds}s full-game profile: ${totals.frames} frames, ${totals.warFrames} war frames, ${totals.saves} saves; report ${output}`);
}catch(error){report.failure=String(error.stack);save();throw error;}
finally{await browser?.close();await server.close();}
