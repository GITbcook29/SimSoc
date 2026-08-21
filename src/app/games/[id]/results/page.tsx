"use client";

import { useGame } from "../game-context";
import { collapseTier, fmt } from "@/lib/derive";
import { computeCirculation, roundFlow } from "@/lib/simsoc-engine.js";
import type { Indicators } from "@/lib/types";
import { SEVERITY_BANNER, SEVERITY_TILE, SEVERITY_TEXT, TYPE, type Severity } from "@/lib/tokens";
import { EmptyState } from "@/components/EmptyState";
import { TileGridSkeleton } from "@/components/Skeleton";

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
  const { loading, game, rounds, heads, participants, prevIndicators } = useGame();
  if (loading) return <TileGridSkeleton tiles={4} />;

  const closed = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .sort((a, b) => b.round_no - a.round_no);

  if (!closed.length) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Results</h2>
        <EmptyState
          text={'No session closed yet — results appear here once you close Session 1.'}
          href={`/games/${game.id}/session`}
          cta="Go to Session tab"
        />
      </div>
    );
  }

  const round = closed[0];
  const R = round.results!;
  const r = round.round_no;
  const prev = prevIndicators(r);
  const tier = collapseTier(R.indicators, prev);

  const circNow = computeCirculation({ rounds, currentRound: r, level: R.level });
  const circPrev = r > 1 ? computeCirculation({ rounds, currentRound: r - 1, level: R.level }) : null;
  const circDelta = Math.round((circNow.total - (circPrev?.total ?? 0)) * 10) / 10;
  const { issued: roundIssued, removed: roundRemoved } = roundFlow(round, rounds[r - 1], R.level);
  const headName = (g: string) => {
    const id = heads[g as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? ` (${p.name})` : "";
  };

  const MAX = 130;
  const tiles = (Object.keys(NAMES) as (keyof Indicators)[]).map((k) => {
    const v = R.indicators[k];
    const d = Math.round((v - prev[k]) * 10) / 10;
    const sev: Severity = v >= 90 ? "success" : v >= 50 ? "warning" : "danger";
    const cls = SEVERITY_TILE[sev];
    const dcls = d > 0 ? SEVERITY_TEXT.success : d < 0 ? SEVERITY_TEXT.danger : "text-neutral-400";
    const darr = d > 0 ? "▲" : d < 0 ? "▼" : "—";
    const w = Math.max(0, Math.min(100, (v / MAX) * 100));
    return (
      <div key={k} className={`border rounded-xl p-3 text-center bg-[var(--inset)] ${cls}`}>
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500 min-h-[26px]">
          {k} · {NAMES[k]}
        </div>
        <div
          className="relative w-[92px] h-[92px] mx-auto my-2 rounded-full"
          style={{ background: `conic-gradient(currentColor ${w}%, var(--line) 0)` }}
        >
          <div className="absolute inset-[9px] rounded-full bg-[var(--inset)] flex items-center justify-center">
            <span className={`${TYPE.kpi} text-[var(--foreground)]`}>{fmt(v)}</span>
          </div>
        </div>
        <div className={`text-xs font-semibold font-mono ${dcls}`}>
          {darr} {d === 0 ? "0" : Math.abs(d)}
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">
          next session starts at {fmt(Math.round(v * 0.9 * 10) / 10)} after natural decline
        </div>
        {R.absorbed[k] > 0 && (
          <div className="text-[11px] text-red-400 mt-1 font-semibold">
            floor applied — raw {fmt(R.raw[k])}, clipped to {fmt(v)} (−{fmt(R.absorbed[k])} absorbed)
          </div>
        )}
      </div>
    );
  });

  const anyClipped = (Object.keys(NAMES) as (keyof Indicators)[]).some((k) => R.absorbed[k] > 0);

  // Trajectory-based collapse warning: the engine's −30 floor means any
  // indicator whose next-session starting value is ≤30 can reach zero in a
  // single round — that's the real red line, not an arbitrary level.
  const warns: { sev: Severity; text: string }[] = [];
  (Object.keys(NAMES) as (keyof Indicators)[]).forEach((k) => {
    const v = R.indicators[k];
    const { tier: kTier, nextStart, roundsToZero } = tier.perIndicator[k];
    if (kTier === "collapsed") {
      warns.push({ sev: "danger", text: `☠ ${k} is below zero — the society has COLLAPSED.` });
    } else if (kTier === "critical") {
      warns.push({
        sev: "danger",
        text:
          nextStart <= 30
            ? `⛔ ${k} = ${fmt(v)} — CRITICAL: next session starts at ${fmt(nextStart)}, reachable to zero in a single bad round.`
            : `⛔ ${k} = ${fmt(v)} — CRITICAL: only ${fmt(nextStart)} points from collapse.`,
      });
    } else if (kTier === "watch") {
      warns.push({
        sev: "warning",
        text:
          roundsToZero !== null && roundsToZero <= 3
            ? `⚠ ${k} = ${fmt(v)} — watch: at this rate of decline, zero is ${fmt(roundsToZero)} rounds away.`
            : `⚠ ${k} = ${fmt(v)} — watch: below 50, dragging multiplier down (×${R.mult ?? "—"}).`,
      });
    }
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
          <div className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded px-3 py-2 mb-2">
            🌀 <b>{R.disaster.title || "Natural disaster"}</b> struck this session — impact:{" "}
            {disEffectText(R.disaster) || "none"}. Details in the MasMed report.
          </div>
        )}
        {R.election && (
          <div className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded px-3 py-2 mb-2">
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
            <div className={TYPE.kpiSm}>{fmt(R.minInd)}</div>
            <div className="text-[10px] uppercase text-neutral-400">Lowest</div>
          </div>
          <div className="border rounded-lg text-center py-2">
            <div
              className={`${TYPE.kpiSm} ${
                R.mult === null ? SEVERITY_TEXT.danger : R.mult >= 1 ? SEVERITY_TEXT.success : SEVERITY_TEXT.warning
              }`}
            >
              {multTxt}
            </div>
            <div className="text-[10px] uppercase text-neutral-400">Income multiplier</div>
          </div>
        </div>
        {warns.length > 0 ? (
          <div className="mt-3 space-y-1">
            <h3 className="text-xs text-neutral-500">Collapse risk</h3>
            {warns.map((w, i) => (
              <div key={i} className={`text-xs border rounded px-3 py-2 ${SEVERITY_BANNER[w.sev]}`}>
                {w.text}
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-xs border rounded px-3 py-2 mt-3 ${SEVERITY_BANNER.success}`}>
            ✓ Stable — no indicator projected to reach zero within three rounds at its current rate of decline.
          </div>
        )}
        {anyClipped && (
          <div className={`text-xs border rounded px-3 py-2 mt-2 ${SEVERITY_BANNER.danger}`}>
            🛡 The −30 floor absorbed damage this round —{" "}
            {(Object.keys(NAMES) as (keyof Indicators)[])
              .filter((k) => R.absorbed[k] > 0)
              .map((k) => `${k} −${fmt(R.absorbed[k])}`)
              .join(", ")}
            . The society took more damage than the displayed numbers show.
          </div>
        )}
        <p className="text-xs text-neutral-400 mt-3">
          Pop: {R.pop} · Absent: {R.absentees} · Unemployed: {R.unemployed} · Deaths: {R.deaths} · Rioters:{" "}
          {R.rioters} · Guard posts: {R.guardPosts} · Arrests: {R.arrests}
        </p>
      </div>

      <div className="border rounded-lg p-4 mt-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Money Supply</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className={TYPE.kpi}>${fmt(circNow.total)}</div>
            <div className="text-[10px] uppercase text-neutral-400">In circulation</div>
          </div>
          <div className={`text-sm font-semibold font-mono ${circDelta > 0 ? SEVERITY_TEXT.success : circDelta < 0 ? SEVERITY_TEXT.danger : "text-neutral-400"}`}>
            {circDelta > 0 ? "▲" : circDelta < 0 ? "▼" : "—"} ${fmt(Math.abs(circDelta))} this round
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Issued this round: <b className="text-neutral-300">${fmt(roundIssued)}</b> (payments + withdrawals) · Removed
          this round: <b className="text-neutral-300">${fmt(roundRemoved)}</b> (purchases + fees + levies)
        </p>
        {Math.abs(circNow.variance) > 0.05 && (
          <p className="text-xs text-amber-400 mt-1">
            ⚠ Region + group cash (${fmt(circNow.total)}) vs. tracked flows since Session 1 (${fmt(circNow.flowTotal)})
            — variance ${fmt(circNow.variance)}. A coordinator&apos;s aid, not a hard constraint.
          </p>
        )}
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
                <td>Passage purchases</td>
                <td>{R.basinPassageCost != null ? (R.basinPassageCost ? `−$${fmt(R.basinPassageCost)}` : "$0") : "—"}</td>
                <td>—</td>
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
