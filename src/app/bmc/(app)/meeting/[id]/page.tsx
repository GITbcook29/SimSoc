import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import {
  MEETING_SEGMENTS,
  ORGS,
  ORG_LABEL,
  PHASES,
  PHASE_LABEL,
} from "@/lib/bmc/config";
import type {
  Issue,
  Meeting,
  MeetingSegment,
  Profile,
  Rock,
  ScorecardMetric,
  SegmentPayload,
  Todo,
} from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  Eyebrow,
  OrgBadge,
  PageHeader,
  Td,
  Th,
} from "@/components/bmc/ui";
import {
  EditableCheckbox,
  EditableSelect,
  EditableText,
  EditableTextarea,
} from "@/components/bmc/EditableField";
import { StatusCycleButton } from "@/components/bmc/StatusCycleButton";
import { MeetingClock } from "@/components/bmc/SegmentTimer";
import { SegmentProgress, SegmentSection } from "@/components/bmc/SegmentSection";
import {
  addHeadline,
  addIssue,
  addMetric,
  addRock,
  addTodo,
  completeMeeting,
  deleteIssue,
  deleteMeeting,
  deleteMetric,
  deleteRock,
  deleteTodo,
  removeHeadline,
  saveTimer,
  setAttendees,
  setCascading,
  setIssueField,
  setIssueOrg,
  setIssueOwner,
  setIssuePriority,
  setIssueResolved,
  setIssueStatus,
  setMeetingDate,
  setMeetingTitle,
  setMetricField,
  setMetricStatus,
  setRating,
  setRockOrg,
  setRockStatus,
  setRockTitle,
  setSegueBest,
  setTodoDone,
  setTodoField,
  setTodoOwner,
} from "../actions";

const ORG_OPTIONS = [
  { value: "", label: "— org —" },
  ...ORGS.map((o) => ({ value: o, label: ORG_LABEL[o] })),
];

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeam();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: meetingData },
    { data: segmentData },
    { data: metricData },
    { data: rockData },
    { data: todoData },
    { data: issueData },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from("bmc_meetings")
      .select("id, meeting_date, title, status, started_at, attendees, rating, cascading")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bmc_meeting_segments")
      .select("id, meeting_id, segment_key, payload, timer_seconds")
      .eq("meeting_id", id),
    supabase
      .from("bmc_scorecard_metrics")
      .select("*")
      .eq("meeting_id", id)
      .order("sort_order"),
    supabase.from("bmc_rocks").select("*").order("sort_order"),
    supabase
      .from("bmc_todos")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at"),
    supabase
      .from("bmc_issues")
      .select("*")
      .eq("meeting_id", id)
      .order("priority")
      .order("created_at"),
    supabase
      .from("bmc_profiles")
      .select("id, email, full_name, org, role, business_name, avatar_url")
      .in("role", ["admin", "staff"])
      .order("full_name"),
  ]);

  if (!meetingData) notFound();

  const meeting = meetingData as Meeting;
  const segments = (segmentData ?? []) as MeetingSegment[];
  const metrics = (metricData ?? []) as ScorecardMetric[];
  const rocks = (rockData ?? []) as Rock[];
  const todos = (todoData ?? []) as Todo[];
  const issues = (issueData ?? []) as Issue[];
  const staff = (profileData ?? []) as Profile[];

  const attendees = meeting.attendees ?? [];
  const ratings = meeting.rating ?? {};
  const ratingValues = Object.values(ratings);
  const avgRating =
    ratingValues.length > 0
      ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
      : "—";

  const segmentByKey = new Map(segments.map((s) => [s.segment_key, s]));
  const elapsedFor = (key: string) => segmentByKey.get(key)?.timer_seconds ?? 0;
  const payloadFor = (key: string) =>
    (segmentByKey.get(key)?.payload ?? {}) as SegmentPayload;

  const ownerOptions = [
    { value: "", label: "— owner —" },
    ...staff.map((p) => ({ value: p.id, label: p.full_name || p.email || "Unnamed" })),
  ];

  const seguePayload = payloadFor("segue");
  const headlines = payloadFor("headlines").headlines ?? [];

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/bmc/meeting" className="hover:underline">
              Meetings
            </Link>{" "}
            / L10
          </span>
        }
        title={meeting.title}
        right={
          <div className="flex items-center gap-3">
            <MeetingClock startedAt={meeting.started_at} />
            <form action={completeMeeting}>
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <button type="submit" className={buttonClass("primary")}>
                Mark complete
              </button>
            </form>
            <form action={deleteMeeting}>
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <button type="submit" className={buttonClass("danger")}>
                Delete
              </button>
            </form>
          </div>
        }
      />

      <SegmentProgress
        segments={MEETING_SEGMENTS.map((s) => ({
          label: s.label,
          minutes: s.minutes,
          elapsed: elapsedFor(s.key),
        }))}
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="eyebrow block mb-1">Meeting date</span>
            <EditableText
              type="date"
              action={setMeetingDate.bind(null, meeting.id)}
              defaultValue={meeting.meeting_date}
              ariaLabel="Meeting date"
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1">Title</span>
            <EditableText
              action={setMeetingTitle.bind(null, meeting.id)}
              defaultValue={meeting.title}
              ariaLabel="Meeting title"
            />
          </label>
          <form action={setAttendees} className="block">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <span className="eyebrow block mb-1">Attendees (comma separated)</span>
            <div className="flex gap-2">
              <input
                name="attendees"
                defaultValue={attendees.join(", ")}
                aria-label="Attendees"
                className="field flex-1"
              />
              <button type="submit" className={`${buttonClass()} no-print`}>
                Save
              </button>
            </div>
          </form>
        </div>
      </Card>

      <div className="space-y-5">
        {/* 1 — Segue */}
        <SegmentSection
          index={1}
          label="Segue"
          minutes={5}
          elapsed={elapsedFor("segue")}
          onPersist={saveTimer.bind(null, meeting.id, "segue")}
          hint="One personal best and one professional best per attendee."
        >
          {attendees.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              Add attendees above to start the round.
            </p>
          ) : (
            <div className="space-y-3">
              {attendees.map((name) => (
                <div key={name} className="grid gap-3 sm:grid-cols-[160px_1fr_1fr] items-center">
                  <span className="text-[13px] font-medium">{name}</span>
                  <EditableText
                    action={setSegueBest.bind(null, meeting.id, name, "personal")}
                    defaultValue={seguePayload.bests?.[name]?.personal}
                    placeholder="Personal best"
                    ariaLabel={`${name} personal best`}
                  />
                  <EditableText
                    action={setSegueBest.bind(null, meeting.id, name, "professional")}
                    defaultValue={seguePayload.bests?.[name]?.professional}
                    placeholder="Professional best"
                    ariaLabel={`${name} professional best`}
                  />
                </div>
              ))}
            </div>
          )}
        </SegmentSection>

        {/* 2 — Scorecard */}
        <SegmentSection
          index={2}
          label="Scorecard"
          minutes={5}
          elapsed={elapsedFor("scorecard")}
          onPersist={saveTimer.bind(null, meeting.id, "scorecard")}
          hint="Weekly build metrics. Red or green — no discussion here, issues go to IDS."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  <Th className="w-[34%]">Metric</Th>
                  <Th>Owner</Th>
                  <Th>Goal</Th>
                  <Th>This week</Th>
                  <Th>Status</Th>
                  <Th className="no-print">&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--rule)] last:border-0">
                    <Td>
                      <EditableText
                        action={setMetricField.bind(null, meeting.id, m.id, "name")}
                        defaultValue={m.name}
                        ariaLabel="Metric name"
                      />
                    </Td>
                    <Td>
                      <EditableText
                        action={setMetricField.bind(null, meeting.id, m.id, "owner")}
                        defaultValue={m.owner}
                        placeholder="owner"
                        ariaLabel="Metric owner"
                      />
                    </Td>
                    <Td>
                      <EditableText
                        action={setMetricField.bind(null, meeting.id, m.id, "goal")}
                        defaultValue={m.goal}
                        placeholder="goal"
                        ariaLabel="Metric goal"
                      />
                    </Td>
                    <Td>
                      <EditableText
                        action={setMetricField.bind(null, meeting.id, m.id, "actual")}
                        defaultValue={m.actual}
                        placeholder="actual"
                        ariaLabel="Metric actual"
                      />
                    </Td>
                    <Td>
                      <StatusCycleButton
                        status={m.status}
                        action={setMetricStatus.bind(null, meeting.id, m.id)}
                        compact
                      />
                    </Td>
                    <Td className="text-right no-print">
                      <form action={deleteMetric}>
                        <input type="hidden" name="meeting_id" value={meeting.id} />
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          aria-label={`Delete metric ${m.name}`}
                          className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                        >
                          ×
                        </button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={addMetric} className="flex gap-2 mt-3 no-print">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input
              name="name"
              required
              placeholder="Add a metric"
              aria-label="New metric name"
              className="field flex-1 max-w-sm"
            />
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </SegmentSection>

        {/* 3 — Rocks */}
        <SegmentSection
          index={3}
          label="Rocks / Milestones"
          minutes={5}
          elapsed={elapsedFor("rocks")}
          onPersist={saveTimer.bind(null, meeting.id, "rocks")}
          hint="Quarterly priorities. On track or off track — off track becomes an issue."
        >
          <div className="space-y-2">
            {rocks.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] last:border-0 pb-2 last:pb-0"
              >
                <span className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] w-[90px] shrink-0">
                  {PHASE_LABEL[r.quarter as keyof typeof PHASE_LABEL]?.split(" — ")[0] ??
                    r.quarter}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <EditableText
                    action={setRockTitle.bind(null, meeting.id, r.id)}
                    defaultValue={r.title}
                    ariaLabel="Rock title"
                  />
                </div>
                <div className="w-[150px]">
                  <EditableSelect
                    action={setRockOrg.bind(null, meeting.id, r.id)}
                    defaultValue={r.org ?? ""}
                    options={ORG_OPTIONS}
                    ariaLabel="Rock org"
                  />
                </div>
                <StatusCycleButton
                  status={r.status}
                  action={setRockStatus.bind(null, meeting.id, r.id)}
                  compact
                />
                <form action={deleteRock} className="no-print">
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    aria-label={`Delete rock ${r.title}`}
                    className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                  >
                    ×
                  </button>
                </form>
              </div>
            ))}
            {rocks.length === 0 && (
              <p className="text-[13px] text-[var(--muted)]">
                No rocks yet. Pull the quarter&apos;s priorities in from the roadmap.
              </p>
            )}
          </div>
          <form action={addRock} className="flex flex-wrap gap-2 mt-3 no-print">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input
              name="title"
              required
              placeholder="Add a rock"
              aria-label="New rock title"
              className="field flex-1 min-w-[220px] max-w-sm"
            />
            <select name="quarter" aria-label="Quarter" className="field w-[220px]">
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABEL[p]}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </SegmentSection>

        {/* 4 — Headlines */}
        <SegmentSection
          index={4}
          label="Headlines"
          minutes={5}
          elapsed={elapsedFor("headlines")}
          onPersist={saveTimer.bind(null, meeting.id, "headlines")}
          hint="Good news and partner news. Anything needing discussion drops to IDS."
        >
          <ul className="space-y-1.5">
            {headlines.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-[13px]">
                <span className="text-[var(--gold)] mt-[2px]">—</span>
                <span className="flex-1">{h.text}</span>
                <form action={removeHeadline} className="no-print">
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="headline_id" value={h.id} />
                  <button
                    type="submit"
                    aria-label="Remove headline"
                    className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
            {headlines.length === 0 && (
              <li className="text-[13px] text-[var(--muted)]">Nothing yet.</li>
            )}
          </ul>
          <form action={addHeadline} className="flex gap-2 mt-3 no-print">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input
              name="text"
              required
              placeholder="Add a headline"
              aria-label="New headline"
              className="field flex-1"
            />
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </SegmentSection>

        {/* 5 — To-Do review */}
        <SegmentSection
          index={5}
          label="To-Do Review"
          minutes={5}
          elapsed={elapsedFor("todos")}
          onPersist={saveTimer.bind(null, meeting.id, "todos")}
          hint="Last meeting's to-dos. Anything not done carries into the next meeting automatically."
        >
          <div className="space-y-2">
            {todos.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] last:border-0 pb-2 last:pb-0"
              >
                <EditableCheckbox
                  action={setTodoDone.bind(null, meeting.id, t.id)}
                  defaultChecked={t.done}
                  label=""
                />
                <div className="flex-1 min-w-[200px]">
                  <EditableText
                    action={setTodoField.bind(null, meeting.id, t.id, "text")}
                    defaultValue={t.text}
                    ariaLabel="To-do text"
                  />
                </div>
                <div className="w-[170px]">
                  <EditableSelect
                    action={setTodoOwner.bind(null, meeting.id, t.id)}
                    defaultValue={t.owner_profile_id ?? ""}
                    options={ownerOptions}
                    ariaLabel="To-do owner"
                  />
                </div>
                <div className="w-[140px]">
                  <EditableText
                    type="date"
                    action={setTodoField.bind(null, meeting.id, t.id, "due_date")}
                    defaultValue={t.due_date}
                    ariaLabel="To-do due date"
                  />
                </div>
                <form action={deleteTodo} className="no-print">
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    aria-label="Delete to-do"
                    className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                  >
                    ×
                  </button>
                </form>
              </div>
            ))}
            {todos.length === 0 && (
              <p className="text-[13px] text-[var(--muted)]">No open to-dos.</p>
            )}
          </div>
          <form action={addTodo} className="flex gap-2 mt-3 no-print">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input
              name="text"
              required
              placeholder="Add a to-do"
              aria-label="New to-do"
              className="field flex-1"
            />
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </SegmentSection>

        {/* 6 — IDS */}
        <SegmentSection
          index={6}
          label="IDS — Issues"
          minutes={60}
          elapsed={elapsedFor("issues")}
          onPersist={saveTimer.bind(null, meeting.id, "issues")}
          hint="Identify, discuss, solve. Work the list in priority order; solved issues become to-dos."
        >
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-[10px] border border-[var(--rule)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="w-[52px]">
                    <EditableText
                      type="number"
                      action={setIssuePriority.bind(null, meeting.id, issue.id)}
                      defaultValue={String(issue.priority)}
                      ariaLabel="Issue priority 1 to 5"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <EditableText
                      action={setIssueField.bind(null, meeting.id, issue.id, "title")}
                      defaultValue={issue.title}
                      ariaLabel="Issue title"
                      className="font-medium"
                    />
                  </div>
                  <div className="w-[150px]">
                    <EditableSelect
                      action={setIssueOrg.bind(null, meeting.id, issue.id)}
                      defaultValue={issue.org ?? ""}
                      options={ORG_OPTIONS}
                      ariaLabel="Issue org"
                    />
                  </div>
                  <StatusCycleButton
                    status={issue.status}
                    action={setIssueStatus.bind(null, meeting.id, issue.id)}
                    compact
                  />
                  <form action={deleteIssue} className="no-print">
                    <input type="hidden" name="meeting_id" value={meeting.id} />
                    <input type="hidden" name="id" value={issue.id} />
                    <button
                      type="submit"
                      aria-label="Delete issue"
                      className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                    >
                      ×
                    </button>
                  </form>
                </div>

                <EditableTextarea
                  action={setIssueField.bind(null, meeting.id, issue.id, "notes")}
                  defaultValue={issue.notes}
                  rows={2}
                  placeholder="Discussion and the solve"
                  ariaLabel="Issue notes"
                />

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="w-[170px]">
                    <EditableSelect
                      action={setIssueOwner.bind(null, meeting.id, issue.id)}
                      defaultValue={issue.owner_profile_id ?? ""}
                      options={ownerOptions}
                      ariaLabel="Issue owner"
                    />
                  </div>
                  <div className="w-[140px]">
                    <EditableText
                      type="date"
                      action={setIssueField.bind(null, meeting.id, issue.id, "due_date")}
                      defaultValue={issue.due_date}
                      ariaLabel="Issue due date"
                    />
                  </div>
                  <EditableCheckbox
                    action={setIssueResolved.bind(null, meeting.id, issue.id)}
                    defaultChecked={issue.resolved}
                    label="Solved"
                  />
                  <OrgBadge org={issue.org} />
                </div>
              </div>
            ))}
            {issues.length === 0 && (
              <p className="text-[13px] text-[var(--muted)]">
                No open issues. Anything that came up in Scorecard or Rocks belongs here.
              </p>
            )}
          </div>
          <form action={addIssue} className="flex gap-2 mt-3 no-print">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <input
              name="title"
              required
              placeholder="Add an issue"
              aria-label="New issue"
              className="field flex-1"
            />
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </SegmentSection>

        {/* 7 — Conclude */}
        <SegmentSection
          index={7}
          label="Conclude"
          minutes={5}
          elapsed={elapsedFor("conclude")}
          onPersist={saveTimer.bind(null, meeting.id, "conclude")}
          hint="Recap the to-dos, agree the cascading message, rate the meeting 1–10."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-2">To-do recap</Eyebrow>
              <ul className="space-y-1.5 text-[13px]">
                {todos
                  .filter((t) => !t.done)
                  .map((t) => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className="text-[var(--gold)]">—</span>
                      <span>
                        {t.text}
                        {t.due_date && (
                          <span className="mono text-[11px] text-[var(--muted)]">
                            {" "}
                            · due {t.due_date}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                {todos.filter((t) => !t.done).length === 0 && (
                  <li className="text-[var(--muted)]">Nothing outstanding.</li>
                )}
              </ul>

              <Eyebrow className="mb-2 mt-5">Cascading message</Eyebrow>
              <EditableTextarea
                action={setCascading.bind(null, meeting.id)}
                defaultValue={meeting.cascading}
                rows={3}
                placeholder="What gets communicated out of this meeting, and to whom"
                ariaLabel="Cascading message"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <Eyebrow>Meeting rating</Eyebrow>
                <span className="mono text-[20px] leading-none">{avgRating}</span>
              </div>
              <div className="space-y-2">
                {attendees.map((name) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-[13px] flex-1">{name}</span>
                    <div className="w-[70px]">
                      <EditableText
                        type="number"
                        action={setRating.bind(null, meeting.id, name)}
                        defaultValue={
                          ratings[name] !== undefined ? String(ratings[name]) : ""
                        }
                        placeholder="1–10"
                        ariaLabel={`${name} meeting rating`}
                      />
                    </div>
                  </div>
                ))}
                {attendees.length === 0 && (
                  <p className="text-[13px] text-[var(--muted)]">
                    Add attendees to collect ratings.
                  </p>
                )}
              </div>
              <div className="mt-4">
                {meeting.status === "complete" ? (
                  <Badge color="var(--teal)" tint="var(--teal-lt)">
                    Meeting complete
                  </Badge>
                ) : (
                  <Badge color="var(--live)" tint="var(--live-lt)">
                    In progress
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SegmentSection>
      </div>
    </>
  );
}
