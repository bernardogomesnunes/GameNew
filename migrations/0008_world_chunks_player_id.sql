-- TECH-14. Not applied to production yet. Tested on a copy of production
-- (Neon branch db-additive-test) on 23 November 2026.
--
-- Problem: every row-level-security check on world_chunks runs a subquery
-- against worlds ("does this chunk's world belong to me?"). One subquery per
-- chunk row is cheap at 1,000 chunks and slow at millions.
--
-- Fix, additive only: world_chunks gets its own player_id, filled from the
-- owning world, with an index and a second, cheaper select policy. Nothing
-- existing changes:
--   - the old policies stay exactly as they are, so an old build keeps
--     reading and writing chunks the way it does now;
--   - player_id is nullable, so an insert that does not send it still works;
--   - a trigger fills it on every insert and update, so an old build never
--     has to know the column exists. The client cannot choose its value: the
--     trigger always overwrites it with the owning world's player_id.
--
-- Safe in any order: column, trigger, backfill, index, policy. Rows written
-- between the column and the backfill get their value from the trigger. The
-- backfill is one UPDATE; production holds about 1,000 chunks today. For a
-- table of millions, run the backfill in batches before creating the index.

alter table world_chunks add column if not exists player_id uuid;

-- Runs as the caller, so it sees only worlds the caller owns. A chunk for a
-- world the caller does not own gets a null player_id here and is then
-- refused by the existing insert/update policy, as before.
create or replace function world_chunks_fill_player_id() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  new.player_id := (select w.player_id from worlds w where w.id = new.world_id);
  return new;
end
$$;

drop trigger if exists world_chunks_fill_player_id on world_chunks;
create trigger world_chunks_fill_player_id
  before insert or update on world_chunks
  for each row execute function world_chunks_fill_player_id();

update world_chunks c
   set player_id = w.player_id
  from worlds w
 where w.id = c.world_id and c.player_id is distinct from w.player_id;

-- Deleting or exporting everything one player owns reads by player_id first.
create index if not exists world_chunks_player_idx on world_chunks (player_id, world_id);

-- A second permissive select policy: policies are OR-ed, so this only adds
-- a way to pass. `(select ...)` makes Postgres evaluate current_player_id()
-- once per query instead of once per row. The old subquery policy stays, so
-- nothing that passed before can fail now. Dropping the old select policy is
-- a later, separate migration, after every row is known to be filled.
drop policy if exists chunks_owner_select_by_player on world_chunks;
create policy chunks_owner_select_by_player on world_chunks for select
  using (player_id = (select current_player_id()));
