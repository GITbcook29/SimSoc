"use client";

import { useState } from "react";
import { useGame } from "../game-context";
import { StatusBoard } from "@/components/StatusBoard";

export default function StatusPage() {
  const { loading, game, participants, rounds, regenerateShareLink } = useGame();
  const [copied, setCopied] = useState(false);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/display/${game.status_share_token}` : "";

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="border rounded-lg p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-1">
            Public projector display
          </h2>
          <p className="text-xs text-neutral-500">
            No login needed, no participant names — just indicators and region counts. Open this link on the
            classroom screen; it refreshes automatically.
          </p>
        </div>
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
        <button
          onClick={() => {
            if (confirm("Regenerate the share link? The old link will stop working immediately."))
              regenerateShareLink();
          }}
          className="text-xs text-red-600 border border-red-200 rounded px-3 py-1.5"
        >
          Regenerate (revoke old link)
        </button>
      </div>

      <StatusBoard participants={participants} rounds={rounds} />
    </div>
  );
}
