-- ACCT-11. Not applied to production yet. Tested on a copy of production
-- (Neon branch db-additive-test) on 23 November 2026.
--
-- A chosen, unique player name. Until now the name shown for an account is
-- the part of its email before the @. Additive: one new table and three new
-- functions; no existing table, column or policy changes, so old builds do
-- not notice, and a build that finds the functions missing shows no name UI.
--
-- player_names is keyed by the sign-in (auth) user id, not by players.id, so
-- a name survives a players row being rebuilt. Writes go only through
-- claim_player_name(): there is no insert, update or delete policy, so a
-- client cannot write the table directly and cannot skip the rules.
--
-- The rules, in one place (src/net/playerName.js mirrors them, and a test
-- checks the two agree):
--   3 to 20 characters; ASCII letters, digits, spaces and underscores;
--   not starting or ending with a space.
-- Names are unique ignoring case ("Anna" and "anna" are the same name). A
-- player can change their own name, including only its capitals.
--
-- Reading: only your own row. Showing other players' names (shared worlds,
-- leaderboards) needs a deliberate, separate read path later; opening the
-- table now would also expose every account's auth user id.
--
-- Moderation (blocked words, reporting) is not in this migration.

create table public.player_names (
  auth_user_id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_names_name_rules check (name ~ '^[A-Za-z0-9_][A-Za-z0-9_ ]{1,18}[A-Za-z0-9_]$')
);

create unique index player_names_name_lower_key on public.player_names (lower(name));

alter table public.player_names enable row level security;

create policy player_names_owner_select on public.player_names for select
  using (auth_user_id = auth.user_id());

revoke all on public.player_names from public;
grant select on public.player_names to authenticated;

-- The caller's own name, or null when none is chosen. Null for "none" lets
-- the game tell "no name yet" (ask) from "function missing" (404, hide).
create or replace function public.my_player_name()
  returns text
  language sql
  stable
  security definer
  set search_path = public, auth
  as $$ select name from public.player_names where auth_user_id = auth.user_id() $$;

-- Claims or changes the caller's name. Acts only for auth.user_id(): there
-- is no user id argument. Errors carry a stable message the game matches:
--   invalid_name  (SQLSTATE 22023)  breaks the rules above
--   name_taken    (SQLSTATE 23505)  another account has it, ignoring case
--   sign_in_first (SQLSTATE 28000)  no identity in the JWT
create or replace function public.claim_player_name(p_name text)
  returns text
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
declare
  uid text := auth.user_id();
begin
  if uid is null or uid = '' then
    raise exception 'sign_in_first' using errcode = '28000';
  end if;
  if p_name is null or p_name !~ '^[A-Za-z0-9_][A-Za-z0-9_ ]{1,18}[A-Za-z0-9_]$' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  begin
    insert into public.player_names (auth_user_id, name) values (uid, p_name)
    on conflict (auth_user_id) do update set name = excluded.name, updated_at = now();
  exception when unique_violation then
    raise exception 'name_taken' using errcode = '23505';
  end;
  return p_name;
end
$$;

-- True when nobody has the name (ignoring case), or the caller already
-- holds it. Lets the game say "taken" before the player presses Save.
create or replace function public.player_name_available(p_name text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, auth
  as $$
    select not exists (
      select 1 from public.player_names
       where lower(name) = lower(p_name) and auth_user_id is distinct from auth.user_id()
    )
  $$;

revoke all on function public.my_player_name() from public;
revoke all on function public.claim_player_name(text) from public;
revoke all on function public.player_name_available(text) from public;
grant execute on function public.my_player_name() to authenticated;
grant execute on function public.claim_player_name(text) to authenticated;
grant execute on function public.player_name_available(text) to authenticated;
