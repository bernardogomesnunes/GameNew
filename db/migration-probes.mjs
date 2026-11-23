/**
 * One read-only question per migration file: "has this one been applied?"
 *
 * The database keeps no list of applied migrations (the folder has no runner,
 * see migrations/README.md), so each migration is recognised by something it
 * leaves behind. Each probe is a single SELECT that returns one boolean column
 * named `applied`. scripts/check-migrations.mjs runs them; the keys are the
 * migration file's four-digit number.
 * tests/migration-check.test.mjs fails if a migration file has no probe, so
 * adding a migration means adding its probe here in the same change.
 */
const has = {
  table: (t) => `to_regclass('public.${t}') is not null`,
  column: (t, c) => `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = '${t}' and column_name = '${c}')`,
  constraint: (name) => `exists (select 1 from pg_constraint where conname = '${name}')`,
  fn: (name) => `exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = '${name}')`,
  policy: (t, p) => `exists (select 1 from pg_policies where schemaname = 'public' and tablename = '${t}' and policyname = '${p}')`,
};

export const PROBES = {
  '0001': `select (${['players', 'worlds', 'world_chunks', 'progression', 'templates'].map(has.table).join(' and ')}) as applied`,
  '0002': `select exists (select 1 from pg_constraint where conname = 'worlds_mode_check' and pg_get_constraintdef(oid) like '%duilt%') as applied`,
  '0003': `select (${has.column('worlds', 'duilt')} and ${has.column('worlds', 'world_gen')}) as applied`,
  '0004': `select ${has.table('save_failures')} as applied`,
  '0005': `select ${has.constraint('world_chunks_rle_size')} as applied`,
  '0006': `select (${has.table('world_save_sessions')} and ${has.fn('begin_world_save')}) as applied`,
  '0007': `select ${has.table('world_sessions')} as applied`,
  '0008': `select (${has.column('world_chunks', 'player_id')} and ${has.policy('world_chunks', 'chunks_owner_select_by_player')}) as applied`,
};
