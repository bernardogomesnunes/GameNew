/**
 * Keeps db/schema.mjs honest against the migration that actually defines
 * each constraint. This is the test that would have failed the day `'duilt'`
 * was added as a mode without anyone widening `worlds_mode_check` — a
 * mismatch here means the app and the database disagree about what's
 * allowed, which is exactly the shape of bug that shipped three times
 * before this file existed.
 *
 * It reads migration SQL as text rather than running it: the point is to
 * catch the two sides of the contract drifting apart with no network and no
 * database, in the same run as every other test.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { WORLDS_MODE_VALUES, WORLDS_NOT_NULL } from '../db/schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = (name) => readFileSync(join(here, '..', 'migrations', name), 'utf8');

await test('WORLDS_MODE_VALUES matches the values 0002 actually allows', () => {
  const sql = migrations('0002_worlds_allow_duilt_mode.sql');
  const match = sql.match(/mode = any \(array\[([^\]]+)\]\)/i);
  assert.ok(match, 'expected an `mode = any (array[...])` check in 0002');
  const allowed = match[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(
    [...WORLDS_MODE_VALUES].sort(),
    [...allowed].sort(),
    'db/schema.mjs WORLDS_MODE_VALUES must list exactly what the live constraint allows',
  );
});

await test('WORLDS_NOT_NULL columns are all declared "not null" in the baseline', () => {
  const sql = migrations('0001_baseline.sql');
  const worldsTable = sql.match(/create table worlds \(([\s\S]*?)\n\);/)[1];
  for (const column of WORLDS_NOT_NULL) {
    const line = worldsTable.split('\n').find((l) => l.trim().startsWith(column + ' '));
    assert.ok(line, `column "${column}" not found in the worlds table definition`);
    assert.match(line, /not null/i, `db/schema.mjs claims "${column}" is required, but 0001_baseline.sql does not mark it not null`);
  }
});

await test('every WORLDS_MODE_VALUES entry is a plain lowercase word', () => {
  // Guards against a typo turning into a silently-permissive check — this
  // module is the one place a mode string gets to mean "allowed."
  for (const mode of WORLDS_MODE_VALUES) assert.match(mode, /^[a-z]+$/);
});
