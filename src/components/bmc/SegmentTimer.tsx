"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function fmt(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Per-segment stopwatch. Counts up from zero and turns amber then red as it
 * runs past its time box, so the facilitator can see overrun at a glance.
 * Elapsed seconds are persisted through `onPersist` (debounced by the caller's
 * server action) so a reload mid-meeting doesn't lose the clock.
 */
export function SegmentTimer({
  boxMinutes,
  initialSeconds = 0,
  onPersist,
  autoStart = false,
}: {
  boxMinutes: number;
  initialSeconds?: number;
  onPersist?: (seconds: number) => void;
  autoStart?: boolean;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(autoStart);
  // Kept in refs so the interval callbacks below always see current values
  // without needing to be torn down and recreated every tick.
  const persistRef = useRef(onPersist);
  const secondsRef = useRef(seconds);

  useEffect(() => {
    persistRef.current = onPersist;
  }, [onPersist]);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Persist every 15s while running, and whenever the timer is paused.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => persistRef.current?.(secondsRef.current), 15000);
    return () => clearInterval(id);
  }, [running]);

  const toggle = useCallback(() => {
    setRunning((r) => {
      if (r) persistRef.current?.(secondsRef.current);
      return !r;
    });
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setSeconds(0);
    persistRef.current?.(0);
  }, []);

  const box = boxMinutes * 60;
  const over = seconds - box;
  const color =
    over > 60 ? "var(--red)" : over > 0 ? "var(--amber)" : "var(--muted)";

  return (
    <div className="flex items-center gap-2 no-print">
      <span
        className="mono text-[13px] tabular-nums font-medium"
        style={{ color }}
        aria-label={`Elapsed ${fmt(seconds)} of ${boxMinutes} minute time box`}
      >
        {fmt(seconds)}
        <span className="text-[var(--muted)] font-normal"> / {boxMinutes}:00</span>
      </span>
      <button
        type="button"
        onClick={toggle}
        className="mono text-[9px] uppercase tracking-[0.12em] border border-[var(--rule)] rounded px-2 py-[3px] hover:border-[var(--gold)] hover:text-[var(--gold)]"
      >
        {running ? "Pause" : seconds > 0 ? "Resume" : "Start"}
      </button>
      <button
        type="button"
        onClick={reset}
        className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--ink)]"
      >
        Reset
      </button>
    </div>
  );
}

/** Whole-meeting clock shown in the topbar. */
export function MeetingClock({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));

  return (
    <span className="mono text-[13px] tabular-nums text-[var(--gold)]" title="Meeting elapsed">
      {fmt(elapsed)}
    </span>
  );
}
