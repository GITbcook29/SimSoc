-- ===========================================================================
-- Business Mastery Cohort (BMC) — schema + Row Level Security
--
-- Every table is prefixed `bmc_` because this Supabase project also hosts the
-- SimSoc app; the prefix keeps the two schemas from colliding on generic names
-- like `sessions`, `issues`, `leads`, or `files`.
--
-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run, or via
-- `supabase db push`. Migration 0007 seeds the starting data.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Profiles — one row per auth user, carrying role and org
-- ---------------------------------------------------------------------------

create table if not exists bmc_profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  org           text check (org in ('palette', 'arena', 'exit_momentum')),
  role          text not null default 'participant'
                  check (role in ('admin', 'staff', 'participant')),
  business_name text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- New signups land as participants. An admin promotes from there (see README).
create or replace function bmc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into bmc_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists bmc_on_auth_user_created on auth.users;
create trigger bmc_on_auth_user_created
  after insert on auth.users
  for each row execute function bmc_handle_new_user();

-- The build team roster is deliberately independent of auth.users: the people
-- planning the cohort need to appear in owner pickers and meeting attendee
-- lists before (and whether or not) they ever create a login. A roster entry
-- links to a profile once that person signs up.
create table if not exists bmc_team_roster (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  org        text check (org in ('palette', 'arena', 'exit_momentum')),
  role_title text,
  email      text,
  profile_id uuid references bmc_profiles (id) on delete set null,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role helpers
--
-- security definer so they read bmc_profiles without re-entering RLS — that is
-- what keeps the bmc_profiles policies below from recursing into themselves.
-- ---------------------------------------------------------------------------

create or replace function bmc_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from bmc_profiles where id = auth.uid();
$$;

create or replace function bmc_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(bmc_role() = 'admin', false);
$$;

-- Build-team access: admins and staff.
create or replace function bmc_is_team()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(bmc_role() in ('admin', 'staff'), false);
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function bmc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Build-team tables
-- ---------------------------------------------------------------------------

create table if not exists bmc_meetings (
  id           uuid primary key default gen_random_uuid(),
  meeting_date date not null default current_date,
  title        text not null default 'Build Team L10',
  status       text not null default 'draft'
                 check (status in ('draft', 'in_progress', 'complete')),
  started_at   timestamptz,
  attendees    jsonb not null default '[]'::jsonb,
  rating       jsonb not null default '{}'::jsonb,   -- { "Name": 8, ... }
  cascading    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists bmc_meeting_segments (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references bmc_meetings (id) on delete cascade,
  segment_key   text not null,
  payload       jsonb not null default '{}'::jsonb,
  timer_seconds int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (meeting_id, segment_key)
);

create table if not exists bmc_scorecard_metrics (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references bmc_meetings (id) on delete cascade,
  name       text not null,
  owner      text,
  goal       text,
  actual     text,
  status     text not null default 'not_started'
               check (status in ('not_started', 'in_progress', 'on_track', 'off_track', 'done')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bmc_rocks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null default '',
  owner_profile_id uuid references bmc_profiles (id) on delete set null,
  org              text check (org in ('palette', 'arena', 'exit_momentum', 'shared')),
  quarter          text not null default 'q3_2026',
  status           text not null default 'not_started'
                     check (status in ('not_started', 'in_progress', 'on_track', 'off_track', 'done')),
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists bmc_issues (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid references bmc_meetings (id) on delete set null,
  title            text not null default '',
  notes            text,
  org              text check (org in ('palette', 'arena', 'exit_momentum', 'shared')),
  priority         int not null default 3 check (priority between 1 and 5),
  status           text not null default 'not_started'
                     check (status in ('not_started', 'in_progress', 'on_track', 'off_track', 'done')),
  owner_profile_id uuid references bmc_profiles (id) on delete set null,
  due_date         date,
  resolved         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists bmc_todos (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid references bmc_meetings (id) on delete set null,
  text             text not null default '',
  owner_profile_id uuid references bmc_profiles (id) on delete set null,
  org              text check (org in ('palette', 'arena', 'exit_momentum', 'shared')),
  due_date         date,
  done             boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists bmc_roadmap_milestones (
  id               uuid primary key default gen_random_uuid(),
  phase            text not null check (phase in ('q3_2026', 'q4_2026', 'q1_2027')),
  title            text not null default '',
  org              text check (org in ('palette', 'arena', 'exit_momentum', 'shared')),
  owner_profile_id uuid references bmc_profiles (id) on delete set null,
  start_date       date,
  due_date         date,
  status           text not null default 'not_started'
                     check (status in ('not_started', 'in_progress', 'on_track', 'off_track', 'done')),
  dependency_ids   uuid[] not null default '{}',
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per (workstream, org) pairing, so a workstream can carry a full
-- RACI across all three orgs plus a named owner per assignment.
create table if not exists bmc_responsibility_matrix (
  id               uuid primary key default gen_random_uuid(),
  workstream       text not null,
  org              text not null
                     check (org in ('palette', 'arena', 'exit_momentum', 'shared')),
  owner_profile_id uuid references bmc_profiles (id) on delete set null,
  owner_name       text,
  raci             text check (raci in ('R', 'A', 'C', 'I')),
  notes            text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workstream, org)
);

create table if not exists bmc_sessions (
  id                  uuid primary key default gen_random_uuid(),
  session_number      int not null unique check (session_number between 1 and 12),
  session_date        date,
  title               text not null default '',
  -- { topic, objective, presenter, materials_url }
  arena_block         jsonb not null default '{}'::jsonb,
  -- { topic, process_stage, presenter, notes }
  exit_momentum_block jsonb not null default '{}'::jsonb,
  breakout_takeaway   text,
  mentor_focus        text,
  recording_url       text,
  location            text,
  prep_checklist      jsonb not null default '[]'::jsonb,  -- [{ text, done }]
  status              text not null default 'not_started'
                        check (status in ('not_started', 'in_progress', 'on_track', 'off_track', 'done')),
  published           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists bmc_leads (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null default '',
  business                 text,
  industry                 text,
  years_in_business        int,
  revenue_band             text,
  employees                int,
  source                   text,
  referred_by              text,
  owner_profile_id         uuid references bmc_profiles (id) on delete set null,
  owner_org                text check (owner_org in ('palette', 'arena', 'exit_momentum', 'shared')),
  stage                    text not null default 'prospect'
                             check (stage in ('prospect', 'contacted', 'info_session_invited',
                                              'applied', 'qualified', 'offered', 'committed', 'declined')),
  last_touch               date,
  next_follow_up           date,
  fit_score                int check (fit_score between 0 and 100),
  notes                    text,
  converted_participant_id uuid references bmc_profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists bmc_pricing_scenarios (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null default 'Scenario',
  price_per_participant numeric,                            -- deliberately null: TBD
  cohort_size           int not null default 15,
  cost_items            jsonb not null default '[]'::jsonb, -- [{ label, amount, per_participant }]
  org_split             jsonb not null default '{}'::jsonb, -- { palette: 34, arena: 33, exit_momentum: 33 }
  notes                 text,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Participant tables
-- ---------------------------------------------------------------------------

create table if not exists bmc_participant_tasks (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid not null references bmc_profiles (id) on delete cascade,
  source_session_id uuid references bmc_sessions (id) on delete set null,
  text              text not null default '',
  due_date          date,
  done              boolean not null default false,
  created_by        uuid references bmc_profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One task per participant per session takeaway — the unique index makes
-- "push this session's takeaway to everyone" safely repeatable. Left
-- unfiltered on purpose: ON CONFLICT can't infer a partial index, and NULLs
-- compare as distinct, so self-created tasks (null source_session_id) are
-- still unconstrained.
create unique index if not exists bmc_participant_tasks_session_unique
  on bmc_participant_tasks (participant_id, source_session_id);

create table if not exists bmc_files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references bmc_profiles (id) on delete cascade,
  storage_path text not null unique,
  filename     text not null,
  mime         text,
  size         bigint not null default 0,
  scope        text not null default 'participant'
                 check (scope in ('participant', 'program')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists bmc_chat_messages (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references bmc_profiles (id) on delete cascade,
  role           text not null check (role in ('user', 'assistant')),
  content        text not null,
  created_at     timestamptz not null default now()
);

create index if not exists bmc_chat_messages_participant_idx
  on bmc_chat_messages (participant_id, created_at);
create index if not exists bmc_participant_tasks_participant_idx
  on bmc_participant_tasks (participant_id);
create index if not exists bmc_files_owner_idx on bmc_files (owner_id);
create index if not exists bmc_leads_stage_idx on bmc_leads (stage);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'bmc_profiles', 'bmc_team_roster', 'bmc_meetings', 'bmc_meeting_segments', 'bmc_scorecard_metrics',
    'bmc_rocks', 'bmc_issues', 'bmc_todos', 'bmc_roadmap_milestones',
    'bmc_responsibility_matrix', 'bmc_sessions', 'bmc_leads', 'bmc_pricing_scenarios',
    'bmc_participant_tasks', 'bmc_files'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format(
      'create trigger %I before update on %I for each row execute function bmc_touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table bmc_profiles              enable row level security;
alter table bmc_team_roster           enable row level security;
alter table bmc_meetings              enable row level security;
alter table bmc_meeting_segments      enable row level security;
alter table bmc_scorecard_metrics     enable row level security;
alter table bmc_rocks                 enable row level security;
alter table bmc_issues                enable row level security;
alter table bmc_todos                 enable row level security;
alter table bmc_roadmap_milestones    enable row level security;
alter table bmc_responsibility_matrix enable row level security;
alter table bmc_sessions              enable row level security;
alter table bmc_leads                 enable row level security;
alter table bmc_pricing_scenarios     enable row level security;
alter table bmc_participant_tasks     enable row level security;
alter table bmc_files                 enable row level security;
alter table bmc_chat_messages         enable row level security;

-- Profiles: everyone reads their own row; the build team reads all (they need
-- names for owner pickers); only admins write anyone else's.
drop policy if exists bmc_profiles_select_self on bmc_profiles;
create policy bmc_profiles_select_self on bmc_profiles
  for select using (id = auth.uid() or bmc_is_team());

drop policy if exists bmc_profiles_update_self on bmc_profiles;
create policy bmc_profiles_update_self on bmc_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists bmc_profiles_admin_all on bmc_profiles;
create policy bmc_profiles_admin_all on bmc_profiles
  for all using (bmc_is_admin()) with check (bmc_is_admin());

-- Build-team tables: full access for admin + staff, invisible to participants.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bmc_meetings', 'bmc_meeting_segments', 'bmc_scorecard_metrics', 'bmc_rocks',
    'bmc_issues', 'bmc_todos', 'bmc_roadmap_milestones', 'bmc_responsibility_matrix',
    'bmc_leads', 'bmc_pricing_scenarios', 'bmc_team_roster'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_team', t);
    execute format(
      'create policy %I on %I for all using (bmc_is_team()) with check (bmc_is_team())',
      t || '_team', t
    );
  end loop;
end;
$$;

-- Sessions: build team writes; participants read published sessions only.
drop policy if exists bmc_sessions_team on bmc_sessions;
create policy bmc_sessions_team on bmc_sessions
  for all using (bmc_is_team()) with check (bmc_is_team());

drop policy if exists bmc_sessions_participant_read on bmc_sessions;
create policy bmc_sessions_participant_read on bmc_sessions
  for select using (published and auth.uid() is not null);

-- Participant tasks: the participant sees and updates their own; the build
-- team can see and assign across participants.
drop policy if exists bmc_participant_tasks_own on bmc_participant_tasks;
create policy bmc_participant_tasks_own on bmc_participant_tasks
  for all using (participant_id = auth.uid()) with check (participant_id = auth.uid());

drop policy if exists bmc_participant_tasks_team on bmc_participant_tasks;
create policy bmc_participant_tasks_team on bmc_participant_tasks
  for all using (bmc_is_team()) with check (bmc_is_team());

-- Files: strictly the owner, plus admins. Staff deliberately excluded — a
-- participant's uploaded financials are not build-team material.
drop policy if exists bmc_files_own on bmc_files;
create policy bmc_files_own on bmc_files
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists bmc_files_admin on bmc_files;
create policy bmc_files_admin on bmc_files
  for all using (bmc_is_admin()) with check (bmc_is_admin());

-- Chat: strictly the participant's own thread, plus admins.
drop policy if exists bmc_chat_own on bmc_chat_messages;
create policy bmc_chat_own on bmc_chat_messages
  for all using (participant_id = auth.uid()) with check (participant_id = auth.uid());

drop policy if exists bmc_chat_admin on bmc_chat_messages;
create policy bmc_chat_admin on bmc_chat_messages
  for all using (bmc_is_admin()) with check (bmc_is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for participant uploads
--
-- Objects are keyed `<user-id>/<uuid>-<filename>`, so the first path segment
-- is the owner and the policies below can compare it against auth.uid().
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('participant-files', 'participant-files', false)
on conflict (id) do nothing;

drop policy if exists bmc_storage_own_read on storage.objects;
create policy bmc_storage_own_read on storage.objects
  for select using (
    bucket_id = 'participant-files'
    and (owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text or bmc_is_admin())
  );

drop policy if exists bmc_storage_own_insert on storage.objects;
create policy bmc_storage_own_insert on storage.objects
  for insert with check (
    bucket_id = 'participant-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists bmc_storage_own_delete on storage.objects;
create policy bmc_storage_own_delete on storage.objects
  for delete using (
    bucket_id = 'participant-files'
    and ((storage.foldername(name))[1] = auth.uid()::text or bmc_is_admin())
  );
