"use client";

import { useState, useTransition } from "react";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  nextStatus,
  type Status,
} from "@/lib/bmc/config";

/**
 * Click to rotate On Track → Off Track → In Progress → Not Started → Done.
 * Carried over from the existing single-file EOS tool, where cycling in place
 * is much faster than opening a select for every row.
 */
export function StatusCycleButton({
  action,
  status,
  compact = false,
}: {
  action: (value: string) => Promise<void>;
  status: Status;
  compact?: boolean;
}) {
  const [current, setCurrent] = useState<Status>(status);
  const [pending, startTransition] = useTransition();

  function cycle() {
    const next = nextStatus(current);
    setCurrent(next);
    startTransition(() => action(next));
  }

  const color = STATUS_COLOR[current];

  return (
    <button
      type="button"
      onClick={cycle}
      title="Click to change status"
      aria-label={`Status: ${STATUS_LABEL[current]}. Click to change.`}
      className={`mono inline-flex items-center gap-1.5 rounded-full border uppercase tracking-[0.1em] whitespace-nowrap transition-opacity hover:opacity-75 ${
        compact ? "px-2 py-[3px] text-[9px]" : "px-2.5 py-1 text-[10px]"
      } ${pending ? "opacity-60" : ""}`}
      style={{ color, borderColor: color, background: "transparent" }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {STATUS_LABEL[current]}
    </button>
  );
}
