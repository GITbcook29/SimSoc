import Link from "next/link";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import {
  ORGS,
  ORG_COLOR,
  ORG_LABEL,
  PHASES,
  PHASE_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Org,
  type Phase,
  type Status,
} from "@/lib/bmc/config";
import type { Milestone, Profile } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
} from "@/components/bmc/ui";
import { EditableSelect, EditableText } from "@/components/bmc/EditableField";
import { StatusCycleButton } from "@/components/bmc/StatusCycleButton";
import {
  addDependency,
  addMilestone,
  deleteMilestone,
  removeDependency,
  setMilestoneField,
  setMilestoneOrg,
  setMilestoneOwner,
  setMilestoneStatus,
} from "./actions";

/** Calendar span each phase band covers, used to place the timeline bars. */
const PHASE_RANGE: Record<Phase, { start: string; end: string }> = {
  q3_2026: { start: "2026-07-01", end: "2026-09-30" },
  q4_2026: { start: "2026-10-01", end: "2026-12-31" },
  q1_2027: { start: "2027-01-01", end: "2027-03-31" },
};

function ms(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/**
 * Position a milestone's bar within its phase band. Milestones with no dates
 * yet get a faint full-width bar so they're still visible on the timeline.
 */
function barGeometry(m: Milestone): { left: number; width: number; dated: boolean } {
  const range = PHASE_RANGE[m.phase];
  const from = ms(range.start);
  const to = ms(range.end);
  const span = to - from;

  if (!m.start_date && !m.due_date) return { left: 0, width: 100, dated: false };

  const startRaw = m.start_date ? ms(m.start_date) : m.due_date ? ms(m.due_date) : from;
  const endRaw = m.due_date ? ms(m.due_date) : startRaw;

  const clampedStart = Math.min(Math.max(startRaw, from), to);
  const clampedEnd = Math.min(Math.max(endRaw, clampedStart), to);

  const left = ((clampedStart - from) / span) * 100;
  const width = Math.max(3, ((clampedEnd - clampedStart) / span) * 100);
  return { left, width: Math.min(width, 100 - left), dated: true };
}

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; status?: string }>;
}) {
  await requireTeam();
  const { org: orgFilter, status: statusFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: milestoneData }, { data: profileData }] = await Promise.all([
    supabase
      .from("roadmap_milestones")
      .select("*")
      .order("phase")
      .order("sort_order"),
    supabase
      .from("profiles")
      .select("id, email, full_name, org, role, business_name, avatar_url")
      .in("role", ["admin", "staff"])
      .order("full_name"),
  ]);

  const all = (milestoneData ?? []) as Milestone[];
  const staff = (profileData ?? []) as Profile[];
  const titleById = new Map(all.map((m) => [m.id, m.title]));

  const visible = all.filter(
    (m) =>
      (!orgFilter || m.org === orgFilter) &&
      (!statusFilter || m.status === statusFilter),
  );

  const ownerOptions = [
    { value: "", label: "— owner —" },
    ...staff.map((p) => ({ value: p.id, label: p.full_name || p.email || "Unnamed" })),
  ];
  const orgOptions = [
    { value: "", label: "— org —" },
    ...ORGS.map((o) => ({ value: o, label: ORG_LABEL[o] })),
  ];

  function filterHref(next: { org?: string; status?: string }) {
    const p = new URLSearchParams();
    const o = next.org ?? orgFilter;
    const s = next.status ?? statusFilter;
    if (o) p.set("org", o);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/bmc/roadmap?${qs}` : "/bmc/roadmap";
  }

  return (
    <>
      <PageHeader
        eyebrow="Plan → Market → Execute"
        title="Roadmap"
        hint="Three phase bands with week-level milestones inside. The bar shows where each milestone sits in its quarter; the table below is where you edit it."
      />

      <div className="flex flex-wrap items-center gap-4 mb-6 no-print">
        <div className="flex items-center gap-1.5">
          <Eyebrow>Org</Eyebrow>
          <Link
            href={filterHref({ org: "" })}
            className={`mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
              !orgFilter
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--rule)] text-[var(--muted)]"
            }`}
          >
            All
          </Link>
          {ORGS.map((o) => (
            <Link
              key={o}
              href={filterHref({ org: o })}
              className="mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border"
              style={{
                color: orgFilter === o ? ORG_COLOR[o] : "var(--muted)",
                borderColor: orgFilter === o ? ORG_COLOR[o] : "var(--rule)",
              }}
            >
              {ORG_LABEL[o]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Eyebrow>Status</Eyebrow>
          <Link
            href={filterHref({ status: "" })}
            className={`mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
              !statusFilter
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--rule)] text-[var(--muted)]"
            }`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={filterHref({ status: s })}
              className={`mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
                statusFilter === s
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-[var(--rule)] text-[var(--muted)]"
              }`}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {PHASES.map((phase) => {
          const rows = visible.filter((m) => m.phase === phase);
          const range = PHASE_RANGE[phase];

          return (
            <Card key={phase} className="print-break">
              <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <div>
                  <Eyebrow className="mb-1">Phase band</Eyebrow>
                  <h2 className="text-lg leading-tight">{PHASE_LABEL[phase]}</h2>
                </div>
                <span className="mono text-[11px] text-[var(--muted)]">
                  {range.start} → {range.end}
                </span>
              </header>

              {/* Timeline */}
              {rows.length > 0 && (
                <div className="mb-5 space-y-1.5">
                  {rows.map((m) => {
                    const { left, width, dated } = barGeometry(m);
                    const color = m.org ? ORG_COLOR[m.org] : "var(--muted)";
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-[12px] w-[220px] shrink-0 truncate">
                          {m.title || (
                            <span className="text-[var(--muted)] italic">Untitled</span>
                          )}
                        </span>
                        <div className="relative h-4 flex-1 rounded bg-[var(--rule)]/40">
                          <div
                            className="absolute top-0 h-4 rounded"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              background: color,
                              opacity: dated ? 0.85 : 0.18,
                            }}
                            title={
                              dated
                                ? `${m.start_date ?? "?"} → ${m.due_date ?? "?"}`
                                : "No dates set"
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Editable table */}
              {rows.length === 0 ? (
                <EmptyState
                  title="No milestones match"
                  hint={
                    orgFilter || statusFilter
                      ? "Clear the filters above to see everything in this band."
                      : "Add the first milestone for this phase below."
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px] min-w-[900px]">
                    <thead>
                      <tr className="border-b border-[var(--rule)] text-left">
                        <th className="eyebrow font-medium py-2 pr-3 w-[26%]">Milestone</th>
                        <th className="eyebrow font-medium py-2 pr-3">Org</th>
                        <th className="eyebrow font-medium py-2 pr-3">Owner</th>
                        <th className="eyebrow font-medium py-2 pr-3">Start</th>
                        <th className="eyebrow font-medium py-2 pr-3">Due</th>
                        <th className="eyebrow font-medium py-2 pr-3">Status</th>
                        <th className="eyebrow font-medium py-2 pr-3">Depends on</th>
                        <th className="eyebrow font-medium py-2 no-print">&nbsp;</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-[var(--rule)] last:border-0 align-top"
                        >
                          <td className="py-2 pr-3">
                            <EditableText
                              action={setMilestoneField.bind(null, m.id, "title")}
                              defaultValue={m.title}
                              ariaLabel="Milestone title"
                            />
                          </td>
                          <td className="py-2 pr-3 w-[150px]">
                            <EditableSelect
                              action={setMilestoneOrg.bind(null, m.id)}
                              defaultValue={m.org ?? ""}
                              options={orgOptions}
                              ariaLabel="Milestone org"
                            />
                          </td>
                          <td className="py-2 pr-3 w-[160px]">
                            <EditableSelect
                              action={setMilestoneOwner.bind(null, m.id)}
                              defaultValue={m.owner_profile_id ?? ""}
                              options={ownerOptions}
                              ariaLabel="Milestone owner"
                            />
                          </td>
                          <td className="py-2 pr-3 w-[140px]">
                            <EditableText
                              type="date"
                              action={setMilestoneField.bind(null, m.id, "start_date")}
                              defaultValue={m.start_date}
                              ariaLabel="Milestone start date"
                            />
                          </td>
                          <td className="py-2 pr-3 w-[140px]">
                            <EditableText
                              type="date"
                              action={setMilestoneField.bind(null, m.id, "due_date")}
                              defaultValue={m.due_date}
                              ariaLabel="Milestone due date"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <StatusCycleButton
                              status={m.status}
                              action={setMilestoneStatus.bind(null, m.id)}
                              compact
                            />
                          </td>
                          <td className="py-2 pr-3 w-[200px]">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {(m.dependency_ids ?? []).map((dep) => (
                                <form
                                  key={dep}
                                  action={removeDependency}
                                  className="inline"
                                >
                                  <input type="hidden" name="id" value={m.id} />
                                  <input type="hidden" name="depends_on" value={dep} />
                                  <button
                                    type="submit"
                                    title="Remove dependency"
                                    className="mono text-[9px] uppercase tracking-[0.1em] border border-[var(--rule)] rounded-full px-2 py-[2px] hover:border-[var(--red)] hover:text-[var(--red)]"
                                  >
                                    {titleById.get(dep) ?? "unknown"} ×
                                  </button>
                                </form>
                              ))}
                            </div>
                            <form action={addDependency} className="no-print">
                              <input type="hidden" name="id" value={m.id} />
                              <select
                                name="depends_on"
                                aria-label="Add dependency"
                                defaultValue=""
                                className="field text-[12px]"
                              >
                                <option value="">+ depends on…</option>
                                {all
                                  .filter(
                                    (o) =>
                                      o.id !== m.id &&
                                      !(m.dependency_ids ?? []).includes(o.id),
                                  )
                                  .map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.title}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="submit"
                                className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--gold)] mt-1"
                              >
                                Add dependency
                              </button>
                            </form>
                          </td>
                          <td className="py-2 text-right no-print">
                            <form action={deleteMilestone}>
                              <input type="hidden" name="id" value={m.id} />
                              <button
                                type="submit"
                                aria-label={`Delete milestone ${m.title}`}
                                className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                              >
                                ×
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <form action={addMilestone} className="flex flex-wrap gap-2 mt-4 no-print">
                <input type="hidden" name="phase" value={phase} />
                <input
                  name="title"
                  required
                  placeholder={`Add a milestone to ${PHASE_LABEL[phase].split(" — ")[0]}`}
                  aria-label="New milestone title"
                  className="field flex-1 min-w-[240px] max-w-md"
                />
                <button type="submit" className={buttonClass()}>
                  Add milestone
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {ORGS.map((o: Org) => (
          <Badge key={o} color={ORG_COLOR[o]}>
            {ORG_LABEL[o]}
          </Badge>
        ))}
        {STATUSES.map((s: Status) => (
          <Badge key={s}>{STATUS_LABEL[s]}</Badge>
        ))}
      </div>
    </>
  );
}
