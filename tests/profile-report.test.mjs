import assert from 'node:assert/strict';
import {PROFILE_PHASES,validateProfileReport} from '../tools/performance/profile-report.js';
const valid=()=>({completed:true,config:{durationSeconds:1800},elapsedSeconds:1800,
  browserVersion:'Test browser',renderConfig:{renderDistance:240,graphics:{antialias:true,grass:true,lights:true,resolution:'auto'}},
  persistence:{initialSavedAt:1,lastSavedAt:2},
  revision:'test-revision',backend:{renderer:'test adapter'},fixture:{buildings:56,population:39},
  totals:{warFrames:100,saves:5,saveAttempts:5,failedSaves:0,frames:100,renderedFrames:100,maxRenderGapMs:17,maxFrameMs:17,histogram:Array.from({length:2001},(_,i)=>i===16?100:0)},errors:[],contextLosses:[],samples:PROFILE_PHASES.map(phase=>({phase,drawnFrames:10,
    playing:true,stop:null,chunks:800,geometryBytes:250000000,calls:900,triangles:2500000,
    geometries:1000,textures:30,population:39,buildings:56,
    position:{y:phase==='caves'?12:120},surfaceHeight:100,headroom:true,deepDraws:phase==='caves'?10:0}))});
assert.deepEqual(validateProfileReport(valid()),[]);
console.log('PASS complete sustained settlement/war profile evidence is accepted');
for(const change of [r=>r.completed=false,r=>r.elapsedSeconds=60,r=>r.totals.warFrames=0,
  r=>r.totals.saves=0,r=>r.fixture.population=0,r=>r.samples.pop(),r=>r.samples[0].geometryBytes=NaN,
  r=>r.samples[0].playing=false,r=>r.samples[0].stop='Synthetic failure',r=>r.errors.push('Synthetic failure'),
  r=>r.totals.histogram=[],r=>r.totals.frames=NaN,r=>r.totals.histogram[0]=1,
  r=>r.samples.find(s=>s.phase==='caves').position.y=120,
  r=>r.samples.find(s=>s.phase==='caves').deepDraws=0,
  r=>{for(const s of r.samples){s.population=0;s.buildings=0;}},
  r=>r.persistence.lastSavedAt=1,r=>r.totals.failedSaves=1,r=>delete r.renderConfig,
  r=>r.persistence.preflightError='Synthetic quota failure']){
  const report=valid();change(report);assert.ok(validateProfileReport(report).length>0);
}
console.log('PASS incomplete duration, missing war/autosave/population, invalid counters and failures cannot pass');
for(const change of [r=>r.totals.renderedFrames=0,r=>delete r.totals.renderedFrames,
  r=>r.totals.renderedFrames=102,r=>r.totals.maxRenderGapMs=8115,
  r=>r.totals.maxRenderGapMs=NaN,r=>r.samples.find(s=>s.phase==='war').drawnFrames=0,
  r=>r.samples[0].drawnFrames=NaN]){
  const report=valid();change(report);assert.ok(validateProfileReport(report).length>0);
}
console.log('PASS continuing simulation cannot hide missing rendered frames or a frozen display');
