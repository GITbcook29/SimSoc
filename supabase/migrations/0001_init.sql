-- SIMSOC web app schema + Row Level Security
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Model: only the game owner creates games; owner invites teammates by email
-- (invite stored in game_invites, converted to a real membership automatically
-- the moment that email signs up).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists games (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  config        jsonb not null default '{}'::jsonb,
  current_round int not null default 1,
  created_at    timestamptz not null default now()
);

create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games (id) on delete cascade,
  name          text not null,
  region        text,          -- Red | Yellow | Blue | Green
  team          text,
  role          text,
  age           text,
  gender        text,
  job           text,
  lux           boolean not null default false,
  ptc           boolean not null default false,
  sessions      jsonb not null default '{}'::jsonb   -- { "1": {status, ns}, "2": {...} }
);

create table if not exists game_heads (
  game_id        uuid not null references games (id) on delete cascade,
  role           text not null check (role in
                   ('BASIN','RETSIN','POP','SOP','EMPIN','HUMSERV','MASMED','JUDCO')),
  participant_id uuid references participants (id) on delete set null,
  primary key (game_id, role)
);

create table if not exists rounds (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games (id) on delete cascade,
  round_no   int not null,
  inputs     jsonb not null default '{}'::jsonb,
  results    jsonb not null default '{}'::jsonb,
  closed     boolean not null default false,
  unique (game_id, round_no)
);

create table if not exists memberships (
  game_id    uuid not null references games (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  team_role  text not null default 'assistant' check (team_role in ('lead', 'assistant')),
  primary key (game_id, user_id)
);

-- Pending invites keyed by email (teammate may not have an account yet).
create table if not exists game_invites (
  game_id    uuid not null references games (id) on delete cascade,
  email      text not null,
  team_role  text not null default 'assistant' check (team_role in ('lead', 'assistant')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, email)
);

-- ---------------------------------------------------------------------------
-- Helper: is the current user a member (or owner) of this game?
-- ---------------------------------------------------------------------------

create or replace function is_game_member(target_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from games g
    where g.id = target_game_id and g.owner_id = auth.uid()
  ) or exists (
    select 1 from memberships m
    where m.game_id = target_game_id and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-convert invites into memberships when the invited email signs up
-- ---------------------------------------------------------------------------

create or replace function handle_new_user_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into memberships (game_id, user_id, team_role)
  select gi.game_id, new.id, gi.team_role
  from game_invites gi
  where lower(gi.email) = lower(new.email)
  on conflict (game_id, user_id) do nothing;

  delete from game_invites gi
  where lower(gi.email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_invites on auth.users;
create trigger on_auth_user_created_invites
  after insert on auth.users
  for each row execute function handle_new_user_invites();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table games enable row level security;
alter table participants enable row level security;
alter table game_heads enable row level security;
alter table rounds enable row level security;
alter table memberships enable row level security;
alter table game_invites enable row level security;

-- games: members (incl. owner) can read; only the owner can create/update/delete.
create policy "games_select_members" on games
  for select using (is_game_member(id));

create policy "games_insert_owner" on games
  for insert with check (owner_id = auth.uid());

create policy "games_update_owner" on games
  for update using (owner_id = auth.uid());

create policy "games_delete_owner" on games
  for delete using (owner_id = auth.uid());

-- participants / game_heads / rounds: any member of the game can read & write.
create policy "participants_all_members" on participants
  for all using (is_game_member(game_id)) with check (is_game_member(game_id));

create policy "game_heads_all_members" on game_heads
  for all using (is_game_member(game_id)) with check (is_game_member(game_id));

create policy "rounds_all_members" on rounds
  for all using (is_game_member(game_id)) with check (is_game_member(game_id));

-- memberships: a user can see their own membership rows; only the game owner
-- can add/remove members.
create policy "memberships_select_own_or_owner" on memberships
  for select using (
    user_id = auth.uid()
    or exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid())
  );

create policy "memberships_write_owner" on memberships
  for all using (
    exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid())
  );

-- game_invites: only the game owner can create/view/delete invites for their game.
create policy "game_invites_owner" on game_invites
  for all using (
    exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from games g where g.id = game_id and g.owner_id = auth.uid())
  );
