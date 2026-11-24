// ACCT-12: the save_failures alert check is read-only, redacts the connection string, and fails over the threshold.
import { readFileSync } from 'node:fs';
import { main, parseThreshold, SUMMARY_SQL, BY_CODE_SQL } from '../scripts/check-save-failures.mjs';
import { assertSelect, readonlyQueries } from '../scripts/readonly-sql.mjs';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const URL_ = 'postgresql://owner:s3cret@ep-x-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
function fake(total, players = 3, status = 200) {
  const seen = [];
  const impl = async (url, init) => {
    seen.push({ url, init });
    if (status !== 200) return { ok: false, status, text: async () => 'bad ' + URL_ };
    return { ok: true, status: 200, json: async () => ({ results: [{ rows: [{ total, players, latest: '2026-11-24T01:00:00Z' }] }, { rows: [{ code: '409', n: total }] }] }) };
  };
  return { impl, seen };
}
function sink() { const l = []; return { log: (s) => l.push(s), error: (s) => l.push(s), l }; }

ok('both queries are single selects', (assertSelect(SUMMARY_SQL), assertSelect(BY_CODE_SQL), true));
ok('queries read save_failures over 24 hours', /save_failures/.test(SUMMARY_SQL) && /24 hours/.test(SUMMARY_SQL));
let bad = 0;
for (const q of ['delete from players', 'select 1; drop table players', 'update x set a=1', 'with a as (delete from players returning 1) select * from a']) {
  try { assertSelect(q); } catch { bad++; }
}
ok('writes and multi-statements are refused', bad === 4);

ok('threshold defaults to 10', parseThreshold(undefined) === 10 && parseThreshold('abc') === 10 && parseThreshold('-1') === 10);
ok('threshold reads a number', parseThreshold('25') === 25 && parseThreshold('0') === 0);

{
  const { impl, seen } = fake(2);
  const o = sink();
  const code = await main([], { ALERTS_DATABASE_URL: URL_ }, impl, o);
  ok('under threshold exits 0', code === 0 && o.l.some((x) => x === 'OK'));
  ok('one read-only batch with two queries', seen.length === 1 && seen[0].init.headers['Neon-Batch-Read-Only'] === 'true' && JSON.parse(seen[0].init.body).queries.length === 2);
  ok('password not in url or body', !seen[0].url.includes('s3cret') && !seen[0].init.body.includes('s3cret'));
}
{
  const o = sink();
  const code = await main([], { ALERTS_DATABASE_URL: URL_, SAVE_FAILURE_THRESHOLD: '5' }, fake(6).impl, o);
  ok('over threshold exits 1 with ALERT', code === 1 && o.l.some((x) => /ALERT: 6 save failures/.test(x)));
}
{
  const o = sink();
  const code = await main([], { ALERTS_DATABASE_URL: URL_, SAVE_FAILURE_THRESHOLD: '5', GITHUB_ACTIONS: 'true' }, fake(6).impl, o);
  ok('GitHub annotation when run in Actions', code === 1 && o.l.some((x) => x.startsWith('::error title=Save failures::')));
}
{
  const o = sink();
  ok('exactly at threshold passes', (await main([], { ALERTS_DATABASE_URL: URL_, SAVE_FAILURE_THRESHOLD: '6' }, fake(6).impl, o)) === 0);
}
{
  const o = sink();
  const code = await main([], {}, fake(0).impl, o);
  ok('missing connection string exits 2', code === 2);
}
{
  const o = sink();
  const code = await main([], { ALERTS_DATABASE_URL: URL_ }, fake(0, 0, 500).impl, o);
  ok('database error exits 2 and hides the connection string', code === 2 && !o.l.join('\n').includes('s3cret') && !o.l.join('\n').includes(URL_));
}
{
  const o = sink();
  const throwing = async () => { throw new Error('boom ' + URL_); };
  const code = await main([], { ALERTS_DATABASE_URL: URL_ }, throwing, o);
  ok('network error exits 2 and hides the connection string', code === 2 && !o.l.join('\n').includes('s3cret'));
}
let refused = false;
try { await readonlyQueries(URL_, [{ query: 'delete from save_failures' }], async () => ({})); } catch { refused = true; }
ok('readonlyQueries refuses a delete before any request', refused);

const wf = readFileSync(new URL('../.github/workflows/save-failure-alert.yml', import.meta.url), 'utf8');
ok('workflow is scheduled and manual', /schedule:/.test(wf) && /workflow_dispatch:/.test(wf));
ok('workflow reads the secret, holds none', /secrets\.ALERTS_DATABASE_URL/.test(wf) && !/postgres(ql)?:\/\//.test(wf));
ok('workflow has read-only permissions', /contents: read/.test(wf));
process.exit(f ? 1 : 0);
