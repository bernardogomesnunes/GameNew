import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({configFile:false,envDir:false,define:{'import.meta.env.VITE_NEON_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
  await server.listen();browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:780},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__game&&!window.__game.booting,null,{timeout:120000});
  await page.evaluate(async()=>{
    const game=window.__game;game.newWorld({mode:'creative',seed:71823,silent:true});game.ui.hideBlocker();
    const {Inventory}=await import('/src/items/Inventory.js');const d=game.duilt,bag=new Inventory();
    d.inventory=bag;d.crafting.inventory=bag;d.jobs.inventory=bag;d.settlers.inventory=bag;
    // Isolate job controls from population arrivals; navigation and building
    // use the actual generated world and Game.applyChanges callback.
    d.settlers.tick=()=>{};const p=game.player.position,x=Math.floor(p.x)+4,z=Math.floor(p.z)+4,y=game.world.surfaceHeight(x,z);
    const hall={id:99881,type:'work_hall',valid:true,tier:0,locked:true,region:{minX:x-12,maxX:x-8,minY:y,maxY:y+4,minZ:z-12,maxZ:z-8}};
    d.structures.structures.push(hall);d.settlers.people=[{id:99882,name:'Builder',x:x+2.5,y:game.world.surfaceHeight(x+2,z),z:z+.5,hungry:false,target:null}];
    bag.add('stone',5);window.jobsCheck={hall,x,y,z};game.ui.openBuilding(hall,game.buildingActions(hall));
  });
  await page.locator('[data-job-person="99882"]').selectOption('hauler');
  assert.equal(await page.evaluate(()=>window.__game.duilt.jobs.assignment(99882).role),'hauler');
  await page.locator('[data-job-deposit="stone"]').tap();
  assert.equal(await page.evaluate(()=>window.__game.duilt.jobs.supplyForHall(99881).countOf('stone')),5);
  await page.locator('[data-job-person="99882"]').selectOption('builder');
  const result=await page.evaluate(async()=>{
    const game=window.__game,d=game.duilt,{x,y,z}=jobsCheck;d.inventory.add('stone',1);
    const c={x,y,z,prev:game.world.getBlock(x,y,z),next:3};
    const queued=d.jobs.enqueueBuild({name:'Test foundation',type:'house',changes:[c],region:{minX:x,maxX:x,minY:y,maxY:y,minZ:z,maxZ:z}});
    for(let i=0;i<100&&d.jobs.builds[0]?.state==='queued';i++)d.jobs.tick(.5);
    const {buildWorldPayload,parseWorldPayload}=await import('/src/storage/WorldExport.js');
    const parsed=parseWorldPayload(JSON.stringify(buildWorldPayload({...game.saveState(),name:'Job save check'})));
    return {queued:queued.ok,state:d.jobs.builds[0]?.state,block:game.world.getBlock(x,y,z),paid:d.inventory.countOf('stone'),savedJobs:parsed.duilt.jobs.builds.length};
  });
  assert.deepEqual(result,{queued:true,state:'completed',block:3,paid:0,savedJobs:1});
  assert.deepEqual(errors,[]);console.log('PASS mobile Work Hall controls assign/deposit/build through Game and export saved jobs');
}finally{await browser?.close();await server.close();}
