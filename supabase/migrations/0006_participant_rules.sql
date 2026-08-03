-- Participant Rules: a per-game list of house rules the coordinator maintains on
-- the Cheat Sheet and players read on the status link.
--
-- Purely a reference/reading feature — nothing here feeds the indicator or
-- session-close math. No existing table or function's behaviour changes except
-- player_status, which gains one extra key ('rules').
--
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists rules (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games (id) on delete cascade,
  text       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rules_game_id_sort_idx on rules (game_id, sort_order, created_at);

-- Keep updated_at honest without relying on every caller to set it.
create or replace function touch_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rules_set_updated_at on rules;
create trigger rules_set_updated_at
  before update on rules
  for each row execute function touch_rules_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same shape as rounds: any member of the game reads/writes.
-- ---------------------------------------------------------------------------

alter table rules enable row level security;

drop policy if exists "rules_all_members" on rules;
create policy "rules_all_members" on rules
  for all using (is_game_member(game_id)) with check (is_game_member(game_id));

-- ---------------------------------------------------------------------------
-- Realtime, so a second coordinator's tab picks up rule edits like everything else.
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table rules;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- player_status: unchanged except for the new 'rules' key.
-- ---------------------------------------------------------------------------
-- Rules are NOT gated on closed rounds or MasMed release — they are reference
-- text the coordinator writes for the players, so they publish immediately.

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
    ), '[]'::jsonb),
    'rules', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', ru.id, 'text', ru.text)
        order by ru.sort_order, ru.created_at
      )
      from rules ru
      where ru.game_id = (select id from g)
    ), '[]'::jsonb)
  ) end;
$$;

grant execute on function player_status(text) to anon, authenticated;
