-- Baseline: documents the schema as it already existed when migrations
-- started being tracked in git (see migrations/README.md). Do NOT run this
-- against the live database — it already has this schema, and every
-- CREATE below will fail with "already exists". It exists so a fresh
-- database can be built from scratch by running every file in this folder
-- in order, and so the history has a real starting point instead of a gap.

create extension if not exists pgcrypto;

-- players -------------------------------------------------------------------

create table players (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  auth_user_id text unique,
  display_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index players_auth_user_id_idx on players (auth_user_id) where auth_user_id is not null;

alter table players enable row level security;

create policy players_self_select on players for select
  using (auth_user_id = auth.user_id());
create policy players_self_insert on players for insert
  with check (auth_user_id = auth.user_id());
create policy players_self_update on players for update
  using (auth_user_id = auth.user_id())
  with check (auth_user_id = auth.user_id());
create policy players_self_delete on players for delete
  using (auth_user_id = auth.user_id());

-- Every other table's row-level security is keyed off this rather than
-- repeating the players lookup in every policy.
create function current_player_id() returns uuid
  language sql stable
  as $$ select id from players where auth_user_id = auth.user_id() limit 1 $$;

-- worlds ----------------------------------------------------------------

create table worlds (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  name text not null,
  mode text not null check (mode = any (array['creative', 'campaign'])),
  size_x integer not null,
  size_z integer not null,
  height integer not null,
  spawn jsonb,
  economy jsonb not null default '{}'::jsonb,
  block_count integer not null default 0,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index worlds_player_idx on worlds (player_id, updated_at desc) where deleted_at is null;

alter table worlds enable row level security;

create policy worlds_owner_select on worlds for select using (player_id = current_player_id());
create policy worlds_owner_insert on worlds for insert with check (player_id = current_player_id());
create policy worlds_owner_update on worlds for update
  using (player_id = current_player_id())
  with check (player_id = current_player_id());
create policy worlds_owner_delete on worlds for delete using (player_id = current_player_id());

-- world_chunks ------------------------------------------------------------

create table world_chunks (
  world_id uuid not null references worlds(id) on delete cascade,
  cx integer not null,
  cz integer not null,
  rle bytea not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (world_id, cx, cz)
);

alter table world_chunks enable row level security;

create policy chunks_owner_select on world_chunks for select
  using (exists (select 1 from worlds w where w.id = world_chunks.world_id and w.player_id = current_player_id()));
create policy chunks_owner_insert on world_chunks for insert
  with check (exists (select 1 from worlds w where w.id = world_chunks.world_id and w.player_id = current_player_id()));
create policy chunks_owner_update on world_chunks for update
  using (exists (select 1 from worlds w where w.id = world_chunks.world_id and w.player_id = current_player_id()))
  with check (exists (select 1 from worlds w where w.id = world_chunks.world_id and w.player_id = current_player_id()));
create policy chunks_owner_delete on world_chunks for delete
  using (exists (select 1 from worlds w where w.id = world_chunks.world_id and w.player_id = current_player_id()));

-- progression ---------------------------------------------------------------
-- One row per player, not per world — XP, levels and streaks belong to the
-- account.

create table progression (
  player_id uuid primary key references players(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  streak_count integer not null default 0,
  last_play_date date,
  achievements jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table progression enable row level security;

create policy progression_owner_all on progression for all
  using (player_id = current_player_id())
  with check (player_id = current_player_id());

-- templates -------------------------------------------------------------

create table templates (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  name text not null,
  size integer not null check (size = any (array[2, 4, 8, 16])),
  block_count integer not null,
  distinct_types integer not null,
  height integer not null,
  blocks jsonb not null,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_player_idx on templates (player_id, updated_at desc);

alter table templates enable row level security;

create policy templates_owner_all on templates for all
  using (player_id = current_player_id())
  with check (player_id = current_player_id());
