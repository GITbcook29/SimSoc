# SimSoc Coordinator Cockpit — START HERE

Single source of truth for picking up this project in a fresh thread. Read this
first; the other `*_HANDOFF.md` files in this folder are **historical** (their
work has all shipped — see "History" at the bottom).

_Last updated: 2026-08-21, after the roster/data-integrity/economy work._

To hand this to a new Claude Code thread: _"Read START_HERE.md, then …"._

---

## What this app is
A hosted, multi-user web app for running the live-action sociology game **SimSoc**.
Coordinators edit shared game data from anywhere; participants ("players") watch a
live status board. Ported from a single-file localStorage HTML app to Next.js +
Supabase + Vercel. Owner/user (**Bcook**) is non-technical for this build.

## Current live state (all deployed & verified 2026-08-21)
- **Production:** https://sim-soc-alpha.vercel.app (auto-deploys from `main`)
- **Coordinators** sign in at `/login`, manage games at `/games`.
- **Players** open a status link or type a game code — no account needed.
- Everything below is live in production and verified against the real database.

## Stack & key identifiers
- **Code:** `/Users/macbookprohomefolder/Desktop/AI/Claude/SimSoc/simsoc-web`
- **GitHub:** github.com/GITbcook29/SimSoc — branch `main` (Vercel deploys from it)
- **Supabase:** `ydxbevynlqlubafnknns.supabase.co` — anon/publishable key in `.env.local` (gitignored). **No service-role key available.**
- **Local dev:** launch config name `simsoc-web`, **port 5174** (in the repo-root `.claude/launch.json`; it also has an unrelated `stirling-cre-l10-dev` entry — leave it). Start with the launch config, or `npx next dev -p 5174`.
- **Next 16 (App Router, Turbopack) + React 19 + Tailwind v4 + TypeScript.** Note `AGENTS.md`: this is a modified Next 16 — mirror existing patterns in the repo.

## Recent commits (on `main`, deployed)
- `b89d685` — Money in circulation, levies assessed-vs-collected, collapse-warning rework
- `5274eee` — Five data-integrity fixes (attendance, BASIN passage model, head/role sync)
- `f093002` — Remove redundant "Head of" roster column
- `ed5c212` — Add "Real World Job" roster column
- `45dfa5a` — Player status link + game delete/rename + MASMED release
- `7024148` — "Mission Control" dark theme (visual redesign; reviewed & accepted)

> ⚠️ **Uncommitted at time of writing:** two coordinator-requested corrections are in
> the working tree but **not committed** — Session-1 auto-seeded simbucks, and the
> roster defaulting to Present. See "Uncommitted work" below before you start.

---

## Features shipped 2026-08-21 (commits `ed5c212` → `b89d685`)

### Roster
- **Real World Job** column on the Setup roster (`participants.job`, already in the DB,
  was populated but never displayed). Redundant "Head of" column removed — `Role` covers it.

### Data-integrity fixes (`5274eee`)
- **Attendance no longer toggles off.** Re-clicking the selected status is a no-op.
- **BASIN passage model corrected to the manual:** errors are scored **per passage**
  (array `basinPassageErrors`), the zero-payment threshold is **`errors >= 6`** (was `> 6`),
  `basinPurchased` is tracked separately from completed, **FES scales with purchased**
  and **SL with acceptable solutions** (`errors < 6`), and BASIN is charged the passage
  purchase cost — gated behind `BASIN_CHARGE_FOR_PASSAGE_PURCHASES` for a one-line revert.
  Rounds saved before this fall back to the old single-total math.
- **Head reassignment syncs `game_heads` ↔ `participants.role`** in one write sequence,
  excludes deceased participants from head dropdowns, flags a deceased head, and runs an
  idempotent `reconcileHeadRoles()` on Setup load to repair pre-existing drift.
- Number inputs replaced the +/− steppers (rapid clicks were dropping increments);
  every number input on Session now has an `aria-label`.

### Economy & collapse (`b89d685`)
- **Money in circulation** — `computeCirculation()` / `roundFlow()` in the engine, plus a
  "Treasury & Circulation" panel on Session, a Money Supply card on Results, and
  by-region / by-group tables on Status. Stored additively under `rounds.inputs.circulation`.
- **Levies are assessed, not auto-collected.** `electionTreasury()` and `disasterLevyRows()`
  return assessed / collected / shortfall per region; only **collected** money is
  redistributed or removed from circulation. Shortfalls surface as MasMed news
  ("Red Region failed to remit $8 of its $10 assessment"). Payment-in-kind (subsistence
  cards) is recorded but **never counted as money**.
- **Trajectory-based collapse warning** — `collapseTier()` in `derive.ts` replaces the old
  flat level thresholds. Critical = next-session start ≤ 30 (reachable to zero in one round,
  because of the −30 floor).
- **Floor disclosure** — `computeRound()` now also returns `raw` (pre-floor) and `absorbed`
  per indicator, shown under each gauge, summarised for the round, and trended in a new
  History column. Previously the floor hid large damage silently.

---

## Features shipped 2026-07-24 (commit `45dfa5a`)

### 1. Player status link (replaced the old anonymous projector)
- Route `/display/[token]` now renders a **named, 6-pill live view** (`src/components/PlayerView.tsx`):
  **Society · MASMED · Red · Yellow · Blue · Green.** Mobile- and TV-friendly.
- Reached by the full share link **or** a short **game code** (typed at `/login` via `src/app/login/PlayerJoin.tsx`).
- Backed by a `security definer` RPC **`player_status(p_key text)`** (migration `supabase/migrations/0005_player_status.sql`, **already run in Supabase**). It accepts EITHER `games.status_share_token` (uuid) OR `games.player_code`.
- **Privacy rules baked into the RPC:** returns participant names/roles, but (a) caps each player's session marks to the latest **closed** round (live/in-progress marks never leak), and (b) only returns MASMED reports once released (see below). Society indicators + team status update as soon as a session closes.
- Status tab (`/games/[id]/status`) shows the link + code; **Regenerate** rotates BOTH and revokes the old ones.

### 2. MASMED report release ("Start next session")
- New column `games.masmed_released_through`. A report for session N is shown to players only when `masmed_released_through >= N`.
- Advanced by a one-tap banner `src/components/ReleaseReportBanner.tsx` (on the **Session** and **MasMed** tabs) → `startNextSession()` in `game-context.tsx`. Publishes at the **start of the next session**, not on close.
- Reports render via shared `src/components/MasmedReport.tsx` (a white printable "paper" doc; stacks to 1 column on mobile, 3 columns ≥640px incl. print).

### 3. Game management on `/games`
- **Delete** (`src/app/games/DeleteGameButton.tsx`) and **Rename** — both **owner-only** (`.eq("owner_id", user.id)` + RLS `games_*_owner`), form-action pattern, confirm dialog on delete. Delete cascades (FK `ON DELETE CASCADE`).
- New games get a `player_code` from a Postgres default; server actions in `src/app/games/actions.ts` (`renameGame`, `deleteGame`).

### DB objects added (migration 0005, already applied)
- `games.masmed_released_through int not null default 0`
- `games.player_code text` (unique, default 6-hex) 
- RPC `player_status(p_key text)` (granted to `anon, authenticated`)

---

## How to work on this project (conventions that matter)
- **`src/lib/simsoc-engine.js` is now partly editable — know which part.** The rule used to be
  "never touch it." That is no longer accurate: as of `5274eee`/`b89d685` the file also holds
  circulation, levy and floor-disclosure logic that is fair game. What remains **off limits
  without explicit instruction** is the verified math: the indicator formulas in `computeRound`,
  the `incomeMult` tiers, `riotEffect`, the −30 floor rule itself, and all eight group income
  formulas. Those are checked against the coordinator workbook.
  **Run `node src/lib/simsoc-engine.js` after any engine change** — the file has ~37 self-tests
  at the bottom covering the workbook reference cases plus the newer BASIN/circulation/levy ones.
- **Supabase access:** this environment has a Supabase MCP with `execute_sql`, which is far easier
  than the old anon-key curl workaround and can read/verify any table directly. Use it to confirm
  writes. If a task needs the user to run privileged SQL themselves, **paste the SQL into chat** —
  file links don't open for them.
- **Verify Supabase writes against the DB, not just the UI.** With just the anon key you can read game state through the RPC:
  ```bash
  # from simsoc-web/, with .env.local sourced
  curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/player_status" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"p_key":"<game_code_or_token>"}'
  ```
- **JSX whitespace trap in this Next build (cost us real time, and I got it wrong once).**
  This version's JSX transform **drops a text run's leading space when that run contains an
  HTML entity** (`&rarr;`, `&apos;`, …). Source like `Release Session {n} report &rarr;` compiles
  to `["Release Session ", n, "report →"]` and renders **"Session 1report"**. The source looks
  perfect, so grepping the source will not find it — you must check the render or the compiled
  output. Fix with an explicit `{" "}`; three sites are already fixed and commented, don't
  "tidy" them back. To sweep for new ones:
  ```bash
  npm run build
  grep -rhoE '[,)}],"[a-z(−$][^"]{3,70}' .next --include="*.js" | sed 's/^[^"]*"//' | sort -u
  ```
  Ignore hits like `resent · ` / `bsent (` — those are the intentional `<b>P</b>resent` labels.
- **Multi-session dev-server gotcha (cost us real time):** the user runs more than one Claude session in this folder, so another session's `next dev` may own port 5174 and serve **stale bundles that don't match your on-disk edits** (a browser hard-refresh won't fix it, and Next 16 refuses to start a second `next dev` for the same dir). Fix: confirm files are correct on disk, then `lsof -ti tcp:5174 | xargs kill` and relaunch `npx next dev -p 5174` for a clean recompile.
- Push only when the user asks; `main` auto-deploys to prod. Commits authored as Bradley Cook (local git identity).

## Uncommitted work (as of 2026-08-21)
Two coordinator-requested corrections are **verified but not committed** — decide whether to
commit or discard before building on top of them:
1. **Session 1 auto-seeds simbucks.** Region and group treasury boxes open pre-filled with the
   manual's level-appropriate figures as editable values (level 1: Green $80 / Yellow $80 /
   Blue $60 / **Red $0**; total **$220**). Regions are now the **authoritative** total and group
   treasuries are a labelled *slice* of it — **not** a second pot. Prompt B originally specified
   `total = Σ group + Σ region`, which would have double-counted the whole supply ($440) once a
   region's figure included its resident heads. `MEMBER_STARTING_ALLOWANCE = 0` (the manual gives
   starting income to heads only — which is exactly why Red opens at $0).
2. **Roster defaults to Present.** Untouched rows render and score as `P`; the coordinator marks
   only exceptions. The "Unmarked" tally, amber row tint and close-session confirm dialog were
   removed by request. `closeSession()` still writes the implicit `P`s explicitly so history and
   the player view show a real status. **`src/components/ConfirmDialog.tsx` is now unreferenced** —
   kept because the three remaining `window.confirm` sites could use it.

## Open design question (raised, deliberately not built)
Whether levies should be **% of holdings/income rather than flat**, so Red isn't wiped out.
Recommendation given: **don't** — the assessed/collected split already prevents a wipeout
(nothing is auto-deducted), and a regressive flat levy is the mechanism that creates the
political pressure the simulation exists to produce. If revisited, prefer an explicit,
announceable **hardship floor** over a silent formula, and note that a %-of-holdings levy would
make region cash counting **mandatory every session**. User's response: "ignore" — so it is parked.

## Known / open (non-blocking)
- **Disaster/election preset race (pre-existing, NOT fixed).** `applyPreset()` in
  `disaster/page.tsx` (and `election/page.tsx`) fires a sequential `await setDisInput(...)` loop;
  the first click dropped the `levy` field and it only landed on retry. Same stale-closure class
  as the bugs fixed in `3e18bb4`/`5274eee`. Worth folding into the ref+queue pattern.
- **Minor mobile cosmetic:** on the player Society pane, the region-health cards ("Red 100") can have the region name and the big number nearly touching on very narrow phones (`PublicDisplayBoard.tsx`). Not fixed.
- The seeded game **"Leadership St Tammany 2026"** has no group heads/roles assigned, so its team pills show names + status but no role labels — that's the data, not a bug (head-badge rendering was verified with mock data).
- Two accepted findings from the dark-theme review (not fixed, deemed fine): GameNav relabels the readout (`Pop→POP`, `Level→LVL`, adds `LIVE`); and the global base `border-color` reaches the MasMed white card's bare border. Neither affects logic or print.

## Test data (verified 2026-08-21)
Two games exist under `bcook29@gmail.com`:
- **LST 2026** — `ad6203f9-52b6-4aa9-b16b-307b3220ba0e`. **32 participants, all 8 group heads
  assigned, Round 1 open, nothing closed yet.** Every participant has a non-empty `job`.
  This is the **live game for the real run — treat it as production.** Read-only checks are fine
  (its `rounds.inputs.circulation` is still `null`, which also makes it a good backward-compat
  check); don't close its sessions or write test values into it.
- **Test 1** — Round 2. Belongs to the user; left untouched.

For anything destructive, **create a throwaway game, verify, then delete it** — that is what was
done for the economy/collapse verification. Scope any delete to the specific card so you never
touch LST 2026 or Test 1.

---

## History (superseded — for reference only)
- `UX_HANDOFF.md` — original app/route/stack context from the initial build.
- `UI_WORK_HANDOFF.md` — the dark "Mission Control" redesign plan (shipped in `7024148`).
- `BUGFIX_WORK_HANDOFF.md` — the closure-read bug hunt (attendance-write fix shipped in `3e18bb4`).
