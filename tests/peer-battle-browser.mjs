import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server=await createServer({configFile:false,envDir:false,server:{host:'127.0.0.1',port:0,hmr:false}});
server.middlewares.use('/peer-check',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Battle peer test</title></head><body></body></html>');});
let browser;
try {
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
 const hostContext=await browser.newContext(),guestContext=await browser.newContext();
 const host=await hostContext.newPage(),guest=await guestContext.newPage();
 const errors=[];
 for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'peer-check');}
 await host.evaluate(async()=>{
   const [{PeerBattle},{World},{Inventory},{ITEM_FOR_BLOCK},{buildWorldPayload},{Rivals}]=await Promise.all([import('/src/net/PeerBattle.js'),import('/src/world/World.js'),import('/src/items/Inventory.js'),import('/src/config/items.js'),import('/src/storage/WorldExport.js'),import('/src/duilt/Rivals.js')]);
   const world=new World({sizeX:32,sizeZ:32,height:16});
   for(let x=0;x<32;x++)for(let z=0;z<32;z++)world.setBlock(x,0,z,2);
   world.setBlock(5,1,5,3);
   const inventory=new Inventory();inventory.add('planks',8);
   window.hostState={world,inventory,statuses:[],positions:[]};
   window.peer=new PeerBattle({onStatus:s=>hostState.statuses.push(s),onPosition:p=>hostState.positions.push(p),onEditRequest:cells=>{
     if(cells.some(c=>c.x===0||!world.inBounds(c.x,c.y,c.z)||world.getBlock(c.x,c.y,c.z)!==c.prev))return {ok:false,reason:'That site is protected or changed.'};
     const cost={};for(const c of cells){const item=ITEM_FOR_BLOCK.get(c.next);if(item)cost[item]=(cost[item]??0)+1;}
     if(!inventory.spend(cost))return {ok:false,reason:'The host needs more materials.'};
     for(const c of cells)world.setBlock(c.x,c.y,c.z,c.next);
     return {ok:true,changes:cells};
   }});
   window.payload=buildWorldPayload({world,player:{position:{x:4,y:1,z:4},yaw:0,pitch:0},gamification:{toJSON:()=>({})},economy:{toJSON:()=>({})},mode:'duilt',duilt:{battle:new Rivals().toJSON(),inventory:inventory.toJSON()},name:'Shared Battle'});
 });
 await guest.evaluate(async()=>{
   const [{PeerBattle},{parseWorldPayload}]=await Promise.all([import('/src/net/PeerBattle.js'),import('/src/storage/WorldExport.js')]);
   window.guestState={world:null,statuses:[],positions:[],editCount:0};
   window.peer=new PeerBattle({onStatus:s=>guestState.statuses.push(s),onPosition:p=>guestState.positions.push(p),onSnapshot:async payload=>{guestState.world=parseWorldPayload(JSON.stringify(payload)).world;return true;},onEdits:cells=>{for(const c of cells)guestState.world.setBlock(c.x,c.y,c.z,c.next);guestState.editCount+=cells.length;return true;}});
 });
 const offer=await host.evaluate(()=>peer.createOffer());
 const answer=await guest.evaluate(code=>peer.acceptOffer(code),offer);
 await host.evaluate(code=>peer.acceptAnswer(code),answer);
 await Promise.all([host.waitForFunction(()=>peer.connected,null,{timeout:30000}),guest.waitForFunction(()=>peer.connected,null,{timeout:30000})]);
 assert.equal(await guest.evaluate(()=>{try{peer.sendEditRequest([{x:4,y:2,z:4,prev:0,next:7}]);return false;}catch{return true;}}),true);
 console.log('PASS two real browser contexts connect without STUN and remain read-only before sync');
 await host.evaluate(()=>peer.sendSnapshot(payload));
 await Promise.all([host.waitForFunction(()=>peer.ready,null,{timeout:30000}),guest.waitForFunction(()=>peer.ready,null,{timeout:30000})]);
 assert.equal(await guest.evaluate(()=>guestState.world.getBlock(5,1,5)),3);
 console.log('PASS the existing WorldExport format restores the actual guest World');
 const result=await guest.evaluate(()=>peer.sendEditRequest([{x:4,y:2,z:4,prev:0,next:7}]));
 assert.equal(result.ok,true);
 assert.equal(await host.evaluate(()=>hostState.inventory.countOf('planks')),7);
 assert.equal(await guest.evaluate(()=>guestState.world.getBlock(4,2,4)),7);
 assert.equal(await host.evaluate(()=>hostState.world.getBlock(4,2,4)),7);
 console.log('PASS guest construction changes both real worlds and spends host inventory once');
 const denied=await guest.evaluate(()=>peer.sendEditRequest([{x:0,y:2,z:4,prev:0,next:7}]));
 assert.equal(denied.ok,false);assert.match(denied.reason,/protected/);
 assert.equal(await host.evaluate(()=>hostState.inventory.countOf('planks')),7);
 assert.equal(await guest.evaluate(()=>guestState.world.getBlock(0,2,4)),0);
 console.log('PASS host validation rejects protected requests without charging or mutating worlds');
 await host.evaluate(async()=>{hostState.world.setBlock(6,2,6,7);await peer.broadcastEdits([{x:6,y:2,z:6,prev:0,next:7}]);});
 await guest.waitForFunction(()=>guestState.world.getBlock(6,2,6)===7);
 await guest.evaluate(()=>peer.updatePosition({x:7,y:2,z:8,yaw:.5,pitch:.1}));
 await host.waitForFunction(()=>hostState.positions.length===1);
 console.log('PASS host edits and guest player positions travel over the live RTC channel');
 // A second full snapshot exercises re-sync ordering after incremental edits.
 await host.evaluate(async()=>{payload.world=hostState.world.serialize();await peer.sendSnapshot(payload);});
 await Promise.all([host.waitForFunction(()=>peer.ready,null,{timeout:30000}),guest.waitForFunction(()=>peer.ready,null,{timeout:30000})]);
 const afterSync=await guest.evaluate(()=>peer.sendEditRequest([{x:8,y:2,z:8,prev:0,next:7}]));assert.equal(afterSync.ok,true);
 console.log('PASS a fresh host snapshot preserves revision ordering for subsequent edits');
 // The panel is Battle-gated, opens in a phone viewport, and disposes its session.
 await guest.setViewportSize({width:390,height:780});
 await guest.evaluate(async()=>{const {PeerBattlePanel}=await import('/src/ui/PeerBattlePanel.js');window.panel=new PeerBattlePanel({isBattle:()=>false});if(panel.open())throw Error('Panel opened outside Battle');panel.dispose();window.panel=new PeerBattlePanel({isBattle:()=>true});panel.open();});
 assert.equal(await guest.locator('.peer-battle-dialog').isVisible(),true);
 assert.equal(await guest.evaluate(()=>document.querySelector('.peer-battle-dialog').getBoundingClientRect().width<=390),true);
 await guest.getByRole('button',{name:'Close panel'}).click();
 await guest.evaluate(()=>{panel.dispose();peer.dispose();});
 await host.waitForFunction(()=>peer.disposed,null,{timeout:15000});
 assert.deepEqual(errors,[]);
 console.log('PASS mobile panel is Battle-only and disconnect closes both peers cleanly');
} finally {await browser?.close();await server.close();}
