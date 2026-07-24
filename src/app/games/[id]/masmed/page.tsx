"use client";

import { useState } from "react";
import { useGame } from "../game-context";
import { EmptyState } from "@/components/EmptyState";
import { DocumentSkeleton } from "@/components/Skeleton";
import { MasmedReport } from "@/components/MasmedReport";
import { ReleaseReportBanner } from "@/components/ReleaseReportBanner";

export default function MasmedPage() {
  const { loading, game, rounds, heads, participants } = useGame();
  const closed = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .sort((a, b) => a.round_no - b.round_no);
  const [selected, setSelected] = useState<number | null>(null);

  if (loading) return <DocumentSkeleton />;
  if (!closed.length)
    return (
      <EmptyState
        text="No closed session yet — the MasMed report is generated once Session 1 is closed."
        href={`/games/${game.id}/session`}
        cta="Go to Session tab"
      />
    );

  const r = selected ?? closed[closed.length - 1].round_no;
  const round = rounds[r];
  if (!round?.results) return null;

  // Returns the head's name, or "" when no head is assigned — the report omits
  // the parenthetical entirely for unassigned heads.
  const headOf = (role: string) => {
    const id = heads[role as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? p.name : "";
  };

  const releasedThrough = game.masmed_released_through ?? 0;
  const visibleToPlayers = r <= releasedThrough;

  return (
    <div>
      <ReleaseReportBanner />

      <div className="flex items-center gap-3 mb-3 flex-wrap print:hidden">
        <label className="text-sm">
          Report for end of session{" "}
          <select
            value={r}
            onChange={(e) => setSelected(+e.target.value)}
            className="border rounded px-2 py-1 ml-1"
          >
            {closed.map((rr) => (
              <option key={rr.round_no} value={rr.round_no}>
                {rr.round_no}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => window.print()}
          className="bg-[var(--accent)] text-[var(--accent-ink)] font-semibold hover:brightness-110 rounded px-3 py-1.5 text-sm"
        >
          Print report
        </button>
        <span
          className={`text-xs rounded-full px-2.5 py-1 border ${
            visibleToPlayers
              ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
              : "text-amber-300 border-amber-500/40 bg-amber-500/10"
          }`}
        >
          {visibleToPlayers ? "✓ Visible to players" : "Hidden from players until you start the next session"}
        </span>
      </div>

      <MasmedReport roundNo={r} inputs={round.inputs} results={round.results} headName={headOf} />
    </div>
  );
}
