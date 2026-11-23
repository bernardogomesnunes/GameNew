// ACCT-11: the player-name rules agree with migration 0010, and the transport hides itself on a database without it.
import { readFileSync } from 'node:fs';
import { PLAYER_NAME_PATTERN, cleanPlayerName, playerNameProblem, playerNameFailure } from '../src/net/playerName.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { NeonTransport } = await import('../src/net/NeonTransport.js');

// --- the pattern is the same text in the migration (table check and function) ---
{
  const sql = readFileSync(new URL('../migrations/0010_player_names.sql', import.meta.url), 'utf8');
  const found = [...sql.matchAll(/'(\^\[A-Za-z0-9_\][^']*\$)'/g)].map((m) => m[1]);
  ok('migration states the pattern twice (check and function)', found.length === 2);
  ok('both match the JS pattern', found.every((p) => p === PLAYER_NAME_PATTERN));
  ok('unique index ignores case', /create unique index \w+ on public\.player_names \(lower\(name\)\)/.test(sql));
  ok('no insert, update or delete policy: writes only through the function', !/create policy \w+ on public\.player_names for (insert|update|delete|all)/.test(sql));
  ok('migration is additive (no drop of existing things)', !/\bdrop (table|column|policy|function)\b/i.test(sql) && !/alter table (public\.)?(worlds|players|world_chunks)/i.test(sql));
}

// --- rules ---
{
  const good = ['abc', 'Anna_1', 'a b', 'abcdefghijklmnopqrst', '___', 'Mr Bean 7'];
  const bad = ['', 'ab', 'abcdefghijklmnopqrstu', ' abc', 'abc ', 'a-b', 'café', 'a\nb', 'x\ty!', '\u{1F600}\u{1F600}\u{1F600}'];
  ok('allowed names pass', good.every((n) => playerNameProblem(n) === null));
  ok('refused names fail', bad.every((n) => playerNameProblem(n) !== null));
  ok('JS pattern and problem() agree on every sample', [...good, ...bad].every((n) => (playerNameProblem(n) === null) === new RegExp(PLAYER_NAME_PATTERN).test(n)));
  ok('clean trims both ends only', cleanPlayerName('  Mr  Bean ') === 'Mr  Bean');
  ok('messages name the rule', /at least 3/.test(playerNameProblem('ab')) && /at most 20/.test(playerNameProblem('x'.repeat(21))) && /letters, numbers/.test(playerNameProblem('a-b')) && /start or end/.test(playerNameProblem(' abc')));
}

// --- failures ---
{
  ok('409 is taken', playerNameFailure({ status: 409, message: 'x' }).reason === 'taken');
  ok('name_taken text is taken', playerNameFailure({ message: '{"message":"name_taken"}' }).reason === 'taken');
  ok('invalid_name is invalid', playerNameFailure({ message: 'Cloud request failed (400). {"message":"invalid_name"}' }).reason === 'invalid');
  ok('401 is signin', playerNameFailure({ status: 401 }).reason === 'signin');
}

// --- transport ---
{
  const calls = [];
  let mode = 'missing';
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname.replace(/^.*\/rest\/v1/, '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    if (mode === 'missing') return { ok: false, status: 404, text: async () => '{"code":"PGRST202","message":"Could not find the function"}' };
    if (path === '/rpc/my_player_name') return { ok: true, status: 200, text: async () => 'null' };
    if (path === '/rpc/claim_player_name') {
      if (body.p_name.toLowerCase() === 'taken') return { ok: false, status: 409, text: async () => '{"code":"23505","message":"name_taken"}' };
      if (body.p_name === 'bad!') return { ok: false, status: 400, text: async () => '{"code":"22023","message":"invalid_name"}' };
      return { ok: true, status: 200, text: async () => JSON.stringify(body.p_name) };
    }
    return { ok: true, status: 200, text: async () => 'true' };
  };
  const make = () => new NeonTransport({ accessToken: async () => 'tok', summary: () => ({ id: 'u1' }) }, { baseUrl: 'https://x.test/rest/v1' });
  const t = make();
  ok('missing functions: getPlayerName undefined', (await t.getPlayerName()) === undefined);
  const n = calls.length;
  ok('missing is remembered', (await t.playerNameAvailable('Zed')) === undefined && calls.length === n);
  ok('claim refuses when missing', await t.claimPlayerName('Zed').then(() => false, () => true));
  mode = 'present';
  const t2 = make();
  ok('no name yet reads null', (await t2.getPlayerName()) === null);
  ok('claim returns the name and sends only the name', (await t2.claimPlayerName('Zed')) === 'Zed' && JSON.stringify(calls.at(-1).body) === '{"p_name":"Zed"}');
  const e1 = await t2.claimPlayerName('Taken').catch((e) => e);
  ok('taken name: reason and sentence', e1.reason === 'taken' && /taken/.test(e1.message));
  const e2 = await t2.claimPlayerName('bad!').catch((e) => e);
  ok('invalid name: reason', e2.reason === 'invalid');
  ok('availability passes through', (await t2.playerNameAvailable('Zed')) === true);
}

process.exit(f ? 1 : 0);
