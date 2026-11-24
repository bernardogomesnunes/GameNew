// TECH-14: the migration check lists files and reports which are missing, read-only.
import { readFileSync } from 'node:fs';
import { listMigrations, sqlEndpoint, runProbes, report, format, main } from '../scripts/check-migrations.mjs';
import { PROBES } from '../db/migration-probes.mjs';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const files = listMigrations();
ok('lists 0001 to 0007 at least', files[0].startsWith('0001') && files.some((x) => x.startsWith('0007')));
ok('every migration file has a probe', files.every((x) => x.slice(0, 4) in PROBES));
ok('every probe is one select returning applied', Object.values(PROBES).every((q) => /^select /.test(q) && /as applied$/.test(q) && !/;/.test(q)));
ok('probes never write', Object.values(PROBES).every((q) => !/\b(insert|update|delete|drop|alter|create|truncate)\b/i.test(q)));

const URL_ = 'postgresql://owner:s3cret@ep-x-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
ok('endpoint is the host over https', sqlEndpoint(URL_) === 'https://ep-x-pooler.c-2.us-east-2.aws.neon.tech/sql');

function fakeFetch(appliedNumbers, status = 200) {
  const seen = [];
  const impl = async (url, init) => {
    seen.push({ url, init });
    if (status !== 200) return { ok: false, status, text: async () => 'nope ' + URL_ };
    const queries = JSON.parse(init.body).queries;
    const nums = Object.keys(PROBES).sort();
    return { ok: true, status: 200, json: async () => ({ results: queries.map((_, i) => ({ rows: [{ applied: appliedNumbers.includes(nums[i]) }] })) }) };
  };
  return { impl, seen };
}

{
  const all = Object.keys(PROBES);
  const { impl, seen } = fakeFetch(all.filter((n) => n !== '0006'));
  const applied = await runProbes(URL_, PROBES, impl);
  ok('one batched request', seen.length === 1);
  ok('request is read-only batch with the connection string in a header', seen[0].init.headers['Neon-Batch-Read-Only'] === 'true' && seen[0].init.headers['Neon-Connection-String'] === URL_);
  ok('password is not in the url or body', !seen[0].url.includes('s3cret') && !seen[0].init.body.includes('s3cret'));
  const rows = report(files, applied);
  ok('0006 reported missing', rows.find((r) => r.number === '0006').status === 'missing');
  ok('0007 reported applied', rows.find((r) => r.number === '0007').status === 'applied');
  ok('format has one line per file', format(rows).split('\n').length === files.length);
}
{
  ok('no connection: all unknown', report(files, null).every((r) => r.status === 'unknown'));
  const lines = [];
  const log = console.log; const err = console.error;
  console.log = (s) => lines.push(String(s)); console.error = (s) => lines.push(String(s));
  const none = await main([], {}, fakeFetch([]).impl);
  const list = await main(['--list'], {});
  const bad = await main([], { MIGRATIONS_DATABASE_URL: URL_ }, fakeFetch([], 500).impl);
  const miss = await main([], { MIGRATIONS_DATABASE_URL: URL_ }, fakeFetch(Object.keys(PROBES).filter((n) => n !== '0008')).impl);
  const good = await main(['--env', 'X'], { X: URL_ }, fakeFetch(Object.keys(PROBES)).impl);
  console.log = log; console.error = err;
  ok('no env var: exit 2', none === 2);
  ok('--list: exit 0', list === 0);
  ok('server error: exit 2 and no password printed', bad === 2 && !lines.join('\n').includes('s3cret'));
  ok('missing one: exit 1', miss === 1);
  ok('all applied: exit 0', good === 0);
}
ok('script holds no write verbs of its own', !/\b(insert into|update \w+ set|delete from)\b/i.test(readFileSync(new URL('../scripts/check-migrations.mjs', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//, '')));

process.exit(f ? 1 : 0);
