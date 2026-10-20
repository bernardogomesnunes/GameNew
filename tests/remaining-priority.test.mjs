import assert from 'node:assert/strict';
import { NeonTransport } from '../src/net/NeonTransport.js';
import { parseWorldPayload, pickFile } from '../src/storage/WorldExport.js';

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
const transport = new NeonTransport({}, { baseUrl: 'https://example.invalid' });
await check('account size limit gives an actionable message without paging retries', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({code:'23514', message:'violates check constraint "worlds_duilt_size"'}) });
  try {
    await assert.rejects(() => transport.send('/worlds', {}), e => /too large to save to your account/.test(e.message) && /Export/.test(e.message) && !e.tooLarge);
  } finally { globalThis.fetch = old; }
});
await check('account list fetches only Battle metadata and preserves its flag', async () => {
  transport.ensurePlayer = async () => 'test';
  transport.request = async path => {
    assert.match(path, /battle:duilt->battle/);
    return [{id:'test', mode:'duilt', battle:{}, revision:1, updated_at:'2026-10-20'}];
  };
  assert.equal((await transport.listWorlds())[0].battle, true);
});
const payload = () => ({format:'voxel-sandbox-world', version:2, name:'Test', mode:'creative', player:{x:1,y:2,z:1,yaw:0,pitch:0}, world:{sizeX:16,sizeZ:16,height:16,chunks:[{cx:0,cz:0,rle:[0,4096]}]}});
await check('valid legacy and current exports still import', () => {
  for (const version of [1,2]) { const p=payload(); p.version=version; assert.equal(parseWorldPayload(JSON.stringify(p)).world.height,16); }
});
await check('valid endless worlds, Battle state and wide block IDs survive import', () => {
  const p=payload();
  p.mode='duilt'; p.duilt={battle:{armed:true},inventory:{slots:[null]},trains:[{cars:1,head:0,trail:[[0,1,0],[1,1,0]]}]};
  p.world={endless:true,seed:7919,height:200,homeX:0,homeZ:0,chunks:[{cx:0,cz:0,rle:[1000,51200],surface:Array(256).fill(200)}]};
  const result=parseWorldPayload(JSON.stringify(p));
  assert.equal(result.world.getBlock(0,0,0),1000);
  assert.equal(result.duilt.battle.armed,true);
  assert.equal(result.world.endless,true);
});
for (const [name, mutate] of [
  ['future format', p => p.version=999],
  ['fractional height', p => p.world.height=1.5],
  ['oversized dimensions', p => p.world.sizeX=1e12],
  ['incomplete run', p => p.world.chunks[0].rle=[0,4095]],
  ['overflowing run', p => p.world.chunks[0].rle=[0,4097]],
  ['negative run', p => p.world.chunks[0].rle=[0,-1]],
  ['invalid block id', p => p.world.chunks[0].rle=[65536,4096]],
  ['duplicate chunks', p => p.world.chunks.push({...p.world.chunks[0]})],
  ['invalid player', p => p.player.x=1e300],
  ['oversized building', p => p.duilt={structures:{structures:[{type:'house',region:{minX:0,minY:0,minZ:0,maxX:1e12,maxY:10,maxZ:10}}]}}],
  ['invalid design', p => p.templates=[{id:'test',size:16,blocks:[{dx:1000,dy:0,dz:0,type:3}]}]],
  ['fake inventory length', p => p.duilt={chests:[{key:'0,0,0',slots:{length:1e9}}]}],
  ['implicit train inventories', p => p.duilt={trains:Array.from({length:20000},()=>({trail:[[0,1,0],[1,1,0]],head:0,cars:5}))}],
  ['thin building spanning thousands of chunks', p => { p.world={endless:true,seed:1,height:200,chunks:[]}; p.duilt={structures:{structures:[{type:'house',region:{minX:0,maxX:1048575,minY:1,maxY:1,minZ:0,maxZ:0}}]}}; }],
]) await check(`import rejects ${name} before world allocation`, () => {
  const p=payload(); mutate(p); assert.throws(() => parseWorldPayload(JSON.stringify(p)), /world file|world format/i);
});
await check('oversized selected files are refused before reading', async () => {
  const old = globalThis.document;
  let read=false;
  globalThis.document={createElement:()=>({files:[{size:129*1024*1024}],click(){this.onchange();}})};
  const reader = globalThis.FileReader;
  globalThis.FileReader=class { readAsText(){read=true;} };
  try { await assert.rejects(() => pickFile('.json'), /too large/i); assert.equal(read,false); }
  finally { globalThis.document=old; globalThis.FileReader=reader; }
});
process.exitCode = failures ? 1 : 0;
