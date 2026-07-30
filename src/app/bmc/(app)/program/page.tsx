import { createClient } from "@/lib/bmc/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";
import {
  LOCKUP,
  ORG_COLOR,
  ORG_LABEL,
  PROGRAM_NAME,
  PROGRAM_TERM,
  SESSION_END_TIME,
  SESSION_START_TIME,
} from "@/lib/bmc/config";
import { formatSessionDate } from "@/lib/bmc/sessions";
import type { CohortSession, TeamMember } from "@/lib/bmc/types";
import {
  Badge,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
} from "@/components/bmc/ui";

/**
 * The participant-facing schedule. Reads from the same session records the
 * build team edits, but shows only published sessions and only the fields a
 * participant should see — no presenter assignments, prep checklists, or
 * build status.
 */
export default async function ProgramPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: sessionData }, { data: rosterData }] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, session_number, session_date, title, arena_block, exit_momentum_block, breakout_takeaway, mentor_focus, recording_url, location, prep_checklist, status, published",
      )
      .eq("published", true)
      .order("session_number"),
    supabase
      .from("team_roster")
      .select("id, full_name, org, role_title, email, profile_id, active, sort_order")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const sessions = (sessionData ?? []) as CohortSession[];
  const roster = (rosterData ?? []) as TeamMember[];

  return (
    <>
      <PageHeader
        eyebrow={LOCKUP}
        title={PROGRAM_NAME}
        hint={`${PROGRAM_TERM} · 12 weeks · six half-day sessions, every other week, ${SESSION_START_TIME}–${SESSION_END_TIME}. Between sessions you meet with your mentor and, where arranged, with Arena and Exit Momentum.`}
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="The schedule isn't published yet"
          hint="Session details appear here as soon as the program team publishes them."
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <Card key={s.id}>
              <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <div>
                  <Eyebrow className="mb-1">Session {s.session_number}</Eyebrow>
                  <h2 className="text-lg leading-tight">
                    {s.title || "Session details coming soon"}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="mono text-[12px]">
                    {formatSessionDate(s.session_date)}
                  </div>
                  <div className="mono text-[11px] text-[var(--muted)]">
                    {SESSION_START_TIME}–{SESSION_END_TIME}
                    {s.location ? ` · ${s.location}` : ""}
                  </div>
                </div>
              </header>

              <div className="grid gap-4 lg:grid-cols-2">
                {s.arena_block?.topic && (
                  <div
                    className="rounded-[10px] border p-4"
                    style={{
                      borderColor: ORG_COLOR.arena,
                      background: "var(--teal-lt)",
                    }}
                  >
                    <div
                      className="mono text-[9px] uppercase tracking-[0.14em] mb-2 font-medium"
                      style={{ color: ORG_COLOR.arena }}
                    >
                      {ORG_LABEL.arena} — business principles
                    </div>
                    <p className="text-[14px] font-medium">{s.arena_block.topic}</p>
                    {s.arena_block.objective && (
                      <p className="text-[13px] text-[var(--muted)] mt-1.5">
                        {s.arena_block.objective}
                      </p>
                    )}
                  </div>
                )}

                {s.exit_momentum_block?.topic && (
                  <div
                    className="rounded-[10px] border p-4"
                    style={{
                      borderColor: ORG_COLOR.exit_momentum,
                      background: "var(--purple-lt)",
                    }}
                  >
                    <div
                      className="mono text-[9px] uppercase tracking-[0.14em] mb-2 font-medium"
                      style={{ color: ORG_COLOR.exit_momentum }}
                    >
                      {ORG_LABEL.exit_momentum} — business coaching
                    </div>
                    <p className="text-[14px] font-medium">
                      {s.exit_momentum_block.topic}
                    </p>
                    {s.exit_momentum_block.process_stage && (
                      <p className="text-[13px] text-[var(--muted)] mt-1.5">
                        {s.exit_momentum_block.process_stage}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(s.breakout_takeaway || s.mentor_focus) && (
                <div className="grid gap-4 lg:grid-cols-2 mt-4">
                  {s.breakout_takeaway && (
                    <div>
                      <Eyebrow className="mb-1">What you&apos;ll take away</Eyebrow>
                      <p className="text-[13px]">{s.breakout_takeaway}</p>
                    </div>
                  )}
                  {s.mentor_focus && (
                    <div>
                      <Eyebrow className="mb-1">Before the next session</Eyebrow>
                      <p className="text-[13px]">{s.mentor_focus}</p>
                    </div>
                  )}
                </div>
              )}

              {s.recording_url && (
                <p className="mt-4">
                  <a
                    href={s.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--gold)] hover:underline"
                  >
                    Watch the recording
                  </a>
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <Eyebrow className="mb-3">Key contacts</Eyebrow>
        {roster.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">
            Contact details will be published before the cohort starts.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((m) => (
              <li key={m.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ background: m.org ? ORG_COLOR[m.org] : "var(--muted)" }}
                />
                <div>
                  <div className="text-[13px] font-medium">{m.full_name}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {m.role_title ?? (m.org ? ORG_LABEL[m.org] : "")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <Eyebrow className="mb-2">Mentoring</Eyebrow>
        <p className="text-[13px]">
          Between sessions you meet with a mentor matched to your business by
          Palette. Mentor conversations focus on the takeaway from the session
          you just completed. Arena and Exit Momentum are also available for
          pre-arranged and ad-hoc conversations across the twelve weeks.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge color={ORG_COLOR.palette}>Mentor matching — Palette</Badge>
          <Badge color={ORG_COLOR.arena}>Curriculum — Arena</Badge>
          <Badge color={ORG_COLOR.exit_momentum}>Coaching — Exit Momentum</Badge>
        </div>
      </Card>
    </>
  );
}
