"use client";

import { useState } from "react";
import { REGIONS, type Region, type Participant, type Round, type RoundInputs, type RoundResults } from "@/lib/types";
import { isDead } from "@/lib/derive";
import { REGION_HEX, regionStatsFor } from "@/components/StatusBoard";
import { PublicDisplayBoard } from "@/components/PublicDisplayBoard";
import { MasmedReport } from "@/components/MasmedReport";

// Payload from the `player_status` RPC. Sessions are pre-filtered server-side to
// rounds that are already closed, so live/in-progress attendance never leaks.
export type PlayerData = {
  game_name: string;
  current_round: number;
  released_through: number;
  max_closed: number;
  heads: Record<string, string>; // role -> head name
  head_by_pid: Record<string, string>; // participant id -> role they head
  participants: Participant[];
  closed_rounds: { round_no: number; results: RoundResults }[];
  reports: { round_no: number; inputs: RoundInputs; results: RoundResults }[];
};

type Pill = "society" | "masmed" | Region;

const SOCIETY_COLOR = "#4de1c1";
const MASMED_COLOR = "#7c6cff";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  P: { label: "Present", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  A: { label: "Absent", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  E: { label: "Unemployed", cls: "bg-violet-500/15 text-violet-300 border-violet-500/40" },
};

export function PlayerView({ data }: { data: PlayerData }) {
  const [pill, setPill] = useState<Pill>("society");

  const rounds: Record<number, Round> = {};
  for (const r of data.closed_rounds) {
    rounds[r.round_no] = {
      id: String(r.round_no),
      game_id: "",
      round_no: r.round_no,
      inputs: {} as RoundInputs,
      results: r.results,
      closed: true,
    };
  }

  const pills: { key: Pill; label: string; color: string }[] = [
    { key: "society", label: "Society", color: SOCIETY_COLOR },
    { key: "masmed", label: "MASMED", color: MASMED_COLOR },
    ...REGIONS.map((r) => ({ key: r as Pill, label: r, color: REGION_HEX[r] })),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="px-5 md:px-10 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">{data.game_name}</h1>
          <div className="flex items-center gap-2 text-sm md:text-lg text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-red-400 simsoc-pulse" />
            SIMSOC · SESSION {data.current_round}
          </div>
        </div>
      </header>

      <nav className="px-3 md:px-8 py-3 border-b border-slate-800 overflow-x-auto">
        <div className="flex gap-2 md:justify-center min-w-max">
          {pills.map((p) => {
            const active = pill === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPill(p.key)}
                className="px-4 md:px-5 py-2 rounded-full text-sm md:text-base font-semibold whitespace-nowrap border transition"
                style={
                  active
                    ? { background: p.color, color: "#06121a", borderColor: p.color }
                    : { background: "transparent", color: p.color, borderColor: `${p.color}66` }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 px-5 md:px-10 py-6 md:py-10">
        {pill === "society" && <PublicDisplayBoard participants={data.participants} rounds={rounds} />}
        {pill === "masmed" && <MasmedPane data={data} />}
        {(REGIONS as readonly string[]).includes(pill) && <TeamPane region={pill as Region} data={data} />}
      </main>
    </div>
  );
}

function MasmedPane({ data }: { data: PlayerData }) {
  const reports = [...data.reports].sort((a, b) => b.round_no - a.round_no);
  const headName = (role: string) => data.heads[role] ?? "";

  if (!reports.length) {
    return (
      <div className="max-w-3xl mx-auto text-center text-slate-400 text-lg md:text-2xl py-16">
        No MASMED report published yet. The latest report appears here when your coordinator starts the next session.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {reports.map((rep, i) => (
        <div key={rep.round_no}>
          <div className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: MASMED_COLOR }}>
            {i === 0 ? "Latest report" : `Session ${rep.round_no}`}
          </div>
          <MasmedReport roundNo={rep.round_no} inputs={rep.inputs} results={rep.results} headName={headName} />
        </div>
      ))}
    </div>
  );
}

function TeamPane({ region, data }: { region: Region; data: PlayerData }) {
  const stats = regionStatsFor(data.participants, data.max_closed).find((s) => s.region === region)!;
  const members = data.participants.filter((p) => p.region === region);
  const hex = REGION_HEX[region];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: `${hex}1a`, border: `1px solid ${hex}55` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: hex }}>
            {region} Team
          </h2>
          <div className="text-right">
            <div className="text-4xl md:text-5xl font-extrabold tabular-nums" style={{ color: hex }}>
              {data.max_closed ? stats.score : "—"}
            </div>
            <div className="text-xs text-slate-400">health</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm md:text-base text-slate-300">
          <span>{stats.living} living</span>
          {stats.absent > 0 && <span className="text-amber-400">{stats.absent} absent</span>}
          {stats.unemp > 0 && <span className="text-violet-400">{stats.unemp} unemployed</span>}
          {stats.ns > 0 && <span className="text-orange-400">{stats.ns} no subsistence</span>}
          {stats.dead > 0 && <span className="text-red-400">{stats.dead} dead</span>}
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No players assigned to the {region} team yet.</p>
      ) : (
        <ul className="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
          {members.map((p) => {
            const dead = isDead(p, data.max_closed);
            const st = p.sessions?.[String(data.max_closed)] ?? {};
            const headRole = data.head_by_pid[p.id];
            const roleText = headRole ? `${headRole} Head` : p.role || p.team || null;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/40">
                <div className="min-w-0">
                  <div className="font-semibold text-base md:text-lg truncate">{p.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {roleText && <span className="text-xs md:text-sm text-slate-400 mr-1">{roleText}</span>}
                    {p.lux && <Chip cls="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">Lux</Chip>}
                    {p.ptc && <Chip cls="bg-sky-500/15 text-sky-300 border-sky-500/30">PTC</Chip>}
                    {data.max_closed > 0 && st.ns && !dead && (
                      <Chip cls="bg-orange-500/15 text-orange-300 border-orange-500/30">No subsist.</Chip>
                    )}
                  </div>
                </div>
                <StatusChip dead={dead} status={data.max_closed ? st.status : undefined} />
              </li>
            );
          })}
        </ul>
      )}

      {data.max_closed === 0 && (
        <p className="text-slate-500 text-sm text-center mt-4">Player status appears once the first session closes.</p>
      )}
    </div>
  );
}

function Chip({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>
  );
}

function StatusChip({ dead, status }: { dead: boolean; status?: string | null }) {
  if (dead) {
    return (
      <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold border bg-red-500/15 text-red-300 border-red-500/40">
        Deceased
      </span>
    );
  }
  const meta = status ? STATUS_META[status] : null;
  if (!meta) {
    return (
      <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold border bg-slate-700/30 text-slate-400 border-slate-600">
        —
      </span>
    );
  }
  return <span className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold border ${meta.cls}`}>{meta.label}</span>;
}
