/** Optional local strategies. Failure never pauses the normal rival simulation. */
export class LocalRivalAI {
  constructor({fetcher=fetch,onStatus=()=>{}}={}) {this.fetcher=fetcher;this.onStatus=onStatus;this.next=0;this.busy=false;this.disposed=false;}
  async tick(battle) {
    if(this.disposed||this.busy||performance.now()<this.next)return;
    this.next=performance.now()+60000;this.busy=true;
    this.abort=new AbortController();const timer=setTimeout(()=>this.abort.abort(),22000);
    try {
      const response=await this.fetcher('/api/local-battle-ai',{method:'POST',headers:{'Content-Type':'application/json'},signal:this.abort.signal,body:JSON.stringify({rivals:battle.list.map(({id,strength,falls})=>({id,strength,falls}))})});
      if(!response.ok)throw Error('Unavailable');
      const result=await response.json();
      if(this.disposed)return;
      if(!Array.isArray(result.rivals)||result.rivals.length!==3)throw Error('Invalid reply');
      const seen=new Set();
      for(const r of result.rivals){if(!Number.isInteger(r.id)||!battle.list[r.id]||seen.has(r.id)||!['pressure','guard','rebuild'].includes(r.stance))throw Error('Invalid reply');seen.add(r.id);}
      for(const r of result.rivals)battle.list[r.id].tactic=r.stance;
      this.onStatus('connected');
    }catch{if(!this.disposed){for(const r of battle.list)delete r.tactic;this.onStatus('fallback');}}
    finally{clearTimeout(timer);this.busy=false;}
  }
  dispose(){this.disposed=true;this.abort?.abort();}
}
