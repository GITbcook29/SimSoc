# SimSoc Coordinator Cockpit — UI/UX Handoff

**Purpose:** Context for a new Claude Code thread picking up UI/UX design work on the already-built, already-deployed SimSoc web app. The build-out (auth, database, all 9 game tabs, realtime sync, public projector display) is complete and working. This phase is purely about making it look and feel better — not adding features, not touching the calculation engine.

Hand this file to Claude Code at the start of the new thread along with: "Read UX_HANDOFF.md, then run a design-critique on the app."

---

## 1. Current state

Fully functional, deployed, multi-user web app. Nothing here is prototype-quality — it works correctly end-to-end, verified against the database directly (not just visually) multiple times during the build.

- **Live app:** https://sim-soc-alpha.vercel.app
- **Code:** `/Users/macbookprohomefolder/Desktop/AI/Claude/SimSoc/simsoc-web` (this repo)
- **GitHub:** github.com/GITbcook29/SimSoc (branch `main`, auto-deploys to Vercel on push)
- **Supabase project:** ydxbevynlqlubafnknns.supabase.co (Postgres + Auth + RLS + Realtime)
- **Local dev:** `npm run dev` runs on port 5174 (already registered in `.claude/launch.json` as config `simsoc-web`)

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Supabase (`@supabase/ssr` + `@supabase/supabase-js`).

## 2. What exists today (functionally complete, visually plain)

Styling right now is default Tailwind utility classes — small text, thin borders, no real visual hierarchy, no color system beyond ad hoc `text-blue-600` / `text-green-600` etc. It is **not** a port of the original app's dark "cockpit" theme (that was an intentional simplification during the build — see `SimSoc_WebApp_BuildSpec.md` and `SimSoc_Coordinator_Cockpit.html` in the parent `SimSoc/` folder for the original visual language, in case that's a useful reference point or explicitly *not* the direction to go).

**Routes / screens that need design attention:**

- `/login` — email/password sign in + sign up, single centered card
- `/games` — list of games, create-game form, per-game invite-by-email
- `/games/[id]/setup` — roster table, CSV import, group-head assignment, config
- `/games/[id]/session` — attendance grid, status buttons (P/A/U/D), flags, tally counters, BASIN/RETSIN/investment number inputs — **the densest, most-used screen during live gameplay**
- `/games/[id]/disaster` — preset buttons + indicator shock inputs + free text
- `/games/[id]/election` — similar shape to disaster
- `/games/[id]/results` — indicator tiles with progress bars, collapse-risk warnings, payment tables
- `/games/[id]/masmed` — printable report (this one should probably stay closer to a plain "document" look since it's meant to be printed/read aloud)
- `/games/[id]/history` — round-by-round table
- `/games/[id]/status` — line chart (hand-rolled SVG) + region health cards + public-display share link
- `/games/[id]/cheatsheet` — static reference tables
- `/display/[token]` — **public, unauthenticated**, meant to be projected on a classroom screen. Different audience (the whole class watching, not the coordinator working) — probably wants bigger text, higher contrast, less UI chrome, no interactive elements.

Shared chrome: `src/app/games/[id]/GameNav.tsx` (top nav bar + session/pop/level indicator + toast notifications), `src/components/StatusBoard.tsx` (shared between the authenticated Status tab and the public display).

## 3. Constraints for the redesign

- **Don't touch `src/lib/simsoc-engine.js` or `src/lib/simsoc-engine.d.ts`.** This is the game's calculation engine, ported verbatim from the original and verified against the coordinator's workbook (10 passing reference test cases baked into the file — run `node src/lib/simsoc-engine.js` to check). Any redesign of the Session/Results/MasMed screens must keep displaying the same numbers, just better.
- **Don't change the data model** (`src/lib/types.ts`, the Supabase schema in `supabase/migrations/`) unless a UX improvement genuinely requires a new field — flag that decision explicitly rather than doing it silently.
- **`GameProvider`** (`src/app/games/[id]/game-context.tsx`) is the single source of truth for all game data and mutations on every authenticated tab. Redesigns should restyle what consumes this context, not fight its data flow. It already handles: optimistic local updates, Supabase writes, a write-queue to keep rapid edits ordered correctly, and Realtime sync across multiple coordinators' tabs.
- **The `/display/[token]` public route is separate** — it polls a Supabase RPC (`public_status`) every 6s rather than using `GameProvider`, and deliberately exposes zero participant names (only aggregate region counts). Keep that privacy boundary intact if redesigning it.
- **Mobile/tablet**: not yet considered at all. Worth deciding explicitly whether the Session tab (the busiest one) needs to work on a phone during live gameplay, or if coordinators always use a laptop.

## 4. Suggested approach for the new thread

Discussed in the prior thread: run **design-critique** first for a structured audit of the current UI (screenshots of each tab would help), then **design-system** to establish consistent tokens/spacing/color before touching individual pages, and **dataviz** specifically for the indicator line chart and region health bars in `StatusBoard.tsx` since those are hand-rolled SVG, not a charting library. **accessibility-review** is worth running too, given the Session tab is a dense data-entry grid.

Verify changes in the browser preview against the live dev server (`simsoc-web` launch config) as you go — this app was built with a strict "verify against the actual rendered UI and the actual database, not just that the code compiles" discipline, and that should carry forward.

## 5. Known rough edges (not blockers, just things a designer/UX pass might want to address)

- Numeric inputs across Session/Disaster/Election commit on blur (matching the original app's `onchange` behavior), not live as you type — intentional, but worth confirming it still feels responsive with a new visual treatment.
- Toasts (bottom-center, in `GameNav.tsx`) are minimal — just black pills with white text.
- No loading skeletons anywhere — tabs show a plain "Loading…" text line while `GameProvider` fetches.
- No empty-state design beyond plain sentences (e.g. "No games yet — create one above.").
- The Results tab's collapse-risk warnings and the Status tab's region health scores are the two places doing the most "at a glance, is this bad?" signaling — probably the highest-value places for strong visual hierarchy.
