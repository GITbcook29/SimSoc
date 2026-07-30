import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { MEETING_TOTAL_MINUTES } from "@/lib/bmc/config";
import type { Meeting } from "@/lib/bmc/types";
import { formatSessionDate } from "@/lib/bmc/sessions";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  Td,
  Th,
} from "@/components/bmc/ui";
import { startNewMeeting } from "./actions";

export default async function MeetingIndexPage() {
  await requireTeam();
  const supabase = await createClient();

  const [{ data: meetingData }, { data: openTodos }, { data: openIssues }] =
    await Promise.all([
      supabase
        .from("bmc_meetings")
        .select("id, meeting_date, title, status, started_at, attendees, rating, cascading")
        .order("meeting_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("bmc_todos").select("id").eq("done", false),
      supabase.from("bmc_issues").select("id").eq("resolved", false),
    ]);

  const meetings = (meetingData ?? []) as Meeting[];

  return (
    <>
      <PageHeader
        eyebrow={`EOS Level 10 · ${MEETING_TOTAL_MINUTES} min`}
        title="Build Team Meeting"
        hint="Segue, Scorecard, Rocks, Headlines, To-Dos, IDS, Conclude. Starting a new meeting clones the prior agenda and carries forward everything still open."
        right={
          <form action={startNewMeeting}>
            <button type="submit" className={buttonClass("primary")}>
              Start a new meeting
            </button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <Eyebrow>Open to-dos carrying forward</Eyebrow>
          <div className="mono text-[26px] leading-none mt-2">
            {openTodos?.length ?? 0}
          </div>
        </Card>
        <Card>
          <Eyebrow>Unsolved issues carrying forward</Eyebrow>
          <div className="mono text-[26px] leading-none mt-2">
            {openIssues?.length ?? 0}
          </div>
        </Card>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          hint="Start the first one — it will pull the attendee list from the build team roster and seed the default scorecard metrics."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto p-5">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  <Th>Date</Th>
                  <Th>Title</Th>
                  <Th>Attendees</Th>
                  <Th>Avg rating</Th>
                  <Th>Status</Th>
                  <Th>&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const scores = Object.values(m.rating ?? {});
                  const avg =
                    scores.length > 0
                      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
                      : "—";
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--rule)] last:border-0"
                    >
                      <Td className="mono whitespace-nowrap">
                        {formatSessionDate(m.meeting_date)}
                      </Td>
                      <Td>{m.title}</Td>
                      <Td className="text-[var(--muted)]">
                        {(m.attendees ?? []).length}
                      </Td>
                      <Td className="mono">{avg}</Td>
                      <Td>
                        {m.status === "complete" ? (
                          <Badge color="var(--teal)" tint="var(--teal-lt)">
                            Complete
                          </Badge>
                        ) : m.status === "in_progress" ? (
                          <Badge color="var(--live)" tint="var(--live-lt)">
                            In progress
                          </Badge>
                        ) : (
                          <Badge>Draft</Badge>
                        )}
                      </Td>
                      <Td className="text-right no-print">
                        <Link
                          href={`/bmc/meeting/${m.id}`}
                          className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--gold)] hover:underline"
                        >
                          Open
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
