import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({configFile:false,envDir:false,server:{host:'127.0.0.1',port:0,hmr:false}});
server.middlewares.use('/__local-save-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local save check</title>');});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+'__local-save-test');
  const small=await page.evaluate(async()=>{
    const {LocalWorlds}=await import('/src/storage/LocalWorlds.js');
    const {World}=await import('/src/world/World.js');
    const local=window.localTest=new LocalWorlds();await local.ready;
    const world=new World({sizeX:16,sizeZ:16,height:16});world.setBlock(1,2,3,4);
    const result=local.save('small',{world,name:'Small',mode:'creative'});
    const asynchronous=typeof result?.then==='function';await result;
    return{asynchronous,listed:local.has('small')};
  });
  assert.equal(small.asynchronous,true,'browser local saves must confirm asynchronously after persistence');assert.equal(small.listed,true);
  console.log('PASS real browser local save confirms persistence asynchronously');
  const large=await page.evaluate(async()=>{
    const {World}=await import('/src/world/World.js');
    const {ChunkGen}=await import('/src/world/ChunkGen.js');
    const world=new World({height:200,gen:new ChunkGen({seed:4242,height:200})});
    world.setBlock(-1,90,-1,4);let fills=0;const fill=world.gen.fill.bind(world.gen);
    world.gen.fill=(...a)=>{fills++;return fill(...a);};
    const before=world.chunks.size;let beats=0;const heartbeat=setInterval(()=>beats++,10);
    const started=performance.now();
    const result=await window.localTest.save('large',{world,name:'Large',mode:'duilt',duilt:{territory:{age:8}},
      territoryBounds:{minX:-128,maxX:127,minZ:-128,maxZ:127}});
    clearInterval(heartbeat);
    const payload=await window.localTest.restore('large');
    const {restoreWorldSnapshot}=await import('/src/storage/WorldSnapshot.js');
    const restored=restoreWorldSnapshot(payload.world);
    return{saved:!!result,beats,ms:performance.now()-started,before,after:world.chunks.size,fills,
      chunks:restored.chunks.size,block:restored.getBlock(-1,90,-1),age:window.localTest.list().find(r=>r.id==='large').age};
  });
  assert.equal(large.saved,true);assert.equal(large.fills,0);assert.equal(large.after,large.before);
  assert.equal(large.chunks,256);assert.equal(large.block,4);assert.equal(large.age,8);assert.ok(large.beats>=3);
  console.log('PASS large claimed world persists while the main thread responds, without live terrain generation: '+JSON.stringify(large));
  await page.reload();
  const reopened=await page.evaluate(async()=>{
    const {LocalWorlds}=await import('/src/storage/LocalWorlds.js');
    const local=window.localTest=new LocalWorlds();await local.ready;
    const payload=await local.restore('large');
    return{listed:local.has('large'),name:payload.name,chunks:payload.world.chunks.length};
  });
  assert.deepEqual(reopened,{listed:true,name:'Large',chunks:256});
  console.log('PASS a fresh page discovers and restores the committed large world');
  const legacy=await page.evaluate(async()=>{
    const {World}=await import('/src/world/World.js');
    const world=new World({sizeX:16,sizeZ:16,height:16});world.setBlock(2,3,4,7);
    const body={world:world.serialize(),name:'Legacy',mode:'creative',updatedAt:1};
    localStorage.setItem('voxelgame:local:world:legacy',JSON.stringify(body));
    localStorage.setItem('voxelgame:local:index',JSON.stringify([{id:'legacy',name:'Legacy',updatedAt:1}]));
    const store=window.localTest;const before=await store.restore('legacy');
    await store.save('legacy',{world,name:'Migrated',mode:'creative'});
    const cleared=localStorage.getItem('voxelgame:local:world:legacy')===null;
    const migrated=await store.restore('legacy');
    const saving=store.save('legacy',{world,name:'Older pending save',mode:'creative'});
    const newer={...body,name:'Newer legacy tab',updatedAt:Date.now()+10000};
    localStorage.setItem('voxelgame:local:world:legacy',JSON.stringify(newer));
    localStorage.setItem('voxelgame:local:index',JSON.stringify([{id:'legacy',name:newer.name,updatedAt:newer.updatedAt}]));
    await saving;
    return{old:before.name,migrated:migrated.name,cleared,
      newerRetained:localStorage.getItem('voxelgame:local:world:legacy')!==null,
      restored:(await store.restore('legacy')).name,listed:store.list().find(r=>r.id==='legacy').name};
  });
  assert.equal(legacy.old,'Legacy');assert.equal(legacy.migrated,'Migrated');assert.equal(legacy.cleared,true);
  assert.equal(legacy.newerRetained,true,'an older background commit must not delete a newer legacy record');
  assert.equal(legacy.restored,'Newer legacy tab');assert.equal(legacy.listed,'Newer legacy tab');
  console.log('PASS legacy migration removes only the replaced version and preserves a newer competing legacy save');
  const ordering=await page.evaluate(async()=>{
    const {World}=await import('/src/world/World.js');
    const {restoreWorldSnapshot}=await import('/src/storage/WorldSnapshot.js');
    const store=window.localTest,world=new World({sizeX:16,sizeZ:16,height:16});
    const saves=[];let maxPending=0;
    for(let i=1;i<=40;i++){
      world.setBlock(1,2,3,i);saves.push(store.save('rapid',{world,name:`Version ${i}`,mode:'creative'}));
      maxPending=Math.max(maxPending,store.store.queue.filter(job=>job.type==='save').length);
    }
    await Promise.all(saves);const payload=await store.restore('rapid');
    const saving=store.save('deleted',{world,name:'Will be deleted',mode:'creative'});
    const deleting=store.delete('deleted');await Promise.all([saving,deleting]);await store.refresh();
    let missing=false;try{await store.restore('deleted');}catch{missing=true;}
    return{maxPending,name:payload.name,block:restoreWorldSnapshot(payload.world).getBlock(1,2,3),missing,listed:store.has('deleted')};
  });
  assert.ok(ordering.maxPending<=1);assert.equal(ordering.name,'Version 40');assert.equal(ordering.block,40);
  assert.equal(ordering.missing,true);assert.equal(ordering.listed,false);
  console.log('PASS rapid saves retain one pending snapshot and deletion cannot be undone by a late save');
  const aborted=await page.evaluate(async()=>{
    const {LocalWorlds}=await import('/src/storage/LocalWorlds.js');
    const {World}=await import('/src/world/World.js');
    const code=`import '${location.origin}/src/storage/local-world.worker.js';
      const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){
        if(this.name==='metadata'&&value.name==='Abort'){this.transaction.abort();throw new Error('Synthetic abort');}
        return put.call(this,value,key);
      };`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    const store=new LocalWorlds({workerFactory:()=>new Worker(url,{type:'module'})});await store.ready;
    const world=new World({sizeX:16,sizeZ:16,height:16});world.setBlock(1,2,3,9);
    let failed=false;try{await store.save('small',{world,name:'Abort',mode:'creative'});}catch{failed=true;}
    const kept=await window.localTest.restore('small');await window.localTest.refresh();
    URL.revokeObjectURL(url);
    return{failed,name:kept.name,listed:window.localTest.list().find(r=>r.id==='small').name};
  });
  assert.equal(aborted.failed,true);assert.equal(aborted.name,'Small');assert.equal(aborted.listed,'Small');
  console.log('PASS an aborted metadata write rolls back the payload and directory together');
  const fallback=await page.evaluate(async()=>{
    const {LocalWorlds}=await import('/src/storage/LocalWorlds.js');
    const {World}=await import('/src/world/World.js');
    const store=new LocalWorlds({workerFactory:()=>{throw new Error('Worker unavailable');}});await store.ready;
    const old=await store.restore('large');const world=new World({sizeX:16,sizeZ:16,height:16});
    const put=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Synthetic quota','QuotaExceededError');};
    try{await store.save('fallback',{world,name:'Fallback',mode:'creative'});}finally{Storage.prototype.setItem=put;}
    return{old:old.name,saved:(await store.restore('fallback')).name};
  });
  assert.deepEqual(fallback,{old:'Large',saved:'Fallback'});
  console.log('PASS worker-disabled fallback retains IndexedDB worlds and survives localStorage quota failure');
  const reused=await page.evaluate(async()=>{
    const {World}=await import('/src/world/World.js');const {ChunkGen}=await import('/src/world/ChunkGen.js');
    const {restoreWorldSnapshot}=await import('/src/storage/WorldSnapshot.js');
    const world=new World({height:200,gen:new ChunkGen({seed:4242,height:200})});const start=performance.now();
    await window.localTest.save('large',{world,name:'Reused',mode:'duilt',duilt:{territory:{age:8}},
      territoryBounds:{minX:-128,maxX:127,minZ:-128,maxZ:127}});
    const ms=performance.now()-start,payload=await window.localTest.restore('large');
    return{ms,chunks:world.chunks.size,block:restoreWorldSnapshot(payload.world).getBlock(-1,90,-1)};
  });
  assert.equal(reused.chunks,0);assert.equal(reused.block,4);
  console.log('PASS later saves reuse committed claimed terrain without regenerating it: '+JSON.stringify(reused));
  const conditional=await page.evaluate(async()=>{
    const {World}=await import('/src/world/World.js');const store=window.localTest;
    const world=new World({sizeX:16,sizeZ:16,height:16});
    await store.save('conditional',{world,name:'Before',mode:'creative'});
    const before=(await store.restore('conditional')).updatedAt;
    await store.save('conditional',{world,name:'After',mode:'creative'});
    const deleted=await store.delete('conditional',{ifUnchangedSince:before});
    return{deleted,name:(await store.restore('conditional')).name};
  });
  assert.deepEqual(conditional,{deleted:false,name:'After'});
  console.log('PASS conditional migration cleanup retains a newer IndexedDB version atomically');
  const denied=await page.evaluate(async()=>{
    const {LocalWorlds}=await import('/src/storage/LocalWorlds.js');const {World}=await import('/src/world/World.js');
    const world=new World({sizeX:16,sizeZ:16,height:16});
    const body={world:world.serialize(),name:'Legacy access',mode:'creative',updatedAt:1};
    localStorage.setItem('voxelgame:local:world:denied',JSON.stringify(body));
    localStorage.setItem('voxelgame:local:index',JSON.stringify([{id:'denied',name:body.name,updatedAt:1}]));
    const code=`import '${location.origin}/src/storage/local-world.worker.js';indexedDB.open=()=>{throw new DOMException('Synthetic denied storage','SecurityError');};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    const store=new LocalWorlds({workerFactory:()=>new Worker(url,{type:'module'})});await store.ready;
    const old=(await store.restore('denied')).name;
    await store.save('denied',{world,name:'Legacy still works',mode:'creative'});
    URL.revokeObjectURL(url);
    return{old,name:(await store.restore('denied')).name,warned:!!store.storageError};
  });
  assert.deepEqual(denied,{old:'Legacy access',name:'Legacy still works',warned:true});
  console.log('PASS denied IndexedDB preserves legacy world access and the existing save fallback');
}finally{await browser?.close();await server.close();}
