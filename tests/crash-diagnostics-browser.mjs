import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server=await createServer({configFile:false,envDir:false,
  define:{'import.meta.env.VITE_NEON_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const kind of ['frame-error','webgl-context-lost','diagnostics-failure']){
    const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,isMobile:true,acceptDownloads:true});
    await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'||['blob:','data:'].includes(url.protocol)?route.continue():route.abort();});
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(()=>window.__game&&!window.__game.booting&&document.querySelector('#loading')?.classList.contains('ld-gone'),null,{timeout:120000});
    await page.evaluate(async()=>{
      const g=window.__game;await g.newWorld({mode:'creative',name:'Test world 1',seed:4242,silent:true});
      g.ui.refreshForMode();g.ui.hideBlocker();
    });
    await page.waitForFunction(()=>window.__game.renderer.info.render.calls>0);
    await page.evaluate(kind=>{
      const g=window.__game;
      if(kind==='diagnostics-failure'){
        const setLoop=g.renderer.setAnimationLoop.bind(g.renderer);
        g.renderer.setAnimationLoop=loop=>{g.__recoveryStopped=loop===null;setLoop(loop);};
        const error=new Error('Synthetic frame failure');
        Object.defineProperty(error,'stack',{get(){throw new Error('Stack formatting failed');}});
        g.tick=()=>{throw error;};
      }else if(kind==='frame-error')g.tick=()=>{throw new Error('Synthetic frame failure https://example.invalid/private?secret=abc');};
      else{
        const extension=g.renderer.getContext().getExtension('WEBGL_lose_context');
        if(!extension)throw new Error('Context loss extension unavailable in test');
        extension.loseContext();
      }
    },kind);
    await page.locator('#crash').waitFor({state:'visible'});
    assert.equal(await page.locator('#crash').getAttribute('role'),'alertdialog');
    assert.equal(await page.locator('#crash').getByRole('button',{name:'Reload',exact:true}).count(),1);
    if(kind==='diagnostics-failure'){
      await page.waitForFunction(()=>document.querySelector('.crash-state')?.textContent==='Your world is saved.');
      assert.match(await page.locator('.crash-why').innerText(),/Synthetic frame failure/);
      assert.equal(await page.evaluate(()=>window.__game.__recoveryStopped),true);
      console.log('PASS diagnostics failure: malformed error stack still stops rendering and saves the world');
      await page.close();continue;
    }
    if(kind==='webgl-context-lost'){
      assert.match(await page.locator('.crash-why').innerText(),/graphics connection was lost/i);
      assert.doesNotMatch(await page.locator('.crash-why').innerText(),/ran out|phone/i);
    }
    const downloadReady=page.waitForEvent('download');
    await page.locator('#crash').getByRole('button',{name:'Download diagnostics'}).click();
    const download=await downloadReady;
    mkdirSync('artifacts/performance',{recursive:true});
    const path=`artifacts/performance/crash-${kind}.json`;await download.saveAs(path);
    const text=readFileSync(path,'utf8'),report=JSON.parse(text);
    assert.equal(report.crash.kind,kind);assert.equal(report.mode,'creative');
    assert.ok(report.graphics.backend.renderer);assert.ok(report.crash.context.loadedChunks>0);
    assert.ok(!Object.hasOwn(report,'worldId'));assert.ok(!text.includes('secret=abc'));
    if(kind==='frame-error'){
      assert.ok(report.errors.filter(e=>e.kind==='frame-error').length>=3);
      assert.match(report.crash.stack,/Synthetic frame failure/);
    }else assert.equal(report.crash.context.graphics.contextLost,true);
    await page.waitForFunction(()=>document.querySelector('.crash-state')?.textContent==='Your world is saved.');
    await page.screenshot({path:`artifacts/performance/crash-${kind}.png`});
    console.log(`PASS ${kind}: actual stop screen, saved world, downloadable redacted diagnostics and cached backend`);
    await page.close();
  }
}finally{await browser?.close();await server.close();}
