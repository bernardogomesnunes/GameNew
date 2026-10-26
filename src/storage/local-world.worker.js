import {localWorldOperation} from './LocalWorldDatabase.js';
import {snapshotTransfers} from './WorldSnapshot.js';
self.onmessage=async({data:{requestId,type,args}})=>{
  try{
    const result=await localWorldOperation(type,args);
    self.postMessage({requestId,result},type==='load'?snapshotTransfers(result.world):[]);
  }catch(error){self.postMessage({requestId,error:error.message});}
};
