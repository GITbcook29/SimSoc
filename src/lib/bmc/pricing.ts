import { ORGS, type Org } from "./config";
import type { CostItem, PricingScenario } from "./types";

export type ScenarioMath = {
  grossRevenue: number | null;
  fixedCosts: number;
  perParticipantCosts: number;
  totalCosts: number;
  margin: number | null;
  marginPct: number | null;
  /** Headcount at which gross revenue covers total costs. */
  breakEvenHeadcount: number | null;
  perOrg: { org: Org; pct: number; amount: number | null }[];
  splitTotal: number;
};

/**
 * Break-even solves for the headcount n where
 *   price × n = fixed + (perParticipant × n)
 * so n = fixed / (price − perParticipant). A price at or below the variable
 * cost per participant never breaks even, so it returns null rather than a
 * misleading number.
 */
export function computeScenario(scenario: PricingScenario): ScenarioMath {
  const items = (scenario.cost_items ?? []) as CostItem[];
  const size = Math.max(0, scenario.cohort_size ?? 0);
  const price = scenario.price_per_participant;

  const fixedCosts = items
    .filter((i) => !i.per_participant)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const perHead = items
    .filter((i) => i.per_participant)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const perParticipantCosts = perHead * size;
  const totalCosts = fixedCosts + perParticipantCosts;

  const grossRevenue = price === null ? null : price * size;
  const margin = grossRevenue === null ? null : grossRevenue - totalCosts;
  const marginPct =
    grossRevenue === null || grossRevenue === 0
      ? null
      : ((margin as number) / grossRevenue) * 100;

  let breakEvenHeadcount: number | null = null;
  if (price !== null && price > perHead) {
    breakEvenHeadcount = Math.ceil(fixedCosts / (price - perHead));
  }

  const split = scenario.org_split ?? {};
  const splitTotal = ORGS.filter((o) => o !== "shared").reduce(
    (sum, o) => sum + (Number(split[o]) || 0),
    0,
  );

  const perOrg = ORGS.filter((o) => o !== "shared").map((org) => {
    const pct = Number(split[org]) || 0;
    return {
      org,
      pct,
      amount: margin === null ? null : (margin * pct) / 100,
    };
  });

  return {
    grossRevenue,
    fixedCosts,
    perParticipantCosts,
    totalCosts,
    margin,
    marginPct,
    breakEvenHeadcount,
    perOrg,
    splitTotal,
  };
}

export function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
