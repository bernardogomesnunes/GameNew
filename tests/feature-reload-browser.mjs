// Local-only real world persistence and the recovery Reload button.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server=await createServer({configFile:false,envDir:false,
  define:{'import.meta.env.VITE_NEON_URL':JSON.stringify('')},
  server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.booting
    &&(!document.querySelector('#loading')||document.querySelector('#loading').classList.contains('ld-gone')),null,{timeout:120000});
  await page.goto(server.resolvedUrls.local[0]);await ready();
  const saved=await page.evaluate(async()=>{
    const g=window.__game;
    await g.newWorld({mode:'duilt',name:'Recovery confirmation',seed:4242,silent:true});
    g.renderer.setAnimationLoop(null);g.ui.refreshForMode();g.ui.hideBlocker();
    const at={x:Math.floor(g.player.position.x)+2,y:Math.floor(g.player.position.y)+3,z:Math.floor(g.player.position.z)};
    g.world.setBlock(at.x,at.y,at.z,3);
    if(!await g.saveAndWait())throw new Error('Initial fixture did not persist');
    const initial=await g.local.restore(g.worldId);
    g.world.setBlock(at.x,at.y,at.z,5);
    window.__recoveryAt=at;
    window.__recoverySave=g.local.save;
    g.local.save=async()=>{throw new Error('Synthetic local commit failure');};
    g.featureFailure=true;
    const result=await g.reloadForFeatures();
    const prior=await g.local.restore(g.worldId);
    return {id:g.worldId,at,result,block:g.world.getBlock(at.x,at.y,at.z),
      previousSavePreserved:prior.updatedAt===initial.updatedAt};
  });
  assert.equal(saved.result,false);assert.equal(saved.block,5);assert.equal(saved.previousSavePreserved,true);
  assert.match(await page.locator('body').innerText(),/Could not save your world/);
  console.log('PASS failed recovery save keeps the live edit and prior committed world intact without reloading');
  await page.evaluate(()=>{window.__game.local.save=window.__recoverySave;});
  await Promise.all([page.waitForEvent('domcontentloaded'),page.evaluate(()=>{void window.__game.reloadForFeatures();})]);
  await ready();
  const reopened=await page.evaluate(async({id,at})=>{
    const g=window.__game;
    if(!await g.openWorld(id))throw new Error('Saved recovery world did not reopen');
    return {id:g.worldId,block:g.world.getBlock(at.x,at.y,at.z)};
  },saved);
  assert.deepEqual(reopened,{id:saved.id,block:5});assert.deepEqual(errors,[]);
  console.log('PASS confirmed recovery save reloads the page and the same local world reopens with the latest edit');
}finally{await browser?.close();await server.close();}
