import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { BILLING_ENTITY_LABEL, ORGS, ORG_COLOR, ORG_LABEL } from "@/lib/bmc/config";
import { computeScenario, money } from "@/lib/bmc/pricing";
import type { CostItem, PricingScenario } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
} from "@/components/bmc/ui";
import { EditableText, EditableTextarea } from "@/components/bmc/EditableField";
import {
  addCostItem,
  addScenario,
  deleteScenario,
  removeCostItem,
  setCostItemField,
  setOrgSplit,
  setScenarioField,
  toggleCostItemBasis,
} from "./actions";

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <div className="mono text-[19px] leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
      {hint && <p className="text-[11px] text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: PricingScenario }) {
  const m = computeScenario(scenario);
  const items = (scenario.cost_items ?? []) as CostItem[];
  const splitOrgs = ORGS.filter((o) => o !== "shared");

  return (
    <Card className="print-break">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex-1 min-w-[220px]">
          <Eyebrow className="mb-1">Scenario</Eyebrow>
          <EditableText
            action={setScenarioField.bind(null, scenario.id, "name")}
            defaultValue={scenario.name}
            ariaLabel="Scenario name"
            className="text-[16px] font-medium"
          />
        </div>
        <form action={deleteScenario} className="no-print">
          <input type="hidden" name="id" value={scenario.id} />
          <button type="submit" className={buttonClass("danger")}>
            Delete
          </button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <label className="block">
          <span className="eyebrow block mb-1">Price per participant</span>
          <EditableText
            type="number"
            action={setScenarioField.bind(
              null,
              scenario.id,
              "price_per_participant",
            )}
            defaultValue={
              scenario.price_per_participant === null
                ? ""
                : String(scenario.price_per_participant)
            }
            placeholder="TBD"
            ariaLabel="Price per participant"
          />
          {scenario.price_per_participant === null && (
            <span className="text-[11px] text-[var(--muted)] mt-1 block">
              Still open — revenue and margin stay blank until this is set.
            </span>
          )}
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Cohort size</span>
          <EditableText
            type="number"
            action={setScenarioField.bind(null, scenario.id, "cohort_size")}
            defaultValue={String(scenario.cohort_size)}
            ariaLabel="Cohort size"
          />
        </label>
      </div>

      {/* Cost line items */}
      <Eyebrow className="mb-2">Cost line items</Eyebrow>
      <div className="space-y-2 mb-4">
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`} className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[140px]">
              <EditableText
                action={setCostItemField.bind(null, scenario.id, i, "label")}
                defaultValue={item.label}
                ariaLabel="Cost item label"
              />
            </div>
            <div className="w-[120px]">
              <EditableText
                type="number"
                action={setCostItemField.bind(null, scenario.id, i, "amount")}
                defaultValue={String(item.amount ?? 0)}
                ariaLabel={`${item.label} amount`}
              />
            </div>
            <form action={toggleCostItemBasis} className="no-print">
              <input type="hidden" name="id" value={scenario.id} />
              <input type="hidden" name="index" value={i} />
              <button
                type="submit"
                title="Switch between a flat cost and a per-participant cost"
                className="mono text-[9px] uppercase tracking-[0.12em] border border-[var(--rule)] rounded-full px-2 py-1 hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                {item.per_participant ? "per participant" : "flat"}
              </button>
            </form>
            <form action={removeCostItem} className="no-print">
              <input type="hidden" name="id" value={scenario.id} />
              <input type="hidden" name="index" value={i} />
              <button
                type="submit"
                aria-label={`Remove ${item.label}`}
                className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
              >
                ×
              </button>
            </form>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[13px] text-[var(--muted)]">No cost items yet.</p>
        )}
      </div>

      <form action={addCostItem} className="flex flex-wrap gap-2 mb-6 no-print">
        <input type="hidden" name="id" value={scenario.id} />
        <input
          name="label"
          required
          placeholder="Add a cost line"
          aria-label="New cost item label"
          className="field flex-1 min-w-[160px] max-w-xs"
        />
        <select name="basis" aria-label="Cost basis" className="field w-[160px]">
          <option value="flat">flat</option>
          <option value="per_participant">per participant</option>
        </select>
        <button type="submit" className={buttonClass()}>
          Add
        </button>
      </form>

      {/* Output */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-[var(--rule)]">
        <Stat
          label="Gross revenue"
          value={money(m.grossRevenue)}
          hint={`${scenario.cohort_size} participants`}
        />
        <Stat
          label="Total costs"
          value={money(m.totalCosts)}
          hint={`${money(m.fixedCosts)} fixed + ${money(m.perParticipantCosts)} variable`}
        />
        <Stat
          label="Margin"
          value={money(m.margin)}
          hint={m.marginPct === null ? "Set a price" : `${m.marginPct.toFixed(1)}%`}
          color={
            m.margin === null
              ? undefined
              : m.margin >= 0
                ? "var(--green)"
                : "var(--red)"
          }
        />
        <Stat
          label="Break-even headcount"
          value={
            m.breakEvenHeadcount === null ? "—" : String(m.breakEvenHeadcount)
          }
          hint={
            m.breakEvenHeadcount === null
              ? "Needs a price above the per-participant cost"
              : m.breakEvenHeadcount > scenario.cohort_size
                ? "Above this cohort size"
                : "Covered by this cohort size"
          }
          color={
            m.breakEvenHeadcount !== null &&
            m.breakEvenHeadcount > scenario.cohort_size
              ? "var(--amber)"
              : undefined
          }
        />
      </div>

      {/* Org split */}
      <div className="mt-5 pt-4 border-t border-[var(--rule)]">
        <div className="flex items-baseline justify-between mb-3">
          <Eyebrow>Revenue split (% of margin)</Eyebrow>
          {m.splitTotal !== 100 && (
            <Badge color="var(--amber)">Splits total {m.splitTotal}%</Badge>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {splitOrgs.map((org) => {
            const row = m.perOrg.find((p) => p.org === org);
            return (
              <div key={org}>
                <div
                  className="mono text-[9px] uppercase tracking-[0.12em] mb-1"
                  style={{ color: ORG_COLOR[org] }}
                >
                  {ORG_LABEL[org]}
                </div>
                <EditableText
                  type="number"
                  action={setOrgSplit.bind(null, scenario.id, org)}
                  defaultValue={String(scenario.org_split?.[org] ?? 0)}
                  ariaLabel={`${ORG_LABEL[org]} split percentage`}
                />
                <div className="mono text-[14px] mt-1">{money(row?.amount ?? null)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Eyebrow className="mb-1">Notes</Eyebrow>
        <EditableTextarea
          action={setScenarioField.bind(null, scenario.id, "notes")}
          defaultValue={scenario.notes}
          rows={2}
          placeholder="Assumptions, what changes at this size…"
          ariaLabel="Scenario notes"
        />
      </div>
    </Card>
  );
}

export default async function PricingPage() {
  await requireTeam();
  const supabase = await createClient();

  const { data } = await supabase
    .from("pricing_scenarios")
    .select("*")
    .order("sort_order");

  const scenarios = (data ?? []) as PricingScenario[];

  return (
    <>
      <PageHeader
        eyebrow={`Billing under ${BILLING_ENTITY_LABEL}`}
        title="Pricing & Revenue Model"
        hint="Price per participant and final cohort size are still open. Both scenarios stay side by side so the tight and broad cases can be compared rather than picked prematurely."
      />

      {scenarios.length === 0 ? (
        <EmptyState
          title="No scenarios yet"
          hint="Run migration 0007 to load the tight and broad cohort scenarios, or add one below."
        />
      ) : (
        <div className="space-y-5">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} />
          ))}
        </div>
      )}

      <Card className="mt-5 no-print">
        <form action={addScenario} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Eyebrow className="mb-1.5">Add a scenario</Eyebrow>
            <input
              name="name"
              placeholder="e.g. Sponsored seats"
              aria-label="New scenario name"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
          </div>
          <button type="submit" className={buttonClass("primary")}>
            Add scenario
          </button>
        </form>
      </Card>
    </>
  );
}
