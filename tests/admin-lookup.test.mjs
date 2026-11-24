// ACCT-12: the support lookup is read-only, joins the right data and hides the connection string.
import { main, parseArgs, format, USER_SQL, PLAYER_SQL, WORLDS_SQL, FAILURES_SQL, NAME_SQL } from '../scripts/admin-lookup.mjs';
import { assertSelect } from '../scripts/readonly-sql.mjs';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const URL_ = 'postgresql://owner:s3cret@ep-x-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
ok('every statement is a single select', [USER_SQL, PLAYER_SQL, WORLDS_SQL, FAILURES_SQL, NAME_SQL].every((q) => (assertSelect(q), true)));
ok('every statement takes the target as a parameter, not text', [USER_SQL, PLAYER_SQL, WORLDS_SQL, FAILURES_SQL, NAME_SQL].every((q) => /\$1/.test(q)));
ok('worlds query counts chunks and reads last save', /count\(\*\)/.test(WORLDS_SQL) && /updated_at/.test(WORLDS_SQL));

const a = parseArgs(['a@b.co', '--json'], { ADMIN_DATABASE_URL: URL_ });
ok('parseArgs reads target, flag, url', a.target === 'a@b.co' && a.json && a.url === URL_);
ok('parseArgs --env reads another variable', parseArgs(['x', '--env', 'OTHER'], { OTHER: 'u' }).url === 'u');

const user = { id: 'au1', email: 'kid@example.com', name: 'kid', email_verified: true, created_at: '2026-11-01T00:00:00Z' };
const player = { id: 'p1', auth_user_id: 'au1', display_name: 'kid', created_at: '2026-11-01T00:00:00Z', last_seen_at: '2026-11-23T00:00:00Z' };
const worlds = [
  { id: 'w1', name: 'Home', mode: 'creative', block_count: 900, revision: 7, updated_at: '2026-11-23T10:00:00Z', deleted_at: null, chunks: 12 },
  { id: 'w2', name: 'Old', mode: 'campaign', block_count: 5, revision: 1, updated_at: '2026-10-01T10:00:00Z', deleted_at: '2026-10-02T00:00:00Z', chunks: 3 },
];
const failures = [{ created_at: '2026-11-22T00:47:00Z', world_id: 'w1', code: '409', message: 'That world changed elsewhere' }];

function fake({ users = [user], players = [player], nameRows = [{ name: 'Kiddo' }], nameFails = false, status = 200 } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    const queries = JSON.parse(init.body).queries;
    calls.push({ url, init, queries });
    if (status !== 200) return { ok: false, status, text: async () => 'bad ' + URL_ };
    const rowsFor = (q) => q.query === USER_SQL ? users : q.query === PLAYER_SQL ? players : q.query === WORLDS_SQL ? worlds : q.query === FAILURES_SQL ? failures : nameRows;
    if (queries[0].query === NAME_SQL && nameFails) return { ok: false, status: 400, text: async () => 'relation "player_names" does not exist' };
    return { ok: true, status: 200, json: async () => ({ results: queries.map((q) => ({ rows: rowsFor(q) })) }) };
  };
  return { impl, calls };
}
function sink() { const l = []; return { log: (s) => l.push(s), error: (s) => l.push(s), l }; }

{
  const { impl, calls } = fake();
  const o = sink();
  const code = await main(['kid@example.com'], { ADMIN_DATABASE_URL: URL_ }, impl, o);
  const text = o.l.join('\n');
  ok('found exits 0', code === 0);
  ok('every request is a read-only batch', calls.every((c) => c.init.headers['Neon-Batch-Read-Only'] === 'true'));
  ok('target goes in params', calls[0].queries.every((q) => q.params[0] === 'kid@example.com'));
  ok('prints email, chosen name, last save', text.includes('kid@example.com') && text.includes('Kiddo') && text.includes('last save 2026-11-23T10:00:00.000Z'));
  ok('prints worlds with chunk counts', text.includes('2 live') === false && text.includes('1 live, 1 deleted, 15 chunks') && text.includes('12 chunks') && text.includes('[deleted] Old'));
  ok('prints recent save failures', text.includes('409') && text.includes('That world changed elsewhere'));
  ok('never prints the connection string', !text.includes('s3cret'));
}
{
  const o = sink();
  const code = await main(['kid@example.com'], { ADMIN_DATABASE_URL: URL_ }, fake({ nameFails: true }).impl, o);
  ok('missing player_names table is tolerated', code === 0 && o.l.join('\n').includes('(none chosen)'));
}
{
  const o = sink();
  const code = await main(['nobody@example.com'], { ADMIN_DATABASE_URL: URL_ }, fake({ users: [], players: [] }).impl, o);
  ok('no match exits 1', code === 1 && o.l.join('\n').includes('none matched'));
}
{
  const o = sink();
  const code = await main(['x', '--json'], { ADMIN_DATABASE_URL: URL_ }, fake().impl, o);
  const parsed = JSON.parse(o.l[0]);
  ok('--json prints parseable output', code === 0 && parsed.players[0].worlds.length === 2 && parsed.players[0].name === 'Kiddo');
}
{
  const o = sink();
  ok('no target exits 2', (await main([], { ADMIN_DATABASE_URL: URL_ }, fake().impl, o)) === 2);
  ok('no connection string exits 2', (await main(['x'], {}, fake().impl, sink())) === 2);
  const o2 = sink();
  const code = await main(['x'], { ADMIN_DATABASE_URL: URL_ }, fake({ status: 500 }).impl, o2);
  ok('database error exits 2 and hides the connection string', code === 2 && !o2.l.join('\n').includes('s3cret'));
}
ok('format handles a device-only player', format({ users: [], players: [{ player: { ...player, auth_user_id: null }, name: null, worlds: [], failures: [] }] }).includes('device only'));
process.exit(f ? 1 : 0);
