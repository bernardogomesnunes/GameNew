-- Backstops on what one account can store, set far above any real world.
--
-- The game wants very large settlements, so these are not play limits. They
-- stop a runaway or hostile client writing gigabytes into one row. Measured
-- on the live data (2026-10-06): largest chunk 22,893 bytes, largest
-- `worlds.duilt` 6,773, largest `economy` 1,114, `progression.stats` 710.
-- Every limit below is at least 1,000x the largest value seen.
--
-- No cap on how many worlds an account has, and none on how many chunks a
-- world has: those are what a big build is made of.
--
-- Each constraint is added NOT VALID and then validated, so existing rows are
-- checked without a long lock. To undo one:
--   alter table <t> drop constraint <name>;

-- A chunk is 16x16x200 cells. At 3 bytes a run the most it can encode is
-- 153,600 bytes, so this limit can never reject a real chunk.
alter table world_chunks
  add constraint world_chunks_rle_size check (octet_length(rle) <= 262144) not valid;
alter table world_chunks validate constraint world_chunks_rle_size;

-- JSON columns, measured as text (pg_column_size sees the compressed size).
alter table worlds
  add constraint worlds_duilt_size check (duilt is null or octet_length(duilt::text) <= 33554432) not valid,
  add constraint worlds_economy_size check (octet_length(economy::text) <= 8388608) not valid,
  add constraint worlds_spawn_size check (spawn is null or octet_length(spawn::text) <= 65536) not valid,
  add constraint worlds_world_gen_size check (world_gen is null or octet_length(world_gen::text) <= 65536) not valid,
  add constraint worlds_name_size check (char_length(name) <= 200) not valid;
alter table worlds
  validate constraint worlds_duilt_size,
  validate constraint worlds_economy_size,
  validate constraint worlds_spawn_size,
  validate constraint worlds_world_gen_size,
  validate constraint worlds_name_size;

alter table progression
  add constraint progression_stats_size check (octet_length(stats::text) <= 8388608) not valid,
  add constraint progression_achievements_size check (octet_length(achievements::text) <= 1048576) not valid;
alter table progression
  validate constraint progression_stats_size,
  validate constraint progression_achievements_size;

alter table templates
  add constraint templates_blocks_size check (octet_length(blocks::text) <= 33554432) not valid,
  add constraint templates_name_size check (char_length(name) <= 200) not valid;
alter table templates
  validate constraint templates_blocks_size,
  validate constraint templates_name_size;

alter table save_failures
  add constraint save_failures_code_size check (code is null or char_length(code) <= 200) not valid,
  add constraint save_failures_message_size check (message is null or char_length(message) <= 4000) not valid;
alter table save_failures
  validate constraint save_failures_code_size,
  validate constraint save_failures_message_size;
