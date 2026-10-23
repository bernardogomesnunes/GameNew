// Compare identical frozen full-game frames; timings here are not phone FPS.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server=await createServer({configFile:false,envDir:false,
  define:{'import.meta.env.VITE_NEON_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
    args:process.env.PERFORMANCE_USE_HARDWARE?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
  await page.addInitScript(()=>performance.setResourceTimingBufferSize(5000));
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'||['blob:','data:'].includes(url.protocol)?route.continue():route.abort();});
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>window.__game&&!window.__game.booting&&document.querySelector('#loading')?.classList.contains('ld-gone'),null,{timeout:120000});
  await page.evaluate(()=>{
    const g=window.__game;g.newWorld({mode:'creative',name:'Test world 1',seed:4242,silent:true});
    g.ui.refreshForMode();g.ui.hideBlocker();
    g.player.teleport(-744,g.world.gen.heightAt(-744,600)+5,600);g.player.flying=true;
    // Build the real full-distance scene without paying for hundreds of
    // intermediate software-rendered frames in CI. Runtime budgets stay unchanged.
    g.renderer.setAnimationLoop(null);
    g.streamChunks();g.generateQueued(Infinity);g.drainRemeshQueue(Infinity);
    g.updateDeep();g.drainRemeshQueue(Infinity);g.updateFarTerrain(Infinity);
    g.updateChunkVisibility();g.tick();
  });
  const measured=await page.evaluate(async()=>{
    const moduleURL=performance.getEntriesByType('resource').find(resource=>new URL(resource.name).pathname.endsWith('/.vite/deps/three.js'))?.name;
    if(!moduleURL)throw new Error('The actual Three.js module was not observed');
    const {WebGLRenderTarget}=await import(moduleURL);
    const g=window.__game;g.renderer.setAnimationLoop(null);
    const tiles=g.farTerrain.meshes,hidden=tiles.filter(mesh=>!mesh.visible),target=new WebGLRenderTarget(320,180);
    const before=new Uint8Array(320*180*4),after=new Uint8Array(before.length);
    const sample=buffer=>{
      g.renderer.render(g.scene,g.camera);
      const metrics={calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
      g.renderer.readRenderTargetPixels(target,0,0,320,180,buffer);return metrics;
    };
    g.renderer.setRenderTarget(target);
    try{
      for(const tile of tiles)tile.visible=true;
      const baseline=sample(before);
      for(const tile of hidden)tile.visible=false;
      const optimized=sample(after);
      let differentChannels=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])differentChannels++;
      const buffers=new Set();let geometryBytes=0;
      g.scene.traverse(object=>{for(const attribute of [...Object.values(object.geometry?.attributes??{}),object.geometry?.index]){
        const buffer=attribute?.array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}
      }});
      return {baseline,optimized,differentChannels,hiddenTiles:hidden.length,
        geometryBytes,chunks:g.world.chunks.size,backend:g.graphicsBackend,crashed:g.crashedWith??null};
    }finally{g.renderer.setRenderTarget(null);target.dispose();}
  });
  mkdirSync('artifacts/performance',{recursive:true});
  writeFileSync('artifacts/performance/full-game-rendering.json',JSON.stringify(measured,null,2)+'\n');
  assert.deepEqual(errors,[]);assert.equal(measured.crashed,null);
  assert.ok(measured.chunks>=700,'Exercise full desktop viewing distance, not a small chunk window');
  assert.ok(measured.hiddenTiles>0,'The full game must exercise covered tiles');
  assert.equal(measured.differentChannels,0,'Skipping covered terrain must leave every rendered channel unchanged');
  assert.ok(measured.optimized.calls<measured.baseline.calls,'Skip actual draw submissions');
  assert.ok(measured.optimized.triangles<measured.baseline.triangles,'Skip actual vertex work');
  const budget=JSON.parse(readFileSync(new URL('../tools/performance/budgets.json',import.meta.url),'utf8')).fullGame;
  assert.ok(measured.optimized.calls<=budget.drawCalls,'Full-game draw-call budget');
  assert.ok(measured.optimized.triangles<=budget.triangles,'Full-game triangle budget');
  assert.ok(measured.geometryBytes<=budget.geometryBytes,'Full-game CPU geometry-buffer budget');
  console.log(`PASS full-game terrain: ${measured.baseline.calls} -> ${measured.optimized.calls} calls, ${measured.baseline.triangles} -> ${measured.optimized.triangles} triangles, identical pixels`);
}finally{await browser?.close();await server.close();}
