"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import {
  DEFAULT_SCORECARD_METRICS,
  MEETING_SEGMENTS,
  ORGS,
  STATUSES,
  type Org,
  type Status,
} from "@/lib/bmc/config";
import type { SegmentPayload } from "@/lib/bmc/types";

function path(meetingId: string) {
  return `/bmc/meeting/${meetingId}`;
}

function asOrgOrNull(value: string): Org | null {
  if (value === "") return null;
  if ((ORGS as readonly string[]).includes(value)) return value as Org;
  throw new Error(`Unknown org: ${value}`);
}

function asStatus(value: string): Status {
  if ((STATUSES as readonly string[]).includes(value)) return value as Status;
  throw new Error(`Unknown status: ${value}`);
}

// ---------------------------------------------------------------------------
// Meeting lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a new meeting. Clones the prior agenda structure — the attendee list
 * and the scorecard metric definitions — and carries forward everything that
 * was left open: unfinished to-dos and unsolved issues re-point at the new
 * meeting so they show up on the agenda again.
 */
export async function startNewMeeting() {
  await requireTeam();
  const supabase = await createClient();

  const { data: prior } = await supabase
    .from("bmc_meetings")
    .select("id, attendees, title")
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let attendees: string[] = (prior?.attendees as string[]) ?? [];
  if (attendees.length === 0) {
    const { data: roster } = await supabase
      .from("bmc_team_roster")
      .select("full_name")
      .eq("active", true)
      .order("sort_order");
    attendees = (roster ?? []).map((m) => m.full_name);
  }

  const { data: meeting, error } = await supabase
    .from("bmc_meetings")
    .insert({
      title: prior?.title ?? "Build Team L10",
      attendees,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !meeting) throw new Error(error?.message ?? "Could not create meeting");

  await supabase.from("bmc_meeting_segments").insert(
    MEETING_SEGMENTS.map((s) => ({
      meeting_id: meeting.id,
      segment_key: s.key,
      payload: {},
    })),
  );

  // Scorecard: same metric names, owners, and goals; this week's actuals blank.
  let metricSeed: { name: string; owner: string | null; goal: string | null }[] =
    DEFAULT_SCORECARD_METRICS.map((name) => ({ name, owner: null, goal: null }));

  if (prior) {
    const { data: priorMetrics } = await supabase
      .from("bmc_scorecard_metrics")
      .select("name, owner, goal, sort_order")
      .eq("meeting_id", prior.id)
      .order("sort_order");
    if (priorMetrics?.length) {
      metricSeed = priorMetrics.map((m) => ({
        name: m.name,
        owner: m.owner,
        goal: m.goal,
      }));
    }
  }

  await supabase.from("bmc_scorecard_metrics").insert(
    metricSeed.map((m, i) => ({
      meeting_id: meeting.id,
      name: m.name,
      owner: m.owner,
      goal: m.goal,
      sort_order: (i + 1) * 10,
    })),
  );

  // Carry forward open work from every earlier meeting, not just the last one.
  await supabase
    .from("bmc_todos")
    .update({ meeting_id: meeting.id })
    .eq("done", false)
    .neq("meeting_id", meeting.id);

  await supabase
    .from("bmc_issues")
    .update({ meeting_id: meeting.id })
    .eq("resolved", false)
    .neq("meeting_id", meeting.id);

  revalidatePath("/bmc/meeting");
  redirect(path(meeting.id));
}

export async function completeMeeting(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("meeting_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_meetings").update({ status: "complete" }).eq("id", id);

  revalidatePath(path(id));
  revalidatePath("/bmc/meeting");
}

export async function deleteMeeting(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("meeting_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_meetings").delete().eq("id", id);

  revalidatePath("/bmc/meeting");
  redirect("/bmc/meeting");
}

export async function setMeetingTitle(id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_meetings")
    .update({ title: value.trim() || "Build Team L10" })
    .eq("id", id);
  revalidatePath(path(id));
}

export async function setMeetingDate(id: string, value: string) {
  await requireTeam();
  if (!value) return;
  const supabase = await createClient();
  await supabase.from("bmc_meetings").update({ meeting_date: value }).eq("id", id);
  revalidatePath(path(id));
}

export async function setCascading(id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_meetings")
    .update({ cascading: value.trim() || null })
    .eq("id", id);
  revalidatePath(path(id));
}

export async function setAttendees(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("meeting_id") ?? "");
  const raw = String(formData.get("attendees") ?? "");
  if (!id) return;

  const attendees = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = await createClient();
  await supabase.from("bmc_meetings").update({ attendees }).eq("id", id);
  revalidatePath(path(id));
}

export async function setRating(meetingId: string, attendee: string, value: string) {
  await requireTeam();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bmc_meetings")
    .select("rating")
    .eq("id", meetingId)
    .maybeSingle();
  if (!data) return;

  const rating = { ...((data.rating ?? {}) as Record<string, number>) };
  const n = Number(value);
  if (value === "" || Number.isNaN(n)) delete rating[attendee];
  else rating[attendee] = Math.min(10, Math.max(1, Math.round(n)));

  await supabase.from("bmc_meetings").update({ rating }).eq("id", meetingId);
  revalidatePath(path(meetingId));
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

async function patchSegment(
  meetingId: string,
  segmentKey: string,
  patch: Partial<{ payload: SegmentPayload; timer_seconds: number }>,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bmc_meeting_segments")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("segment_key", segmentKey)
    .maybeSingle();

  if (data) {
    await supabase.from("bmc_meeting_segments").update(patch).eq("id", data.id);
  } else {
    await supabase
      .from("bmc_meeting_segments")
      .insert({ meeting_id: meetingId, segment_key: segmentKey, ...patch });
  }
}

export async function saveTimer(
  meetingId: string,
  segmentKey: string,
  seconds: number,
) {
  await requireTeam();
  await patchSegment(meetingId, segmentKey, {
    timer_seconds: Math.max(0, Math.round(seconds)),
  });
  // No revalidate — the timer is client-owned; re-rendering would fight it.
}

export async function setSegueBest(
  meetingId: string,
  attendee: string,
  kind: "personal" | "professional",
  value: string,
) {
  await requireTeam();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bmc_meeting_segments")
    .select("id, payload")
    .eq("meeting_id", meetingId)
    .eq("segment_key", "segue")
    .maybeSingle();

  const payload = ((data?.payload ?? {}) as SegmentPayload) ?? {};
  const bests = { ...(payload.bests ?? {}) };
  bests[attendee] = { ...(bests[attendee] ?? {}), [kind]: value.trim() };

  await patchSegment(meetingId, "segue", { payload: { ...payload, bests } });
  revalidatePath(path(meetingId));
}

export async function addHeadline(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!meetingId || !text) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("bmc_meeting_segments")
    .select("payload")
    .eq("meeting_id", meetingId)
    .eq("segment_key", "headlines")
    .maybeSingle();

  const payload = ((data?.payload ?? {}) as SegmentPayload) ?? {};
  const headlines = [
    ...(payload.headlines ?? []),
    { id: crypto.randomUUID(), text },
  ];

  await patchSegment(meetingId, "headlines", { payload: { ...payload, headlines } });
  revalidatePath(path(meetingId));
}

export async function removeHeadline(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const headlineId = String(formData.get("headline_id") ?? "");
  if (!meetingId || !headlineId) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("bmc_meeting_segments")
    .select("payload")
    .eq("meeting_id", meetingId)
    .eq("segment_key", "headlines")
    .maybeSingle();

  const payload = ((data?.payload ?? {}) as SegmentPayload) ?? {};
  const headlines = (payload.headlines ?? []).filter((h) => h.id !== headlineId);

  await patchSegment(meetingId, "headlines", { payload: { ...payload, headlines } });
  revalidatePath(path(meetingId));
}

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

const METRIC_COLUMNS = ["name", "owner", "goal", "actual"] as const;

export async function setMetricField(
  meetingId: string,
  id: string,
  column: string,
  value: string,
) {
  await requireTeam();
  if (!(METRIC_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }

  const supabase = await createClient();
  await supabase
    .from("bmc_scorecard_metrics")
    .update({ [column]: value.trim() || null })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setMetricStatus(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_scorecard_metrics")
    .update({ status: asStatus(value) })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function addMetric(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!meetingId || !name) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("bmc_scorecard_metrics")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("bmc_scorecard_metrics").insert({
    meeting_id: meetingId,
    name,
    sort_order: (last?.sort_order ?? 0) + 10,
  });
  revalidatePath(path(meetingId));
}

export async function deleteMetric(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_scorecard_metrics").delete().eq("id", id);
  revalidatePath(path(meetingId));
}

// ---------------------------------------------------------------------------
// Rocks (quarterly, not per-meeting)
// ---------------------------------------------------------------------------

export async function setRockTitle(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_rocks").update({ title: value.trim() }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setRockStatus(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_rocks").update({ status: asStatus(value) }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setRockOrg(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_rocks").update({ org: asOrgOrNull(value) }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function addRock(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const quarter = String(formData.get("quarter") ?? "q3_2026");
  if (!title) return;

  const supabase = await createClient();
  await supabase.from("bmc_rocks").insert({ title, quarter });
  revalidatePath(path(meetingId));
}

export async function deleteRock(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_rocks").delete().eq("id", id);
  revalidatePath(path(meetingId));
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

export async function addTodo(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!meetingId || !text) return;

  const supabase = await createClient();
  await supabase.from("bmc_todos").insert({ meeting_id: meetingId, text });
  revalidatePath(path(meetingId));
}

export async function setTodoDone(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_todos").update({ done: value === "true" }).eq("id", id);
  revalidatePath(path(meetingId));
}

const TODO_COLUMNS = ["text", "due_date"] as const;

export async function setTodoField(
  meetingId: string,
  id: string,
  column: string,
  value: string,
) {
  await requireTeam();
  if (!(TODO_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }
  const supabase = await createClient();
  await supabase
    .from("bmc_todos")
    .update({ [column]: value.trim() || null })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setTodoOwner(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_todos")
    .update({ owner_profile_id: value || null })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function deleteTodo(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_todos").delete().eq("id", id);
  revalidatePath(path(meetingId));
}

// ---------------------------------------------------------------------------
// Issues (IDS)
// ---------------------------------------------------------------------------

export async function addIssue(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!meetingId || !title) return;

  const supabase = await createClient();
  await supabase.from("bmc_issues").insert({ meeting_id: meetingId, title });
  revalidatePath(path(meetingId));
}

const ISSUE_COLUMNS = ["title", "notes", "due_date"] as const;

export async function setIssueField(
  meetingId: string,
  id: string,
  column: string,
  value: string,
) {
  await requireTeam();
  if (!(ISSUE_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }
  const supabase = await createClient();
  await supabase
    .from("bmc_issues")
    .update({ [column]: value.trim() || null })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setIssuePriority(meetingId: string, id: string, value: string) {
  await requireTeam();
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || n > 5) return;

  const supabase = await createClient();
  await supabase.from("bmc_issues").update({ priority: n }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setIssueOrg(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_issues").update({ org: asOrgOrNull(value) }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setIssueStatus(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase.from("bmc_issues").update({ status: asStatus(value) }).eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setIssueOwner(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_issues")
    .update({ owner_profile_id: value || null })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function setIssueResolved(meetingId: string, id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("bmc_issues")
    .update({ resolved: value === "true" })
    .eq("id", id);
  revalidatePath(path(meetingId));
}

export async function deleteIssue(formData: FormData) {
  await requireTeam();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_issues").delete().eq("id", id);
  revalidatePath(path(meetingId));
}
