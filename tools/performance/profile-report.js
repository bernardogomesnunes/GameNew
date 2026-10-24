export const PROFILE_PHASES=['settlement','war','travel','return','caves','recovery'];

export function validateProfileReport(report){
  const failures=[];
  if(!report.completed)failures.push('Profile did not complete');
  const config=report.config??{},samples=report.samples??[];
  if(!Number.isFinite(config.durationSeconds)||config.durationSeconds<30
    ||!Number.isFinite(report.elapsedSeconds)||report.elapsedSeconds<config.durationSeconds)
    failures.push('Requested wall-clock duration was not exercised');
  if(!report.revision||!report.backend?.renderer)failures.push('Missing revision/backend evidence');
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
