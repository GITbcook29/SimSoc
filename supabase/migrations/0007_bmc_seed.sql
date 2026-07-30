-- ===========================================================================
-- BMC seed data
--
-- Idempotent: safe to re-run. Loads the build team roster, the three phase
-- bands with the kickoff-call milestones, the ten responsibility-matrix
-- workstreams, six empty session shells, and two pricing scenarios.
--
-- Deliberately NOT seeded: price per participant, final cohort size, and the
-- Spring 2027 session dates. Those are open items — the app leaves them blank
-- rather than baking in a guess.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Build team
-- ---------------------------------------------------------------------------

insert into bmc_team_roster (full_name, org, role_title, sort_order) values
  ('Bradley Cook',   'palette',       'Program lead / Palette',            1),
  ('Lauren Navarre', 'arena',         'Curriculum lead / Arena',           2),
  ('Jared Miguez',   'arena',         'Curriculum / Arena',                3),
  ('Craig Sweeney',  'exit_momentum', 'Coaching lead / Exit Momentum',     4),
  ('Marty Mayer',    'palette',       'Mentor matching / corporate relationships', 5),
  ('Chad Tabary',    'palette',       'Systems & tech',                    6)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Roadmap — phase bands with week-level milestones
-- ---------------------------------------------------------------------------

insert into bmc_roadmap_milestones (phase, title, org, sort_order)
select v.phase, v.title, v.org, v.sort_order
from (values
  -- Q3 2026 — Plan & Build
  ('q3_2026', 'Build curriculum assets (6 session arcs)',            'arena',         10),
  ('q3_2026', 'Define the coaching component / day-one process map', 'exit_momentum', 20),
  ('q3_2026', 'Define ICP and qualification criteria',               'shared',        30),
  ('q3_2026', 'Define pricing and revenue split',                    'palette',       40),
  ('q3_2026', 'Build lead-gen and application flow',                 'palette',       50),
  ('q3_2026', 'Recruit mentor pool',                                 'palette',       60),
  ('q3_2026', 'Stand up program platform and systems',               'palette',       70),
  -- Q4 2026 — Market & Recruit
  ('q4_2026', 'Marketing and creative assets ready',                 'palette',       10),
  ('q4_2026', 'Info session #1',                                     'shared',        20),
  ('q4_2026', 'Info session #2',                                     'shared',        30),
  ('q4_2026', 'Kickoff / sales kickoff event',                       'shared',        40),
  ('q4_2026', 'Run outreach against the leads list',                 'shared',        50),
  ('q4_2026', 'Applications open',                                   'palette',       60),
  ('q4_2026', 'Select and confirm the cohort',                       'shared',        70),
  -- Q1 2027 — Execute
  ('q1_2027', 'Session 1 delivered',                                 'shared',        10),
  ('q1_2027', 'Session 2 delivered',                                 'shared',        20),
  ('q1_2027', 'Session 3 delivered',                                 'shared',        30),
  ('q1_2027', 'Session 4 delivered',                                 'shared',        40),
  ('q1_2027', 'Session 5 delivered',                                 'shared',        50),
  ('q1_2027', 'Session 6 delivered',                                 'shared',        60),
  ('q1_2027', 'Cohort debrief and next-cohort decision',             'shared',        70)
) as v(phase, title, org, sort_order)
where not exists (
  select 1 from bmc_roadmap_milestones m
  where m.phase = v.phase and m.title = v.title
);

-- ---------------------------------------------------------------------------
-- Responsibility matrix — 10 workstreams
--
-- Seeds the Accountable owner for each workstream. Consulted/Informed rows for
-- the other orgs are added in the app; a workstream with no Accountable row is
-- flagged as a gap.
-- ---------------------------------------------------------------------------

insert into bmc_responsibility_matrix (workstream, org, owner_name, raci, sort_order)
values
  ('Curriculum & Content',   'arena',         'Lauren Navarre', 'A', 10),
  ('Coaching Component',     'exit_momentum', 'Craig Sweeney',  'A', 20),
  ('Facilities & Logistics', 'palette',       null,             'A', 30),
  ('Mentor Program',         'palette',       'Marty Mayer',    'A', 40),
  ('Marketing & Creative',   'palette',       'Aja',            'A', 50),
  ('Sales & Outreach',       'shared',        null,             'A', 60),
  ('Application & Selection','shared',        null,             'A', 70),
  ('Tech & Systems',         'palette',       'Chad Tabary',    'A', 80),
  ('Pricing & Revenue',      'palette',       'Bradley Cook',   'A', 90),
  ('Recording & Media',      'palette',       'Lettuce Media Studio', 'A', 100)
on conflict (workstream, org) do nothing;

-- Arena and Exit Momentum are Consulted on the shared go-to-market workstreams.
insert into bmc_responsibility_matrix (workstream, org, raci, sort_order)
values
  ('Sales & Outreach',       'arena',         'R', 61),
  ('Sales & Outreach',       'exit_momentum', 'R', 62),
  ('Application & Selection','arena',         'C', 71),
  ('Application & Selection','exit_momentum', 'C', 72),
  ('Curriculum & Content',   'palette',       'I', 11),
  ('Coaching Component',     'palette',       'I', 21)
on conflict (workstream, org) do nothing;

-- ---------------------------------------------------------------------------
-- Six session shells
--
-- Dates left null on purpose — the Spring 2027 calendar isn't set. The app
-- shows them as placeholders until an admin fills them in.
-- ---------------------------------------------------------------------------

insert into bmc_sessions (session_number, prep_checklist)
select
  n,
  jsonb_build_array(
    jsonb_build_object('text', 'Room booked and set',           'done', false),
    jsonb_build_object('text', 'Arena materials finalized',     'done', false),
    jsonb_build_object('text', 'Exit Momentum block confirmed', 'done', false),
    jsonb_build_object('text', 'Participant pre-work sent',     'done', false),
    jsonb_build_object('text', 'Recording set up',              'done', false)
  )
from generate_series(1, 6) as n
on conflict (session_number) do nothing;

-- ---------------------------------------------------------------------------
-- Pricing scenarios — the two cohort sizes that came up on the kickoff call.
-- price_per_participant is left null: it is an open item, not a default.
-- ---------------------------------------------------------------------------

insert into bmc_pricing_scenarios (name, cohort_size, cost_items, org_split, notes, sort_order)
select v.name, v.cohort_size, v.cost_items::jsonb, v.org_split::jsonb, v.notes, v.sort_order
from (values
  (
    'Tight cohort (12–15)', 13,
    '[{"label":"Facility","amount":0,"per_participant":false},
      {"label":"Materials","amount":0,"per_participant":true},
      {"label":"Mentor stipends","amount":0,"per_participant":true},
      {"label":"Marketing","amount":0,"per_participant":false},
      {"label":"Platform","amount":0,"per_participant":false}]',
    '{"palette":34,"arena":33,"exit_momentum":33}',
    'Higher-touch delivery; mentor matching is easier to staff at this size.', 10
  ),
  (
    'Broad cohort (20–25)', 22,
    '[{"label":"Facility","amount":0,"per_participant":false},
      {"label":"Materials","amount":0,"per_participant":true},
      {"label":"Mentor stipends","amount":0,"per_participant":true},
      {"label":"Marketing","amount":0,"per_participant":false},
      {"label":"Platform","amount":0,"per_participant":false}]',
    '{"palette":34,"arena":33,"exit_momentum":33}',
    'Better unit economics; needs a deeper mentor pool and a bigger room.', 20
  )
) as v(name, cohort_size, cost_items, org_split, notes, sort_order)
where not exists (select 1 from bmc_pricing_scenarios p where p.name = v.name);
