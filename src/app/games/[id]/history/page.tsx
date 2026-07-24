"use client";

import { useRouter } from "next/navigation";
import { useGame } from "../game-context";
import { fmt } from "@/lib/derive";
import { TableSkeleton } from "@/components/Skeleton";

export default function HistoryPage() {
  const { loading, game, rounds, currentRound, reopenRound } = useGame();
  const router = useRouter();
  if (loading) return <TableSkeleton rows={6} cols={8} />;

  const roundNos = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  async function handleReopen(r: number) {
    if (!confirm(`Reopen session ${r}? Later sessions will need re-closing.`)) return;
    await reopenRound(r);
    router.push(`/games/${game.id}/session`);
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Round-by-Round History</h2>
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-neutral-400">
              <th>Session</th>
              <th>FES</th>
              <th>SL</th>
              <th>SC</th>
              <th>PC</th>
              <th>Mult</th>
              <th>Abs</th>
              <th>Unemp</th>
              <th>Riot</th>
              <th>Arr</th>
              <th>Dead</th>
              <th>BASIN $</th>
              <th>RETSIN $</th>
              <th>Total paid</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roundNos.map((r) => {
              const R = rounds[r];
              if (R.closed && R.results) {
                const x = R.results;
                return (
                  <tr key={r} className="border-t">
                    <td><b>{r}</b></td>
                    <td>{fmt(x.indicators.FES)}</td>
                    <td>{fmt(x.indicators.SL)}</td>
                    <td>{fmt(x.indicators.SC)}</td>
                    <td>{fmt(x.indicators.PC)}</td>
                    <td>{x.mult === null ? "✖" : x.mult}</td>
                    <td>{x.absentees}</td>
                    <td>{x.unemployed}</td>
                    <td>{x.rioters}</td>
                    <td>{x.arrests}</td>
                    <td>{x.deaths}</td>
                    <td>{fmt(x.basinNet)}</td>
                    <td>{fmt(x.retsinNet)}</td>
                    <td>${fmt(Object.values(x.net).reduce((a, b) => a + b, 0))}</td>
                    <td>
                      <button onClick={() => handleReopen(r)} className="border rounded px-2 py-0.5">
                        Reopen
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={r} className="border-t">
                  <td><b>{r}</b></td>
                  <td colSpan={13} className="text-neutral-400">
                    {r === currentRound ? "In progress" : "Not started"}
                  </td>
                  <td></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400 mt-2">
        Reopening a closed session lets you correct entries and re-close it (later rounds recompute).
      </p>
    </div>
  );
}
