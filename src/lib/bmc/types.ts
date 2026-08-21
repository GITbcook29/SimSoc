import type {
  Org,
  Phase,
  PipelineStage,
  Raci,
  Role,
  Status,
} from "./config";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  org: Org | null;
  role: Role;
  business_name: string | null;
  avatar_url: string | null;
};

export type TeamMember = {
  id: string;
  full_name: string;
  org: Org | null;
  role_title: string | null;
  email: string | null;
  profile_id: string | null;
  active: boolean;
  sort_order: number;
};

export type Meeting = {
  id: string;
  meeting_date: string;
  title: string;
  status: "draft" | "in_progress" | "complete";
  started_at: string | null;
  attendees: string[];
  rating: Record<string, number>;
  cascading: string | null;
};

export type MeetingSegment = {
  id: string;
  meeting_id: string;
  segment_key: string;
  payload: SegmentPayload;
  timer_seconds: number;
};

/** Free-form per-segment storage. Only `segue` and `headlines` use rows today. */
export type SegmentPayload = {
  /** Segue: one personal + one professional best per attendee. */
  bests?: Record<string, { personal?: string; professional?: string }>;
  /** Headlines: add-a-row list of good news / partner news. */
  headlines?: { id: string; text: string }[];
};

export type ScorecardMetric = {
  id: string;
  meeting_id: string;
  name: string;
  owner: string | null;
  goal: string | null;
  actual: string | null;
  status: Status;
  sort_order: number;
};

export type Rock = {
  id: string;
  title: string;
  owner_profile_id: string | null;
  org: Org | null;
  quarter: string;
  status: Status;
  sort_order: number;
};

export type Issue = {
  id: string;
  meeting_id: string | null;
  title: string;
  notes: string | null;
  org: Org | null;
  priority: number;
  status: Status;
  owner_profile_id: string | null;
  due_date: string | null;
  resolved: boolean;
};

export type Todo = {
  id: string;
  meeting_id: string | null;
  text: string;
  owner_profile_id: string | null;
  org: Org | null;
  due_date: string | null;
  done: boolean;
};

export type Milestone = {
  id: string;
  phase: Phase;
  title: string;
  org: Org | null;
  owner_profile_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: Status;
  dependency_ids: string[];
  sort_order: number;
};

export type MatrixRow = {
  id: string;
  workstream: string;
  org: Org;
  owner_profile_id: string | null;
  owner_name: string | null;
  raci: Raci | null;
  notes: string | null;
  sort_order: number;
};

export type ArenaBlock = {
  topic?: string;
  objective?: string;
  presenter?: string;
  materials_url?: string;
};

export type ExitMomentumBlock = {
  topic?: string;
  process_stage?: string;
  presenter?: string;
  notes?: string;
};

export type PrepItem = { text: string; done: boolean };

export type CohortSession = {
  id: string;
  session_number: number;
  session_date: string | null;
  title: string;
  arena_block: ArenaBlock;
  exit_momentum_block: ExitMomentumBlock;
  breakout_takeaway: string | null;
  mentor_focus: string | null;
  recording_url: string | null;
  location: string | null;
  prep_checklist: PrepItem[];
  status: Status;
  published: boolean;
};

export type Lead = {
  id: string;
  name: string;
  business: string | null;
  industry: string | null;
  years_in_business: number | null;
  revenue_band: string | null;
  employees: number | null;
  source: string | null;
  referred_by: string | null;
  owner_profile_id: string | null;
  owner_org: Org | null;
  stage: PipelineStage;
  last_touch: string | null;
  next_follow_up: string | null;
  fit_score: number | null;
  notes: string | null;
  converted_participant_id: string | null;
};

export type CostItem = {
  label: string;
  amount: number;
  per_participant: boolean;
};

export type PricingScenario = {
  id: string;
  name: string;
  price_per_participant: number | null;
  cohort_size: number;
  cost_items: CostItem[];
  org_split: Partial<Record<Org, number>>;
  notes: string | null;
  sort_order: number;
};

export type ParticipantTask = {
  id: string;
  participant_id: string;
  source_session_id: string | null;
  text: string;
  due_date: string | null;
  done: boolean;
};

export type StoredFile = {
  id: string;
  owner_id: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  size: number;
  scope: "participant" | "program";
  created_at: string;
};

export type ChatMessage = {
  id: string;
  participant_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
