// ACCT-5: download my data, delete my account (client side, with a fake Data API and a fake auth client).
import { buildAccountExport, bytesToBase64, base64ToBytes, ACCOUNT_EXPORT_FORMAT } from '../src/storage/AccountExport.js';
import { CloudAuth } from '../src/net/CloudAuth.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { NeonTransport, isMissingThing } = await import('../src/net/NeonTransport.js');

// --- base64 round trip ---
{
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256);
  ok('base64 round trip over 64K bytes', base64ToBytes(bytesToBase64(bytes)).every((b, i) => b === bytes[i]));
}

// --- export file ---
{
  const chunk = (cx, cz, n) => ({ cx, cz, bytes: Uint8Array.from({ length: n }, (_, i) => i % 251) });
  const transport = {
    listWorlds: async () => [
      { id: 'w1', name: 'Home', mode: 'duilt', updatedAt: Date.parse('2026-11-20T10:00:00Z'), blockCount: 5, revision: 3 },
      { id: 'w2', name: 'Broken', mode: 'creative', updatedAt: Date.parse('2026-11-21T10:00:00Z'), blockCount: 1, revision: 1 },
      { id: 'w3', name: 'Second', mode: 'creative', updatedAt: Date.parse('2026-11-22T10:00:00Z'), blockCount: 1, revision: 1 },
    ],
    pullWorld: async (id) => {
      if (id === 'w2') throw new Error('Cloud request failed (500).');
      return { meta: { id, name: id, mode: 'duilt', height: 200, duilt: { bag: { wood: 3 } } }, chunks: id === 'w1' ? [chunk(0, 0, 40), chunk(1, 0, 10)] : [chunk(0, 0, 4)] };
    },
    pullProgression: async () => ({ xp: 120, level: 3 }),
    pullTemplates: async () => [{ id: 't1', name: 'Hut', blocks: [1, 2] }],
  };
  const seen = [];
  const r = await buildAccountExport({ transport, user: { id: 'u1', email: 'me@x.test', name: 'me' }, playerName: 'Builder 7', onProgress: (p) => seen.push(p.done + '/' + p.total), now: () => new Date('2026-11-23T12:00:00Z') });
  const file = JSON.parse(await r.blob.text());
  ok('format and version', file.format === ACCOUNT_EXPORT_FORMAT && file.version === 1);
  ok('account, player name, progression, templates', file.account.email === 'me@x.test' && file.playerName === 'Builder 7' && file.progression.xp === 120 && file.templates[0].name === 'Hut');
  ok('two worlds written, one failure listed', r.worlds === 2 && file.worlds.length === 2 && file.failed.length === 1 && file.failed[0].id === 'w2');
  ok('world metadata (duilt bag) kept', file.worlds[0].meta.duilt.bag.wood === 3 && file.worlds[0].mode === 'duilt');
  ok('chunks counted and decodable', r.chunks === 3 && base64ToBytes(file.worlds[0].chunks[0].rle).length === 40 && file.worlds[0].chunks[1].cx === 1);
  ok('progress reported to the end', seen[0] === '0/3' && seen.at(-1) === '3/3');
  ok('empty account still a valid file', JSON.parse(await (await buildAccountExport({ transport: { listWorlds: async () => [], pullProgression: async () => null }, user: null })).blob.text()).worlds.length === 0);
}

// --- transport: feature detection and calls ---
{
  const calls = [];
  let mode = 'missing';
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body && JSON.parse(init.body) });
    if (mode === 'missing') return { ok: false, status: 404, text: async () => '{"code":"PGRST202","message":"Could not find the function public.delete_my_account_data"}' };
    return { ok: true, status: 200, text: async () => JSON.stringify({ dry_run: calls.at(-1).body.p_dry_run, worlds: 2, chunks: 9 }) };
  };
  const t = new NeonTransport({ accessToken: async () => 'tok', summary: () => ({ id: 'u1' }) }, { baseUrl: 'https://x.test/rest/v1' });
  ok('missing function: preview is undefined', (await t.accountDeletePreview()) === undefined);
  const n = calls.length;
  await t.accountDeletePreview();
  ok('missing function is remembered, no second request', calls.length === n);
  ok('delete refuses when function missing', await t.deleteAccountData().then(() => false, () => true));
  ok('isMissingThing reads 404 and PGRST202', isMissingThing({ status: 404 }) && isMissingThing({ message: 'PGRST202' }) && !isMissingThing({ status: 500, message: 'x' }));

  mode = 'present';
  const t2 = new NeonTransport({ accessToken: async () => 'tok', summary: () => ({ id: 'u1' }) }, { baseUrl: 'https://x.test/rest/v1' });
  const p = await t2.accountDeletePreview();
  ok('preview sends dry run and returns counts', p.worlds === 2 && calls.at(-1).body.p_dry_run === true && calls.at(-1).url.endsWith('/rpc/delete_my_account_data'));
  const d = await t2.deleteAccountData();
  ok('delete sends a real call with no user id in the body', calls.at(-1).body.p_dry_run === false && Object.keys(calls.at(-1).body).join() === 'p_dry_run' && d.worlds === 2);
}

// --- CloudAuth.deleteAccount ---
{
  const make = (deleteUser) => {
    const a = new CloudAuth({ emit: (e, p) => { a.events.push([e, p]); } });
    a.events = [];
    a.client = { auth: { deleteUser } };
    a.user = { id: 'u1' };
    return a;
  };
  const sent = [];
  const a = make(async (body) => { sent.push(body); return { data: { success: true } }; });
  await a.deleteAccount();
  ok('deleteUser called, user cleared, signed-out event', sent.length === 1 && a.user === null && a.events.at(-1)[1].user === null);
  const b = make(async () => ({ error: { status: 404, message: 'Not found' } }));
  const e1 = await b.deleteAccount().catch((e) => e);
  ok('404 reads as unavailable and keeps the session', e1.reason === 'unavailable' && /does not allow/.test(e1.message) && b.user !== null);
  const c = make(async () => ({ error: { status: 403, message: 'Session expired. Re-authenticate to perform this action' } }));
  ok('stale session asks for the password', (await c.deleteAccount().catch((e) => e)).reason === 'needs-password');
  const d = make(async () => ({ error: { status: 400, code: 'INVALID_PASSWORD', message: 'Invalid password' } }));
  ok('wrong password named', (await d.deleteAccount('x').catch((e) => e)).reason === 'wrong-password');
  const pw = [];
  await make(async (b2) => { pw.push(b2); return { data: {} }; }).deleteAccount('hunter22');
  ok('password is sent when given', pw[0].password === 'hunter22');
  const e = make(undefined);
  ok('client without deleteUser: unavailable', (await e.deleteAccount().catch((x) => x)).reason === 'unavailable');
}

process.exit(f ? 1 : 0);
