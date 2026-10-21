-- REVIEW ONLY: not applied. Requires 0001..0004 and the live 0005 size limits.
-- Coordinate this migration with the atomic-saves client deployment. Old clients
-- lose direct world/chunk write access deliberately; reads remain compatible.
-- Apply as the table owner. The Data API role must be `authenticated`, without
-- table ownership/BYPASSRLS. Read atomic-saves.md before approving deployment.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated' and not rolbypassrls and not rolsuper) then
    raise exception 'Review the Data API role before applying atomic saves';
  end if;
  if exists (select 1 from pg_class c join pg_roles r on r.oid = c.relowner
    where c.oid in ('public.worlds'::regclass, 'public.world_chunks'::regclass)
      and (r.rolname = 'authenticated' or c.relforcerowsecurity)) then
    raise exception 'Atomic RPCs require owner-exempt RLS and a non-owner API role';
  end if;
end $$;

create table public.world_save_sessions (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  world_id uuid not null,
  expected_revision bigint not null check (expected_revision >= 0),
  expected_chunks integer not null check (expected_chunks between 0 and 16384),
  metadata jsonb not null check (octet_length(metadata::text) <= 8388608),
  committed_revision bigint,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 minutes')
);
create index world_save_sessions_player_idx on public.world_save_sessions(player_id, created_at);
create table public.world_save_chunks (
  save_id uuid not null references public.world_save_sessions(id) on delete cascade,
  cx integer not null check (cx between -1048575 and 1048575),
  cz integer not null check (cz between -1048575 and 1048575),
  rle bytea not null check (octet_length(rle) between 3 and 1048576),
  primary key (save_id, cx, cz)
);
create table public.player_write_budgets (
  -- Keep the quota across deleting/recreating a player row for the same JWT
  -- identity. Owner maintenance may purge old identities after retention.
  auth_user_id text primary key,
  tokens double precision not null,
  refilled_at timestamptz not null
);
-- No client policies: staging and budgets are accessible only through the RPCs.
alter table public.world_save_sessions enable row level security;
alter table public.world_save_chunks enable row level security;
alter table public.player_write_budgets enable row level security;
revoke all on public.world_save_sessions, public.world_save_chunks, public.player_write_budgets from public, authenticated;

create function public.consume_player_write() returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  who uuid;
  credit double precision;
  last_at timestamptz;
  stamp timestamptz := clock_timestamp();
begin
  select id into who from public.players where auth_user_id = auth.user_id() limit 1;
  if who is null then raise sqlstate 'PT401' using message = 'Sign in to save worlds'; end if;
  insert into public.player_write_budgets values (auth.user_id(), 40, stamp) on conflict do nothing;
  select tokens, refilled_at into credit, last_at from public.player_write_budgets where auth_user_id = auth.user_id() for update;
  stamp := clock_timestamp();
  credit := least(40, credit + greatest(0, extract(epoch from (stamp - last_at))) * 4);
  if credit < 1 then raise sqlstate 'PT429' using message = 'Save write rate exceeded; retry shortly'; end if;
  update public.player_write_budgets set tokens = credit - 1, refilled_at = stamp where auth_user_id = auth.user_id();
  return who;
end $$;

create function public.valid_saved_rle(bytes bytea, height integer) returns boolean
language plpgsql immutable strict set search_path = pg_catalog as $$
declare
  pos integer := 0;
  stride integer := 3;
  total bigint := 0;
  block_id integer;
  run integer;
  len integer := octet_length(bytes);
begin
  if height not between 1 and 512 or len < 3 then return false; end if;
  if get_byte(bytes, 0) = 255 and get_byte(bytes, 1) = 2 then pos := 2; stride := 4; end if;
  if (len - pos) % stride <> 0 then return false; end if;
  while pos < len loop
    block_id := get_byte(bytes, pos);
    if stride = 4 then block_id := block_id + 256 * get_byte(bytes, pos + 1); end if;
    run := get_byte(bytes, pos + stride - 2) + 256 * get_byte(bytes, pos + stride - 1);
    if block_id >= 4096 or run = 0 then return false; end if;
    total := total + run;
    if total > 256 * height then return false; end if;
    pos := pos + stride;
  end loop;
  return total = 256 * height;
end $$;

create function public.begin_world_save(p_save_id uuid, p_world_id uuid, p_expected_revision bigint, p_expected_chunks integer, p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  who uuid := public.consume_player_write();
  held public.world_save_sessions%rowtype;
  current_world public.worlds%rowtype;
  gen jsonb := nullif(p_metadata->'world_gen', 'null'::jsonb);
begin
  if p_save_id is null or p_world_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_expected_chunks is null or p_expected_chunks not between 0 and 16384
    or jsonb_typeof(p_metadata) is distinct from 'object' or octet_length(p_metadata::text) > 8388608 then
    raise sqlstate 'PT400' using message = 'Invalid save session';
  end if;
  select * into held from public.world_save_sessions where id = p_save_id for update;
  if found then
    if held.player_id <> who or held.world_id <> p_world_id or held.expected_revision <> p_expected_revision
      or held.expected_chunks <> p_expected_chunks then raise sqlstate 'PT409' using message = 'Save ID already used'; end if;
    if held.committed_revision is not null then return jsonb_build_object('revision', held.committed_revision, 'committed', true); end if;
    if held.expires_at <= clock_timestamp() or held.metadata <> p_metadata then raise sqlstate 'PT409' using message = 'Save session expired or changed'; end if;
    return jsonb_build_object('committed', false);
  end if;
  if jsonb_typeof(p_metadata->'name') is distinct from 'string'
    or coalesce(p_metadata->>'mode', '') not in ('creative', 'campaign', 'duilt')
    or coalesce((p_metadata->>'height')::integer, 0) not between 1 and 512 then
    raise sqlstate 'PT400' using message = 'Invalid world metadata';
  end if;
  if gen is null then
    if coalesce((p_metadata->>'size_x')::integer, 0) not between 1 and 4096
      or coalesce((p_metadata->>'size_z')::integer, 0) not between 1 and 4096 then raise sqlstate 'PT400' using message = 'Invalid fixed dimensions'; end if;
  elsif jsonb_typeof(gen) is distinct from 'object' or (gen->>'seed') is null
    or (gen->>'seed')::bigint not between -2147483648 and 2147483647
    or coalesce((p_metadata->>'size_x')::integer, -1) <> 0 or coalesce((p_metadata->>'size_z')::integer, -1) <> 0 then
    raise sqlstate 'PT400' using message = 'Invalid terrain metadata';
  end if;
  select * into current_world from public.worlds where id = p_world_id for update;
  if found then
    if current_world.player_id <> who then raise sqlstate 'PT403' using message = 'World is not yours'; end if;
    if current_world.deleted_at is not null or current_world.revision <> p_expected_revision then
      raise sqlstate 'PT409' using message = 'World changed or was deleted';
    end if;
  elsif p_expected_revision <> 0 then raise sqlstate 'PT409' using message = 'World no longer exists';
  end if;
  delete from public.world_save_sessions where player_id = who and expires_at <= clock_timestamp();
  delete from public.world_save_sessions where id in (select id from public.world_save_sessions where player_id = who
    and committed_revision is not null order by created_at desc offset 256);
  if (select count(*) from public.world_save_sessions where player_id = who and committed_revision is null) >= 4 then
    raise sqlstate 'PT429' using message = 'Too many unfinished saves';
  end if;
  insert into public.world_save_sessions(id, player_id, world_id, expected_revision, expected_chunks, metadata)
    values (p_save_id, who, p_world_id, p_expected_revision, p_expected_chunks, p_metadata);
  return jsonb_build_object('committed', false);
end $$;

create function public.stage_world_save(p_save_id uuid, p_chunks jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  who uuid := public.consume_player_write();
  held public.world_save_sessions%rowtype;
  part record;
  decoded bytea;
  count_chunks integer;
  count_bytes bigint;
begin
  select * into held from public.world_save_sessions where id = p_save_id for update;
  if not found or held.player_id <> who then raise sqlstate 'PT403' using message = 'Save session is not yours'; end if;
  if held.committed_revision is not null then return jsonb_build_object('revision', held.committed_revision, 'committed', true); end if;
  if held.expires_at <= clock_timestamp() then raise sqlstate 'PT409' using message = 'Save session expired'; end if;
  if jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_array_length(p_chunks) not between 1 and 100
    or octet_length(p_chunks::text) > 4194304 then raise sqlstate 'PT400' using message = 'Invalid chunk page'; end if;
  for part in select * from jsonb_to_recordset(p_chunks) as c(cx integer, cz integer, rle text) loop
    decoded := part.rle::bytea;
    if part.cx is null or part.cz is null or decoded is null or octet_length(decoded) not between 3 and 1048576
      or not public.valid_saved_rle(decoded, (held.metadata->>'height')::integer) then
      raise sqlstate 'PT400' using message = 'Invalid saved chunk';
    end if;
    insert into public.world_save_chunks(save_id, cx, cz, rle) values(p_save_id, part.cx, part.cz, decoded)
      on conflict (save_id, cx, cz) do update set rle = excluded.rle;
  end loop;
  select count(*) into count_chunks from public.world_save_chunks where save_id = p_save_id;
  select coalesce(sum(octet_length(c.rle)), 0) into count_bytes from public.world_save_chunks c
    join public.world_save_sessions s on s.id = c.save_id where s.player_id = who;
  if count_chunks > held.expected_chunks or count_bytes > 67108864 then raise sqlstate 'PT413' using message = 'Save staging size exceeded'; end if;
  return jsonb_build_object('staged', count_chunks);
end $$;

create function public.commit_world_save(p_save_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  who uuid := public.consume_player_write();
  held public.world_save_sessions%rowtype;
  current_world public.worlds%rowtype;
  next_revision bigint;
  m jsonb;
begin
  select * into held from public.world_save_sessions where id = p_save_id for update;
  if not found or held.player_id <> who then raise sqlstate 'PT403' using message = 'Save session is not yours'; end if;
  if held.committed_revision is not null then return jsonb_build_object('revision', held.committed_revision); end if;
  if held.expires_at <= clock_timestamp() then raise sqlstate 'PT409' using message = 'Save session expired'; end if;
  if (select count(*) from public.world_save_chunks where save_id = p_save_id) <> held.expected_chunks then
    raise sqlstate 'PT409' using message = 'Save is incomplete';
  end if;
  -- An absent row cannot be locked FOR UPDATE. This also serializes two
  -- different accounts trying to create the same previously-unused UUID.
  perform pg_advisory_xact_lock(hashtextextended(held.world_id::text, 0));
  select * into current_world from public.worlds where id = held.world_id for update;
  if found then
    if current_world.player_id <> who then raise sqlstate 'PT403' using message = 'World is not yours'; end if;
    if current_world.deleted_at is not null or current_world.revision <> held.expected_revision then
      raise sqlstate 'PT409' using message = 'World changed or was deleted';
    end if;
  elsif held.expected_revision <> 0 then raise sqlstate 'PT409' using message = 'World no longer exists';
  end if;
  next_revision := held.expected_revision + 1;
  m := held.metadata;
  insert into public.worlds as published(id, player_id, name, mode, size_x, size_z, height, spawn, economy, duilt, world_gen, block_count, revision, updated_at)
  values(held.world_id, who, m->>'name', m->>'mode', (m->>'size_x')::integer, (m->>'size_z')::integer, (m->>'height')::integer,
    nullif(m->'spawn', 'null'::jsonb), coalesce(nullif(m->'economy', 'null'::jsonb), '{}'::jsonb),
    nullif(m->'duilt', 'null'::jsonb), nullif(m->'world_gen', 'null'::jsonb), coalesce((m->>'block_count')::integer, 0), next_revision, clock_timestamp())
  on conflict (id) do update set name=excluded.name, mode=excluded.mode, size_x=excluded.size_x, size_z=excluded.size_z,
    height=excluded.height, spawn=excluded.spawn, economy=excluded.economy, duilt=excluded.duilt, world_gen=excluded.world_gen,
    block_count=excluded.block_count, revision=excluded.revision, updated_at=excluded.updated_at
    where published.player_id = who and published.revision = held.expected_revision and published.deleted_at is null;
  if not found then raise sqlstate 'PT409' using message = 'World changed before publishing'; end if;
  insert into public.world_chunks(world_id, cx, cz, rle, revision, updated_at)
    select held.world_id, cx, cz, rle, next_revision, clock_timestamp() from public.world_save_chunks where save_id = p_save_id
    on conflict(world_id,cx,cz) do update set rle=excluded.rle, revision=excluded.revision, updated_at=excluded.updated_at;
  update public.world_save_sessions set committed_revision = next_revision, metadata = '{}'::jsonb where id = p_save_id;
  delete from public.world_save_chunks where save_id = p_save_id;
  return jsonb_build_object('revision', next_revision);
end $$;

create function public.delete_world_atomic(p_world_id uuid, p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  who uuid := public.consume_player_write();
  held public.worlds%rowtype;
begin
  if p_expected_revision is null or p_expected_revision < 0 then raise sqlstate 'PT400' using message = 'Invalid expected revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_world_id::text, 0));
  select * into held from public.worlds where id = p_world_id for update;
  if not found or held.player_id <> who then raise sqlstate 'PT403' using message = 'World is not yours'; end if;
  if held.deleted_at is not null then return jsonb_build_object('deleted', true); end if;
  if held.revision <> p_expected_revision then raise sqlstate 'PT409' using message = 'World changed'; end if;
  update public.worlds set deleted_at=clock_timestamp(), revision=revision+1 where id=p_world_id;
  delete from public.world_chunks where world_id=p_world_id;
  delete from public.world_save_sessions where world_id=p_world_id and player_id=who;
  return jsonb_build_object('deleted', true);
end $$;

-- Existing permissive policies cannot override these restrictive write guards.
create policy worlds_atomic_insert on public.worlds as restrictive for insert to authenticated with check (false);
create policy worlds_atomic_update on public.worlds as restrictive for update to authenticated using (false) with check (false);
create policy worlds_atomic_delete on public.worlds as restrictive for delete to authenticated using (false);
create policy chunks_atomic_insert on public.world_chunks as restrictive for insert to authenticated with check (false);
create policy chunks_atomic_update on public.world_chunks as restrictive for update to authenticated using (false) with check (false);
create policy chunks_atomic_delete on public.world_chunks as restrictive for delete to authenticated using (false);

create function public.guard_auxiliary_write() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- An owner performing maintenance outside the JWT API has no caller to pace.
  -- API calls without an identity still cannot mutate rows under their RLS.
  if auth.user_id() is null then return null; end if;
  perform public.consume_player_write();
  return null;
end $$;
create trigger progression_write_budget before insert or update or delete on public.progression for each statement execute function public.guard_auxiliary_write();
create trigger templates_write_budget before insert or update or delete on public.templates for each statement execute function public.guard_auxiliary_write();
create trigger failures_write_budget before insert or update or delete on public.save_failures for each statement execute function public.guard_auxiliary_write();
create trigger players_insert_budget after insert on public.players for each statement execute function public.guard_auxiliary_write();
create trigger players_change_budget before update or delete on public.players for each statement execute function public.guard_auxiliary_write();

revoke all on function public.consume_player_write(), public.valid_saved_rle(bytea,integer), public.guard_auxiliary_write(),
  public.begin_world_save(uuid,uuid,bigint,integer,jsonb), public.stage_world_save(uuid,jsonb), public.commit_world_save(uuid),
  public.delete_world_atomic(uuid,bigint) from public, authenticated;
grant execute on function public.begin_world_save(uuid,uuid,bigint,integer,jsonb), public.stage_world_save(uuid,jsonb),
  public.commit_world_save(uuid), public.delete_world_atomic(uuid,bigint) to authenticated;
commit;
