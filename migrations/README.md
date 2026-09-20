# Database migrations

The live schema (Neon project `wispy-hat-39858552`, database `neondb`) used to
exist only in the database itself, changed by hand whenever something needed
it. Nothing in this repository recorded what those changes were, so the app
code and the database's actual rules could — and did — drift apart with
nothing to catch it. `worlds.size_x`/`worlds.size_z` being `NOT NULL` and
`worlds.mode` only allowing `'creative'` and `'campaign'` both went unnoticed
this way: nobody could see the constraint next to the code that violated it,
because only one of the two lived in git.

From here on, **every schema change is a new numbered file in this folder**,
applied deliberately — never a one-off `ALTER TABLE` typed straight at the
database. The number order is the history; each file says what it does and
why.

## Applying a migration

There is no runner script — the project is small enough that running the SQL
by hand (via the Neon SQL editor, `psql`, or the Neon MCP tools) and then
committing the file that describes what you ran is the whole process. What
matters is the ordering rule:

1. Write the migration file first, in this folder, numbered one higher than
   the last one.
2. Run it against the database.
3. Commit the file in the same change as any app code that depends on it.

A migration file is a historical record once it has run — never edit one
after it has been applied to the live database. If a change was wrong, write
a new migration that corrects it.

## Files

- `0001_baseline.sql` — documents the schema as it already existed before
  this folder existed. **Do not run this against the live database** — it
  already has this schema; running it will fail on "already exists." It
  exists so the repo has one coherent starting point, and so a fresh
  database (a new environment, a local test database) can be built from
  scratch by running every file in order.
- `0002_worlds_allow_duilt_mode.sql` — already applied. Widens
  `worlds_mode_check` to allow `'duilt'`, the mode every Duilt-mode world
  actually saves under and the one value the original check constraint never
  allowed.
- `0003_worlds_duilt_worldgen_columns.sql` — already applied. Gives the
  Duilt game state and an endless world's seed their own columns instead of
  both being nested inside the `economy` JSONB column, which is how the
  `duilt` field went missing from the wire format in the first place — it
  was one more level of nesting for a mistake to hide in.
- `0004_save_failures.sql` — already applied. A small table that failed
  saves are best-effort logged to, so a broken save is visible by querying
  the database instead of only by a player noticing and reporting it.

## `db/schema.mjs`

Alongside the migrations, `db/schema.mjs` restates the specific constraints
the app's own code needs to honor (allowed `mode` values, which columns are
required). `tests/schema-contract.test.mjs` checks that file against this
folder's SQL text, so an app change that assumes a value this folder's
migrations don't actually allow fails a test — offline, before it ever
reaches a player — instead of failing in production the way the mode and
size bugs did.
