-- Size and count limits on what one account can store.
--
-- Until now nothing bounded a row: `world_chunks.rle` is bytea and the jsonb
-- columns are free-form, so one signed-in account could write unlimited data.
-- Limits were chosen from the live data (read 2026-10-06): largest chunk
-- 22,893 bytes, largest `worlds.duilt` 6,773, largest `economy` 1,114,
-- `progression.stats` 710, at most 6 worlds per player and 169 chunks per
-- world. Every limit below is at least 10x the largest value seen, and the
-- chunk limit clears the worst case a chunk can encode (16x16x200 cells at
-- 3 bytes a run is 153,600 bytes).
--
-- Each constraint is added NOT VALID and then validated, so existing rows are
-- checked without holding a long lock. To undo one:
--   alter table <t> drop constraint <name>;

-- Chunk bytes ---------------------------------------------------------------

alter table world_chunks
  add constraint world_chunks_rle_size check (octet_length(rle) <= 262144) not valid;
alter table world_chunks validate constraint world_chunks_rle_size;

-- JSON columns (measured as text, since pg_column_size sees compressed bytes) -

alter table worlds
  add constraint worlds_duilt_size check (duilt is null or octet_length(duilt::text) <= 524288) not valid,
  add constraint worlds_economy_size check (octet_length(economy::text) <= 65536) not valid,
  add constraint worlds_spawn_size check (spawn is null or octet_length(spawn::text) <= 4096) not valid,
  add constraint worlds_world_gen_size check (world_gen is null or octet_length(world_gen::text) <= 4096) not valid,
  add constraint worlds_name_size check (char_length(name) <= 100) not valid;
alter table worlds
  validate constraint worlds_duilt_size,
  validate constraint worlds_economy_size,
  validate constraint worlds_spawn_size,
  validate constraint worlds_world_gen_size,
  validate constraint worlds_name_size;

alter table progression
  add constraint progression_stats_size check (octet_length(stats::text) <= 262144) not valid,
  add constraint progression_achievements_size check (octet_length(achievements::text) <= 65536) not valid;
alter table progression
  validate constraint progression_stats_size,
  validate constraint progression_achievements_size;

alter table templates
  add constraint templates_blocks_size check (octet_length(blocks::text) <= 2097152) not valid,
  add constraint templates_name_size check (char_length(name) <= 100) not valid;
alter table templates
  validate constraint templates_blocks_size,
  validate constraint templates_name_size;

alter table save_failures
  add constraint save_failures_code_size check (code is null or char_length(code) <= 100) not valid,
  add constraint save_failures_message_size check (message is null or char_length(message) <= 2000) not valid;
alter table save_failures
  validate constraint save_failures_code_size,
  validate constraint save_failures_message_size;

-- Worlds per player ----------------------------------------------------------
-- A trigger rather than an insert policy: the game saves with
-- `POST ... on_conflict=id` (merge-duplicates), and Postgres checks insert
-- policies before it looks for the conflict, so a policy would block a player
-- at the cap from saving a world they already own. The trigger lets any row
-- whose id already exists through, and only counts new worlds.
-- Deleted worlds (deleted_at set) do not count.

create function worlds_enforce_cap() returns trigger
  language plpgsql
  as $$
begin
  if exists (select 1 from worlds where id = new.id) then
    return new;
  end if;
  if (select count(*) from worlds
        where player_id = new.player_id and deleted_at is null) >= 30 then
    raise exception 'World limit reached (30 per account)'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger worlds_cap before insert on worlds
  for each row execute function worlds_enforce_cap();
