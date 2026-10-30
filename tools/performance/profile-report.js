export const PROFILE_PHASES=['settlement','war','travel','return','caves','recovery'];

export function observeSave(state,save,completion=null){
  state.saveAttempts++;
  try{
    const result=save();
    if(completion){
      const start=performance.now();
      const pending=Promise.resolve(result===true?completion():false).then(committed=>{
        if(committed===true)state.saves++;else state.failedSaves++;
        const durations=state.saveCompletions??=[];
        if(durations.length<64)durations.push(performance.now()-start);
      },()=>{state.failedSaves++;});
      const jobs=state.pendingSaves??=new Set();jobs.add(pending);pending.then(()=>jobs.delete(pending));
      return result;
    }
    if(result===true)state.saves++;else state.failedSaves++;
    return result;
  }catch(error){state.failedSaves++;throw error;}
}

export function validateProfileReport(report){
  const failures=[];
  if(!report.completed)failures.push('Profile did not complete');
  const config=report.config??{},samples=report.samples??[];
  if(!Number.isFinite(config.durationSeconds)||config.durationSeconds<30
    ||!Number.isFinite(report.elapsedSeconds)||report.elapsedSeconds<config.durationSeconds)
    failures.push('Requested wall-clock duration was not exercised');
  if(!report.revision||!report.backend?.renderer)failures.push('Missing revision/backend evidence');
  if(!report.browserVersion||!Number.isFinite(report.renderConfig?.renderDistance)
    ||!report.renderConfig?.graphics)failures.push('Missing effective graphics configuration');
  if((report.fixture?.buildings??0)<48||(report.fixture?.population??0)<24)
    failures.push('Populated large settlement was not exercised');
  if((report.totals?.warFrames??0)<1)failures.push('No live war-party frames were observed');
  const histogram=report.totals?.histogram;
  if(!Number.isFinite(report.totals?.frames)||report.totals.frames<samples.length
    ||!Number.isFinite(report.totals?.maxFrameMs)||report.totals.maxFrameMs<0
    ||!Array.isArray(histogram)||histogram.length!==2001
    ||histogram.some(n=>!Number.isSafeInteger(n)||n<0)
    ||histogram.reduce((a,b)=>a+b,0)!==report.totals.frames)
    failures.push('Missing or inconsistent frame-time measurements');
  if(config.durationSeconds>=600&&(report.totals?.saves??0)<1)failures.push('No autosave was observed');
  if((report.totals?.failedSaves??0)>0)failures.push('A local save failed');
  if(report.persistence?.preflightError)failures.push('Initial local save failed');
  if(config.durationSeconds>=600&&!(report.persistence?.lastSavedAt>report.persistence?.initialSavedAt))
    failures.push('No newer persisted world was restored after autosave');
  if(!samples.some(s=>['settlement','return','recovery'].includes(s.phase)&&s.playing&&s.buildings>=48&&s.population>=24))
    failures.push('No actual populated settlement sample');
  if(!samples.some(s=>s.phase==='caves'&&s.headroom&&s.position?.y+2<s.surfaceHeight&&s.deepDraws>0))
    failures.push('No validated underground view with actual deep rendering');
  for(const phase of PROFILE_PHASES)if(!samples.some(s=>s.phase===phase))failures.push(`Missing phase: ${phase}`);
  for(const sample of samples){
    for(const key of ['chunks','geometryBytes','calls','triangles','geometries','textures','population','buildings']){
      if(!Number.isFinite(sample[key])||sample[key]<0)failures.push(`Invalid ${key} counter`);
    }
    if(sample.stop)failures.push('Game stopped');
    if(!sample.playing)failures.push('Profile left actual playing state');
  }
  if(report.pageCrash||(report.errors??[]).length||(report.contextLosses??[]).length)
    failures.push('Page error, tab crash or graphics-context loss');
  return [...new Set(failures)];
}
