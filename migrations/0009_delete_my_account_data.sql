-- ACCT-5. Not applied to production yet. Tested on a copy of production
-- (Neon branch db-additive-test) on 23 November 2026.
--
-- "Delete my account": one function that removes everything the signed-in
-- player owns in this database. Additive: one new function, no table,
-- column or policy touched, so old builds do not notice it.
--
-- Guard: the function takes no player or user id. It deletes for
-- auth.user_id(), the identity in the caller's own JWT, and refuses a call
-- with none. Another player's data cannot be named, so it cannot be hit.
-- It is SECURITY DEFINER (like current_player_id) so it can delete across
-- tables in one transaction, and its search_path is pinned.
--
-- What goes: the player's worlds and their chunks (and, through the
-- existing ON DELETE CASCADE keys, world_sessions), progression, templates,
-- save_failures, and the players row itself. A chosen player name
-- (0010, player_names) goes too when that table exists. The sign-in
-- (auth) user is NOT touched here: the game asks Neon Auth to delete it
-- afterwards. If that step is refused, nothing here is left to recover: the
-- next sign-in simply makes a fresh, empty players row.
--
-- p_dry_run = true counts and deletes nothing. The game calls it first to
-- show "12 worlds will be deleted" and to find out whether this function
-- exists at all (a database without 0009 answers 404).

create or replace function public.delete_my_account_data(p_dry_run boolean default false)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
declare
  uid text := auth.user_id();
  pid uuid;
  n_worlds bigint := 0;
  n_chunks bigint := 0;
  n_templates bigint := 0;
  had_name boolean := false;
begin
  if uid is null or uid = '' then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select id into pid from players where auth_user_id = uid;
  if pid is not null then
    select count(*) into n_worlds from worlds where player_id = pid;
    select count(*) into n_chunks from world_chunks c join worlds w on w.id = c.world_id where w.player_id = pid;
    select count(*) into n_templates from templates where player_id = pid;
  end if;
  if to_regclass('public.player_names') is not null then
    execute 'select exists (select 1 from public.player_names where auth_user_id = $1)' into had_name using uid;
  end if;

  if not p_dry_run then
    if pid is not null then
      delete from world_chunks c using worlds w where w.id = c.world_id and w.player_id = pid;
      delete from worlds where player_id = pid;
      delete from players where id = pid;  -- cascades progression, templates, save_failures, world_sessions
    end if;
    if had_name then
      execute 'delete from public.player_names where auth_user_id = $1' using uid;
    end if;
  end if;

  return jsonb_build_object('dry_run', p_dry_run, 'worlds', n_worlds, 'chunks', n_chunks, 'templates', n_templates, 'had_name', had_name);
end
$$;

revoke all on function public.delete_my_account_data(boolean) from public;
grant execute on function public.delete_my_account_data(boolean) to authenticated;
