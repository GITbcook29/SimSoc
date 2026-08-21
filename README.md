# SimSoc + Business Mastery Cohort

Two applications share this Next.js codebase. Each owns a **separate Supabase
project**:

| App | Routes | What it is |
| --- | --- | --- |
| **SimSoc Coordinator Cockpit** | `/`, `/games/*`, `/display/*`, `/login` | Live-game coordinator tool for running SIMSOC sessions. |
| **Business Mastery Cohort (BMC)** | `/bmc/*` | Program platform for the Spring 2027 cohort — build-team planning tools plus a participant portal. |

They are fully independent: separate Supabase projects, separate sign-in
pages and auth sessions, separate navigation, and separate visual themes.
Neither app can read the other's data — the isolation is at the database
level, not just in the UI.

`src/proxy.ts` picks which project a request authenticates against: `/bmc/*`
goes to BMC's, everything else to SimSoc's. Because `@supabase/ssr` names its
session cookie after the project ref, a user can be signed into both at once
without either clobbering the other.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase
(Postgres + Auth + Storage), Anthropic Messages API, deployed on Vercel.

---

## Business Mastery Cohort

A 12-week program run jointly by **Palette** (host, facilities, mentor
coordination, program administration), **Arena Collective** (business-principles
curriculum), and **Exit Momentum** (business coaching). Six half-day sessions,
every other week, 9:00 AM–12:00 PM, Spring 2027. Application-based.

### Build-team tools (admin + staff)

| Route | What it does |
| --- | --- |
| `/bmc/matrix` | **Responsibility Matrix** — RACI across the three orgs per workstream, with a named owner per cell and a flag on any workstream with no Accountable owner. |
| `/bmc/sessions` | **Session Builder** — the six sessions, each pairing an Arena curriculum block with an Exit Momentum coaching block, plus takeaway, mentor focus, prep checklist, a build-completeness meter, a publish toggle, and a one-click push of the takeaway to every participant's task list. |
| `/bmc/meeting` | **EOS L10 meeting coordinator** — Segue, Scorecard, Rocks, Headlines, To-Dos, IDS, Conclude, each with a time box and live timer. Meetings persist; starting a new one clones the agenda and carries forward every unfinished to-do and unsolved issue. |
| `/bmc/roadmap` | **Roadmap** — three phase bands (Q3 2026 plan & build, Q4 2026 market & recruit, Q1 2027 execute) with week-level milestones, a timeline view, dependencies, and org/status filters. |
| `/bmc/leads` | **Leads & outreach** — table and kanban views over the eight-stage pipeline, ICP guardrails with a fit-score helper, CSV import/export, and conversion of a committed lead into an invited participant. |
| `/bmc/pricing` | **Pricing & revenue model** — per-scenario price, cohort size, cost lines (flat or per-participant), three-way revenue split, margin, and break-even headcount. |
| `/bmc/admin` | **People & access** (admin only) — roles, orgs, and the build-team roster. |

### Participant portal

| Route | What it does |
| --- | --- |
| `/bmc/dashboard` | Their tasks, progress across the six sessions, next session, business name. |
| `/bmc/program` | The published schedule, read-only, showing only participant-appropriate fields. |
| `/bmc/files` | Private document upload to Supabase Storage — download and delete. |
| `/bmc/assistant` | Streaming AI chat scoped to their own business and program journey. It can save a commitment straight to their task list. |

### Open items, deliberately left unset

The following are configuration or empty inputs rather than baked-in
assumptions, because they hadn't been decided:

- **Price per participant** — an editable, nullable field. Revenue and margin
  read "—" until it's set.
- **Cohort size** — both the tight (12–15) and broad (20–25) scenarios ship
  seeded and side by side; neither is treated as the answer.
- **Session dates** — blank placeholders on all six sessions.
- **Billing/branding entity** — `BILLING_ENTITY` in `src/lib/bmc/config.ts`,
  defaulting to Palette.
- **Revenue split** — editable per scenario, seeded at an even 34/33/33 with a
  warning badge whenever the three don't total 100%.
- **Program name** — `PROGRAM_NAME` in `src/lib/bmc/config.ts`. Renaming it
  there renames the program everywhere.

---

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000/bmc.

### Supabase projects

You need **two** projects at [supabase.com](https://supabase.com) — one per
app. Create the BMC one fresh rather than reusing an existing project: its
migration defines a `handle_new_user` trigger, which is the same name
Supabase's own starter snippets use.

For each project, **Project Settings → API** gives you the URL and anon key.
Put SimSoc's in `NEXT_PUBLIC_SUPABASE_*` and BMC's in
`NEXT_PUBLIC_BMC_SUPABASE_*`; BMC's service role key goes in
`BMC_SUPABASE_SERVICE_ROLE_KEY`.

Then, in **each** project:

1. **Authentication → Providers → Email** — enable email/password, plus magic
   links if you want the "email me a link" option on the sign-in page.
2. **Authentication → URL Configuration** — add your site URL, and add the
   app's confirm route as a redirect URL: `<site>/auth/confirm` for the SimSoc
   project, `<site>/bmc/auth/confirm` for the BMC project. Each project only
   ever issues links for its own app.

### Running migrations

Migrations live in a directory per project. Paste each file into that
project's **SQL Editor → New query → Run**, in order — and check the project
ref in the dashboard URL before you run, since the two sets are not
interchangeable.

**SimSoc project** — `supabase/migrations/`:

```
0001_init.sql
0002_rounds_results_nullable.sql
0003_enable_realtime.sql
0004_public_status_display.sql
0005_player_status.sql
```

**BMC project** — `supabase/bmc/migrations/`:

```
0001_init.sql    schema, RLS policies, participant-files storage bucket
0002_seed.sql    build team, phase bands + milestones, workstreams,
                 six session shells, two pricing scenarios
```

Both BMC migrations are idempotent — re-running them is safe.

If you prefer the CLI, note that `supabase link` binds one project per
`supabase/` directory, so it can only manage SimSoc's here. For BMC, use
`psql` against the connection string in **Project Settings → Database**:

```bash
psql "$BMC_DB_URL" -f supabase/bmc/migrations/0001_init.sql
psql "$BMC_DB_URL" -f supabase/bmc/migrations/0002_seed.sql
```

### Environment variables

See `.env.example` for the annotated list. Summary:

| Variable | Project | Scope | Required |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SimSoc | client + server | for SimSoc |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SimSoc | client + server | for SimSoc |
| `NEXT_PUBLIC_BMC_SUPABASE_URL` | BMC | client + server | for BMC |
| `NEXT_PUBLIC_BMC_SUPABASE_ANON_KEY` | BMC | client + server | for BMC |
| `BMC_SUPABASE_SERVICE_ROLE_KEY` | BMC | **server only** | only for lead→participant invites |
| `NEXT_PUBLIC_SITE_URL` | — | client + server | recommended (auth email links) |
| `ANTHROPIC_API_KEY` | — | **server only** | only for the participant Assistant |
| `ANTHROPIC_MODEL` | — | server | no — defaults to `claude-sonnet-5` |

Each app only needs its own project's variables; you can run one without
configuring the other. The service-role and Anthropic keys are read only
inside server actions and route handlers. Neither is ever sent to the browser.

---

## Roles and access

Three roles, enforced by Postgres RLS rather than by the UI alone:

| Role | Sees |
| --- | --- |
| `admin` | Everything, including participants' files and chats, plus user management. |
| `staff` | All build-team tabs. **Not** participants' files or assistant chats. |
| `participant` | Their own dashboard, files, and assistant, plus the published schedule. Never the leads pipeline or the pricing model. |

Every new signup starts as a `participant`.

### Promoting the first admin

There's a chicken-and-egg: the admin page requires an admin. Sign up through
the app, then run this once in the Supabase SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

(Run this in the **BMC** project, not SimSoc's.)

From then on, roles are managed at `/bmc/admin`.

### Inviting participants

Either:

- **From the app** — on `/bmc/leads`, enter the lead's email and press
  **Convert to participant**. This sends a Supabase invite email, sets the lead
  to Committed, and links the new account back to the lead record. Requires
  `BMC_SUPABASE_SERVICE_ROLE_KEY`.
- **From Supabase** — in the **BMC** project, **Authentication → Users →
  Invite user**. The signup trigger creates their `profiles` row as a
  participant automatically.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, and import the repository. The framework
   preset detects Next.js; no build-command changes are needed.
3. **Settings → Environment Variables** — add every variable from
   `.env.example` for Production (and Preview, if you use preview
   deployments), taking care that the BMC values come from the BMC project.
   Set `NEXT_PUBLIC_SITE_URL` to the deployment's own URL.
4. **Deploy.**
5. Back in Supabase, set each project's **Authentication → URL Configuration**
   to the Vercel domain, and add its own redirect URL:
   `https://<your-domain>/auth/confirm` for the SimSoc project and
   `https://<your-domain>/bmc/auth/confirm` for the BMC project.
6. Visit `https://<your-domain>/bmc`, sign up, and promote yourself to admin
   with the SQL above.

No `vercel.json` is needed — the defaults are correct for this app.

---

## Design system

The BMC theme is scoped to a `.bmc` class (`src/app/bmc/bmc.css`) so it
coexists with SimSoc's dark theme in the same application.

- **Fonts** — Fraunces (headings), Outfit (body/UI), DM Mono (labels, timers,
  numbers), self-hosted via `next/font`.
- **Colours** — ink `#0F0E0C` on paper `#F6F2EC`, with gold `#C9923A`, teal
  `#2E7B72`, and Palette purple `#7B52AB` as the three-org coding: Palette gold,
  Arena teal, Exit Momentum purple, shared grey.
- **Patterns** — 10px-radius cards with a soft shadow, a sticky ink topbar with
  a 3px gold underline, uppercase DM Mono eyebrows, badge pills, status dots,
  cycle-through status buttons, and dashed editable fields that turn solid gold
  on focus.
- **Print** — every page has a print stylesheet that hides controls, expands
  collapsed sections, and breaks sensibly between cards.

## Project layout

```
src/app/bmc/                 BMC routes
  layout.tsx                 theme + fonts wrapper
  login/                     BMC sign-in
  (app)/                     authenticated shell (topbar + nav)
    matrix/ sessions/ meeting/ roadmap/ leads/ pricing/ admin/
    dashboard/ program/ files/ assistant/
  auth/confirm/              BMC magic-link / invite landing
src/app/api/bmc/chat/        Assistant streaming route handler
src/lib/bmc/                 config, types, auth guards, domain logic
  supabase/                  client + session refresh for the BMC project
src/components/bmc/          shared UI primitives
supabase/migrations/         SimSoc project: schema, RLS
supabase/bmc/migrations/     BMC project: schema, RLS, seed
src/proxy.ts                 routes each request to the right project's auth
```

Each feature keeps its server actions next to its page in an `actions.ts`, and
every action re-checks the caller's role before writing.

---

## SimSoc

The original app is unchanged. See `UX_HANDOFF.md` for its design notes. Its
routes, tables, Supabase project, and theme are untouched by the BMC work.
The only shared file that changed is `src/proxy.ts`, which now dispatches
`/bmc/*` to BMC's session handler before SimSoc's runs.
