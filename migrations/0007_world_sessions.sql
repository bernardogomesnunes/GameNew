-- One open session per world (owner, 9 November: "We can deal with opening the
-- world at the same time gracefully, by telling the user if another session is
-- open, if the user wants to proceed we will close that another session.")
--
-- A row says which browser tab has the world open and when it last said so.
-- Opening a world reads it: a row seen in the last 75 seconds from another
-- tab means the world is open elsewhere, and the player chooses whether to
-- take it over. Taking it over writes this tab's id; the other tab's next
-- heartbeat finds its id gone and closes itself without saving. Additive and
-- safe on a live database: nothing else reads or writes this table, and a
-- client that cannot find it carries on as before.
create table world_sessions (
  world_id uuid primary key references worlds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 80),
  device text check (char_length(device) <= 120),
  seen_at timestamptz not null default now()
);

alter table world_sessions enable row level security;

create policy world_sessions_owner_select on world_sessions for select using (player_id = current_player_id());
create policy world_sessions_owner_insert on world_sessions for insert with check (player_id = current_player_id());
create policy world_sessions_owner_update on world_sessions for update
  using (player_id = current_player_id())
  with check (player_id = current_player_id());
create policy world_sessions_owner_delete on world_sessions for delete using (player_id = current_player_id());

grant select, insert, update, delete on world_sessions to authenticated;
