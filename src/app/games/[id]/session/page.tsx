"use client";

import { useRouter } from "next/navigation";
import { useGame } from "../game-context";
import { HEADROLES, REGIONS, type AttendanceCode, type HeadRole, type Region } from "@/lib/types";
import { basinPaymentFromInputs, basinPurchasedCount, computeCirculation, defaultCirculation, BANK_FEES, LV } from "@/lib/simsoc-engine.js";
import { countStatus, fmt, isDead, livingByRegion, newDeaths } from "@/lib/derive";
import { TableSkeleton } from "@/components/Skeleton";
import { ReleaseReportBanner } from "@/components/ReleaseReportBanner";

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
    setCirculationInput,
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

  const basinPurchased = basinPurchasedCount(I);
  const passageErrors = Array.from({ length: I.basinPassages }, (_, i) => I.basinPassageErrors?.[i] ?? 0);
  const bp = basinPaymentFromInputs(I, level);
  const rw = Math.min(I.retsinWords, I.retsinAnagramsIn ? 5 * I.retsinAnagramsIn : I.retsinWords);

  // Rounds created before this feature may have no `circulation` key at all.
  const rawC = I.circulation || defaultCirculation();
  const C = {
    ...defaultCirculation(),
    ...rawC,
    regionCash: { ...defaultCirculation().regionCash, ...(rawC.regionCash || {}) },
    bankFees: { ...defaultCirculation().bankFees, ...(rawC.bankFees || {}) },
  };
  const circ = computeCirculation({
    rounds,
    currentRound,
    level,
    regionLiving: livingByRegion(participants, currentRound),
  });
  const feeTotal =
    C.bankFees.ptc * BANK_FEES.ptc +
    C.bankFees.lux * BANK_FEES.lux +
    C.bankFees.moving * BANK_FEES.moving +
    C.bankFees.transfer * BANK_FEES.transfer +
    I.guardPosts * BANK_FEES.guardPost;

  // These inputs are pre-filled with the derived figure and commit on blur, so
  // simply tabbing through the panel would otherwise stamp an override on every
  // row and freeze it from tracking future income. Writing a value equal to the
  // derived one instead clears the override and hands the row back to auto-tracking.
  async function commitRegionCash(region: Region, v: number) {
    const val = Math.max(0, v);
    const next = { ...C.regionCash };
    if (val === circ.regionDerived[region]) delete next[region];
    else next[region] = val;
    await setCirculationInput({ regionCash: next });
  }
  async function commitGroupCashOverride(role: HeadRole, raw: string) {
    const next = { ...C.groupCash };
    const val = Math.max(0, +raw);
    if (raw === "" || val === circ.groupDerived[role]) delete next[role];
    else next[role] = val;
    await setCirculationInput({ groupCash: next });
  }
  async function commitFee(key: keyof typeof C.bankFees, v: number) {
    await setCirculationInput({ bankFees: { ...C.bankFees, [key]: Math.max(0, Math.round(v)) } });
  }
  async function addRemoval() {
    await setCirculationInput({ removals: [...C.removals, { label: "", amount: 0 }] });
  }
  async function updateRemoval(i: number, patch: Partial<{ label: string; amount: number }>) {
    const next = C.removals.map((x, idx) => (idx === i ? { ...x, ...patch } : x));
    await setCirculationInput({ removals: next });
  }
  async function removeRemoval(i: number) {
    await setCirculationInput({ removals: C.removals.filter((_, idx) => idx !== i) });
  }
  async function addInjection() {
    await setCirculationInput({ injections: [...C.injections, { label: "", amount: 0 }] });
  }
  async function updateInjection(i: number, patch: Partial<{ label: string; amount: number }>) {
    const next = C.injections.map((x, idx) => (idx === i ? { ...x, ...patch } : x));
    await setCirculationInput({ injections: next });
  }
  async function removeInjection(i: number) {
    await setCirculationInput({ injections: C.injections.filter((_, idx) => idx !== i) });
  }

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
    if (res.collapsed) alert("⚠ An indicator has gone below 0 — per the rules the SOCIETY COLLAPSES. Results recorded; see the Results tab.");
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
                  // Present is the default: the coordinator marks only the
                  // exceptions (Absent / Unemployed / Dead), so an untouched
                  // row reads — and scores — as Present.
                  const shown = st.status ?? "P";
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
                                shown === c ? STATUS_COLOR[c] : "bg-neutral-50 border-neutral-200 text-neutral-500"
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

          <div className="border rounded-lg p-4">
            <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Treasury &amp; Circulation</h2>
            <p className="text-xs text-neutral-500 mb-2">
              A coordinator&apos;s aid, not a hard constraint — the books not balancing never blocks closing a
              session.
            </p>
            <h3 className="text-xs text-neutral-500 mb-1">
              Region cash — everyone living there, group heads included
            </h3>
            {REGIONS.map((r) => (
              <NumRow
                key={r + "-" + fmt(circ.regionCash[r])}
                label={r}
                value={circ.regionCash[r]}
                min={0}
                onCommit={(v) => commitRegionCash(r, v)}
              />
            ))}

            <h3 className="text-xs text-neutral-500 mt-3 mb-1">
              Group treasuries — the heads&apos; share of the region totals above, not extra money
            </h3>
            {HEADROLES.map((g) => (
              <NumRow
                key={g + "-" + fmt(circ.groupTreasury[g])}
                label={g}
                value={circ.groupTreasury[g]}
                min={0}
                ariaLabel={`${g} treasury`}
                onCommit={(v) => commitGroupCashOverride(g, String(v))}
              />
            ))}

            <h3 className="text-xs text-neutral-500 mt-3 mb-1">Bank fee counts</h3>
            <NumRow label="PTC issued" ariaLabel={`PTC issued — $${BANK_FEES.ptc} each`} value={C.bankFees.ptc} min={0} step={1} onCommit={(v) => commitFee("ptc", v)} />
            <NumRow label="Luxury Living Endowment" ariaLabel={`Luxury Living Endowment — $${BANK_FEES.lux} each`} value={C.bankFees.lux} min={0} step={1} onCommit={(v) => commitFee("lux", v)} />
            <NumRow label="Moving fee" ariaLabel={`Moving fee — $${BANK_FEES.moving} each`} value={C.bankFees.moving} min={0} step={1} onCommit={(v) => commitFee("moving", v)} />
            <NumRow label="PTC transfers" ariaLabel={`PTC transfer — $${BANK_FEES.transfer} each`} value={C.bankFees.transfer} min={0} step={1} onCommit={(v) => commitFee("transfer", v)} />
            <p className="text-xs text-neutral-500 mt-1">
              Fees this round: <b>${fmt(feeTotal)}</b> (guard posts reuse the {I.guardPosts} already tallied above ×
              ${BANK_FEES.guardPost}).
            </p>

            <h3 className="text-xs text-neutral-500 mt-3 mb-1">Ad hoc removals</h3>
            {C.removals.map((x, i) => (
              <div key={i} className="flex items-center gap-1 py-0.5 text-sm">
                <input
                  defaultValue={x.label}
                  key={"rl" + i + x.label}
                  placeholder="Label"
                  aria-label="Removal label"
                  onBlur={(e) => updateRemoval(i, { label: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  defaultValue={x.amount}
                  key={"ra" + i + x.amount}
                  aria-label="Removal amount"
                  onBlur={(e) => updateRemoval(i, { amount: +e.target.value || 0 })}
                  className="w-16 border rounded px-2 py-1 text-right text-xs"
                />
                <button onClick={() => removeRemoval(i)} className="text-neutral-400 hover:text-red-500 px-1">
                  ✕
                </button>
              </div>
            ))}
            <button onClick={addRemoval} className="border rounded px-2 py-1 text-xs mt-1">
              + Add removal
            </button>

            <h3 className="text-xs text-neutral-500 mt-3 mb-1">Ad hoc injections</h3>
            {C.injections.map((x, i) => (
              <div key={i} className="flex items-center gap-1 py-0.5 text-sm">
                <input
                  defaultValue={x.label}
                  key={"il" + i + x.label}
                  placeholder="Label"
                  aria-label="Injection label"
                  onBlur={(e) => updateInjection(i, { label: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  defaultValue={x.amount}
                  key={"ia" + i + x.amount}
                  aria-label="Injection amount"
                  onBlur={(e) => updateInjection(i, { amount: +e.target.value || 0 })}
                  className="w-16 border rounded px-2 py-1 text-right text-xs"
                />
                <button onClick={() => removeInjection(i)} className="text-neutral-400 hover:text-red-500 px-1">
                  ✕
                </button>
              </div>
            ))}
            <button onClick={addInjection} className="border rounded px-2 py-1 text-xs mt-1">
              + Add injection
            </button>

            <div className="mt-3 pt-3 border-t">
              <div className="text-lg font-bold font-mono">${fmt(circ.total)}</div>
              <div className="text-[10px] uppercase text-neutral-400">In circulation</div>
              <p className="text-xs text-neutral-500 mt-1">
                Of which group heads hold <b className="text-neutral-300">${fmt(circ.totalGroup)}</b> and ordinary
                members <b className="text-neutral-300">${fmt(circ.totalMembers)}</b>.
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Issued ${fmt(circ.issuedTotal)} − removed ${fmt(circ.removedTotal)} since Session 1 = $
                {fmt(circ.flowTotal)}
                {Math.abs(circ.variance) > 0.05 && (
                  <span className="text-amber-400"> (variance ${fmt(circ.variance)} vs. counted total)</span>
                )}
              </p>
            </div>
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
