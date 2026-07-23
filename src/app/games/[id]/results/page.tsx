"use client";

import { useGame } from "../game-context";
import { fmt } from "@/lib/derive";
import type { Indicators } from "@/lib/types";

function disEffectText(D: { dFES: number; dSL: number; dSC: number; dPC: number; subForfeit?: number; levy?: number }) {
  const parts: string[] = [];
  if (D.dFES) parts.push("FES " + (D.dFES > 0 ? "+" : "") + D.dFES);
  if (D.dSL) parts.push("SL " + (D.dSL > 0 ? "+" : "") + D.dSL);
  if (D.dSC) parts.push("SC " + (D.dSC > 0 ? "+" : "") + D.dSC);
  if (D.dPC) parts.push("PC " + (D.dPC > 0 ? "+" : "") + D.dPC);
  if (D.subForfeit) parts.push(`${D.subForfeit} subsistence cards forfeited`);
  if (D.levy) parts.push(`$${D.levy} FEMA levy`);
  return parts.join(" · ");
}
function elecEffectText(E: { dFES: number; dSL: number; dSC: number; dPC: number }) {
  const p: string[] = [];
  if (E.dFES) p.push("FES " + (E.dFES > 0 ? "+" : "") + E.dFES);
  if (E.dSL) p.push("SL " + (E.dSL > 0 ? "+" : "") + E.dSL);
  if (E.dSC) p.push("SC " + (E.dSC > 0 ? "+" : "") + E.dSC);
  if (E.dPC) p.push("PC " + (E.dPC > 0 ? "+" : "") + E.dPC);
  return p.join(" · ");
}

const NAMES: Record<keyof Indicators, string> = {
  FES: "Food & Energy Supply",
  SL: "Standard of Living",
  SC: "Social Cohesion",
  PC: "Public Commitment",
};

export default function ResultsPage() {
  const { loading, rounds, heads, participants, prevIndicators } = useGame();
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const closed = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .sort((a, b) => b.round_no - a.round_no);

  if (!closed.length) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Results</h2>
        <p className="text-sm text-neutral-500">
          No session closed yet. Enter data on the Session tab and press &quot;Close Session &amp; Calculate&quot;.
        </p>
      </div>
    );
  }

  const round = closed[0];
  const R = round.results!;
  const r = round.round_no;
  const prev = prevIndicators(r);
  const headName = (g: string) => {
    const id = heads[g as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? ` (${p.name})` : "";
  };

  const MAX = 130;
  const tiles = (Object.keys(NAMES) as (keyof Indicators)[]).map((k) => {
    const v = R.indicators[k];
    const d = Math.round((v - prev[k]) * 10) / 10;
    const cls = v >= 90 ? "text-green-600 border-green-300" : v >= 50 ? "text-amber-600 border-amber-300" : "text-red-600 border-red-300";
    const dcls = d > 0 ? "text-green-600" : d < 0 ? "text-red-600" : "text-neutral-400";
    const darr = d > 0 ? "▲" : d < 0 ? "▼" : "—";
    const w = Math.max(0, Math.min(100, (v / MAX) * 100));
    return (
      <div key={k} className={`border rounded-lg p-3 ${cls}`}>
        <div className="flex justify-between items-baseline text-xs">
          <span className="font-bold text-neutral-500">
            {k} · {NAMES[k]}
          </span>
          <span className={`font-semibold ${dcls}`}>
            {darr} {d === 0 ? "0" : Math.abs(d)}
          </span>
        </div>
        <div className="text-3xl font-extrabold">{fmt(v)}</div>
        <div className="h-3 bg-neutral-100 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-current rounded-full" style={{ width: `${w}%` }} />
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">
          next session starts at {fmt(Math.round(v * 0.9 * 10) / 10)} after natural decline
        </div>
      </div>
    );
  });

  const warns: { cls: string; text: string }[] = [];
  (Object.keys(NAMES) as (keyof Indicators)[]).forEach((k) => {
    const v = R.indicators[k];
    const headroom = Math.round(v * 0.9 * 10) / 10;
    if (v < 0) warns.push({ cls: "bg-red-50 border-red-400 text-red-700", text: `☠ ${k} is below zero — the society has COLLAPSED.` });
    else if (v < 10)
      warns.push({
        cls: "bg-red-50 border-red-400 text-red-700",
        text: `⛔ ${k} = ${fmt(v)} — CRITICAL: only ${headroom} points from collapse; multiplier already at 0.1.`,
      });
    else if (v < 25)
      warns.push({
        cls: "bg-amber-50 border-amber-400 text-amber-700",
        text: `⚠ ${k} = ${fmt(v)} — danger close: one bad session could push it below 0. Headroom: ${headroom}.`,
      });
    else if (v < 50)
      warns.push({
        cls: "bg-neutral-50 border-neutral-300 text-neutral-600",
        text: `👁 ${k} = ${fmt(v)} — watch: dragging multiplier down (×${R.mult ?? "—"}).`,
      });
  });

  const multTxt = R.mult === null ? "COLLAPSE" : `×${R.mult}`;
  const netTotal = Object.values(R.net).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          End of Session {r} — National Indicators
        </h2>
        {R.disaster && (
          <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded px-3 py-2 mb-2">
            🌀 <b>{R.disaster.title || "Natural disaster"}</b> struck this session — impact:{" "}
            {disEffectText(R.disaster) || "none"}. Details in the MasMed report.
          </div>
        )}
        {R.election && (
          <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded px-3 py-2 mb-2">
            🗳 {R.election.announce ? "Election ANNOUNCED — POP vs SOP vote next session. " : ""}
            {R.election.winner
              ? `${R.election.winner} won — treasury $${fmt(R.election.treasury.total)} collected; $${fmt(
                  R.election.treasury.share
                )} each to ${R.election.treasury.recips.join(", ")}. `
              : ""}
            {elecEffectText(R.election) ? `Indicator impact: ${elecEffectText(R.election)}.` : ""}
          </div>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {tiles}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="border rounded-lg text-center py-2">
            <div className="text-xl font-bold">{fmt(R.minInd)}</div>
            <div className="text-[10px] uppercase text-neutral-400">Lowest</div>
          </div>
          <div className="border rounded-lg text-center py-2">
            <div className={`text-xl font-bold ${R.mult === null ? "text-red-600" : R.mult >= 1 ? "text-green-600" : "text-amber-600"}`}>
              {multTxt}
            </div>
            <div className="text-[10px] uppercase text-neutral-400">Income multiplier</div>
          </div>
        </div>
        {warns.length > 0 ? (
          <div className="mt-3 space-y-1">
            <h3 className="text-xs text-neutral-500">Collapse risk</h3>
            {warns.map((w, i) => (
              <div key={i} className={`text-xs border rounded px-3 py-2 ${w.cls}`}>
                {w.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs bg-green-50 border border-green-300 text-green-800 rounded px-3 py-2 mt-3">
            ✓ No indicators near collapse.
          </div>
        )}
        <p className="text-xs text-neutral-400 mt-3">
          Pop: {R.pop} · Absent: {R.absentees} · Unemployed: {R.unemployed} · Deaths: {R.deaths} · Rioters:{" "}
          {R.rioters} · Guard posts: {R.guardPosts} · Arrests: {R.arrests}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="border rounded-lg p-4">
          <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
            Payments to distribute for Session {r + 1}
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-neutral-400">
                <th>Group</th>
                <th>Basic income</th>
                <th>× {R.mult ?? "—"}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(R.basic).map((g) => (
                <tr key={g} className="border-t">
                  <td>
                    <b>{g}</b>
                    <span className="text-neutral-400">{headName(g)}</span>
                  </td>
                  <td>${fmt(R.basic[g])}</td>
                  <td>
                    <b>${fmt(R.net[g])}</b>
                  </td>
                </tr>
              ))}
              <tr className="border-t font-bold">
                <td>Total</td>
                <td></td>
                <td>${fmt(netTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Industry ledger</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-neutral-400">
                <th></th>
                <th>BASIN</th>
                <th>RETSIN</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td>Work payment earned</td>
                <td>${fmt(R.basinPay)}</td>
                <td>${fmt(R.retsinPay)}</td>
              </tr>
              <tr className="border-t">
                <td>Net assets (carried forward)</td>
                <td>${fmt(R.basinNet)}</td>
                <td>${fmt(R.retsinNet)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-neutral-400 mt-2">Size level {R.level}</p>
        </div>
      </div>
    </div>
  );
}
