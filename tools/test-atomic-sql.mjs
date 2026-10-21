// Optional isolated PostgreSQL/WASM validation. Does not connect to Neon.
// npm install --prefix <temporary-dir> --no-save --package-lock=false @electric-sql/pglite@0.5.11
// PGLITE_MODULE_PATH=<temporary-dir>/node_modules/@electric-sql/pglite/dist/index.js node tools/test-atomic-sql.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { bytesToHex } from '../src/net/NeonTransport.js';
import { packRle } from '../src/storage/SyncEngine.js';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite');
const db = new PGlite();
const playerA = '00000000-0000-0000-0000-000000000001';
const playerB = '00000000-0000-0000-0000-000000000002';
const world = '00000000-0000-0000-0000-000000000010';
const saveA = '00000000-0000-0000-0000-000000000011';
const saveB = '00000000-0000-0000-0000-000000000012';
const saveC = '00000000-0000-0000-0000-000000000013';
const metadata = name => ({name,mode:'creative',size_x:16,size_z:16,height:16,spawn:null,economy:{},duilt:null,world_gen:null,block_count:1});
const chunk = block => [{cx:0,cz:0,rle:bytesToHex(packRle([block,4096]))}];
const rpc = async (name,args) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
try {
  await db.exec(`create role authenticated; create schema auth;
    create function auth.user_id() returns text language sql stable as $$ select nullif(current_setting('test.user_id', true), '') $$;
    grant usage on schema auth to authenticated; grant execute on function auth.user_id() to authenticated;`);
  for(const file of ['0001_baseline.sql','0002_worlds_allow_duilt_mode.sql','0003_worlds_duilt_worldgen_columns.sql','0004_save_failures.sql']) {
    // gen_random_uuid is built in; the optional pgcrypto extension is not in PGlite.
    await db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8').replace('create extension if not exists pgcrypto;',''));
  }
  await db.exec(`grant usage on schema public to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into public.players(id,device_key,auth_user_id) values ('${playerA}','test-a','A'),('${playerB}','test-b','B');`);
  await db.exec(readFileSync(new URL('../migrations/0006_atomic_world_saves.sql',import.meta.url),'utf8'));
  console.log('PASS 0006 migration executes in isolated PostgreSQL/WASM (baseline 0001..0004; live 0005 unavailable)');
  await db.exec("set role authenticated; set test.user_id = 'A';");
  await assert.rejects(db.query('select * from public.world_save_sessions'), /permission denied/);
  await assert.rejects(db.query("insert into public.worlds(id,player_id,name,mode,size_x,size_z,height) values($1,$2,'direct','creative',16,16,16)",[world,playerA]),/row-level security/);
  await rpc('begin_world_save',[saveA,world,0,1,metadata('First')]);
  await assert.rejects(rpc('commit_world_save',[saveA]),/incomplete/);
  await rpc('stage_world_save',[saveA,chunk(1)]);
  assert.equal((await db.query('select count(*)::int as n from public.worlds')).rows[0].n,0,'Staged worlds are invisible');
  assert.equal((await rpc('commit_world_save',[saveA])).revision,1);
  assert.equal((await rpc('commit_world_save',[saveA])).revision,1,'Lost-response commit replay is idempotent');
  console.log('PASS SQL hides incomplete stages, blocks direct legacy writes, and commits/replays a complete save');
  await rpc('begin_world_save',[saveB,world,1,1,metadata('B loses')]);
  await rpc('begin_world_save',[saveC,world,1,1,metadata('C wins')]);
  await rpc('stage_world_save',[saveB,chunk(2)]);
  await rpc('stage_world_save',[saveC,chunk(3)]);
  await rpc('commit_world_save',[saveC]);
  await assert.rejects(rpc('commit_world_save',[saveB]),/changed/);
  const published=(await db.query('select name,revision from public.worlds where id=$1',[world])).rows[0];
  assert.equal(published.name,'C wins'); assert.equal(Number(published.revision),2);
  const bytes=(await db.query('select rle from public.world_chunks where world_id=$1',[world])).rows[0].rle;
  assert.deepEqual(bytes,packRle([3,4096]));
  console.log('PASS SQL rejects a competing stale session without copying any losing chunks');
  await assert.rejects(db.query('insert into public.world_chunks(world_id,cx,cz,rle) values($1,1,1,$2)',[world,packRle([1,4096])]),/row-level security/);
  await db.exec('reset role; alter table public.world_chunks add constraint test_publish_limit check (get_byte(rle,0) <> 4); set role authenticated;');
  const failedSave='00000000-0000-0000-0000-000000000014';
  await rpc('begin_world_save',[failedSave,world,2,1,metadata('Must roll back')]);
  await assert.rejects(rpc('stage_world_save',[failedSave,[{cx:0,cz:0,rle:bytesToHex(packRle([4,4095]))}]]),/Invalid saved chunk/);
  await rpc('stage_world_save',[failedSave,chunk(4)]);
  await assert.rejects(rpc('commit_world_save',[failedSave]),/test_publish_limit/);
  const unchanged=(await db.query('select name,revision from public.worlds where id=$1',[world])).rows[0];
  assert.equal(unchanged.name,'C wins'); assert.equal(Number(unchanged.revision),2);
  assert.deepEqual((await db.query('select rle from public.world_chunks where world_id=$1',[world])).rows[0].rle,packRle([3,4096]));
  console.log('PASS SQL rolls metadata and chunks back together when publishing violates a chunk constraint');
  await db.exec("set test.user_id = 'B';");
  await assert.rejects(rpc('commit_world_save',[saveC]),/not yours/);
  await assert.rejects(rpc('begin_world_save',['00000000-0000-0000-0000-000000000099',world,2,0,metadata('Intruder')]),/not yours/);
  assert.equal((await db.query('select count(*)::int as n from public.worlds')).rows[0].n,0);
  await db.exec("set test.user_id = 'A';");
  await assert.rejects(rpc('delete_world_atomic',[world,null]),/Invalid expected revision/);
  await rpc('delete_world_atomic',[world,2]);
  await assert.rejects(rpc('begin_world_save',['00000000-0000-0000-0000-000000000098',world,3,0,metadata('Resurrect')]),/deleted/);
  console.log('PASS SQL rejects cross-account access and null-revision deletes; deleted worlds cannot be resurrected');
  // Exhaust the server-side token bucket using valid auxiliary table writes.
  let limited=false;
  for(let i=0;i<80;i++) {
    try { await db.query('insert into public.save_failures(player_id,message) values($1,$2)',[playerA,'rate check']); }
    catch(error) { assert.match(error.message,/write rate exceeded/); limited=true; break; }
  }
  assert.equal(limited,true);
  console.log('PASS SQL enforces a shared per-account write quota on direct auxiliary table writes');
} finally { await db.close(); }
