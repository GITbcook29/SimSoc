"use client";

import { useGame } from "../game-context";
import { REGIONS, type Region } from "@/lib/types";
import { isDead } from "@/lib/derive";
import type { Participant } from "@/lib/types";

const IND_COLORS: Record<string, string> = { FES: "#4da3ff", SL: "#3ecf8e", SC: "#f59e0b", PC: "#a78bfa" };
const REGION_HEX: Record<Region, string> = { Red: "#e05555", Yellow: "#ca9a1f", Blue: "#5590e0", Green: "#55b06a" };

function regionStatsFor(roster: Participant[], round: number) {
  return REGIONS.map((reg) => {
    const members = roster.filter((p) => p.region === reg);
    const N = members.length;
    let living = 0,
      absent = 0,
      unemp = 0,
      dead = 0,
      ns = 0;
    members.forEach((p) => {
      const isD = isDead(p, round);
      if (isD) dead++;
      else living++;
      const st = p.sessions[String(round)] ?? {};
      if (!isD) {
        if (st.status === "A") absent++;
        if (st.status === "E") unemp++;
        if (st.ns) ns++;
      }
    });
    const score = N ? Math.max(0, Math.min(100, Math.round((100 * living) / N - 8 * absent - 6 * unemp - 4 * ns))) : 0;
    return { region: reg, N, living, absent, unemp, dead, ns, score };
  });
}

function LineChart({
  series,
  rounds,
  w = 780,
  h = 260,
  ymax = 130,
}: {
  series: { name: string; color: string; values: number[] }[];
  rounds: number[];
  w?: number;
  h?: number;
  ymax?: number;
}) {
  const padL = 34,
    padB = 24,
    padT = 10,
    padR = 40;
  const iw = w - padL - padR,
    ih = h - padT - padB;
  const x = (i: number) => padL + (rounds.length < 2 ? iw / 2 : (i / (rounds.length - 1)) * iw);
  const y = (v: number) => padT + ih - (Math.max(0, Math.min(ymax, v)) / ymax) * ih;
  const grid = [];
  for (let gv = 0; gv <= ymax; gv += 25) {
    grid.push(
      <g key={gv}>
        <line x1={padL} y1={y(gv)} x2={w - padR} y2={y(gv)} stroke="#e5e7eb" strokeWidth={1} />
        <text x={padL - 6} y={y(gv) + 4} fill="#9ca3af" fontSize={10} textAnchor="end">
          {gv}
        </text>
      </g>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {grid}
      {rounds.map((r, i) => (
        <text key={r} x={x(i)} y={h - 6} fill="#9ca3af" fontSize={11} textAnchor="middle">
          S{r}
        </text>
      ))}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const last = s.values[s.values.length - 1];
        return (
          <g key={s.name}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />
            ))}
            <text x={x(s.values.length - 1) + 6} y={y(last) + 4} fill={s.color} fontSize={11} fontWeight={700}>
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function StatusPage() {
  const { loading, participants, rounds } = useGame();
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const closedRounds = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .map((r) => r.round_no)
    .sort((a, b) => a - b);

  if (!closedRounds.length) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Society Status</h2>
        <p className="text-sm text-neutral-500">No sessions closed yet — the status board comes alive after Session 1 is closed.</p>
      </div>
    );
  }

  const last = closedRounds[closedRounds.length - 1];
  const R = rounds[last].results!;
  const series = (["FES", "SL", "SC", "PC"] as const).map((k) => ({
    name: k,
    color: IND_COLORS[k],
    values: closedRounds.map((r) => rounds[r].results!.indicators[k]),
  }));
  const stats = regionStatsFor(participants, last);

  return (
    <div>
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          Society Health — National Indicators through Session {last}
        </h2>
        <LineChart series={series} rounds={closedRounds} />
        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Income multiplier by session</h3>
        <div className="flex gap-2">
          {closedRounds.map((r) => {
            const m = rounds[r].results!.mult;
            const color = m === null ? "text-red-600" : m >= 1 ? "text-green-600" : m >= 0.5 ? "text-amber-600" : "text-red-600";
            return (
              <div key={r} className="flex-1 text-center">
                <div className={`font-extrabold text-lg ${color}`}>{m === null ? "✖" : "×" + m}</div>
                <div className="text-[10px] text-neutral-400">S{r}</div>
              </div>
            );
          })}
        </div>
        {R.mult === null && (
          <div className="bg-red-50 border border-red-400 text-red-700 rounded px-3 py-2 mt-2 font-bold">
            ☠ THE SOCIETY HAS COLLAPSED
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {stats.map((st) => {
          const sc = st.score >= 75 ? "text-green-600" : st.score >= 45 ? "text-amber-600" : "text-red-600";
          const barMax = Math.max(1, st.N);
          const bar = (label: string, val: number, color: string) => (
            <div key={label} className="flex items-center gap-2 text-xs my-1">
              <span className="w-20 text-neutral-500">{label}</span>
              <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${(val / barMax) * 100}%`, background: color }} />
              </div>
              <span className="w-5 text-right font-bold">{val}</span>
            </div>
          );
          return (
            <div key={st.region} className="border rounded-lg p-3" style={{ borderTop: `4px solid ${REGION_HEX[st.region]}` }}>
              <div className="flex justify-between items-center">
                <h2 className="font-bold" style={{ color: REGION_HEX[st.region] }}>
                  {st.region}
                </h2>
                <div className="text-center">
                  <div className={`text-2xl font-extrabold ${sc}`}>{st.score}</div>
                  <div className="text-[10px] text-neutral-400">health</div>
                </div>
              </div>
              {bar("Living", st.living, "#22c55e")}
              {bar("Absent", st.absent, "#f59e0b")}
              {bar("Unemployed", st.unemp, "#a78bfa")}
              {bar("No subsist.", st.ns, "#fb923c")}
              {bar("Dead", st.dead, "#ef4444")}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-neutral-400 mt-3">
        Region health = 100 × living ÷ region size, minus 8 per absentee, 6 per unemployed, and 4 per missed
        subsistence this session (floor 0).
      </p>
    </div>
  );
}
