function clean(value, limit) {
  return String(value).replace(/https?:\/\/[^\s)]+/g, address => {
    // Keep public application source/line references, never endpoints or queries.
    try { const url = new URL(address); return /^\/(src|assets)\//.test(url.pathname) ? url.pathname : '[URL]'; }
    catch { return '[URL]'; }
  }).replace(/\beyJ[A-Za-z0-9_.-]+/g,'[token]').slice(0,limit);
}
function errorDetails(error) {
  return { message:clean(error?.message??error??'Unknown error',500),
    ...(error?.stack ? {stack:clean(error.stack,4000)} : {}) };
}

/** Read once at renderer creation; never query the driver in the frame loop. */
export function describeGraphicsBackend(renderer) {
  try {
    const gl=renderer.getContext(), extension=gl.getExtension('WEBGL_debug_renderer_info');
    return {api:gl.getParameter(gl.VERSION),
      renderer:gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
      antialias:gl.getContextAttributes()?.antialias??null};
  } catch { return {api:null,renderer:null,antialias:null}; }
}

/** Local, bounded reports. Nothing is uploaded or tied to an account. */
export class Diagnostics {
  constructor({events=globalThis,now=()=>Date.now()}={}) {
    this.now=now;this.started=now();this.frames=[];this.errors=[];this.frameCount=0;this.slowFrames=0;
    this.error=e=>this.recordError(e.error??e.message,'error');
    this.rejection=e=>this.recordError(e.reason,'unhandledrejection');
    this.events=events;events.addEventListener?.('error',this.error);events.addEventListener?.('unhandledrejection',this.rejection);
  }
  recordError(error,kind='error') {
    this.errors.push({at:this.now(),kind,...errorDetails(error)});if(this.errors.length>20)this.errors.shift();
  }
  recordCrash(error,kind,context={}) {
    this.crash={at:this.now(),kind,...errorDetails(error),context};
  }
  frame(ms) {
    if(!Number.isFinite(ms)||ms<=0||ms>1000)return;
    this.frameCount++;if(ms>50)this.slowFrames++;
    this.frames.push(ms);if(this.frames.length>1200)this.frames.shift();
  }
  report(context={}) {
    const sorted=[...this.frames].sort((a,b)=>a-b),mean=sorted.reduce((n,x)=>n+x,0)/(sorted.length||1);
    return {format:'duilt-diagnostics',version:1,createdAt:new Date(this.now()).toISOString(),sessionSeconds:Math.round((this.now()-this.started)/1000),frames:this.frameCount,slowFrames:this.slowFrames,recentFPS:mean?Math.round(1000/mean):null,frameP95Ms:sorted.length?Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]):null,errors:this.errors.map(e=>({...e})),...(this.crash?{crash:this.crash}:{}),...context};
  }
  download(context={}) {
    const blob=new Blob([JSON.stringify(this.report(context),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='duilt-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  dispose(){this.events.removeEventListener?.('error',this.error);this.events.removeEventListener?.('unhandledrejection',this.rejection);}
}
