"use client";

import { useGame } from "../game-context";
import type { ElectionInputs } from "@/lib/types";
import { electionTreasury } from "@/lib/simsoc-engine.js";
import { fmt, livingByRegion } from "@/lib/derive";
import { CardSkeleton } from "@/components/Skeleton";

const ELEC_PRESETS: Record<string, Partial<ElectionInputs>> = {
  announce: {
    announce: true,
    winner: "",
    dFES: 0,
    dSL: 0,
    dSC: 0,
    dPC: 2,
    notes:
      "A national election will be held next session between POP and SOP. The winner gains primary control of the treasury. The heads of POP and SOP may travel freely next session, without tickets, to campaign in all regions.",
  },
  sopWin: {
    announce: false,
    winner: "SOP",
    levyPerMember: 2,
    levyFlat: 10,
    dSL: 4,
    dSC: 2,
    dPC: 2,
    dFES: 0,
    notes:
      "SOP has won the election. A social-program levy is collected from every region. Funds go to the heads of SOP, HUMSERV, and EMPIN to create programs for those in need — they alone decide how the money is spent.",
  },
  popWin: {
    announce: false,
    winner: "POP",
    levyPerMember: 2,
    levyFlat: 10,
    dFES: 4,
    dSL: 2,
    dSC: 0,
    dPC: 2,
    notes:
      "POP has won the election. An industry-development levy is collected from every region. Funds go to the heads of POP, BASIN, and RETSIN to expand production and employment.",
  },
  contested: {
    announce: false,
    winner: "",
    dFES: 0,
    dSL: 0,
    dSC: -6,
    dPC: -6,
    notes:
      "The election result is disputed. JUDCO must rule on the outcome before any treasury funds move. Social Cohesion and Public Commitment suffer while the society waits.",
  },
  clear: { announce: false, winner: "", levyPerMember: 0, levyFlat: 0, dFES: 0, dSL: 0, dSC: 0, dPC: 0, notes: "" },
};

function elecActive(E: ElectionInputs) {
  return !!(E.announce || E.winner || E.levyPerMember || E.levyFlat || E.dFES || E.dSL || E.dSC || E.dPC || E.notes);
}

function elecEffectText(E: ElectionInputs) {
  const p: string[] = [];
  if (E.dFES) p.push("FES " + (E.dFES > 0 ? "+" : "") + E.dFES);
  if (E.dSL) p.push("SL " + (E.dSL > 0 ? "+" : "") + E.dSL);
  if (E.dSC) p.push("SC " + (E.dSC > 0 ? "+" : "") + E.dSC);
  if (E.dPC) p.push("PC " + (E.dPC > 0 ? "+" : "") + E.dPC);
  return p.join(" · ");
}

export default function ElectionPage() {
  const { loading, currentRound, rounds, heads, participants, setElecInput } = useGame();
  if (loading) return <CardSkeleton rows={7} />;
  const round = rounds[currentRound];
  if (!round) return null;
  const E: ElectionInputs = {
    announce: false,
    winner: "",
    levyPerMember: 0,
    levyFlat: 0,
    dFES: 0,
    dSL: 0,
    dSC: 0,
    dPC: 0,
    notes: "",
    ...(round.inputs.elec as Partial<ElectionInputs> | undefined),
  };

  const headOf = (role: string) => {
    const id = heads[role as keyof typeof heads];
    const p = id && participants.find((x) => x.id === id);
    return p ? p.name : "(no head assigned)";
  };

  const regionLiving = livingByRegion(participants, currentRound);
  const T = electionTreasury(E, regionLiving);

  async function applyPreset(name: string) {
    const preset = ELEC_PRESETS[name];
    for (const [k, v] of Object.entries(preset)) {
      await setElecInput(k, v as string | number | boolean);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          National Election — Session {currentRound}
        </h2>
        <p className="text-xs text-neutral-500 mb-2">
          Two phases. <b>1) Announce:</b> check the box and close the session. <b>2) Decide:</b> next session, hold
          the vote, set the winner and levy here, then close.
        </p>
        <label className="flex items-center gap-2 my-2 text-sm">
          <input
            type="checkbox"
            checked={E.announce}
            onChange={(e) => setElecInput("announce", e.target.checked)}
          />
          <b>Announce election in this session&apos;s MasMed report</b>
        </label>
        <div className="flex items-center gap-2 py-1 text-sm">
          <span className="w-32 shrink-0 text-xs">Election result</span>
          <select
            value={E.winner}
            onChange={(e) => setElecInput("winner", e.target.value)}
            className="border rounded px-2 py-1 text-sm flex-1"
          >
            <option value="">— no result yet —</option>
            <option value="POP">POP wins (industry program)</option>
            <option value="SOP">SOP wins (social program)</option>
          </select>
        </div>
        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Quick presets</h3>
        <div className="flex gap-2 flex-wrap text-xs mb-3">
          <button onClick={() => applyPreset("announce")} className="border rounded px-2 py-1">Announce vote</button>
          <button onClick={() => applyPreset("sopWin")} className="border rounded px-2 py-1">SOP victory</button>
          <button onClick={() => applyPreset("popWin")} className="border rounded px-2 py-1">POP victory</button>
          <button onClick={() => applyPreset("contested")} className="border rounded px-2 py-1">Contested / disputed</button>
          <button onClick={() => applyPreset("clear")} className="border rounded px-2 py-1">Clear election</button>
        </div>
        <h3 className="text-xs text-neutral-500 mb-1">Indicator shocks</h3>
        {(["dFES", "dSL", "dSC", "dPC"] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 py-1 text-sm">
            <span className="flex-1 text-xs text-neutral-500">{k.slice(1)}</span>
            <input
              type="number"
              defaultValue={E[k]}
              key={E[k]}
              onBlur={(e) => setElecInput(k, +e.target.value || 0)}
              className="w-20 border rounded px-2 py-1 text-right text-sm"
            />
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Treasury Levy &amp; Distribution</h2>
        <div className="flex items-center gap-2 py-1 text-sm">
          <span className="flex-1 text-xs text-neutral-500">Levy per living citizen ($)</span>
          <input
            type="number"
            defaultValue={E.levyPerMember}
            key={"per" + E.levyPerMember}
            onBlur={(e) => setElecInput("levyPerMember", +e.target.value || 0)}
            className="w-20 border rounded px-2 py-1 text-right text-sm"
          />
        </div>
        <div className="flex items-center gap-2 py-1 text-sm">
          <span className="flex-1 text-xs text-neutral-500">Flat levy per region ($)</span>
          <input
            type="number"
            defaultValue={E.levyFlat}
            key={"flat" + E.levyFlat}
            onBlur={(e) => setElecInput("levyFlat", +e.target.value || 0)}
            className="w-20 border rounded px-2 py-1 text-right text-sm"
          />
        </div>

        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Collection preview (living members)</h3>
        <table className="w-full text-xs border-collapse mb-2">
          <thead>
            <tr className="text-left text-neutral-400">
              <th>Region</th>
              <th>Members</th>
              <th>Levy</th>
            </tr>
          </thead>
          <tbody>
            {T.rows.map((r) => (
              <tr key={r.region} className="border-t">
                <td>{r.region}</td>
                <td>{r.members}</td>
                <td>${fmt(r.amount)}</td>
              </tr>
            ))}
            <tr className="border-t font-bold">
              <td>Treasury total</td>
              <td></td>
              <td>${fmt(T.total)}</td>
            </tr>
          </tbody>
        </table>
        {T.recips.length > 0 && (
          <table className="w-full text-xs border-collapse mb-2">
            <thead>
              <tr className="text-left text-neutral-400">
                <th>Recipient</th>
                <th>Head</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {T.recips.map((g) => (
                <tr key={g} className="border-t">
                  <td>
                    <b>{g}</b>
                  </td>
                  <td>{headOf(g)}</td>
                  <td>${fmt(T.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-neutral-500 mb-2">
          <b>SOP wins:</b> treasury split among SOP, HUMSERV, EMPIN heads. <b>POP wins:</b> treasury split among POP,
          BASIN, RETSIN heads.
        </p>
        <h3 className="text-xs text-neutral-500 mb-1">Rules &amp; announcements for MasMed</h3>
        <textarea
          defaultValue={E.notes}
          key={"notes" + E.notes}
          onBlur={(e) => setElecInput("notes", e.target.value)}
          rows={5}
          placeholder="Ballot rules, polling location, campaign restrictions, runoff conditions…"
          className="w-full border rounded px-2 py-1.5 text-sm"
        />
        <div className="mt-3">
          {elecActive(E) ? (
            <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded px-3 py-2">
              🗳 Election armed for Session {currentRound}
              {E.announce ? " · will be announced" : ""}
              {E.winner ? ` · ${E.winner} declared winner` : ""}
              {elecEffectText(E) ? ` · indicator impact: ${elecEffectText(E)}` : ""}.
            </div>
          ) : (
            <div className="text-xs bg-green-50 border border-green-300 text-green-800 rounded px-3 py-2">
              No election activity armed for Session {currentRound}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
