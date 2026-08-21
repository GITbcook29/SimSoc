import { fmt } from "@/lib/derive";
import { disasterLevyCollectedTotal, disasterLevyRows } from "@/lib/simsoc-engine.js";
import type { RoundInputs, RoundResults } from "@/lib/types";

// The MasMed "Report to MASMED" paper document. Intentionally a white
// (bg-white/text-black) printable sheet regardless of the app's dark theme —
// it is printed and read aloud. Shared by the coordinator's MasMed tab and the
// player status view so both render identically.
//
// `headName(role)` returns the head participant's name for a group role, or ""
// when no head is assigned — callers get the parenthetical omitted entirely
// (never "(no head assigned)").
export function MasmedReport({
  roundNo,
  inputs,
  results,
  headName,
}: {
  roundNo: number;
  inputs: RoundInputs;
  results: RoundResults;
  headName: (role: string) => string;
}) {
  const R = results;
  const I = inputs;
  const D = R.disaster;
  const E = R.election;

  const headParen = (role: string) => (headName(role) ? ` (${headName(role)})` : "");
  const elecEffectText = (ev: { dFES: number; dSL: number; dSC: number; dPC: number }) => {
    const p: string[] = [];
    if (ev.dFES) p.push("FES " + (ev.dFES > 0 ? "+" : "") + ev.dFES);
    if (ev.dSL) p.push("SL " + (ev.dSL > 0 ? "+" : "") + ev.dSL);
    if (ev.dSC) p.push("SC " + (ev.dSC > 0 ? "+" : "") + ev.dSC);
    if (ev.dPC) p.push("PC " + (ev.dPC > 0 ? "+" : "") + ev.dPC);
    return p.join(" · ");
  };
  const disEffectText = (ev: { dFES: number; dSL: number; dSC: number; dPC: number }) => elecEffectText(ev);

  const disLevyRows = D ? disasterLevyRows(D) : [];
  const disShortfallRegions = disLevyRows.filter((r) => r.shortfall > 0);
  const disShortfall = disShortfallRegions.reduce((a, r) => a + r.shortfall, 0);
  const disInKindRegions = disLevyRows.filter((r) => r.inKind > 0);
  const elecShortfallRegions = E?.treasury ? E.treasury.rows.filter((r) => r.shortfall > 0) : [];
  const elecShortfall = elecShortfallRegions.reduce((a, r) => a + r.shortfall, 0);
  const elecInKindRegions = E?.treasury ? E.treasury.rows.filter((r) => r.inKind > 0) : [];

  return (
    <div className="bg-white text-black rounded-lg p-6 border">
      <h2 className="text-lg font-bold border-b-2 border-black pb-1">
        Report to MASMED — End of Session {roundNo} (Form Y-1)
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-3 text-sm">
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
          {D.levy > 0 && <div><b>FEMA levy assessed:</b> ${fmt(D.levy)} (${fmt(disasterLevyCollectedTotal(D))} collected, removed from circulation)</div>}
          {D.levy > 0 && disShortfall > 0 && (
            <div className="text-red-700 font-semibold">
              {disShortfallRegions.map((r) => `${r.region} Region failed to remit $${fmt(r.shortfall)} of its $${fmt(r.assessed)} assessment`).join("; ")}.
            </div>
          )}
          {D.levy > 0 && disInKindRegions.length > 0 && (
            <div>
              <b>Paid in kind:</b>{" "}
              {disInKindRegions.map((r) => `${r.region} — ${r.inKind} subsistence card${r.inKind === 1 ? "" : "s"}`).join(", ")}.
            </div>
          )}
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
              <b>{E.winner}</b> has won control of the treasury. Levy assessed: ${fmt(E.treasury.totalAssessed)} ·
              collected: ${fmt(E.treasury.total)}.
              <table className="w-full text-xs mt-1">
                <thead>
                  <tr><th className="text-left">Region</th><th className="text-left">Members</th><th className="text-left">Assessed</th><th className="text-left">Collected</th></tr>
                </thead>
                <tbody>
                  {E.treasury.rows.map((x) => (
                    <tr key={x.region}><td>{x.region}</td><td>{x.members}</td><td>${fmt(x.assessed)}</td><td>${fmt(x.collected)}</td></tr>
                  ))}
                </tbody>
              </table>
              {elecShortfall > 0 && (
                <div className="text-red-700 font-semibold mt-1">
                  {elecShortfallRegions.map((r) => `${r.region} Region failed to remit $${fmt(r.shortfall)} of its $${fmt(r.assessed)} assessment`).join("; ")}.
                  The winning heads receive less as a result.
                </div>
              )}
              {elecInKindRegions.length > 0 && (
                <div className="mt-1">
                  <b>Paid in kind:</b>{" "}
                  {elecInKindRegions.map((r) => `${r.region} — ${r.inKind} subsistence card${r.inKind === 1 ? "" : "s"}`).join(", ")}.
                </div>
              )}
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
  );
}
