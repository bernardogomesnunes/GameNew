#!/usr/bin/env node
/**
 * Support lookup. Read-only. Given an email, a sign-in user id or a player id, prints
 * the sign-in record, chosen name, worlds with chunk counts, last save time and recent save_failures.
 *
 *   ADMIN_DATABASE_URL='postgresql://...' node scripts/admin-lookup.mjs someone@example.com
 *   node scripts/admin-lookup.mjs <uuid>            (sign-in user id or player id)
 *   --json                                          (machine-readable output)
 *   --env OTHER_VAR                                 (read another variable)
 *
 * Exit 0 found, 1 nobody matched, 2 could not look up. Needs a role that bypasses
 * row-level security (the project owner role does). Every statement is a single
 * select sent as a read-only batch (scripts/readonly-sql.mjs). The connection string is never printed.
 */
import { fileURLToPath } from 'node:url';
import { readonlyQueries, redact } from './readonly-sql.mjs';

export const USER_SQL = `select id::text as id, email, name, "emailVerified" as email_verified, "createdAt" as created_at
from neon_auth."user" where lower(email) = lower($1) or id::text = $1 limit 5`;
export const PLAYER_SQL = `select p.id::text as id, p.auth_user_id, p.display_name, p.created_at, p.last_seen_at
from players p
where p.id::text = $1 or p.auth_user_id = $1
   or p.auth_user_id in (select id::text from neon_auth."user" where lower(email) = lower($1))
limit 5`;
export const WORLDS_SQL = `select w.id::text as id, w.name, w.mode, w.block_count, w.revision, w.updated_at, w.deleted_at,
  (select count(*)::int from world_chunks c where c.world_id = w.id) as chunks,
  (select max(c.updated_at) from world_chunks c where c.world_id = w.id) as last_chunk_at
from worlds w where w.player_id::text = $1 order by w.updated_at desc limit 200`;
export const FAILURES_SQL = `select created_at, world_id::text as world_id, code, message
from save_failures where player_id::text = $1 order by created_at desc limit 10`;
export const NAME_SQL = `select name from player_names where auth_user_id = $1`;

export function parseArgs(argv, env) {
  const flags = new Set();
  let target; let envName = 'ADMIN_DATABASE_URL';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') envName = argv[++i];
    else if (argv[i] === '--json') flags.add('json');
    else if (!argv[i].startsWith('--') && target === undefined) target = argv[i].trim();
  }
  return { target, json: flags.has('json'), envName, url: env[envName] };
}

/** Looks up one target. Returns { users, players: [{ player, name, worlds, failures }] }. */
export async function lookup(url, target, fetchImpl) {
  const [users, players] = await readonlyQueries(url, [
    { query: USER_SQL, params: [target] },
    { query: PLAYER_SQL, params: [target] },
  ], fetchImpl);
  const out = [];
  for (const player of players) {
    const queries = [
      { query: WORLDS_SQL, params: [player.id] },
      { query: FAILURES_SQL, params: [player.id] },
    ];
    let name = null;
    const [worlds, failures] = await readonlyQueries(url, queries, fetchImpl);
    if (player.auth_user_id) {
      // Separate call: a database without migration 0010 has no player_names table.
      try { name = (await readonlyQueries(url, [{ query: NAME_SQL, params: [player.auth_user_id] }], fetchImpl))[0][0]?.name ?? null; } catch { name = null; }
    }
    out.push({ player, name, worlds, failures });
  }
  return { users, players: out };
}

const t = (v) => (v ? new Date(v).toISOString() : 'never');

export function format(result) {
  const lines = [];
  for (const u of result.users) lines.push(`sign-in user ${u.id}  ${u.email}  verified ${u.email_verified}  created ${t(u.created_at)}`);
  if (!result.users.length) lines.push('sign-in user: none matched');
  for (const { player, name, worlds, failures } of result.players) {
    const live = worlds.filter((w) => !w.deleted_at);
    const last = worlds.map((w) => w.updated_at).filter(Boolean).sort().pop();
    lines.push('', `player ${player.id}  auth user ${player.auth_user_id ?? '(none, device only)'}`);
    lines.push(`  chosen name: ${name ?? '(none chosen)'}   display name: ${player.display_name ?? '(none)'}`);
    lines.push(`  created ${t(player.created_at)}   last seen ${t(player.last_seen_at)}   last save ${t(last)}`);
    lines.push(`  worlds: ${live.length} live, ${worlds.length - live.length} deleted, ${worlds.reduce((s, w) => s + (w.chunks || 0), 0)} chunks`);
    for (const w of worlds) {
      lines.push(`    ${w.id}  ${w.deleted_at ? '[deleted] ' : ''}${w.name}  ${w.mode}  ${w.chunks} chunks  ${w.block_count} blocks  rev ${w.revision}  saved ${t(w.updated_at)}`);
    }
    lines.push(`  save failures (latest ${failures.length}, max 10):`);
    if (!failures.length) lines.push('    none');
    for (const x of failures) lines.push(`    ${t(x.created_at)}  world ${x.world_id ?? '-'}  ${x.code ?? '-'}  ${String(x.message ?? '').slice(0, 120)}`);
  }
  if (!result.players.length) lines.push('', 'player: none matched');
  return lines.join('\n');
}

export async function main(argv, env, fetchImpl = globalThis.fetch, out = console) {
  const { target, json, envName, url } = parseArgs(argv, env);
  if (!target) { out.error('Usage: node scripts/admin-lookup.mjs <email | user id | player id> [--json]'); return 2; }
  if (!url) { out.error(`Set ${envName} to a Neon connection string.`); return 2; }
  let result;
  try { result = await lookup(url, target, fetchImpl); } catch (err) {
    out.error(`Could not look up: ${redact(err.message, url)}`);
    return 2;
  }
  out.log(json ? JSON.stringify(result, null, 2) : format(result));
  return result.users.length || result.players.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main(process.argv.slice(2), process.env));
}
