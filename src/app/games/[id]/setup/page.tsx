"use client";

import { useRef, useState } from "react";
import { useGame } from "../game-context";
import { HEADREGION, HEADROLES, REGIONS, type HeadRole, type Region } from "@/lib/types";
import { downloadCSVTemplate, parseRosterCSV } from "@/lib/csv";
import { LV } from "@/lib/simsoc-engine.js";
import { isDead } from "@/lib/derive";

export default function SetupPage() {
  const {
    loading,
    game,
    participants,
    heads,
    currentRound,
    level,
    pop,
    addParticipant,
    addParticipantsBulk,
    deleteParticipant,
    setRegion,
    autoRegions,
    setHead,
    setConfig,
    toast,
  } = useGame();

  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState<Region>("Red");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const roleOf = (id: string) =>
    (HEADROLES as readonly HeadRole[]).find((r) => heads[r] === id) ?? "";

  const regionCounts = REGIONS.map(
    (r) => participants.filter((p) => p.region === r && !isDead(p, currentRound)).length
  );

  async function handleAdd() {
    const n = newName.trim();
    if (!n) return;
    await addParticipant(n, newRegion);
    setNewName("");
  }

  async function handlePasteAdd() {
    const lines = pasteText.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return;
    await addParticipantsBulk(lines.map((name, i) => ({ name, region: REGIONS[i % 4] })));
    setPasteText("");
    setShowPaste(false);
  }

  async function handleCSVFile(file: File) {
    const text = await file.text();
    const { rows, error } = parseRosterCSV(text);
    if (error) {
      toast(error);
      return;
    }
    const { added, headsSet } = await addParticipantsBulk(rows);
    toast(`${added} participant(s) imported${headsSet.length ? " · heads auto-assigned: " + headsSet.join(", ") : ""}`);
  }

  const L = level - 1;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-3">Roster</h2>
        <div className="flex gap-2 mb-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Participant name"
            className="flex-1 min-w-[160px] border rounded px-2 py-1.5 text-sm"
          />
          <select
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value as Region)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button onClick={handleAdd} className="bg-black text-white rounded px-3 py-1.5 text-sm">
            Add
          </button>
        </div>
        <div className="flex gap-2 mb-2 flex-wrap text-xs">
          <button onClick={() => setShowPaste((v) => !v)} className="border rounded px-2 py-1">
            Paste list…
          </button>
          <button onClick={() => csvInputRef.current?.click()} className="border rounded px-2 py-1">
            Upload CSV…
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCSVFile(f);
              e.target.value = "";
            }}
          />
          <button onClick={downloadCSVTemplate} className="border rounded px-2 py-1">
            CSV template
          </button>
          <button onClick={autoRegions} className="border rounded px-2 py-1">
            Auto-assign regions evenly
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          CSV columns (header row, any order): <b>Name, Region, Role, Age, Gender, Real World Job, Team Color</b>.
          Region must be Red/Yellow/Blue/Green; a Role matching a basic group (BASIN, RETSIN, POP, SOP, EMPIN,
          HUMSERV, MASMED, JUDCO) is auto-assigned as that group&apos;s head.
        </p>
        {showPaste && (
          <div className="mb-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              placeholder="One name per line"
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
            <button onClick={handlePasteAdd} className="mt-1 bg-black text-white rounded px-3 py-1.5 text-sm">
              Add all
            </button>
          </div>
        )}
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-neutral-400 uppercase text-[10px]">
                <th className="py-1">#</th>
                <th>Name</th>
                <th>Region</th>
                <th>Head of</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, i) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1">{i + 1}</td>
                  <td>
                    {p.name}
                    {isDead(p, currentRound) && (
                      <span className="ml-1 text-white bg-red-500 rounded px-1 text-[10px]">DEAD</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={p.region ?? "Red"}
                      onChange={(e) => setRegion(p.id, e.target.value as Region)}
                      className="border rounded px-1 py-0.5"
                    >
                      {REGIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>{roleOf(p.id) ? <b>{roleOf(p.id)}</b> : ""}</td>
                  <td>{p.role ?? ""}</td>
                  <td>
                    <button onClick={() => deleteParticipant(p.id)} className="text-neutral-400 hover:text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-3">Society Parameters</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Kpi label="Population" value={pop} />
          <Kpi label={`Size level${game.config.lockLevel && game.config.lockedLevel ? " (locked)" : ""}`} value={level} />
          {REGIONS.map((r, i) => (
            <Kpi key={r} label={r} value={regionCounts[i]} />
          ))}
        </div>

        <h3 className="text-xs text-neutral-500 mt-3 mb-1">Size-level table (Coordinator&apos;s Manual)</h3>
        <table className="w-full text-xs border-collapse mb-3">
          <thead>
            <tr className="text-left text-neutral-400">
              <th>Level</th>
              <th>Population</th>
              <th>POP/SOP</th>
              <th>BASIN/RETSIN</th>
              <th>Other heads</th>
              <th>Assets</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {[
              [1, "≤32"],
              [2, "33–47"],
              [3, "48–60"],
              [4, "61–75"],
              [5, ">75"],
            ].map(([lvl, range], i) => (
              <tr key={i} className="border-t">
                <td>{lvl}</td>
                <td>{range}</td>
                <td>{LV.pop[i]}</td>
                <td>{LV.br[i]}</td>
                <td>{LV.other[i]}</td>
                <td>{LV.assets[i]}</td>
                <td>{LV.cost[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-xs text-neutral-500 mb-1">Session 1 starting payments (fixed by level)</h3>
        <p className="text-xs text-neutral-500 mb-3">
          BASIN &amp; RETSIN: <b>${LV.br[L]}</b> each · POP &amp; SOP: <b>${LV.pop[L]}</b> each · EMPIN, HUMSERV,
          MASMED: <b>${LV.other[L]}</b> each · JUDCO: <b>${0.75 * LV.pop[L]}</b>
        </p>

        <h3 className="text-xs text-neutral-500 mb-1">Group heads</h3>
        <p className="text-xs text-neutral-500 mb-2">
          Region column shows where the Coordinator&apos;s Manual places each head (standard game, 26+
          participants); Red gets no group heads.
        </p>
        <table className="w-full text-xs border-collapse mb-4">
          <thead>
            <tr className="text-left text-neutral-400">
              <th>Group</th>
              <th>Region</th>
              <th>Head</th>
            </tr>
          </thead>
          <tbody>
            {HEADROLES.map((role) => (
              <tr key={role} className="border-t">
                <td>{role}</td>
                <td>{HEADREGION[role]}</td>
                <td>
                  <select
                    value={heads[role] ?? ""}
                    onChange={(e) => setHead(role, e.target.value || null)}
                    className="border rounded px-1 py-0.5"
                  >
                    <option value="">—</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-xs text-neutral-500 mb-1">Options</h3>
        <div className="flex gap-4 items-center text-sm flex-wrap">
          <label className="flex items-center gap-1">
            Sessions planned
            <input
              type="number"
              min={2}
              max={9}
              value={game.config.numSessions}
              onChange={(e) => setConfig({ numSessions: +e.target.value })}
              className="w-16 border rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={game.config.lockLevel}
              onChange={(e) => setConfig({ lockLevel: e.target.checked })}
            />
            Lock size level
          </label>
          <span className="text-xs text-neutral-400 italic">
            Lock keeps the level fixed after Session 1 even if attendance changes.
          </span>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg text-center py-2">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase text-neutral-400">{label}</div>
    </div>
  );
}
