import type { ReactNode } from "react";
import { Card, Eyebrow } from "@/components/bmc/ui";
import { SegmentTimer } from "@/components/bmc/SegmentTimer";

/**
 * One L10 agenda segment: numbered eyebrow, time box, live timer, content.
 * `open` defaults to true so print gets everything expanded.
 */
export function SegmentSection({
  index,
  label,
  minutes,
  elapsed,
  onPersist,
  hint,
  children,
}: {
  index: number;
  label: string;
  minutes: number;
  elapsed: number;
  onPersist: (seconds: number) => Promise<void>;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="print-break">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-[var(--rule)]">
        <div className="min-w-0">
          <Eyebrow className="mb-1">
            {index}. {label} · {minutes} min
          </Eyebrow>
          {hint && <p className="text-[13px] text-[var(--muted)]">{hint}</p>}
        </div>
        <SegmentTimer
          boxMinutes={minutes}
          initialSeconds={elapsed}
          onPersist={onPersist}
        />
      </header>
      {children}
    </Card>
  );
}

/** Horizontal band showing where the meeting's time actually went. */
export function SegmentProgress({
  segments,
}: {
  segments: { label: string; minutes: number; elapsed: number }[];
}) {
  const totalBox = segments.reduce((sum, s) => sum + s.minutes * 60, 0);

  return (
    <div className="mb-6">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-[var(--rule)]">
        {segments.map((s) => {
          const box = s.minutes * 60;
          const share = totalBox > 0 ? (box / totalBox) * 100 : 0;
          const fill = box > 0 ? Math.min(100, (s.elapsed / box) * 100) : 0;
          const over = s.elapsed > box;
          return (
            <div
              key={s.label}
              style={{ width: `${share}%` }}
              className="h-full border-r border-[var(--paper)] last:border-0"
              title={`${s.label}: ${Math.round(s.elapsed / 60)} of ${s.minutes} min`}
            >
              <div
                className="h-full"
                style={{
                  width: `${fill}%`,
                  background: over ? "var(--red)" : "var(--teal)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {segments.map((s) => (
          <span
            key={s.label}
            className="mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)] truncate"
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
