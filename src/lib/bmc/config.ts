/**
 * Single source of truth for the program's identity and vocabulary.
 * The working title is expected to change — rename it here and it changes
 * everywhere in the app at once.
 */

export const PROGRAM_NAME = "Business Mastery Cohort";
export const PROGRAM_SHORT_NAME = "BMC";
export const PROGRAM_TERM = "Spring 2027";

/**
 * Whether the program bills and brands under Palette or PACE. Left as a
 * config setting because the call hasn't been made yet; defaults to Palette.
 */
export const BILLING_ENTITY: "palette" | "pace" = "palette";

export const BILLING_ENTITY_LABEL = BILLING_ENTITY === "palette" ? "Palette" : "PACE";

/** 6 half-day sessions, every other week across 12 weeks. */
export const SESSION_COUNT = 6;
export const SESSION_START_TIME = "9:00 AM";
export const SESSION_END_TIME = "12:00 PM";

export const ORGS = ["palette", "arena", "exit_momentum", "shared"] as const;
export type Org = (typeof ORGS)[number];

export const ORG_LABEL: Record<Org, string> = {
  palette: "Palette",
  arena: "Arena",
  exit_momentum: "Exit Momentum",
  shared: "Shared",
};

/** Three-org color coding — badges, matrix cells, session blocks, timeline bars. */
export const ORG_COLOR: Record<Org, string> = {
  palette: "var(--gold)",
  arena: "var(--teal)",
  exit_momentum: "var(--purple)",
  shared: "var(--muted)",
};

export const ORG_TINT: Record<Org, string> = {
  palette: "var(--gold-lt)",
  arena: "var(--teal-lt)",
  exit_momentum: "var(--purple-lt)",
  shared: "var(--rule)",
};

export const LOCKUP = "Palette × Arena × Exit Momentum";

export const ROLES = ["admin", "staff", "participant"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "not_started",
  "in_progress",
  "on_track",
  "off_track",
  "done",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_track: "On Track",
  off_track: "Off Track",
  done: "Done",
};

export const STATUS_COLOR: Record<Status, string> = {
  not_started: "var(--muted)",
  in_progress: "var(--live)",
  on_track: "var(--green)",
  off_track: "var(--red)",
  done: "var(--teal)",
};

/** Click order for the cycle-through status buttons. */
export const STATUS_CYCLE: Status[] = [
  "on_track",
  "off_track",
  "in_progress",
  "not_started",
  "done",
];

export function nextStatus(current: Status): Status {
  const i = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

export const PHASES = ["q3_2026", "q4_2026", "q1_2027"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  q3_2026: "Q3 2026 — Plan & Build",
  q4_2026: "Q4 2026 — Market & Recruit",
  q1_2027: "Q1 2027 — Execute (12-week cohort)",
};

export const PIPELINE_STAGES = [
  "prospect",
  "contacted",
  "info_session_invited",
  "applied",
  "qualified",
  "offered",
  "committed",
  "declined",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  info_session_invited: "Info-session Invited",
  applied: "Applied",
  qualified: "Qualified",
  offered: "Offered",
  committed: "Committed / Paid",
  declined: "Declined / Not a Fit",
};

/**
 * Ideal customer profile, shown inline on the leads tracker so outreach owners
 * qualify against the same bar.
 */
export const ICP_GUARDRAILS = [
  "2–3+ years in business (not a brand-new solo startup)",
  "Hitting a growth ceiling they can name",
  "Has employees",
  "Ready to scale — has capacity and appetite for change",
];

export const RACI = ["R", "A", "C", "I"] as const;
export type Raci = (typeof RACI)[number];

export const RACI_LABEL: Record<Raci, string> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

/** EOS L10 segments, in order, with their suggested time boxes in minutes. */
export const MEETING_SEGMENTS = [
  { key: "segue", label: "Segue", minutes: 5 },
  { key: "scorecard", label: "Scorecard", minutes: 5 },
  { key: "rocks", label: "Rocks / Milestones", minutes: 5 },
  { key: "headlines", label: "Headlines", minutes: 5 },
  { key: "todos", label: "To-Do Review", minutes: 5 },
  { key: "issues", label: "IDS — Issues", minutes: 60 },
  { key: "conclude", label: "Conclude", minutes: 5 },
] as const;

export type SegmentKey = (typeof MEETING_SEGMENTS)[number]["key"];

export const MEETING_TOTAL_MINUTES = MEETING_SEGMENTS.reduce(
  (sum, s) => sum + s.minutes,
  0,
);

/** Default scorecard metrics for a new meeting. */
export const DEFAULT_SCORECARD_METRICS = [
  "Leads added",
  "Outreach touches made",
  "Applications received",
  "Qualified",
  "Committed / paid",
  "Mentor slots filled",
  `Sessions fully built (of ${SESSION_COUNT})`,
];
