import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NeonTransport, bytesToHex } from '../src/net/NeonTransport.js';
import { CLOUD } from '../src/net/cloudConfig.js';
import { packRle } from '../src/storage/SyncEngine.js';

assert.equal(CLOUD.atomicSaves, false, 'New RPCs stay disabled in unconfigured builds');
const immediate = { run: task => task() };
const auth = {accessToken:async()=> 'fake-token'};
const transport = () => {
  const result = new NeonTransport(auth, { baseUrl:'https://fake.invalid', atomicSaves:true, writeQueue:immediate });
  result.ensurePlayer = async () => 'player';
  return result;
};
const chunks = block => Array.from({length:201}, (_,cx) => ({cx,cz:0,bytes:packRle([block,4096])}));
const meta = name => ({name,mode:'creative',sizeX:64,sizeZ:64,height:16,revision:2});
const published = { revision:1, name:'Before', chunks:new Map() };
const sessions = new Map(), requests = [];
let releaseA, startedA;
const heldA = new Promise(resolve => { releaseA=resolve; });
const readyA = new Promise(resolve => { startedA=resolve; });
let loseCommitResponse = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = JSON.parse(options.body ?? '{}');
  requests.push({path,body});
  const success = data => ({ok:true,status:200,text:async()=>JSON.stringify(data)});
  if (path === '/rpc/begin_world_save') {
    sessions.set(body.p_save_id,{...body,chunks:new Map()});
    return success({committed:false});
  }
  const session = sessions.get(body.p_save_id);
  if (path === '/rpc/stage_world_save') {
    for (const chunk of body.p_chunks) session.chunks.set(`${chunk.cx},${chunk.cz}`,chunk.rle);
    assert.ok(body.p_chunks.length <= 100);
    if (session.p_metadata.name === 'A' && session.chunks.size === 100) { startedA(); await heldA; }
    return success({staged:session.chunks.size});
  }
  if (path === '/rpc/commit_world_save') {
    if (session.committed) return success({revision:session.committed});
    if (published.revision !== session.p_expected_revision) return {ok:false,status:409,text:async()=> 'World changed'};
    assert.equal(session.chunks.size,session.p_expected_chunks);
    published.revision++;
    published.name=session.p_metadata.name;
    for (const [key,value] of session.chunks) published.chunks.set(key,value);
    session.committed=published.revision;
    if (loseCommitResponse) { loseCommitResponse=false; throw new TypeError('Failed to fetch'); }
    return success({revision:published.revision});
  }
  throw new Error(`Unexpected endpoint ${path}`);
};
try {
  const a = transport().pushWorld({worldId:'world',meta:meta('A'),chunks:chunks(1)});
  const rejectedA = assert.rejects(a, error => error.status === 409);
  await readyA;
  await transport().pushWorld({worldId:'world',meta:meta('B'),chunks:chunks(2)});
  releaseA(); await rejectedA;
  assert.equal(published.name,'B');
  assert.equal(published.chunks.size,201);
  assert.ok([...published.chunks.values()].every(value=>value===bytesToHex(packRle([2,4096]))));
  assert.ok(requests.every(request=>request.path.startsWith('/rpc/')),'Atomic path never publishes direct metadata or chunk pages');
  console.log('PASS atomic transport stages bounded pages; a losing device cannot publish mixed chunks (mock RPC contract)');
  loseCommitResponse=true;
  await transport().pushWorld({worldId:'world',meta:{...meta('Retry'),revision:3},chunks:[]});
  assert.equal(published.revision,3);
  const commits=requests.filter(request=>request.path==='/rpc/commit_world_save');
  assert.equal(commits.at(-1).body.p_save_id,commits.at(-2).body.p_save_id);
  console.log('PASS lost commit responses retry the same save ID without publishing twice (mock RPC contract)');
  const reader=transport();
  let snapshots=0;
  reader.request=async path=> {
    if(path.includes('select=*')) {
      snapshots++;
      return [{id:'world',name:snapshots===1?'old':'new',mode:'creative',size_x:16,size_z:16,height:16,revision:snapshots===1?1:2,economy:{}}];
    }
    if(path.includes('/world_chunks?')) return [{cx:0,cz:0,rle:bytesToHex(packRle([2,4096]))}];
    if(path.includes('select=revision')) return [{revision:2}];
    throw new Error(path);
  };
  const restored=await reader.pullWorld('world');
  assert.equal(restored.meta.name,'new');
  assert.equal(restored.meta.revision,2);
  assert.equal(snapshots,2);
  console.log('PASS paged atomic reads retry when a commit changes the revision mid-download');
} finally { globalThis.fetch=originalFetch; }

// Static contract checks do not execute SQL or prove PostgreSQL concurrency/RLS.
const sql=readFileSync(new URL('../migrations/0006_atomic_world_saves.sql',import.meta.url),'utf8');
assert.match(sql,/for update/);
assert.match(sql,/current_world\.revision <> held\.expected_revision/);
assert.match(sql,/as restrictive for update to authenticated using \(false\)/);
assert.match(sql,/from public, authenticated/);
assert.match(sql,/PT429/);
for(const definition of sql.split(/create function /).slice(1)) {
  if(definition.includes('security definer')) assert.match(definition,/security definer set search_path = pg_catalog/);
}
console.log('PASS reviewed migration contract includes row locks, revision comparison, API guards and SQL write budget (not database execution)');
