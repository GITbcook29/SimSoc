-- Player status link: replaces the anonymous projector with a named, per-team
-- "cockpit" participants can log into. Access is still gated by the unguessable
-- per-game share token OR a short human-typable player_code; the anon role never
-- touches the base tables directly (security-definer RPC only).
--
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- ---------------------------------------------------------------------------
-- New columns on games
-- ---------------------------------------------------------------------------

-- Highest session number whose MasMed report has been released to players.
-- Advanced by the coordinator's "Start next session" action. 0 = none released.
alter table games add column if not exists masmed_released_through int not null default 0;

-- Short, human-typable code players enter on the login screen. 6 uppercase hex
-- chars (no O/I/L letters to confuse with 0/1). New rows get one by default;
-- existing rows are backfilled below.
alter table games add column if not exists player_code text;

update games
set player_code = upper(substr(md5(random()::text || id::text), 1, 6))
where player_code is null;

alter table games
  alter column player_code
  set default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

create unique index if not exists games_player_code_key on games (player_code);

-- ---------------------------------------------------------------------------
-- player_status RPC
-- ---------------------------------------------------------------------------
-- Returns everything the 6-pill player view needs, or NULL if the key matches
-- no game. Unlike the old public_status, this DOES expose participant names,
-- roles, and per-team status — by design (the projector is being replaced by a
-- named board for the game's own participants). Two privacy guards remain:
--   * only sessions up to the latest CLOSED round are returned (live/in-progress
--     attendance the coordinator is still entering never leaks), and
--   * MasMed reports are only returned once released (round_no <= released_through).
-- Society indicators and team status reflect the latest closed session as soon
-- as it closes, matching the old projector behaviour.

create or replace function player_status(p_key text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with g as (
    select *
    from games
    where status_share_token::text = p_key
       or player_code = upper(p_key)
    limit 1
  ),
  mc as (
    select coalesce(max(r.round_no), 0) as n
    from rounds r
    where r.game_id = (select id from g) and r.closed
  )
  select case when not exists (select 1 from g) then null else jsonb_build_object(
    'game_name', (select name from g),
    'current_round', (select current_round from g),
    'released_through', (select coalesce(masmed_released_through, 0) from g),
    'max_closed', (select n from mc),
    'heads', coalesce((
      select jsonb_object_agg(gh.role, p.name)
      from game_heads gh
      join participants p on p.id = gh.participant_id
      where gh.game_id = (select id from g)
    ), '{}'::jsonb),
    'head_by_pid', coalesce((
      select jsonb_object_agg(gh.participant_id::text, gh.role)
      from game_heads gh
      where gh.game_id = (select id from g) and gh.participant_id is not null
    ), '{}'::jsonb),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'region', p.region,
          'team', p.team,
          'role', p.role,
          'lux', p.lux,
          'ptc', p.ptc,
          'sessions', coalesce((
            select jsonb_object_agg(s.k, s.v)
            from jsonb_each(p.sessions) as s(k, v)
            where s.k ~ '^[0-9]+$' and s.k::int <= (select n from mc)
          ), '{}'::jsonb)
        )
        order by p.name
      )
      from participants p
      where p.game_id = (select id from g)
    ), '[]'::jsonb),
    'closed_rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object('round_no', r.round_no, 'results', r.results)
        order by r.round_no
      )
      from rounds r
      where r.game_id = (select id from g) and r.closed
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(
        jsonb_build_object('round_no', r.round_no, 'inputs', r.inputs, 'results', r.results)
        order by r.round_no
      )
      from rounds r
      where r.game_id = (select id from g)
        and r.closed
        and r.round_no <= (select coalesce(masmed_released_through, 0) from g)
    ), '[]'::jsonb)
  ) end;
$$;

grant execute on function player_status(text) to anon, authenticated;
