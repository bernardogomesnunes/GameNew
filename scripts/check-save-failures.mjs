#!/usr/bin/env node
/**
 * Alert check: counts save_failures rows from the last 24 hours. Read-only.
 *
 *   ALERTS_DATABASE_URL='postgresql://...' node scripts/check-save-failures.mjs
 *   SAVE_FAILURE_THRESHOLD=10   rows in 24 h that count as an alert (default 10)
 *   --env OTHER_VAR             read the connection string from another variable
 *
 * Exit 0 at or under the threshold, 1 over it, 2 could not check.
 * The role in the connection string must be able to read save_failures across players
 * (row-level security hides other players' rows from ordinary roles).
 */
import { fileURLToPath } from 'node:url';
import { readonlyQueries, redact } from './readonly-sql.mjs';

export const SUMMARY_SQL = `select count(*)::int as total, count(distinct player_id)::int as players, max(created_at) as latest
from save_failures where created_at > now() - interval '24 hours'`;
export const BY_CODE_SQL = `select coalesce(code, '(none)') as code, count(*)::int as n
from save_failures where created_at > now() - interval '24 hours'
group by 1 order by n desc limit 5`;

export function parseThreshold(value) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(n) && n >= 0 ? n : 10;
}

export async function main(argv, env, fetchImpl = globalThis.fetch, out = console) {
  const i = argv.indexOf('--env');
  const name = i >= 0 ? argv[i + 1] : 'ALERTS_DATABASE_URL';
  const url = env[name];
  if (!url) { out.error(`Set ${name} to a Neon connection string.`); return 2; }
  const threshold = parseThreshold(env.SAVE_FAILURE_THRESHOLD);
  let summary, codes;
  try {
    [summary, codes] = await readonlyQueries(url, [{ query: SUMMARY_SQL }, { query: BY_CODE_SQL }], fetchImpl);
  } catch (err) {
    out.error(`Could not check: ${redact(err.message, url)}`);
    return 2;
  }
  const row = summary[0] ?? {};
  const total = Number(row.total ?? 0);
  const players = Number(row.players ?? 0);
  out.log(`save_failures, last 24 hours: ${total} rows, ${players} players, latest ${row.latest ?? 'none'}. Threshold ${threshold}.`);
  for (const c of codes) out.log(`  code ${c.code}: ${c.n}`);
  if (total > threshold) {
    const msg = `ALERT: ${total} save failures from ${players} players in 24 hours (threshold ${threshold}).`;
    out.error(env.GITHUB_ACTIONS ? `::error title=Save failures::${msg}` : msg);
    return 1;
  }
  out.log('OK');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main(process.argv.slice(2), process.env));
}
