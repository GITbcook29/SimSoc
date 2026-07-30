import { createClient } from "@/lib/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import {
  ORG_COLOR,
  ORG_LABEL,
  SESSION_END_TIME,
  SESSION_START_TIME,
} from "@/lib/bmc/config";
import type { CohortSession, PrepItem } from "@/lib/bmc/types";
import {
  completeness,
  formatSessionDate,
  fullyBuiltCount,
  missingFields,
} from "@/lib/bmc/sessions";
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
  EditableTextarea,
} from "@/components/bmc/EditableField";
import { StatusCycleButton } from "@/components/bmc/StatusCycleButton";
import {
  addPrepItem,
  pushTakeawayToParticipants,
  removePrepItem,
  setArenaField,
  setExitMomentumField,
  setSessionField,
  setSessionStatus,
  togglePrepItem,
  togglePublished,
} from "./actions";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1">{label}</span>
      {children}
    </label>
  );
}

function SessionCard({ session }: { session: CohortSession }) {
  const { filled, total, complete } = completeness(session);
  const missing = missingFields(session);

  return (
    <Card className="print-break">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <Eyebrow className="mb-1">
            Session {session.session_number} · {SESSION_START_TIME}–{SESSION_END_TIME}
          </Eyebrow>
          <h2 className="text-lg leading-tight">
            {session.title || (
              <span className="text-[var(--muted)] italic">Untitled session</span>
            )}
          </h2>
          <p className="mono text-[11px] text-[var(--muted)] mt-1">
            {formatSessionDate(session.session_date)}
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {session.published ? (
            <Badge color="var(--teal)" tint="var(--teal-lt)">
              Published
            </Badge>
          ) : (
            <Badge>Draft</Badge>
          )}
          <StatusCycleButton
            status={session.status}
            action={setSessionStatus.bind(null, session.id)}
            compact
          />
        </div>
      </header>

      <div className="mb-5 max-w-xs">
        <Meter
          value={filled}
          max={total}
          color={complete ? "var(--green)" : "var(--gold)"}
          label={`Build completeness · ${filled}/${total}`}
        />
        {missing.length > 0 && (
          <p className="text-[12px] text-[var(--muted)] mt-1.5">
            Still needed: {missing.join(", ")}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <Field label="Date">
          <EditableText
            type="date"
            action={setSessionField.bind(null, session.id, "session_date")}
            defaultValue={session.session_date}
            ariaLabel={`Session ${session.session_number} date`}
          />
        </Field>
        <Field label="Theme / title">
          <EditableText
            action={setSessionField.bind(null, session.id, "title")}
            defaultValue={session.title}
            placeholder="e.g. Vision & Numbers"
            ariaLabel={`Session ${session.session_number} title`}
          />
        </Field>
        <Field label="Location">
          <EditableText
            action={setSessionField.bind(null, session.id, "location")}
            defaultValue={session.location}
            placeholder="Palette — Northshore"
            ariaLabel={`Session ${session.session_number} location`}
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Arena curriculum block */}
        <div
          className="rounded-[10px] border p-4"
          style={{ borderColor: ORG_COLOR.arena, background: "var(--teal-lt)" }}
        >
          <div
            className="mono text-[9px] uppercase tracking-[0.14em] mb-3 font-medium"
            style={{ color: ORG_COLOR.arena }}
          >
            {ORG_LABEL.arena} curriculum block · ~3 hrs with a break
          </div>
          <div className="space-y-3">
            <Field label="Topic">
              <EditableText
                action={setArenaField.bind(null, session.id, "topic")}
                defaultValue={session.arena_block?.topic}
                placeholder="Curriculum topic"
                ariaLabel="Arena topic"
              />
            </Field>
            <Field label="Learning objective">
              <EditableTextarea
                action={setArenaField.bind(null, session.id, "objective")}
                defaultValue={session.arena_block?.objective}
                rows={2}
                placeholder="By the end of this block participants can…"
                ariaLabel="Arena learning objective"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Presenter">
                <EditableText
                  action={setArenaField.bind(null, session.id, "presenter")}
                  defaultValue={session.arena_block?.presenter}
                  placeholder="Lauren / Jared"
                  ariaLabel="Arena presenter"
                />
              </Field>
              <Field label="Materials link">
                <EditableText
                  type="url"
                  action={setArenaField.bind(null, session.id, "materials_url")}
                  defaultValue={session.arena_block?.materials_url}
                  placeholder="https://"
                  ariaLabel="Arena materials link"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Exit Momentum coaching block */}
        <div
          className="rounded-[10px] border p-4"
          style={{
            borderColor: ORG_COLOR.exit_momentum,
            background: "var(--purple-lt)",
          }}
        >
          <div
            className="mono text-[9px] uppercase tracking-[0.14em] mb-3 font-medium"
            style={{ color: ORG_COLOR.exit_momentum }}
          >
            {ORG_LABEL.exit_momentum} coaching block
          </div>
          <div className="space-y-3">
            <Field label="Topic">
              <EditableText
                action={setExitMomentumField.bind(null, session.id, "topic")}
                defaultValue={session.exit_momentum_block?.topic}
                placeholder="Coaching topic"
                ariaLabel="Exit Momentum topic"
              />
            </Field>
            <Field label="Portion of the day-one consulting process">
              <EditableTextarea
                action={setExitMomentumField.bind(null, session.id, "process_stage")}
                defaultValue={session.exit_momentum_block?.process_stage}
                rows={2}
                placeholder="Which stage of Craig's engagement this session covers"
                ariaLabel="Coaching process stage"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Presenter">
                <EditableText
                  action={setExitMomentumField.bind(null, session.id, "presenter")}
                  defaultValue={session.exit_momentum_block?.presenter}
                  placeholder="Craig"
                  ariaLabel="Exit Momentum presenter"
                />
              </Field>
              <Field label="Notes">
                <EditableText
                  action={setExitMomentumField.bind(null, session.id, "notes")}
                  defaultValue={session.exit_momentum_block?.notes}
                  placeholder="Prep, handouts…"
                  ariaLabel="Exit Momentum notes"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-5">
        <Field label="Breakout / tangible takeaway — implemented before next session">
          <EditableTextarea
            action={setSessionField.bind(null, session.id, "breakout_takeaway")}
            defaultValue={session.breakout_takeaway}
            rows={2}
            placeholder="The thing each participant walks out and does"
            ariaLabel="Breakout takeaway"
          />
        </Field>
        <Field label="Between-session mentor focus">
          <EditableTextarea
            action={setSessionField.bind(null, session.id, "mentor_focus")}
            defaultValue={session.mentor_focus}
            rows={2}
            placeholder="What the mentor conversation should cover"
            ariaLabel="Mentor focus"
          />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Field label="Recording link">
          <EditableText
            type="url"
            action={setSessionField.bind(null, session.id, "recording_url")}
            defaultValue={session.recording_url}
            placeholder="https://"
            ariaLabel="Recording link"
          />
        </Field>

        <div>
          <Eyebrow className="mb-1.5">Prep checklist</Eyebrow>
          <ul className="space-y-1.5">
            {(session.prep_checklist as PrepItem[]).map((item, i) => (
              <li key={`${item.text}-${i}`} className="flex items-center gap-2">
                <EditableCheckbox
                  action={togglePrepItem.bind(null, session.id, i)}
                  defaultChecked={item.done}
                  label={item.text}
                />
                <form action={removePrepItem} className="no-print ml-auto">
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="index" value={i} />
                  <button
                    type="submit"
                    aria-label={`Remove prep item: ${item.text}`}
                    className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addPrepItem} className="flex gap-2 mt-2 no-print">
            <input type="hidden" name="session_id" value={session.id} />
            <input
              name="text"
              required
              placeholder="Add a prep item"
              aria-label="New prep item"
              className="field flex-1"
            />
            <button type="submit" className={buttonClass()}>
              Add
            </button>
          </form>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[var(--rule)] no-print">
        <form action={togglePublished}>
          <input type="hidden" name="session_id" value={session.id} />
          <input
            type="hidden"
            name="publish"
            value={session.published ? "false" : "true"}
          />
          <button type="submit" className={buttonClass(session.published ? "secondary" : "primary")}>
            {session.published ? "Unpublish from participants" : "Publish to participants"}
          </button>
        </form>

        <form action={pushTakeawayToParticipants}>
          <input type="hidden" name="session_id" value={session.id} />
          <button
            type="submit"
            className={buttonClass()}
            disabled={!session.breakout_takeaway?.trim()}
            title={
              session.breakout_takeaway?.trim()
                ? "Creates or updates this session's takeaway task for every participant"
                : "Write the takeaway first"
            }
          >
            Push takeaway to participant tasks
          </button>
        </form>
      </footer>
    </Card>
  );
}

export default async function SessionsPage() {
  await requireTeam();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bmc_sessions")
    .select("*")
    .order("session_number");

  const sessions = (data ?? []) as CohortSession[];
  const built = fullyBuiltCount(sessions);

  return (
    <>
      <PageHeader
        eyebrow="12 weeks · every other week · 6 half-day sessions"
        title="Session Builder"
        hint="Each session pairs Arena's curriculum with an Exit Momentum coaching block. By session 6 participants have seen a full engagement preview."
        right={
          <div className="text-right">
            <Eyebrow>Fully built</Eyebrow>
            <div className="mono text-[20px] leading-none mt-1">
              {built}
              <span className="text-[var(--muted)] text-[14px]">
                {" "}
                / {sessions.length}
              </span>
            </div>
          </div>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          hint="Run migration 0007 to create the six session shells."
        />
      ) : (
        <div className="space-y-5">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </>
  );
}
