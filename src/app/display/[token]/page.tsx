"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayerView, type PlayerData } from "@/components/PlayerView";

// The player status link. The `[token]` segment accepts either the full share
// token (from the copied link) or the short game code (typed on the login
// screen) — the `player_status` RPC resolves both. Polls rather than using
// Realtime, which would require opening RLS to anon.
const POLL_MS = 6000;

export default function PlayerStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PlayerData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data: result, error } = await supabase.rpc("player_status", { p_key: token });
      if (cancelled) return;
      if (error || !result) {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      setData(result as PlayerData);
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 text-center">
        <p className="text-xl md:text-2xl text-slate-300">
          Status link not found — double-check the game code or link from your coordinator.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-2xl text-slate-300">Loading…</p>
      </div>
    );
  }

  return <PlayerView data={data} />;
}
