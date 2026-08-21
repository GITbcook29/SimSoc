"use client";

import { useState } from "react";
import { useGame } from "../game-context";
import { StatusBoard } from "@/components/StatusBoard";
import { CardSkeleton, ChartSkeleton, TileGridSkeleton } from "@/components/Skeleton";
import { REGIONS, HEADROLES } from "@/lib/types";
import { computeCirculation } from "@/lib/simsoc-engine.js";
import { fmt, livingByRegion } from "@/lib/derive";

export default function StatusPage() {
  const { loading, game, participants, rounds, currentRound, level, heads, regenerateShareLink } = useGame();
  const [copied, setCopied] = useState(false);

  if (loading)
    return (
      <div className="space-y-4">
        <CardSkeleton rows={2} />
        <ChartSkeleton />
        <TileGridSkeleton tiles={4} />
      </div>
    );

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/display/${game.status_share_token}` : "";
  const code = game.player_code ?? null;
  const circ = computeCirculation({ rounds, currentRound, level });
  const livingByReg = livingByRegion(participants, currentRound);
  const headName = (role: string) => {
    const id = heads[role as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? p.name : "—";
  };

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="border rounded-lg p-4 mb-4 space-y-3">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-1">Player status link</h2>
          <p className="text-xs text-neutral-500">
            Share this with your participants. They get a live, mobile- and TV-friendly view with six tabs —
            overall Society status, the MASMED reports, and each team&rsquo;s roster, roles, and status. No login
            or password needed; it refreshes automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border rounded px-3 py-1.5 truncate max-w-[280px]"
          >
            {shareUrl}
          </a>
          <button onClick={copyLink} className="text-xs border rounded px-3 py-1.5">
            {copied ? "Copied" : "Copy link"}
          </button>
          {code && (
            <span className="text-xs text-neutral-500">
              or game code{" "}
              <b className="font-mono tracking-[2px] text-sm text-[var(--foreground)]">{code}</b>{" "}
              (players enter this at the login screen)
            </span>
          )}
        </div>

        <button
          onClick={() => {
            if (confirm("Regenerate the player link and game code? The old link and code will stop working immediately."))
              regenerateShareLink();
          }}
          className="text-xs text-red-400 border border-red-500/40 rounded px-3 py-1.5 hover:bg-red-500/10"
        >
          Regenerate (revoke old link &amp; code)
        </button>
      </div>

      <div className="border rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-1">Money in Circulation</h2>
        <div className="text-2xl font-bold font-mono">${fmt(circ.total)}</div>
        <div className="text-[10px] uppercase text-neutral-400 mb-3">Total for the society</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs text-neutral-500 mb-1">By region</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th>Region</th>
                  <th>Living</th>
                  <th>Cash held</th>
                  <th>Per-capita</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r, i) => (
                  <tr key={r} className="border-t">
                    <td>{r}</td>
                    <td>{livingByReg[i]}</td>
                    <td>${fmt(circ.regionCash[r])}</td>
                    <td>{livingByReg[i] > 0 ? `$${fmt(circ.regionCash[r] / livingByReg[i])}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-xs text-neutral-500 mb-1">By group</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th>Group</th>
                  <th>Head</th>
                  <th>Treasury</th>
                </tr>
              </thead>
              <tbody>
                {HEADROLES.map((g) => (
                  <tr key={g} className="border-t">
                    <td>{g}</td>
                    <td>{headName(g)}</td>
                    <td>${fmt(circ.groupTreasury[g])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <StatusBoard participants={participants} rounds={rounds} gameId={game.id} />
    </div>
  );
}
