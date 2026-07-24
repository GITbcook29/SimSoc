"use client";

import { useState } from "react";
import { useGame } from "../game-context";
import { StatusBoard } from "@/components/StatusBoard";
import { CardSkeleton, ChartSkeleton, TileGridSkeleton } from "@/components/Skeleton";

export default function StatusPage() {
  const { loading, game, participants, rounds, regenerateShareLink } = useGame();
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

      <StatusBoard participants={participants} rounds={rounds} gameId={game.id} />
    </div>
  );
}
