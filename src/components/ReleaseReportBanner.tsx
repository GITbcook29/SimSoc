"use client";

import { useGame } from "@/app/games/[id]/game-context";

// Coordinator control for the "auto-publish at the beginning of the next
// session" flow. Closing a session computes it immediately, but its MasMed
// report stays hidden from players until the coordinator taps this when the
// group actually meets for the next session. Shown on the Session and MasMed
// tabs only while a closed report is still unreleased.
export function ReleaseReportBanner() {
  const { game, rounds, startNextSession } = useGame();

  const closed = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .map((r) => r.round_no);
  if (!closed.length) return null;

  const latestClosed = Math.max(...closed);
  const releasedThrough = game.masmed_released_through ?? 0;
  if (latestClosed <= releasedThrough) return null;

  return (
    <div className="mb-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 flex items-center gap-4 flex-wrap print:hidden">
      <div className="flex-1 min-w-[240px]">
        <div className="text-sm font-semibold text-[var(--accent)]">▶ Start next session</div>
        <p className="text-xs text-neutral-400 mt-0.5">
          Session {latestClosed}&rsquo;s MasMed report isn&rsquo;t visible to players yet. Release it when your
          group meets for the next session so the report drops as the &ldquo;news.&rdquo;
        </p>
      </div>
      <button
        onClick={() => startNextSession()}
        className="bg-[var(--accent)] text-[var(--accent-ink)] font-semibold hover:brightness-110 rounded-lg px-4 py-2 text-sm"
      >
        {/* The explicit {" "} is load-bearing: this Next.js version's JSX transform drops a text
            run's leading space when that run contains an HTML entity (here &rarr;), rendering
            "Session 1report". Don't collapse it back into a plain space. */}
        Release Session {latestClosed}{" "}
        report &rarr;
      </button>
    </div>
  );
}
