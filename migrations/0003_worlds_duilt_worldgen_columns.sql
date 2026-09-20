-- Already applied against the live database. Table was empty (0 rows) at
-- the time, so this is a pure additive change with nothing to backfill.
--
-- The Duilt game state (bag, buildings, skills, age) and an endless world's
-- seed used to both be nested inside the `economy` JSONB column as
-- `{economy, duilt, worldGen}`, because adding real columns would have meant
-- a migration and there was no process for one. That trick worked, but it
-- is exactly how `duilt` went missing from the wire format in the first
-- place: NeonTransport computed it, forgot to nest it into the one column
-- that carried it, and nothing about the shape made that omission visible.
-- One field per column is the boring, safer default; this un-nests them.

alter table worlds add column duilt jsonb;
alter table worlds add column world_gen jsonb;
