"use client";

import { useState, useTransition } from "react";
import { ORG_COLOR, ORG_TINT, RACI_LABEL, type Org, type Raci } from "@/lib/bmc/config";

const CYCLE: (Raci | null)[] = [null, "R", "A", "C", "I"];

/**
 * One matrix cell: click the letter to cycle through — / R / A / C / I, then
 * name the person who holds it. Colour comes from the owning org so a column
 * reads as a block.
 */
export function RaciCell({
  org,
  raci,
  ownerName,
  rosterNames,
  setRaci,
  setOwner,
}: {
  org: Org;
  raci: Raci | null;
  ownerName: string | null;
  rosterNames: string[];
  setRaci: (value: string) => Promise<void>;
  setOwner: (value: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState<Raci | null>(raci);
  const [owner, setOwnerValue] = useState(ownerName ?? "");
  const [pending, startTransition] = useTransition();

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setCurrent(next);
    startTransition(() => setRaci(next ?? ""));
  }

  const color = current ? ORG_COLOR[org] : "var(--muted)";
  const listId = `roster-${org}`;

  return (
    <div className={`flex items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={cycle}
        title={current ? RACI_LABEL[current] : "Not assigned — click to set"}
        aria-label={
          current
            ? `${RACI_LABEL[current]}. Click to change.`
            : "Not assigned. Click to assign."
        }
        className="mono shrink-0 h-6 w-6 rounded-full border text-[11px] font-medium flex items-center justify-center transition-opacity hover:opacity-75"
        style={{
          color,
          borderColor: current ? color : "var(--rule)",
          background: current ? ORG_TINT[org] : "transparent",
        }}
      >
        {current ?? "–"}
      </button>
      <input
        type="text"
        value={owner}
        list={listId}
        aria-label="Owner name"
        placeholder="owner"
        onChange={(e) => setOwnerValue(e.target.value)}
        onBlur={() => {
          if ((ownerName ?? "") !== owner) startTransition(() => setOwner(owner));
        }}
        className="field text-[12px] min-w-0"
      />
      <datalist id={listId}>
        {rosterNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}
