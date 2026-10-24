import {snapshotTransfers} from './WorldSnapshot.js';

/** One active operation plus one pending save. Repeated saves of that world
 * replace the pending snapshot; its callers all await the newer commit.
 * Deletes/reads remain ordered with writes. Different-world pressure fails
 * explicitly rather than retaining an unbounded pile of world buffers.
 */
export class LocalWorldWorker{
  constructor(workerFactory=()=>new Worker(new URL('./local-world.worker.js',import.meta.url),{type:'module'})){
    this.queue=[];this.sequence=0;
    try{
      this.worker=workerFactory();
      this.worker.onmessage=({data})=>{
        const waiter=this.waiter;if(!waiter||data.requestId!==waiter.requestId)return;
        clearTimeout(waiter.timer);
        this.waiter=null;data.error?waiter.reject(new Error(data.error)):waiter.resolve(data.result);
      };
      const failed=event=>{
        event.preventDefault?.();this.worker?.terminate();this.worker=null;
        clearTimeout(this.waiter?.timer);
        this.waiter?.reject(new Error('Background saving stopped. Try Save again.'));this.waiter=null;
      };
      this.worker.onerror=failed;this.worker.onmessageerror=failed;
    }catch{this.worker=null;}
  }
  request(type,args={}){
    return new Promise((resolve,reject)=>{
      if(type==='save'){
        const pending=this.queue.find(job=>job.type==='save');
        if(pending){
          if(pending.args.id!==args.id){reject(new Error('Another world is still saving. Try again shortly.'));return;}
          // Coalesce only adjacent saves: never move a new write before an
          // intervening delete or load.
          if(this.queue.at(-1)!==pending){reject(new Error('The previous save is still finishing. Try again shortly.'));return;}
          pending.args=args;pending.waiters.push({resolve,reject});return;
        }
      }
      this.queue.push({type,args,waiters:[{resolve,reject}]});this.pump();
    });
  }
  async pump(){
    if(this.running)return;this.running=true;
    while(this.queue.length){
      const job=this.queue.shift();
      try{
        let result;
        if(this.worker){
          result=await new Promise((resolve,reject)=>{
            const requestId=++this.sequence;
            const timer=setTimeout(()=>{
              this.worker?.terminate();this.worker=null;this.waiter=null;
              reject(new Error('Local storage did not finish. Try Save again.'));
            },job.type==='save'?120000:30000);
            this.waiter={requestId,resolve,reject,timer};
            try{this.worker.postMessage({requestId,type:job.type,args:job.args},
              job.type==='save'?snapshotTransfers(job.args.payload.world):[]);}
            catch(error){clearTimeout(timer);this.waiter=null;reject(error);}
          });
        }else{
          const {localWorldOperation}=await import('./LocalWorldDatabase.js');
          result=await localWorldOperation(job.type,job.args,()=>new Promise(resolve=>setTimeout(resolve,0)));
        }
        for(const waiter of job.waiters)waiter.resolve(result);
      }catch(error){for(const waiter of job.waiters)waiter.reject(error);}
    }
    this.running=false;
  }
}
