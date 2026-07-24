"use client";

import { useRouter } from "next/navigation";
import { useGame } from "../game-context";
import { REGIONS, type AttendanceCode } from "@/lib/types";
import { basinPayment, LV } from "@/lib/simsoc-engine.js";
import { countStatus, fmt, isDead, newDeaths } from "@/lib/derive";
import { TableSkeleton } from "@/components/Skeleton";

const STATUS_CODES: AttendanceCode[] = ["P", "A", "E", "D"];
const STATUS_LABEL: Record<AttendanceCode, string> = { P: "P", A: "A", E: "U", D: "D" };
const STATUS_COLOR: Record<AttendanceCode, string> = {
  P: "bg-green-500 text-white border-green-500",
  A: "bg-amber-400 text-black border-amber-400",
  E: "bg-purple-500 text-white border-purple-500",
  D: "bg-red-500 text-white border-red-500",
};

export default function SessionPage() {
  const router = useRouter();
  const {
    loading,
    game,
    participants,
    currentRound,
    level,
    rounds,
    setStatus,
    setFlag,
    setInput,
    tally,
    setConfig,
    closeSession,
  } = useGame();

  if (loading) return <TableSkeleton rows={8} cols={7} />;

  const round = rounds[currentRound];
  if (!round) return <p className="text-sm text-neutral-500">Preparing session…</p>;
  const I = round.inputs;

  const sort = game.config.sessionSort ?? "roster";
  let list = [...participants];
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "region")
    list.sort(
      (a, b) => REGIONS.indexOf(a.region ?? "Red") - REGIONS.indexOf(b.region ?? "Red") || a.name.localeCompare(b.name)
    );

  const nsWarn: string[] = [];
  for (const p of list) {
    const prevNS = currentRound > 1 && !!p.sessions[String(currentRound - 1)]?.ns;
    const st = p.sessions[String(currentRound)];
    if (prevNS && st?.ns && st.status !== "D") nsWarn.push(p.name);
  }

  const bp = basinPayment(I.basinPassages, I.basinErrors, level);
  const rw = Math.min(I.retsinWords, I.retsinAnagramsIn ? 5 * I.retsinAnagramsIn : I.retsinWords);

  async function handleClose() {
    const res = await closeSession();
    if (!res.ok && res.needsConfirm) {
      const proceed = confirm(
        `${res.needsConfirm} participant(s) have no status for this session — they will be treated as Present. Continue?`
      );
      if (!proceed) return;
      const res2 = await closeSession({ force: true });
      if (res2.collapsed) alert("⚠ An indicator has gone below 0 — per the rules the SOCIETY COLLAPSES. Results recorded; see the Results tab.");
      router.push(`/games/${game.id}/results`);
      return;
    }
    if (res.collapsed) alert("⚠ An indicator has gone below 0 — per the rules the SOCIETY COLLAPSES. Results recorded; see the Results tab.");
    router.push(`/games/${game.id}/results`);
  }

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 border rounded-lg p-4">
          <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
            Attendance &amp; Individual Status — Session {currentRound}
          </h2>
          <p className="text-xs text-neutral-500 mb-2">
            Click status: <b>P</b>resent · <b>A</b>bsent (SL −2, PC −2 each) · <b>U</b>nemployed (SL −3, SC −3, PC −1
            each) · <b>D</b>ead (SL/SC/PC −5 each, permanent). Flags: <b>NS</b> = no subsistence · <b>Lux</b> =
            luxury living · <b>PTC</b> = Private Transportation Certificate.
          </p>
          {nsWarn.length > 0 && (
            <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded px-3 py-2 mb-2">
              ⚠ Second consecutive session without subsistence: <b>{nsWarn.join(", ")}</b> — per the rules they die
              at the end of this session (mark <b>D</b>).
            </div>
          )}
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th className="cursor-pointer" onClick={() => setConfig({ sessionSort: sort === "name" ? "roster" : "name" })}>
                    Name{sort === "name" ? " ▲" : ""}
                  </th>
                  <th className="cursor-pointer" onClick={() => setConfig({ sessionSort: sort === "region" ? "roster" : "region" })}>
                    Region{sort === "region" ? " ▲" : ""}
                  </th>
                  <th>Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const deadBefore = isDead(p, currentRound - 1);
                  const st = p.sessions[String(currentRound)] ?? {};
                  if (deadBefore) {
                    return (
                      <tr key={p.id} className="border-t opacity-40">
                        <td>{p.name}</td>
                        <td>{p.region}</td>
                        <td colSpan={2}>Deceased</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="py-1">{p.name}</td>
                      <td>{p.region}</td>
                      <td>
                        <div className="flex gap-1">
                          {STATUS_CODES.map((c) => (
                            <button
                              key={c}
                              onClick={() => setStatus(p.id, c)}
                              className={`w-6 h-6 rounded border text-[11px] font-bold ${
                                st.status === c ? STATUS_COLOR[c] : "bg-neutral-50 border-neutral-200 text-neutral-500"
                              }`}
                            >
                              {STATUS_LABEL[c]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <FlagBtn on={!!st.ns} onClick={() => setFlag(p.id, "ns")} label="NS" />
                          <FlagBtn on={p.lux} onClick={() => setFlag(p.id, "lux")} label="Lux" />
                          <FlagBtn on={p.ptc} onClick={() => setFlag(p.id, "ptc")} label="PTC" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Society Tallies</h2>
            <TallyRow label="Absentees (from roster)" value={countStatus(participants, currentRound, "A")} readOnly />
            <TallyRow label="Unemployed (from roster)" value={countStatus(participants, currentRound, "E")} readOnly />
            <TallyRow label="Deaths this session" value={newDeaths(participants, currentRound)} readOnly />
            <TallyRow label="Rioters" value={I.rioters} onDelta={(d) => tally("rioters", d)} />
            <TallyRow label="Guard posts" value={I.guardPosts} onDelta={(d) => tally("guardPosts", d)} />
            <TallyRow label="Arrests" value={I.arrests} onDelta={(d) => tally("arrests", d)} />
            <h3 className="text-xs text-neutral-500 mt-3 mb-1">
              Goal declarations (PC: +0.25 per positive, −1 per negative)
            </h3>
            <TallyRow label="Positive" value={I.goalsPos} onDelta={(d) => tally("goalsPos", d)} />
            <TallyRow label="Negative" value={I.goalsNeg} onDelta={(d) => tally("goalsNeg", d)} />
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">BASIN</h2>
            <NumRow label="Assets (start of round)" value={I.basinAssets ?? LV.assets[level - 1]} onCommit={(v) => setInput("basinAssets", v)} />
            <NumRow label="Assets withdrawn" value={I.basinWithdrawn} onCommit={(v) => setInput("basinWithdrawn", v)} />
            <NumRow label="Passages completed" value={I.basinPassages} onCommit={(v) => setInput("basinPassages", v)} />
            <NumRow label="Total errors" value={I.basinErrors} onCommit={(v) => setInput("basinErrors", v)} />
            <p className="text-xs text-neutral-500 mt-1">
              {I.basinErrors > 6 && <span className="text-red-500">More than 6 errors ⇒ no payment. </span>}
              Payment due BASIN: <b>${fmt(bp)}</b> (level {level}: {LV.basinPay[level - 1]}/passage −{" "}
              {LV.basinErr[level - 1]}/error).
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">RETSIN</h2>
            <NumRow label="Assets (start of round)" value={I.retsinAssets ?? LV.assets[level - 1]} onCommit={(v) => setInput("retsinAssets", v)} />
            <NumRow label="Assets withdrawn" value={I.retsinWithdrawn} onCommit={(v) => setInput("retsinWithdrawn", v)} />
            <NumRow label="Anagrams turned in" value={I.retsinAnagramsIn} onCommit={(v) => setInput("retsinAnagramsIn", v)} />
            <NumRow label="Correct words" value={I.retsinWords} onCommit={(v) => setInput("retsinWords", v)} />
            <p className="text-xs text-neutral-500 mt-1">
              Payment due RETSIN: <b>${fmt(rw * LV.retsinWd[level - 1])}</b> ({LV.retsinWd[level - 1]}/word, max
              5/anagram).
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
              Investments &amp; Support Cards
            </h2>
            <NumRow label="R&C investment ($)" value={I.invRC} onCommit={(v) => setInput("invRC", v)} />
            <NumRow label="Welfare investment ($)" value={I.invWelfare} onCommit={(v) => setInput("invWelfare", v)} />
            <h3 className="text-xs text-neutral-500 mt-2 mb-1">Support cards turned in</h3>
            <NumRow label="POP" value={I.scPOP} onCommit={(v) => setInput("scPOP", v)} />
            <NumRow label="SOP" value={I.scSOP} onCommit={(v) => setInput("scSOP", v)} />
            <NumRow label="EMPIN" value={I.scEMPIN} onCommit={(v) => setInput("scEMPIN", v)} />
            <NumRow label="HUMSERV" value={I.scHUMSERV} onCommit={(v) => setInput("scHUMSERV", v)} />
            <NumRow label="MASMED" value={I.scMASMED} onCommit={(v) => setInput("scMASMED", v)} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={handleClose} className="bg-black text-white rounded px-5 py-2.5 text-sm font-semibold">
          Close Session &amp; Calculate →
        </button>
        <span className="text-xs text-neutral-400 italic">
          Computes National Indicators, income multiplier, and next-session payments; archives this round.
        </span>
      </div>
    </div>
  );
}

function FlagBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] rounded border px-1.5 py-0.5 ${
        on ? "bg-amber-300 border-amber-300" : "bg-neutral-50 border-neutral-200 text-neutral-500"
      }`}
    >
      {label}
    </button>
  );
}

function TallyRow({
  label,
  value,
  onDelta,
  readOnly,
}: {
  label: string;
  value: number;
  onDelta?: (d: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="flex-1 text-neutral-500 text-xs">{label}</span>
      {!readOnly && onDelta && (
        <button onClick={() => onDelta(-1)} className="w-6 h-6 border rounded">
          −
        </button>
      )}
      <span className="w-8 text-center font-bold">{value || 0}</span>
      {!readOnly && onDelta && (
        <button onClick={() => onDelta(1)} className="w-6 h-6 border rounded">
          +
        </button>
      )}
    </div>
  );
}

function NumRow({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="flex-1 text-xs text-neutral-500">{label}</span>
      <input
        type="number"
        defaultValue={value}
        key={value}
        onBlur={(e) => onCommit(e.target.value === "" ? 0 : +e.target.value)}
        className="w-20 border rounded px-2 py-1 text-right text-sm"
      />
    </div>
  );
}
