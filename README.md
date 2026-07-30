# SimSoc + Business Mastery Cohort

Two applications share this Next.js codebase and one Supabase project:

| App | Routes | What it is |
| --- | --- | --- |
| **SimSoc Coordinator Cockpit** | `/`, `/games/*`, `/display/*`, `/login` | Live-game coordinator tool for running SIMSOC sessions. |
| **Business Mastery Cohort (BMC)** | `/bmc/*` | Program platform for the Spring 2027 cohort — build-team planning tools plus a participant portal. |

They are independent: separate sign-in pages, separate navigation, separate
visual themes, and separate database tables (BMC tables are all prefixed
`bmc_`). Nothing in one app reads the other's data.

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

### Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API** gives you `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run the migrations (below).
4. **Authentication → Providers → Email**: enable email/password. Enable magic
   links if you want the "email me a link" option on the sign-in page.
5. **Authentication → URL Configuration**: add your site URL and
   `<site>/auth/confirm` as a redirect URL.

### Running migrations

Either paste each file into **SQL Editor → New query → Run**, in order:

```
supabase/migrations/0001_init.sql            SimSoc
supabase/migrations/0002_rounds_results_nullable.sql
supabase/migrations/0003_enable_realtime.sql
supabase/migrations/0004_public_status_display.sql
supabase/migrations/0005_player_status.sql
supabase/migrations/0006_bmc_init.sql        BMC schema, RLS, storage bucket
supabase/migrations/0007_bmc_seed.sql        BMC seed data
```

…or use the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`0006` creates the `bmc_*` tables, the RLS policies, and the private
`participant-files` storage bucket. `0007` seeds the six build-team members,
the three phase bands with their milestones, the ten responsibility-matrix
workstreams, six empty session shells, and the two pricing scenarios. Both are
idempotent — re-running them is safe.

### Environment variables

See `.env.example` for the annotated list. Summary:

| Variable | Scope | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | only for lead→participant invites |
| `NEXT_PUBLIC_SITE_URL` | client + server | recommended (auth email links) |
| `ANTHROPIC_API_KEY` | **server only** | only for the participant Assistant |
| `ANTHROPIC_MODEL` | server | no — defaults to `claude-sonnet-5` |

The service-role and Anthropic keys are read only inside server actions and
route handlers. Neither is ever sent to the browser.

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
update bmc_profiles set role = 'admin' where email = 'you@example.com';
```

From then on, roles are managed at `/bmc/admin`.

### Inviting participants

Either:

- **From the app** — on `/bmc/leads`, enter the lead's email and press
  **Convert to participant**. This sends a Supabase invite email, sets the lead
  to Committed, and links the new account back to the lead record. Requires
  `SUPABASE_SERVICE_ROLE_KEY`.
- **From Supabase** — **Authentication → Users → Invite user**. The signup
  trigger creates their `bmc_profiles` row as a participant automatically.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, and import the repository. The framework
   preset detects Next.js; no build-command changes are needed.
3. **Settings → Environment Variables** — add every variable from
   `.env.example` for Production (and Preview, if you use preview
   deployments). Set `NEXT_PUBLIC_SITE_URL` to the deployment's own URL.
4. **Deploy.**
5. Back in Supabase, **Authentication → URL Configuration**: set the site URL
   to the Vercel domain and add `https://<your-domain>/auth/confirm` as a
   redirect URL, so magic links and invite emails land in the right place.
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
src/app/api/bmc/chat/        Assistant streaming route handler
src/lib/bmc/                 config, types, auth guards, domain logic
src/components/bmc/          shared UI primitives
supabase/migrations/         schema, RLS, seed
```

Each feature keeps its server actions next to its page in an `actions.ts`, and
every action re-checks the caller's role before writing.

---

## SimSoc

The original app is unchanged. See `UX_HANDOFF.md` for its design notes. Its
routes, tables, and theme are untouched by the BMC work; the only shared file
that changed is `src/lib/supabase/middleware.ts`, which now sends an
unauthenticated `/bmc/*` request to `/bmc/login` instead of SimSoc's `/login`.
