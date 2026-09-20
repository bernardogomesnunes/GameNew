-- Already applied against the live database.
--
-- Until now the only way a broken save became visible was a player noticing
-- and sending a screenshot. This is a small, best-effort log: the client
-- records a failed push here (after retries are exhausted) so what is
-- actually failing, and for whom, is one query away instead of a photo from
-- a phone. It is not a source of truth for anything — writing to it is
-- itself allowed to fail silently, since the retry that already happened
-- matters far more than the record that it needed to.

create table save_failures (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  world_id uuid,
  code text,
  message text,
  created_at timestamptz not null default now()
);

create index save_failures_player_idx on save_failures (player_id, created_at desc);

alter table save_failures enable row level security;

-- Insert-and-forget from the client, and readable only by the player it is
-- about — nobody else's failures are any business of a browser tab that
-- isn't theirs. Nothing ever needs to update or delete a row here.
create policy save_failures_owner_insert on save_failures for insert
  with check (player_id = current_player_id());
create policy save_failures_owner_select on save_failures for select
  using (player_id = current_player_id());
