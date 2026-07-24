"use client";

import { useState } from "react";
import { useGame } from "../game-context";
import { fmt } from "@/lib/derive";
import { EmptyState } from "@/components/EmptyState";
import { DocumentSkeleton } from "@/components/Skeleton";

export default function MasmedPage() {
  const { loading, game, rounds, heads, participants } = useGame();
  const closed = Object.values(rounds)
    .filter((r) => r.closed && r.results)
    .sort((a, b) => a.round_no - b.round_no);
  const [selected, setSelected] = useState<number | null>(null);

  if (loading) return <DocumentSkeleton />;
  if (!closed.length)
    return (
      <EmptyState
        text="No closed session yet — the MasMed report is generated once Session 1 is closed."
        href={`/games/${game.id}/session`}
        cta="Go to Session tab"
      />
    );

  const r = selected ?? closed[closed.length - 1].round_no;
  const round = rounds[r];
  if (!round?.results) return null;
  const R = round.results;
  const I = round.inputs;
  const D = R.disaster;
  const E = R.election;

  // Returns the head's name, or "" when no head is assigned to that group —
  // callers wrap it in parens themselves so an unassigned head omits the
  // parenthetical entirely instead of printing "(no head assigned)".
  const headOf = (role: string) => {
    const id = heads[role as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? p.name : "";
  };
  const headParen = (role: string) => (headOf(role) ? ` (${headOf(role)})` : "");
  const elecEffectText = (ev: { dFES: number; dSL: number; dSC: number; dPC: number }) => {
    const p: string[] = [];
    if (ev.dFES) p.push("FES " + (ev.dFES > 0 ? "+" : "") + ev.dFES);
    if (ev.dSL) p.push("SL " + (ev.dSL > 0 ? "+" : "") + ev.dSL);
    if (ev.dSC) p.push("SC " + (ev.dSC > 0 ? "+" : "") + ev.dSC);
    if (ev.dPC) p.push("PC " + (ev.dPC > 0 ? "+" : "") + ev.dPC);
    return p.join(" · ");
  };
  const disEffectText = (ev: { dFES: number; dSL: number; dSC: number; dPC: number }) => elecEffectText(ev);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 print:hidden">
        <label className="text-sm">
          Report for end of session{" "}
          <select
            value={r}
            onChange={(e) => setSelected(+e.target.value)}
            className="border rounded px-2 py-1 ml-1"
          >
            {closed.map((rr) => (
              <option key={rr.round_no} value={rr.round_no}>
                {rr.round_no}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => window.print()} className="bg-black text-white rounded px-3 py-1.5 text-sm">
          Print report
        </button>
      </div>

      <div className="bg-white text-black rounded-lg p-6 border">
        <h2 className="text-lg font-bold border-b-2 border-black pb-1">
          Report to MASMED — End of Session {r} (Form Y-1)
        </h2>
        <div className="grid grid-cols-3 gap-6 mt-3 text-sm">
          <div>
            <b>National Indicators</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>FES</td><td>{fmt(R.indicators.FES)}</td></tr>
                <tr><td>SL</td><td>{fmt(R.indicators.SL)}</td></tr>
                <tr><td>SC</td><td>{fmt(R.indicators.SC)}</td></tr>
                <tr><td>PC</td><td>{fmt(R.indicators.PC)}</td></tr>
                <tr><td>Income multiplier</td><td>{R.mult === null ? "COLLAPSE" : R.mult}</td></tr>
              </tbody>
            </table>
            <b className="block mt-3">Society</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>Size level</td><td>{R.level}</td></tr>
                <tr><td>Total population</td><td>{R.pop}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <b>Events</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>Absentees</td><td>{R.absentees}</td></tr>
                <tr><td>Unemployed</td><td>{R.unemployed}</td></tr>
                <tr><td>Rioters</td><td>{R.rioters}</td></tr>
                <tr><td>Guard posts</td><td>{R.guardPosts}</td></tr>
                <tr><td>Arrests</td><td>{R.arrests}</td></tr>
                <tr><td>Deaths</td><td>{R.deaths}</td></tr>
              </tbody>
            </table>
            <b className="block mt-3">Goal declarations</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>Positive</td><td>{I.goalsPos}</td></tr>
                <tr><td>Negative</td><td>{I.goalsNeg}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <b>Group support (cards)</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>POP</td><td>{I.scPOP}</td></tr>
                <tr><td>SOP</td><td>{I.scSOP}</td></tr>
                <tr><td>EMPIN</td><td>{I.scEMPIN}</td></tr>
                <tr><td>HUMSERV</td><td>{I.scHUMSERV}</td></tr>
                <tr><td>MASMED</td><td>{I.scMASMED}</td></tr>
              </tbody>
            </table>
            <b className="block mt-3">Investments</b>
            <table className="w-full text-xs mt-1">
              <tbody>
                <tr><td>R&amp;C $</td><td>{I.invRC}</td></tr>
                <tr><td>Welfare $</td><td>{I.invWelfare}</td></tr>
                <tr><td>BASIN passages</td><td>{I.basinPassages}</td></tr>
                <tr><td>RETSIN anagrams</td><td>{I.retsinAnagramsIn}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {D && (
          <div className="border-2 border-red-700 bg-red-50 rounded-lg p-3 mt-4">
            <div className="font-extrabold text-red-700">🌀 NATURAL DISASTER: {D.title || "Unnamed event"}</div>
            {disEffectText(D) && <div className="mt-1"><b>Effects on National Indicators:</b> {disEffectText(D)}</div>}
            {D.levy > 0 && <div><b>FEMA levy collected:</b> ${D.levy} (removed from circulation)</div>}
            {D.closures && <div><b>Travel restrictions:</b> {D.closures}</div>}
            {D.rules && (
              <div className="mt-1">
                <b>Emergency rules &amp; announcements:</b>
                <br />
                {D.rules}
              </div>
            )}
          </div>
        )}

        {E && (
          <div className="border-2 border-blue-700 bg-blue-50 rounded-lg p-3 mt-4">
            <div className="font-extrabold text-blue-700">
              🗳 NATIONAL ELECTION{E.winner ? ` — ${E.winner} VICTORY` : E.announce ? " — ANNOUNCEMENT" : ""}
            </div>
            {E.announce && (
              <div className="mt-1">
                A national election will be held <b>next session</b> between <b>POP</b>
                {headParen("POP")} and <b>SOP</b>
                {headParen("SOP")}. The winning party gains primary control of the treasury. Both party
                heads may travel freely next session, without travel tickets, to campaign in every region.
              </div>
            )}
            {E.winner && (
              <div className="mt-1">
                <b>{E.winner}</b> has won control of the treasury. Levy collected: ${fmt(E.treasury.total)}.
                <table className="w-full text-xs mt-1">
                  <thead>
                    <tr><th className="text-left">Region</th><th className="text-left">Members</th><th className="text-left">Levy due</th></tr>
                  </thead>
                  <tbody>
                    {E.treasury.rows.map((x) => (
                      <tr key={x.region}><td>{x.region}</td><td>{x.members}</td><td>${fmt(x.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-1">
                  <b>Distribution — {E.winner === "SOP" ? "social programs for those in need" : "industry development"}:</b>{" "}
                  {E.treasury.recips.map((g) => `${g} head${headParen(g)}: $${fmt(E.treasury.share)}`).join(" · ")}.
                </div>
              </div>
            )}
            {elecEffectText(E) && <div className="mt-1"><b>Effects on National Indicators:</b> {elecEffectText(E)}</div>}
            {E.notes && (
              <div className="mt-1">
                <b>Election rules &amp; announcements:</b>
                <br />
                {E.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
