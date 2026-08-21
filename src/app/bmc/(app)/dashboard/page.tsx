import Link from "next/link";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";
import {
  PROGRAM_NAME,
  SESSION_END_TIME,
  SESSION_START_TIME,
} from "@/lib/bmc/config";
import { formatSessionDate } from "@/lib/bmc/sessions";
import type { CohortSession, ParticipantTask } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  Meter,
  PageHeader,
} from "@/components/bmc/ui";
import {
  EditableCheckbox,
  EditableText,
} from "@/components/bmc/EditableField";
import {
  addTask,
  deleteTask,
  setBusinessName,
  setTaskDone,
  setTaskField,
} from "./actions";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const [{ data: taskData }, { data: sessionData }] = await Promise.all([
    supabase
      .from("participant_tasks")
      .select("id, participant_id, source_session_id, text, due_date, done")
      .eq("participant_id", me.id)
      .order("done")
      .order("due_date", { nullsFirst: false }),
    supabase
      .from("sessions")
      .select(
        "id, session_number, session_date, title, arena_block, exit_momentum_block, breakout_takeaway, mentor_focus, recording_url, location, prep_checklist, status, published",
      )
      .eq("published", true)
      .order("session_number"),
  ]);

  const tasks = (taskData ?? []) as ParticipantTask[];
  const sessions = (sessionData ?? []) as CohortSession[];

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const today = todayISO();
  const overdue = open.filter((t) => t.due_date && t.due_date < today);

  // Progress across the six sessions: a session counts as complete once its
  // pushed takeaway task is ticked off.
  const sessionTaskById = new Map(
    tasks.filter((t) => t.source_session_id).map((t) => [t.source_session_id!, t]),
  );
  const takeawaysDone = sessions.filter(
    (s) => sessionTaskById.get(s.id)?.done,
  ).length;

  const upcoming = sessions.find((s) => s.session_date && s.session_date >= today);

  return (
    <>
      <PageHeader
        eyebrow={PROGRAM_NAME}
        title={`Welcome${me.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}`}
        hint="Your tasks, your progress through the twelve weeks, and what's coming up next."
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-5">
        <Card>
          <Eyebrow className="mb-2">Progress through the program</Eyebrow>
          <Meter
            value={takeawaysDone}
            max={sessions.length || 6}
            label={`Takeaways completed · ${takeawaysDone}/${sessions.length || 6}`}
          />
          <p className="text-[12px] text-[var(--muted)] mt-2">
            A session counts as complete once you tick off its takeaway.
          </p>
        </Card>

        <Card>
          <Eyebrow className="mb-2">Next session</Eyebrow>
          {upcoming ? (
            <>
              <div className="text-[15px] font-medium">
                {upcoming.title || `Session ${upcoming.session_number}`}
              </div>
              <div className="mono text-[12px] text-[var(--muted)] mt-1">
                {formatSessionDate(upcoming.session_date)} · {SESSION_START_TIME}–
                {SESSION_END_TIME}
              </div>
              {upcoming.location && (
                <div className="mono text-[12px] text-[var(--muted)]">
                  {upcoming.location}
                </div>
              )}
              <Link
                href="/bmc/program"
                className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--gold)] hover:underline mt-2 inline-block"
              >
                See the full schedule
              </Link>
            </>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">
              No upcoming session scheduled yet.
            </p>
          )}
        </Card>

        <Card>
          <Eyebrow className="mb-2">Your business</Eyebrow>
          <EditableText
            action={setBusinessName}
            defaultValue={me.business_name}
            placeholder="Business name"
            ariaLabel="Your business name"
          />
          <p className="text-[12px] text-[var(--muted)] mt-2">
            The Assistant uses this when it helps you draft plans.
          </p>
          {overdue.length > 0 && (
            <div className="mt-3">
              <Badge color="var(--red)">
                {overdue.length} task{overdue.length === 1 ? "" : "s"} overdue
              </Badge>
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-5">
        <div className="flex items-baseline justify-between mb-4">
          <Eyebrow>My tasks</Eyebrow>
          <span className="mono text-[11px] text-[var(--muted)]">
            {open.length} open · {done.length} done
          </span>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            title="Nothing assigned yet"
            hint="Session takeaways appear here automatically. You can also add your own."
          />
        ) : (
          <div className="space-y-2">
            {[...open, ...done].map((task) => {
              const isOverdue = !task.done && task.due_date && task.due_date < today;
              return (
                <div
                  key={task.id}
                  className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] last:border-0 pb-2 last:pb-0"
                >
                  <EditableCheckbox
                    action={setTaskDone.bind(null, task.id)}
                    defaultChecked={task.done}
                    label=""
                  />
                  <div className="flex-1 min-w-[200px]">
                    <EditableText
                      action={setTaskField.bind(null, task.id, "text")}
                      defaultValue={task.text}
                      ariaLabel="Task"
                    />
                  </div>
                  {task.source_session_id && (
                    <Badge color="var(--teal)" tint="var(--teal-lt)">
                      From a session
                    </Badge>
                  )}
                  <div className="w-[140px]">
                    <EditableText
                      type="date"
                      action={setTaskField.bind(null, task.id, "due_date")}
                      defaultValue={task.due_date}
                      ariaLabel="Due date"
                    />
                  </div>
                  {isOverdue && <Badge color="var(--red)">Overdue</Badge>}
                  <form action={deleteTask} className="no-print">
                    <input type="hidden" name="id" value={task.id} />
                    <button
                      type="submit"
                      aria-label="Delete task"
                      className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                    >
                      ×
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <form action={addTask} className="flex flex-wrap gap-2 mt-4 no-print">
          <input
            name="text"
            required
            placeholder="Add a task for yourself"
            aria-label="New task"
            className="field flex-1 min-w-[200px]"
          />
          <input
            name="due_date"
            type="date"
            aria-label="New task due date"
            className="field w-[150px]"
          />
          <button type="submit" className={buttonClass("primary")}>
            Add
          </button>
        </form>
      </Card>

      <Card>
        <Eyebrow className="mb-3">Session progress</Eyebrow>
        {sessions.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">
            The schedule hasn&apos;t been published yet.
          </p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => {
              const task = sessionTaskById.get(s.id);
              const complete = Boolean(task?.done);
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-2.5 rounded-md border border-[var(--rule)] p-3"
                >
                  <span
                    aria-hidden
                    className="mt-1 inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      background: complete ? "var(--green)" : "var(--rule)",
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      {s.title || `Session ${s.session_number}`}
                    </div>
                    <div className="mono text-[11px] text-[var(--muted)]">
                      {formatSessionDate(s.session_date)}
                    </div>
                    {task && (
                      <div className="text-[12px] text-[var(--muted)] mt-1">
                        {complete ? "Takeaway complete" : "Takeaway outstanding"}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
