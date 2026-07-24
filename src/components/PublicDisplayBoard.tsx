import { REGIONS } from "@/lib/types";
import type { Participant, Round } from "@/lib/types";
import { IND_COLORS, REGION_HEX, regionStatsFor } from "@/components/StatusBoard";

const IND_LABELS: Record<string, string> = {
  FES: "Food/Energy/Space",
  SL: "Standard of Living",
  SC: "Social Cohesion",
  PC: "Political Cohesion",
};

function BigLineChart({
  series,
  rounds,
  ymax = 130,
}: {
  series: { name: string; color: string; values: number[] }[];
  rounds: number[];
  ymax?: number;
}) {
  const w = 1200,
    h = 420;
  const padL = 56,
    padB = 40,
    padT = 16,
    padR = 24;
  const iw = w - padL - padR,
    ih = h - padT - padB;
  const x = (i: number) => padL + (rounds.length < 2 ? iw / 2 : (i / (rounds.length - 1)) * iw);
  const y = (v: number) => padT + ih - (Math.max(0, Math.min(ymax, v)) / ymax) * ih;
  const grid = [];
  for (let gv = 0; gv <= ymax; gv += 25) {
    grid.push(
      <g key={gv}>
        <line x1={padL} y1={y(gv)} x2={w - padR} y2={y(gv)} stroke="#334155" strokeWidth={1} />
        <text x={padL - 10} y={y(gv) + 5} fill="#94a3b8" fontSize={16} textAnchor="end">
          {gv}
        </text>
      </g>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {grid}
      {rounds.map((r, i) => (
        <text key={r} x={x(i)} y={h - 10} fill="#94a3b8" fontSize={18} textAnchor="middle">
          S{r}
        </text>
      ))}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={s.name}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={5.5} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function PublicDisplayBoard({ participants, rounds }: { participants: Participant[]; rounds: Record<number, Round> }) {
  const closedRounds = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .map((r) => r.round_no)
    .sort((a, b) => a - b);

  if (!closedRounds.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-3xl text-slate-400">Society status will appear here once Session 1 closes.</p>
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
    <div className="flex flex-col gap-10">
      {R.mult === null && (
        <div className="bg-red-950 border-2 border-red-500 text-red-300 rounded-2xl px-8 py-6 text-center text-4xl md:text-5xl font-extrabold tracking-wide">
          ☠ THE SOCIETY HAS COLLAPSED
        </div>
      )}

      {/* Headline indicator tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {series.map((s) => (
          <div key={s.name} className="text-center">
            <div className="text-6xl md:text-7xl font-extrabold tabular-nums" style={{ color: s.color }}>
              {s.values[s.values.length - 1]}
            </div>
            <div className="mt-2 text-lg md:text-xl font-semibold text-slate-300">{s.name}</div>
            <div className="text-sm text-slate-500">{IND_LABELS[s.name]}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-3">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full" style={{ background: s.color }} />
              <span className="text-lg font-semibold" style={{ color: s.color }}>
                {s.name}
              </span>
            </div>
          ))}
          <span className="ml-auto text-lg text-slate-400">
            Income multiplier: <span className="font-bold text-slate-100">{R.mult === null ? "✖" : `×${R.mult}`}</span>
          </span>
        </div>
        <BigLineChart series={series} rounds={closedRounds} />
      </div>

      {/* Region health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {REGIONS.map((reg) => {
          const st = stats.find((s) => s.region === reg)!;
          return (
            <div key={reg} className="rounded-2xl px-6 py-5" style={{ backgroundColor: `${REGION_HEX[reg]}1a` }}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-bold" style={{ color: REGION_HEX[reg] }}>
                  {reg}
                </h2>
                <div className="text-5xl font-extrabold tabular-nums" style={{ color: REGION_HEX[reg] }}>
                  {st.score}
                </div>
              </div>
              <div className="mt-3 text-lg text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                <span>{st.living} living</span>
                {st.absent > 0 && <span className="text-amber-400">{st.absent} absent</span>}
                {st.unemp > 0 && <span className="text-violet-400">{st.unemp} unemployed</span>}
                {st.ns > 0 && <span className="text-orange-400">{st.ns} no subsist.</span>}
                {st.dead > 0 && <span className="text-red-400">{st.dead} dead</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
