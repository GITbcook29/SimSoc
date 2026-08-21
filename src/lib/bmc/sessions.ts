import type { CohortSession } from "./types";

/**
 * Fields a session needs before the team can call it "built". The build
 * completeness meter on each session card, and the Scorecard's "sessions fully
 * built (of 6)" metric, both read from this one list.
 */
export const REQUIRED_SESSION_FIELDS: {
  key: string;
  label: string;
  get: (s: CohortSession) => string | null | undefined;
}[] = [
  { key: "session_date", label: "Date", get: (s) => s.session_date },
  { key: "title", label: "Theme / title", get: (s) => s.title },
  { key: "arena_topic", label: "Arena topic", get: (s) => s.arena_block?.topic },
  {
    key: "arena_objective",
    label: "Arena learning objective",
    get: (s) => s.arena_block?.objective,
  },
  {
    key: "arena_presenter",
    label: "Arena presenter",
    get: (s) => s.arena_block?.presenter,
  },
  {
    key: "em_topic",
    label: "Exit Momentum topic",
    get: (s) => s.exit_momentum_block?.topic,
  },
  {
    key: "em_stage",
    label: "Coaching process stage",
    get: (s) => s.exit_momentum_block?.process_stage,
  },
  {
    key: "breakout",
    label: "Breakout / tangible takeaway",
    get: (s) => s.breakout_takeaway,
  },
  { key: "mentor", label: "Between-session mentor focus", get: (s) => s.mentor_focus },
];

export function missingFields(session: CohortSession): string[] {
  return REQUIRED_SESSION_FIELDS.filter(
    (f) => !String(f.get(session) ?? "").trim(),
  ).map((f) => f.label);
}

export function completeness(session: CohortSession): {
  filled: number;
  total: number;
  complete: boolean;
} {
  const total = REQUIRED_SESSION_FIELDS.length;
  const filled = total - missingFields(session).length;
  return { filled, total, complete: filled === total };
}

export function fullyBuiltCount(sessions: CohortSession[]): number {
  return sessions.filter((s) => completeness(s).complete).length;
}

export function formatSessionDate(date: string | null): string {
  if (!date) return "Date TBD";
  // Parse as a plain calendar date — no timezone shifting on a date-only value.
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
