# SimSoc Coordinator Cockpit — Bug-Hunt & Fix Handoff

> **ℹ️ NOTE (2026-07-24):** A visual-only redesign shipped (commit `7024148`, the "Mission Control" dark theme). It restyled most component files but left `game-context.tsx` and all game logic/data flow untouched — so every correctness target below is still valid as written.

**Purpose:** Context for a new Claude Code thread doing a systematic functional pass over the already-deployed app — running it end to end and fixing whatever breaks. This is independent of and can run before, after, or in parallel with `UI_WORK_HANDOFF.md` (visual redesign); this thread should focus on correctness, not appearance.

Hand this file to Claude Code at the start of the new thread along with: "Read BUGFIX_WORK_HANDOFF.md, then start testing the app end to end and fix what's broken."

---

## Why this thread exists

While building a mock 3-session test scenario in a prior thread (28 participants, baseline → disaster → election), a real data-loss bug was found and fixed: **attendance/flag clicks (P/A/U/D, NS/Lux/PTC) on every roster row except the first were silently discarded** — the click registered visually but never reached Supabase, and reloading the page reverted it. Root cause: `patchParticipantSession` in `src/app/games/[id]/game-context.tsx` read participant state back out of a `setState` updater closure via a variable that wasn't reliably synchronous across rapid sequential writes — the same class of bug the project had already hit once before and fixed for round-level writes (see `roundsRef` / `roundWriteQueueRef` in the same file, and the note in `simsoc_web_project` memory). That fix for participants is live as of commit `3e18bb4` on `main`, verified both in the browser and by reloading to confirm persistence.

**The takeaway:** this bug pattern (stale closure reads on rapid/multi-row writes) may exist elsewhere in `game-context.tsx` wherever there's a loop, a list of independent editable rows, or rapid sequential clicks. That's the main thing to hunt for in this thread, alongside general functional testing.

## Priority 1: audit for the same closure-read bug pattern

Grep `game-context.tsx` for every mutation function and check whether it reads current state via a plain variable/`let` captured in a closure (buggy pattern) vs. a `ref` or the setState updater's own parameter (safe pattern). Specifically check, in addition to the now-fixed participant status/flags:

- Disaster tab: indicator shocks, "other effects" fields (subsistence forfeits, FEMA levy, travel closures, rules text) — any of these touched rapidly in sequence?
- Election tab: result selection + treasury levy fields + rules text.
- Setup tab: CSV import / "paste list" bulk-add (many rows written in one action — the exact shape of bug that hit attendance), group-head dropdown assignment (8 dropdowns), region reassignment per-row, roster deletion (✕ buttons).
- Session tab: society tallies (rioters/guard posts/arrests/goal declarations +/- buttons) — these are rapid-click counters, same risk profile as the bug just fixed.
- Support card counts and investment fields (already spot-checked working during the mock run, but confirm under rapid sequential edits, not just one field at a time).
- Invite-by-email on `/games` — separate write path, check it independently.

For each, write a quick repro (rapid clicks/edits across multiple rows or fields), reload the page, and confirm the value persisted. Don't just trust the UI after the click — reload to rule out optimistic-update-only bugs like the one just fixed.

## Priority 2: general end-to-end functional pass

Walk every route as a coordinator would, verifying against the database directly (Supabase project `ydxbevynlqlubafnknns.supabase.co`), not just the rendered UI — this project has already been burned once by a schema issue (`rounds.results` was accidentally `NOT NULL`) where writes failed silently while the UI still looked correct:

- `/login` — sign in, sign up, sign out, bad-credentials handling.
- `/games` — create game, invite teammate by email, multi-coordinator access.
- `/games/[id]/setup` — roster CRUD (add one, paste list, CSV upload, delete), region reassignment, group-head assignment, size-level lock behavior, "sessions planned" field.
- `/games/[id]/session` — full round entry (attendance, flags, tallies, BASIN/RETSIN, investments, support cards), then **Close Session & Calculate** — verify the computed indicators/payments match the coordinator's manual math for at least one round.
- `/games/[id]/disaster` and `/election` — arm each preset, verify indicator shocks and MasMed narrative text land correctly after closing a session.
- `/games/[id]/results`, `/masmed`, `/history`, `/status` — confirm data appears immediately after closing a session (Realtime sync) and after a manual reload.
- `/games/[id]/history` — test **Reopen** on a closed session, edit a value, re-close, confirm later rounds recompute correctly (this is called out in the UI as a supported flow but wasn't exercised in the mock run).
- `/display/[token]` — confirm it polls and updates without login, confirm **Regenerate** revokes the old link (old token should stop working).
- Multi-coordinator Realtime — open the same game in two sessions/tabs, confirm a write in one appears in the other without a manual reload.

## Test data available

"Leadership St Tammany 2026" (owned by bcook29@gmail.com) already has 28 participants and 3 closed sessions — safe to keep using for read/regression checks, or reopen sessions there to test the reopen/recompute flow. Create a fresh game for anything destructive (roster deletion, account/invite testing) so the seeded data stays intact for the UI thread's before/after screenshots.

## Constraints

Same as the UI thread: don't touch `src/lib/simsoc-engine.js` or its `.d.ts` (verified calculation engine — if a bug turns out to be in the math itself, flag it explicitly rather than editing verbatim-ported code without discussion). Don't change the data model unless a bug genuinely requires it, and flag that decision rather than doing it silently.
