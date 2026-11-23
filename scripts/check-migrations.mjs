#!/usr/bin/env node
/**
 * Lists the files in migrations/ and says which ones the live database is
 * missing. Read-only: every query is a single SELECT, sent to Neon's SQL over
 * HTTP endpoint with the read-only batch header. No driver, no dependency.
 *
 *   MIGRATIONS_DATABASE_URL='postgresql://...' node scripts/check-migrations.mjs
 *   node scripts/check-migrations.mjs --env OTHER_VAR   (read another variable)
 *   node scripts/check-migrations.mjs --list            (files only, no connection)
 *
 * Exit code: 0 all applied (or --list), 1 at least one missing, 2 could not check.
 * 0006 is held back on purpose until its review is done (migrations/atomic-saves.md),
 * so a missing 0006 is reported as "missing" like any other, and is the owner's call.
 * The connection string is never printed.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROBES } from '../db/migration-probes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function listMigrations(dir = join(root, 'migrations')) {
  return readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
}

/** Where the SQL-over-HTTP endpoint for a connection string lives. The password never leaves the header. */
export function sqlEndpoint(connectionString) {
  return `https://${new URL(connectionString).hostname}/sql`;
}

/** Runs every probe in one read-only batch. Returns { '0001': true, ... }. */
export async function runProbes(connectionString, probes = PROBES, fetchImpl = globalThis.fetch) {
  const numbers = Object.keys(probes).sort();
  const res = await fetchImpl(sqlEndpoint(connectionString), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': connectionString,
      'Neon-Batch-Read-Only': 'true',
    },
    body: JSON.stringify({ queries: numbers.map((n) => ({ query: probes[n], params: [] })) }),
  });
  if (!res.ok) throw new Error(`The database answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const results = body.results ?? [];
  if (results.length !== numbers.length) throw new Error('The database answered with the wrong number of results.');
  const out = {};
  numbers.forEach((n, i) => {
    const v = results[i]?.rows?.[0]?.applied;
    out[n] = v === true || v === 't' || v === 'true';
  });
  return out;
}

/** Joins files with probe results. status: applied | missing | unknown (no probe, or not checked). */
export function report(files, applied) {
  return files.map((file) => {
    const number = file.slice(0, 4);
    const status = !(number in PROBES) || !applied ? 'unknown' : applied[number] ? 'applied' : 'missing';
    return { file, number, status };
  });
}

export function format(rows) {
  const w = Math.max(...rows.map((r) => r.file.length));
  return rows.map((r) => `${r.status.padEnd(8)} ${r.file.padEnd(w)}`).join('\n');
}

export async function main(argv, env, fetchImpl = globalThis.fetch) {
  const files = listMigrations();
  if (argv.includes('--list')) {
    console.log(format(report(files, null)));
    return 0;
  }
  const i = argv.indexOf('--env');
  const name = i >= 0 ? argv[i + 1] : 'MIGRATIONS_DATABASE_URL';
  const url = env[name];
  if (!url) {
    console.error(`Set ${name} to a Neon connection string, or use --list to see the files only.`);
    console.log(format(report(files, null)));
    return 2;
  }
  let applied;
  try { applied = await runProbes(url, PROBES, fetchImpl); } catch (err) {
    console.error(`Could not check: ${String(err.message).replaceAll(url, '[connection string]')}`);
    return 2;
  }
  const rows = report(files, applied);
  console.log(format(rows));
  const missing = rows.filter((r) => r.status === 'missing');
  console.log(`\n${rows.length} files, ${rows.filter((r) => r.status === 'applied').length} applied, ${missing.length} missing${missing.length ? `: ${missing.map((r) => r.number).join(', ')}` : ''}`);
  return missing.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main(process.argv.slice(2), process.env));
}
