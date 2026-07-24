"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PublicDisplayBoard } from "@/components/PublicDisplayBoard";
import type { Participant, Round } from "@/lib/types";

type PublicStatus = {
  game_name: string;
  current_round: number;
  participants: { region: Participant["region"]; sessions: Participant["sessions"] }[];
  rounds: { round_no: number; closed: boolean; results: Round["results"] }[];
};

const POLL_MS = 6000;

export default function PublicDisplayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data: result, error } = await supabase.rpc("public_status", { p_token: token });
      if (cancelled) return;
      if (error || !result) {
        setNotFound(true);
        return;
      }
      setData(result as PublicStatus);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-2xl text-slate-300">Display link not found — it may have been regenerated.</p>
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

  const participants = data.participants as Participant[];
  const rounds: Record<number, Round> = {};
  for (const r of data.rounds) {
    rounds[r.round_no] = {
      id: String(r.round_no),
      game_id: "",
      round_no: r.round_no,
      inputs: {} as Round["inputs"],
      results: r.results,
      closed: r.closed,
    };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-10 md:p-14 flex flex-col">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{data.game_name}</h1>
        <p className="mt-2 text-xl md:text-2xl text-slate-400">SIMSOC · Session {data.current_round}</p>
      </div>
      <PublicDisplayBoard participants={participants} rounds={rounds} />
    </div>
  );
}
