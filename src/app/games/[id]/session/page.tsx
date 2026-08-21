"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "../game-context";
import { REGIONS, type AttendanceCode } from "@/lib/types";
import { basinPaymentFromInputs, basinPurchasedCount, LV } from "@/lib/simsoc-engine.js";
import { countStatus, fmt, isDead, newDeaths } from "@/lib/derive";
import { TableSkeleton } from "@/components/Skeleton";
import { ReleaseReportBanner } from "@/components/ReleaseReportBanner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
    setConfig,
    closeSession,
  } = useGame();

  const [closeConfirm, setCloseConfirm] = useState<{ count: number; names: string[] } | null>(null);

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

  const unmarkedParticipants = participants.filter(
    (p) => !isDead(p, currentRound - 1) && !p.sessions[String(currentRound)]?.status
  );

  const basinPurchased = basinPurchasedCount(I);
  const passageErrors = Array.from({ length: I.basinPassages }, (_, i) => I.basinPassageErrors?.[i] ?? 0);
  const bp = basinPaymentFromInputs(I, level);
  const rw = Math.min(I.retsinWords, I.retsinAnagramsIn ? 5 * I.retsinAnagramsIn : I.retsinWords);

  async function commitPassagesCompleted(v: number) {
    const n = Math.max(0, Math.round(v));
    const cur = I.basinPassageErrors && I.basinPassageErrors.length ? I.basinPassageErrors : Array(I.basinPassages).fill(0);
    const next = cur.slice(0, n);
    while (next.length < n) next.push(0);
    await setInput("basinPassages", n);
    await setInput("basinPassageErrors", next);
  }

  async function commitPassageError(i: number, v: number) {
    const cur = I.basinPassageErrors && I.basinPassageErrors.length ? [...I.basinPassageErrors] : Array(I.basinPassages).fill(0);
    while (cur.length <= i) cur.push(0);
    cur[i] = Math.max(0, Math.round(v));
    await setInput("basinPassageErrors", cur);
  }

  async function handleClose() {
    const res = await closeSession();
    if (!res.ok && res.needsConfirm) {
      setCloseConfirm({ count: res.needsConfirm, names: unmarkedParticipants.slice(0, 10).map((p) => p.name) });
      return;
    }
    if (res.collapsed) alert("⚠ An indicator has gone below 0 — per the rules the SOCIETY COLLAPSES. Results recorded; see the Results tab.");
    router.push(`/games/${game.id}/results`);
  }

  async function confirmCloseAnyway() {
    setCloseConfirm(null);
    const res2 = await closeSession({ force: true });
    if (res2.collapsed) alert("⚠ An indicator has gone below 0 — per the rules the SOCIETY COLLAPSES. Results recorded; see the Results tab.");
    router.push(`/games/${game.id}/results`);
  }

  return (
    <div>
      <ReleaseReportBanner />
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
            <div className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded px-3 py-2 mb-2">
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
                  const unmarked = !st.status;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t ${unmarked ? "border-l-2 border-l-amber-400 bg-amber-500/5" : ""}`}
                    >
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
            <TallyRow label="Unmarked" value={unmarkedParticipants.length} readOnly warn />
            <NumRow
              label="Rioters"
              value={I.rioters}
              min={0}
              step={1}
              onCommit={(v) => setInput("rioters", Math.max(0, Math.round(v)))}
            />
            <NumRow
              label="Guard posts"
              value={I.guardPosts}
              min={0}
              step={1}
              onCommit={(v) => setInput("guardPosts", Math.max(0, Math.round(v)))}
            />
            <NumRow
              label="Arrests"
              value={I.arrests}
              min={0}
              step={1}
              onCommit={(v) => setInput("arrests", Math.max(0, Math.round(v)))}
            />
            <h3 className="text-xs text-neutral-500 mt-3 mb-1">
              Goal declarations (PC: +0.25 per positive, −1 per negative)
            </h3>
            <NumRow
              label="Positive"
              ariaLabel="Positive goal declarations"
              value={I.goalsPos}
              min={0}
              step={1}
              onCommit={(v) => setInput("goalsPos", Math.max(0, Math.round(v)))}
            />
            <NumRow
              label="Negative"
              ariaLabel="Negative goal declarations"
              value={I.goalsNeg}
              min={0}
              step={1}
              onCommit={(v) => setInput("goalsNeg", Math.max(0, Math.round(v)))}
            />
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">BASIN</h2>
            <NumRow label="Assets (start of round)" value={I.basinAssets ?? LV.assets[level - 1]} onCommit={(v) => setInput("basinAssets", v)} />
            <NumRow label="Assets withdrawn" value={I.basinWithdrawn} onCommit={(v) => setInput("basinWithdrawn", v)} />
            <NumRow
              label="Passages purchased"
              value={basinPurchased}
              min={0}
              max={5}
              step={1}
              onCommit={(v) => setInput("basinPurchased", Math.max(0, Math.min(5, Math.round(v))))}
            />
            <NumRow label="Passages completed" value={I.basinPassages} min={0} step={1} onCommit={commitPassagesCompleted} />
            {I.basinPassages > basinPurchased && (
              <p className="text-xs text-amber-500 mt-1">⚠ Passages completed exceeds passages purchased.</p>
            )}
            {passageErrors.map((e, i) => (
              <NumRow
                key={i}
                label={`Passage ${i + 1} errors`}
                value={e}
                min={0}
                step={1}
                onCommit={(v) => commitPassageError(i, v)}
              />
            ))}
            <p className="text-xs text-neutral-500 mt-1">
              {passageErrors.some((e) => e >= 6) && (
                <span className="text-red-500">6 or more errors ⇒ no payment. </span>
              )}
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
        <button onClick={handleClose} className="bg-[var(--accent)] text-[var(--accent-ink)] rounded-lg px-5 py-2.5 text-sm font-semibold hover:brightness-110">
          Close Session &amp; Calculate →
        </button>
        <span className="text-xs text-neutral-400 italic">
          Computes National Indicators, income multiplier, and next-session payments; archives this round.
        </span>
      </div>

      <ConfirmDialog
        open={!!closeConfirm}
        title="Unmarked participants"
        confirmLabel="Close anyway"
        cancelLabel="Go back"
        onConfirm={confirmCloseAnyway}
        onCancel={() => setCloseConfirm(null)}
        message={
          closeConfirm && (
            <>
              <b>{closeConfirm.count}</b> participant{closeConfirm.count === 1 ? "" : "s"} have no status for Session{" "}
              {currentRound}: {closeConfirm.names.join(", ")}
              {closeConfirm.count > closeConfirm.names.length
                ? ` (+${closeConfirm.count - closeConfirm.names.length} more)`
                : ""}
              . They will be excluded from all indicator penalties. Close anyway?
            </>
          )
        }
      />
    </div>
  );
}

function FlagBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] rounded border px-1.5 py-0.5 ${
        on
          ? "bg-amber-500/20 border-amber-400 text-amber-300"
          : "bg-neutral-50 border-neutral-200 text-neutral-500"
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
  warn,
}: {
  label: string;
  value: number;
  onDelta?: (d: number) => void;
  readOnly?: boolean;
  warn?: boolean;
}) {
  const isWarn = !!warn && value > 0;
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className={`flex-1 text-xs ${isWarn ? "text-amber-400" : "text-neutral-500"}`}>{label}</span>
      {!readOnly && onDelta && (
        <button onClick={() => onDelta(-1)} className="w-6 h-6 border rounded">
          −
        </button>
      )}
      <span className={`w-8 text-center font-bold ${isWarn ? "text-amber-400" : ""}`}>{value || 0}</span>
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
  ariaLabel,
  value,
  onCommit,
  min,
  max,
  step,
}: {
  label: string;
  ariaLabel?: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="flex-1 text-xs text-neutral-500">{label}</span>
      <input
        type="number"
        defaultValue={value}
        key={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel ?? label}
        onBlur={(e) => onCommit(e.target.value === "" ? 0 : +e.target.value)}
        className="w-20 border rounded px-2 py-1 text-right text-sm"
      />
    </div>
  );
}
