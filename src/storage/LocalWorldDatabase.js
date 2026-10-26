import {completeWorldSnapshot} from './WorldSnapshot.js';
let opening;
function open(){
  if(opening)return opening;
  opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open('voxelgame-local-worlds',1);
    request.onupgradeneeded=()=>{
      request.result.createObjectStore('worlds');request.result.createObjectStore('metadata');
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Close other game tabs and try saving again.'));
    request.onsuccess=()=>{
      const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);
    };
  });
  opening.catch(()=>{opening=null;});return opening;
}
async function transaction(stores,mode,action){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,mode);let result,failure;
    tx.oncomplete=()=>resolve(typeof result==='function'?result():result instanceof IDBRequest?result.result:result);
    tx.onerror=tx.onabort=()=>reject(failure??tx.error??new Error('The local save did not complete.'));
    try{result=action(tx,error=>{failure=error;tx.abort();});}catch(error){tx.abort();reject(error);}
  });
}

/** Also used as a yielding fallback if a worker is unavailable. */
export async function localWorldOperation(type,args,yieldWork=null){
  if(type==='list')return transaction(['metadata'],'readonly',tx=>tx.objectStore('metadata').getAll());
  if(type==='load'){
    const body=await transaction(['worlds'],'readonly',tx=>tx.objectStore('worlds').get(args.id));
    if(!body)throw new Error('That world is no longer saved in this browser.');return body;
  }
  if(type==='delete')return transaction(['worlds','metadata'],'readwrite',tx=>{
    let deleted=false;const metadata=tx.objectStore('metadata'),request=metadata.get(args.id);
    request.onsuccess=()=>{
      if(args.ifUnchangedSince!=null&&request.result?.updatedAt>args.ifUnchangedSince)return;
      tx.objectStore('worlds').delete(args.id);metadata.delete(args.id);deleted=true;
    };
    return()=>deleted;
  });
  if(type!=='save')throw new Error('Unknown local storage operation.');
  const {id,payload}=args;
  const previous=payload.world.chunks.some(c=>!c.data)
    ?await transaction(['worlds'],'readonly',tx=>tx.objectStore('worlds').get(id)):null;
  await completeWorldSnapshot(payload.world,yieldWork,previous?.world);
  const meta={id,name:payload.name,mode:payload.mode,updatedAt:payload.updatedAt,
    age:payload.duilt?.territory?.age??null,...(payload.duilt?.battle?{battle:true}:{})};
  await transaction(['worlds','metadata'],'readwrite',(tx,fail)=>{
    const metadata=tx.objectStore('metadata'),old=metadata.get(id);
    old.onsuccess=()=>{
      try{
        if(old.result?.updatedAt>meta.updatedAt){fail(new Error('A newer local save was made in another tab. Reopen it before saving.'));return;}
        tx.objectStore('worlds').put(payload,id);metadata.put(meta,id);
      }catch(error){fail(error);}
    };
  });
  return{revision:payload.revision,meta};
}
