/**
 * The app's own assumptions about the live database schema, written down as
 * data instead of scattered across NeonTransport and a hand-rolled test
 * fake that both used to guess independently — which is how `worlds.mode`
 * drifted from what the database actually allowed without anything noticing
 * until a player's save failed. `tests/schema-contract.test.mjs` checks
 * this file against migrations/ mechanically, so that specific drift can't
 * happen silently again.
 *
 * This does not change the database and does not read it live — it exists
 * for code that cannot reach Postgres at all (the test suite runs with no
 * network). migrations/ is still the one place a schema change actually
 * happens; this is that change's mirror for code that has to agree with it.
 */

// migrations/0002_worlds_allow_duilt_mode.sql
export const WORLDS_MODE_VALUES = ['creative', 'campaign', 'duilt'];

// migrations/0001_baseline.sql — columns with no default, so a write that
// omits one is rejected rather than silently stored as null.
export const WORLDS_NOT_NULL = ['name', 'mode', 'size_x', 'size_z', 'height'];

// migrations/0003_worlds_duilt_worldgen_columns.sql
export const WORLDS_NULLABLE_JSON_COLUMNS = ['spawn', 'duilt', 'world_gen'];
