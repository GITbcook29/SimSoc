import Link from "next/link";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import {
  ICP_GUARDRAILS,
  ORGS,
  ORG_LABEL,
  PIPELINE_STAGES,
  STAGE_LABEL,
} from "@/lib/bmc/config";
import { fitBand } from "@/lib/bmc/leads";
import type { Lead, Profile } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  OrgBadge,
  PageHeader,
} from "@/components/bmc/ui";
import { EditableSelect, EditableText } from "@/components/bmc/EditableField";
import {
  addLead,
  convertLeadToParticipant,
  deleteLead,
  importLeadsCSV,
  rescoreLead,
  setLeadField,
  setLeadOwner,
  setLeadOwnerOrg,
  setLeadStage,
} from "./actions";

const STAGE_OPTIONS = PIPELINE_STAGES.map((s) => ({
  value: s,
  label: STAGE_LABEL[s],
}));

function FitBadge({ score }: { score: number | null }) {
  const band = fitBand(score);
  return (
    <Badge color={band.color}>
      {score === null ? band.label : `${score} · ${band.label}`}
    </Badge>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    stage?: string;
    owner?: string;
    error?: string;
    message?: string;
  }>;
}) {
  await requireTeam();
  const sp = await searchParams;
  const kanban = sp.view === "kanban";

  const supabase = await createClient();
  const [{ data: leadData }, { data: profileData }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, full_name, org, role, business_name, avatar_url")
      .in("role", ["admin", "staff"])
      .order("full_name"),
  ]);

  const all = (leadData ?? []) as Lead[];
  const staff = (profileData ?? []) as Profile[];

  const leads = all.filter(
    (l) =>
      (!sp.stage || l.stage === sp.stage) &&
      (!sp.owner || l.owner_profile_id === sp.owner),
  );

  const ownerOptions = [
    { value: "", label: "— owner —" },
    ...staff.map((p) => ({ value: p.id, label: p.full_name || p.email || "Unnamed" })),
  ];
  const orgOptions = [
    { value: "", label: "— org —" },
    ...ORGS.map((o) => ({ value: o, label: ORG_LABEL[o] })),
  ];

  function href(next: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { view: sp.view, stage: sp.stage, owner: sp.owner, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/bmc/leads?${qs}` : "/bmc/leads";
  }

  const counts = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, all.filter((l) => l.stage === s).length]),
  ) as Record<string, number>;

  return (
    <>
      <PageHeader
        eyebrow="Participant recruitment"
        title="Leads & Outreach"
        hint="Prospect → Contacted → Info-session invited → Applied → Qualified → Offered → Committed. Converting a committed lead invites them as a participant."
        right={
          <>
            <Link
              href={href({ view: kanban ? undefined : "kanban" })}
              className={buttonClass()}
            >
              {kanban ? "Table view" : "Kanban view"}
            </Link>
            <a href="/bmc/leads/export" className={buttonClass()}>
              Export CSV
            </a>
          </>
        }
      />

      {sp.error && (
        <p className="mb-4 text-[13px] rounded-md px-3 py-2 border border-[var(--red)] text-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]">
          {sp.error}
        </p>
      )}
      {sp.message && (
        <p className="mb-4 text-[13px] rounded-md px-3 py-2 border border-[var(--teal)] text-[var(--teal)] bg-[var(--teal-lt)]">
          {sp.message}
        </p>
      )}

      <Card className="mb-5">
        <Eyebrow className="mb-2">Ideal participant profile</Eyebrow>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-[13px]">
          {ICP_GUARDRAILS.map((g) => (
            <li key={g} className="flex items-start gap-2">
              <span className="text-[var(--gold)]">—</span>
              {g}
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-[var(--muted)] mt-2">
          Fit score is suggested from years in business, headcount, revenue band,
          industry, and whether they were referred. Always editable.
        </p>
      </Card>

      {/* Stage filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5 no-print">
        <Eyebrow>Stage</Eyebrow>
        <Link
          href={href({ stage: undefined })}
          className={`mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
            !sp.stage
              ? "border-[var(--ink)] text-[var(--ink)]"
              : "border-[var(--rule)] text-[var(--muted)]"
          }`}
        >
          All ({all.length})
        </Link>
        {PIPELINE_STAGES.map((s) => (
          <Link
            key={s}
            href={href({ stage: s })}
            className={`mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
              sp.stage === s
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--rule)] text-[var(--muted)]"
            }`}
          >
            {STAGE_LABEL[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState
          title="No leads here yet"
          hint="Add one below, or import the running spreadsheet as CSV."
        />
      ) : kanban ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PIPELINE_STAGES.map((stage) => {
            const column = leads.filter((l) => l.stage === stage);
            return (
              <Card key={stage} className="min-h-[140px]">
                <div className="flex items-baseline justify-between mb-3">
                  <Eyebrow>{STAGE_LABEL[stage]}</Eyebrow>
                  <span className="mono text-[11px] text-[var(--muted)]">
                    {column.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {column.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-md border border-[var(--rule)] p-2.5"
                    >
                      <div className="text-[13px] font-medium">{lead.name}</div>
                      {lead.business && (
                        <div className="text-[12px] text-[var(--muted)]">
                          {lead.business}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <FitBadge score={lead.fit_score} />
                        <OrgBadge org={lead.owner_org} />
                      </div>
                      <div className="mt-2">
                        <EditableSelect
                          action={setLeadStage.bind(null, lead.id)}
                          defaultValue={lead.stage}
                          options={STAGE_OPTIONS}
                          ariaLabel={`Stage for ${lead.name}`}
                        />
                      </div>
                    </div>
                  ))}
                  {column.length === 0 && (
                    <p className="text-[12px] text-[var(--muted)]">Empty.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto p-5">
            <table className="w-full border-collapse text-[13px] min-w-[1400px]">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  {[
                    "Name",
                    "Business",
                    "Industry",
                    "Yrs",
                    "Revenue",
                    "Emp",
                    "Source",
                    "Referred by",
                    "Owner",
                    "Org",
                    "Stage",
                    "Last touch",
                    "Next follow-up",
                    "Fit",
                    "Notes",
                    "",
                  ].map((h) => (
                    <th key={h} className="eyebrow font-medium py-2 pr-3 align-bottom">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--rule)] last:border-0 align-top"
                  >
                    <td className="py-2 pr-3 w-[150px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "name")}
                        defaultValue={lead.name}
                        ariaLabel="Lead name"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[150px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "business")}
                        defaultValue={lead.business}
                        ariaLabel="Business"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[120px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "industry")}
                        defaultValue={lead.industry}
                        ariaLabel="Industry"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[60px]">
                      <EditableText
                        type="number"
                        action={setLeadField.bind(null, lead.id, "years_in_business")}
                        defaultValue={
                          lead.years_in_business === null
                            ? ""
                            : String(lead.years_in_business)
                        }
                        ariaLabel="Years in business"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[110px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "revenue_band")}
                        defaultValue={lead.revenue_band}
                        placeholder="$1–3M"
                        ariaLabel="Revenue band"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[60px]">
                      <EditableText
                        type="number"
                        action={setLeadField.bind(null, lead.id, "employees")}
                        defaultValue={
                          lead.employees === null ? "" : String(lead.employees)
                        }
                        ariaLabel="Employees"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[110px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "source")}
                        defaultValue={lead.source}
                        ariaLabel="Source"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[120px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "referred_by")}
                        defaultValue={lead.referred_by}
                        ariaLabel="Referred by"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[150px]">
                      <EditableSelect
                        action={setLeadOwner.bind(null, lead.id)}
                        defaultValue={lead.owner_profile_id ?? ""}
                        options={ownerOptions}
                        ariaLabel="Outreach owner"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[140px]">
                      <EditableSelect
                        action={setLeadOwnerOrg.bind(null, lead.id)}
                        defaultValue={lead.owner_org ?? ""}
                        options={orgOptions}
                        ariaLabel="Owning org"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[170px]">
                      <EditableSelect
                        action={setLeadStage.bind(null, lead.id)}
                        defaultValue={lead.stage}
                        options={STAGE_OPTIONS}
                        ariaLabel="Pipeline stage"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[135px]">
                      <EditableText
                        type="date"
                        action={setLeadField.bind(null, lead.id, "last_touch")}
                        defaultValue={lead.last_touch}
                        ariaLabel="Last touch date"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[135px]">
                      <EditableText
                        type="date"
                        action={setLeadField.bind(null, lead.id, "next_follow_up")}
                        defaultValue={lead.next_follow_up}
                        ariaLabel="Next follow-up date"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[130px]">
                      <div className="flex flex-col gap-1">
                        <EditableText
                          type="number"
                          action={setLeadField.bind(null, lead.id, "fit_score")}
                          defaultValue={
                            lead.fit_score === null ? "" : String(lead.fit_score)
                          }
                          ariaLabel="Fit score"
                        />
                        <FitBadge score={lead.fit_score} />
                        <form action={rescoreLead} className="no-print">
                          <input type="hidden" name="id" value={lead.id} />
                          <button
                            type="submit"
                            className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--gold)]"
                          >
                            Suggest
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="py-2 pr-3 w-[180px]">
                      <EditableText
                        action={setLeadField.bind(null, lead.id, "notes")}
                        defaultValue={lead.notes}
                        ariaLabel="Notes"
                      />
                    </td>
                    <td className="py-2 w-[190px] no-print">
                      {lead.converted_participant_id ? (
                        <Badge color="var(--teal)" tint="var(--teal-lt)">
                          Participant invited
                        </Badge>
                      ) : (
                        <form action={convertLeadToParticipant} className="space-y-1">
                          <input type="hidden" name="id" value={lead.id} />
                          <input
                            name="email"
                            type="email"
                            placeholder="email to invite"
                            aria-label={`Email to invite ${lead.name}`}
                            className="field text-[12px]"
                          />
                          <button type="submit" className={buttonClass()}>
                            Convert to participant
                          </button>
                        </form>
                      )}
                      <form action={deleteLead} className="mt-1">
                        <input type="hidden" name="id" value={lead.id} />
                        <button
                          type="submit"
                          className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 mt-5 no-print">
        <Card>
          <Eyebrow className="mb-2">Add a lead</Eyebrow>
          <form action={addLead} className="flex flex-wrap gap-2">
            <input
              name="name"
              required
              placeholder="Name"
              aria-label="New lead name"
              className="field flex-1 min-w-[130px]"
            />
            <input
              name="business"
              placeholder="Business"
              aria-label="New lead business"
              className="field flex-1 min-w-[130px]"
            />
            <button type="submit" className={buttonClass("primary")}>
              Add
            </button>
          </form>
        </Card>

        <Card>
          <Eyebrow className="mb-2">Bulk import</Eyebrow>
          <form action={importLeadsCSV} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              aria-label="Leads CSV file"
              className="text-[13px] flex-1 min-w-[180px]"
            />
            <button type="submit" className={buttonClass()}>
              Import CSV
            </button>
          </form>
          <p className="text-[12px] text-[var(--muted)] mt-2">
            Needs a header row with at least <span className="mono">name</span>.
            Business, industry, years, revenue, employees, source, referred by,
            stage, dates, and notes are all recognised.
          </p>
        </Card>
      </div>
    </>
  );
}
