# SimSoc Coordinator Cockpit — UI Work Handoff

> **✅ STATUS: COMPLETE — 2026-07-24 (commit `7024148` on `main`).**
> The redesign this doc sequences is **done and deployed**. Step 2 (design tokens — color/severity system + type scale) shipped as part of the full **"Mission Control" dark theme** (`src/app/globals.css` + `src/lib/tokens.ts`). Steps 1, 3, and 4 (public display legibility, the Status chart label-collision fix, and the empty/loading/MasMed-phrasing polish) were already handled by an earlier thread and remain in place. Everything was verified live against the seeded **"Leadership St Tammany 2026"** game. **The step-by-step below is a historical record — check the current code before treating any item as outstanding.**

**Purpose:** Context for a new Claude Code thread executing the UI/UX redesign. A design-critique was already run in a prior thread against the live app, and a 3-session mock scenario (28 participants, baseline → disaster → election) was played through to see the busy screens populated with real data. This doc has the findings and the recommended order of work. Read `UX_HANDOFF.md` first for full app/route context, constraints, and stack — this doc is the sequencing and findings layer on top of it.

Hand this file to Claude Code at the start of the new thread along with: "Read UI_WORK_HANDOFF.md and UX_HANDOFF.md, then start on step 1."

---

## Test data already seeded

The game **"Leadership St Tammany 2026"** (owned by bcook29@gmail.com) has 28 mock participants and 3 closed sessions (baseline, a Category 4 Hurricane disaster, an SOP election victory) already in the database. Results, MasMed Report, History, and Status all have real non-empty data for this game — no need to reseed before screenshotting during redesign work. Session 4 is open and ready if you need to test the live-entry screens further.

## Recommended order of work

### 1. Public display page first (`/display/[token]`)
This is the one screen that isn't just plain — it's actively wrong for its audience. It currently uses the same small type and card chrome as the coordinator's laptop screens, but it's meant to be read from across a classroom on a projector by people who aren't interacting with it. Fix: large type (48px+ for the headline indicator numbers), high contrast, minimal/no card borders competing for attention. Keep the privacy boundary intact (no participant names — this route already deliberately excludes them via the `public_status` RPC).

### 2. Design tokens — color/severity system + type scale
Do this before touching individual screens, since steps 3+ all depend on it and you don't want to redo work. Define:
- **Semantic color tokens** (success/warning/danger/neutral) — apply to Results' collapse-risk warnings, Status' region health scores, riot %, and toasts. This is currently entirely ad hoc (`text-blue-600`/`text-green-600` scattered per-instance) and is the single highest-value fix per the original critique: these two screens are the app's main "at a glance, is this bad?" surfaces.
- **Type scale** — bigger numerals for KPI-style values (national indicators, treasury totals, payment amounts) vs. body/label text. Right now everything reads at roughly the same size.

This step is effectively a scoped `design-system` pass — don't run the full generic skill, just establish what these two screens actually need.

### 3. Fix the Status chart's label collision (confirmed bug, not hypothetical)
In the mock 3-session run, SC and PC both landed at 150.8 in Session 3 and their end-of-line labels overlapped illegibly in the hand-rolled SVG chart in `StatusBoard.tsx`. This will happen routinely in real games since indicators often converge. Fix as part of (or right after) the `dataviz` pass on this chart and the region health bars, now that you have real multi-session data in the seeded game to verify against instead of a flat empty chart.

### 4. Batch polish pass
Lower-value, can go together once 1–3 are done:
- Toasts (`GameNav.tsx`) — currently unstyled black pills; differentiate success/error/info with the new color tokens.
- Empty states (Results/Status/MasMed/History before any session is closed) — currently plain sentences ("No session closed yet…"); give them a clear next action, not just prose.
- Loading states — currently plain "Loading…" text; skeleton screens matching each tab's layout.
- MasMed report phrasing bug: when a group head isn't assigned, the election/disaster narrative text reads awkwardly — e.g. "SOP head ((no head assigned)): $32". Seen live in the Session 3 MasMed report for the seeded game. Fix the sentence construction to handle the unassigned case gracefully (e.g. omit the parenthetical or name the group only).

## Things to leave alone (per original critique)
- Setup and Session tabs' information density is appropriate — they're coordinator working sheets, not consumer UI. Don't simplify them.
- MasMed's plain "document" instinct is correct — don't turn it into a styled dashboard card; it should look and print like a report.
- The two-column layout pattern (primary entry left, secondary tallies/context right) on Session/Disaster/Election is solid — keep it as the base structure.
- Quick-preset buttons (Disaster/Election) are a good pattern — keep and extend, don't redesign away.

## Verification discipline
Verify every visual change in the browser preview against the live dev server (`simsoc-web` launch config, port 5174) as you go. Use the seeded "Leadership St Tammany 2026" game to check populated-state screens, and Session 4 (still open) to check live-entry screens. This app was built and critiqued with a strict "verify against the actual rendered UI, not just that the code compiles" discipline — keep that going.
