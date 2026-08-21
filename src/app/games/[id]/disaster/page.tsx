"use client";

import { useGame } from "../game-context";
import type { DisasterInputs } from "@/lib/types";
import { disasterLevyRows } from "@/lib/simsoc-engine.js";
import { fmt } from "@/lib/derive";
import { CardSkeleton } from "@/components/Skeleton";

const DIS_PRESETS: Record<string, Partial<DisasterInputs>> = {
  hurricane: {
    title: "Category 4 Hurricane",
    dFES: -10,
    dSL: -5,
    dSC: 0,
    dPC: 0,
    subForfeit: 8,
    levy: 40,
    closures: "All roads closed between Red↔Yellow and Blue↔Green.",
    rules:
      "Each region must forfeit 2 subsistence cards and $10 to FEMA for resource distribution. Travel between closed regions is prohibited until MasMed announces roads reopened.",
  },
  epidemic: {
    title: "Epidemic in the Red Region",
    dFES: 0,
    dSL: -8,
    dSC: 0,
    dPC: -4,
    subForfeit: 0,
    levy: 0,
    closures: "Red Region quarantined — no travel in or out.",
    rules:
      "Members of the Red Region must pay $2 each for treatment or be marked absent this session. HUMSERV may deliver aid without a travel ticket.",
  },
  earthquake: {
    title: "Major Earthquake",
    dFES: -12,
    dSL: -4,
    dSC: -6,
    dPC: 0,
    subForfeit: 4,
    levy: 20,
    closures: "All travel suspended for the first 10 minutes of the session.",
    rules:
      "BASIN may not submit passages this session (infrastructure down). An R&C investment of $30+ this session earns a +10 FES rebuild bonus next session (coordinator applies via shock).",
  },
  drought: {
    title: "Severe Drought",
    dFES: -8,
    dSL: -3,
    dSC: 0,
    dPC: 0,
    subForfeit: 6,
    levy: 0,
    closures: "",
    rules: "Subsistence prices rise: agencies must charge $1 extra per subsistence this session.",
  },
  clear: { title: "", dFES: 0, dSL: 0, dSC: 0, dPC: 0, subForfeit: 0, levy: 0, closures: "", rules: "" },
};

function disActive(D: DisasterInputs) {
  return !!(D.title || D.dFES || D.dSL || D.dSC || D.dPC || D.subForfeit || D.levy || D.closures || D.rules);
}

function disEffectText(D: DisasterInputs) {
  const parts: string[] = [];
  if (D.dFES) parts.push("FES " + (D.dFES > 0 ? "+" : "") + D.dFES);
  if (D.dSL) parts.push("SL " + (D.dSL > 0 ? "+" : "") + D.dSL);
  if (D.dSC) parts.push("SC " + (D.dSC > 0 ? "+" : "") + D.dSC);
  if (D.dPC) parts.push("PC " + (D.dPC > 0 ? "+" : "") + D.dPC);
  if (D.subForfeit) parts.push(`${D.subForfeit} subsistence cards forfeited (SL −${D.subForfeit})`);
  if (D.levy) parts.push(`$${D.levy} FEMA levy`);
  return parts.join(" · ");
}

export default function DisasterPage() {
  const { loading, currentRound, rounds, setDisInput } = useGame();
  if (loading) return <CardSkeleton rows={7} />;
  const round = rounds[currentRound];
  if (!round) return null;
  const rawD = (round.inputs.dis as Partial<DisasterInputs> | undefined) ?? {};
  const D: DisasterInputs = {
    title: "",
    dFES: 0,
    dSL: 0,
    dSC: 0,
    dPC: 0,
    subForfeit: 0,
    levy: 0,
    closures: "",
    rules: "",
    ...rawD,
    levyCollected: { ...(rawD.levyCollected || {}) },
    inKind: { ...(rawD.inKind || {}) },
  };
  const levyRows = disasterLevyRows(D);

  async function applyPreset(name: string) {
    const preset = DIS_PRESETS[name];
    for (const [k, v] of Object.entries(preset)) {
      await setDisInput(k, v as string | number);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          Natural Disaster — Session {currentRound}
        </h2>
        <p className="text-xs text-neutral-500 mb-2">
          Effects entered here hit the National Indicators when you close <b>this</b>{" "}
          session, and the event is announced in that session&apos;s MasMed report. Session 1 indicators are fixed
          at 100, so disasters take effect from Session 2 onward. The −30 floor still applies.
        </p>
        <div className="flex items-center gap-2 my-2">
          <span className="text-xs w-32 shrink-0">Title / type</span>
          <input
            value={D.title}
            onChange={(e) => setDisInput("title", e.target.value)}
            placeholder="e.g. Category 4 Hurricane"
            className="flex-1 border rounded px-2 py-1 text-sm"
          />
        </div>
        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Quick presets</h3>
        <div className="flex gap-2 flex-wrap text-xs mb-3">
          {["hurricane", "epidemic", "earthquake", "drought", "clear"].map((p) => (
            <button key={p} onClick={() => applyPreset(p)} className="border rounded px-2 py-1">
              {p === "clear" ? "Clear disaster" : DIS_PRESETS[p].title}
            </button>
          ))}
        </div>
        <h3 className="text-xs text-neutral-500 mb-1">Indicator shocks (negative = harm)</h3>
        {(["dFES", "dSL", "dSC", "dPC"] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 py-1 text-sm">
            <span className="flex-1 text-xs text-neutral-500">{k.slice(1)}</span>
            <input
              type="number"
              defaultValue={D[k]}
              key={D[k]}
              onBlur={(e) => setDisInput(k, +e.target.value || 0)}
              className="w-20 border rounded px-2 py-1 text-right text-sm"
            />
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Other Effects</h2>
        <div className="flex items-center gap-2 py-1 text-sm">
          <span className="flex-1 text-xs text-neutral-500">Subsistence cards forfeited (SL −1 each)</span>
          <input
            type="number"
            defaultValue={D.subForfeit}
            key={"sub" + D.subForfeit}
            onBlur={(e) => setDisInput("subForfeit", +e.target.value || 0)}
            className="w-20 border rounded px-2 py-1 text-right text-sm"
          />
        </div>
        <div className="flex items-center gap-2 py-1 text-sm">
          <span className="flex-1 text-xs text-neutral-500">FEMA levy assessed ($ total, split evenly per region)</span>
          <input
            type="number"
            defaultValue={D.levy}
            key={"levy" + D.levy}
            onBlur={(e) => setDisInput("levy", +e.target.value || 0)}
            className="w-20 border rounded px-2 py-1 text-right text-sm"
          />
        </div>
        {D.levy > 0 && (
          <>
            <h3 className="text-xs text-neutral-500 mt-2 mb-1">
              Levy collection — only collected $ leaves circulation; a region that can&apos;t pay is a real shortfall
            </h3>
            <table className="w-full text-xs border-collapse mb-2">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th>Region</th>
                  <th>Assessed</th>
                  <th>Collected</th>
                  <th>Shortfall</th>
                  <th>In-kind (cards)</th>
                </tr>
              </thead>
              <tbody>
                {levyRows.map((row) => (
                  <tr key={row.region} className="border-t">
                    <td>{row.region}</td>
                    <td>${fmt(row.assessed)}</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={row.collected}
                        key={"lc" + row.region + row.collected}
                        onBlur={(e) =>
                          setDisInput("levyCollected", {
                            ...D.levyCollected,
                            [row.region]: e.target.value === "" ? 0 : +e.target.value,
                          })
                        }
                        className="w-16 border rounded px-1 py-0.5 text-right"
                      />
                    </td>
                    <td className={row.shortfall > 0 ? "text-amber-500 font-semibold" : ""}>
                      {row.shortfall > 0 ? `$${fmt(row.shortfall)}` : "—"}
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={row.inKind}
                        key={"lk" + row.region + row.inKind}
                        onBlur={(e) =>
                          setDisInput("inKind", {
                            ...D.inKind,
                            [row.region]: e.target.value === "" ? 0 : +e.target.value,
                          })
                        }
                        className="w-14 border rounded px-1 py-0.5 text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {levyRows.some((r) => r.shortfall > 0) && (
              <p className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded px-3 py-2 mb-2">
                ⚠ Total shortfall: ${fmt(levyRows.reduce((a, r) => a + r.shortfall, 0))} — this is a political event
                (a region that couldn&apos;t pay), not an accounting error.
              </p>
            )}
          </>
        )}
        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Travel / road closures</h3>
        <textarea
          defaultValue={D.closures}
          key={"clos" + D.closures}
          onBlur={(e) => setDisInput("closures", e.target.value)}
          rows={3}
          placeholder="e.g. Roads closed between Red↔Yellow and Blue↔Green"
          className="w-full border rounded px-2 py-1.5 text-sm"
        />
        <h3 className="text-xs text-neutral-500 mt-2 mb-1">Rules, laws &amp; details for MasMed</h3>
        <textarea
          defaultValue={D.rules}
          key={"rules" + D.rules}
          onBlur={(e) => setDisInput("rules", e.target.value)}
          rows={5}
          placeholder="Anything MasMed must broadcast: emergency laws, relief conditions, curfews, aid offers…"
          className="w-full border rounded px-2 py-1.5 text-sm"
        />
        <div className="mt-3">
          {disActive(D) ? (
            <div className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded px-3 py-2">
              🌀 <b>{D.title || "Unnamed disaster"}</b> armed for Session {currentRound}. Net indicator impact:{" "}
              {disEffectText(D) || "none"}. It will apply when you close this session.
            </div>
          ) : (
            <div className="text-xs bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 rounded px-3 py-2">
              No disaster armed for Session {currentRound}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
