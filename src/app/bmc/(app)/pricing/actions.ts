"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { ORGS, type Org } from "@/lib/bmc/config";
import type { CostItem } from "@/lib/bmc/types";

const PATH = "/bmc/pricing";

export async function setScenarioField(id: string, column: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  const trimmed = value.trim();

  if (column === "name" || column === "notes") {
    await supabase
      .from("pricing_scenarios")
      .update({ [column]: trimmed || (column === "name" ? "Scenario" : null) })
      .eq("id", id);
  } else if (column === "price_per_participant") {
    // Deliberately nullable — an empty price is "still TBD", not zero.
    const n = trimmed === "" ? null : Number(trimmed);
    if (n !== null && (Number.isNaN(n) || n < 0)) return;
    await supabase
      .from("pricing_scenarios")
      .update({ price_per_participant: n })
      .eq("id", id);
  } else if (column === "cohort_size") {
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0) return;
    await supabase
      .from("pricing_scenarios")
      .update({ cohort_size: Math.round(n) })
      .eq("id", id);
  } else {
    throw new Error(`Column not editable: ${column}`);
  }

  revalidatePath(PATH);
}

export async function setOrgSplit(id: string, org: string, value: string) {
  await requireTeam();
  if (!(ORGS as readonly string[]).includes(org)) {
    throw new Error(`Unknown org: ${org}`);
  }

  const n = value.trim() === "" ? 0 : Number(value);
  if (Number.isNaN(n) || n < 0 || n > 100) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pricing_scenarios")
    .select("org_split")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const split = { ...((data.org_split ?? {}) as Record<string, number>) };
  split[org as Org] = n;

  await supabase
    .from("pricing_scenarios")
    .update({ org_split: split })
    .eq("id", id);

  revalidatePath(PATH);
}

async function writeCostItems(id: string, items: CostItem[]) {
  const supabase = await createClient();
  await supabase.from("pricing_scenarios").update({ cost_items: items }).eq("id", id);
  revalidatePath(PATH);
}

async function readCostItems(id: string): Promise<CostItem[] | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pricing_scenarios")
    .select("cost_items")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return (data.cost_items ?? []) as CostItem[];
}

export async function setCostItemField(
  id: string,
  index: number,
  field: "label" | "amount",
  value: string,
) {
  await requireTeam();
  const items = await readCostItems(id);
  if (!items || index < 0 || index >= items.length) return;

  const next = items.map((item, i) => {
    if (i !== index) return item;
    if (field === "label") return { ...item, label: value.trim() };
    const n = value.trim() === "" ? 0 : Number(value);
    return Number.isNaN(n) ? item : { ...item, amount: n };
  });

  await writeCostItems(id, next);
}

export async function toggleCostItemBasis(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const index = Number(formData.get("index"));
  if (!id || Number.isNaN(index)) return;

  const items = await readCostItems(id);
  if (!items || index < 0 || index >= items.length) return;

  await writeCostItems(
    id,
    items.map((item, i) =>
      i === index ? { ...item, per_participant: !item.per_participant } : item,
    ),
  );
}

export async function addCostItem(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !label) return;

  const items = await readCostItems(id);
  if (!items) return;

  await writeCostItems(id, [
    ...items,
    { label, amount: 0, per_participant: formData.get("basis") === "per_participant" },
  ]);
}

export async function removeCostItem(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const index = Number(formData.get("index"));
  if (!id || Number.isNaN(index)) return;

  const items = await readCostItems(id);
  if (!items) return;

  await writeCostItems(
    id,
    items.filter((_, i) => i !== index),
  );
}

export async function addScenario(formData: FormData) {
  await requireTeam();
  const name = String(formData.get("name") ?? "").trim() || "New scenario";

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("pricing_scenarios")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("pricing_scenarios").insert({
    name,
    cohort_size: 15,
    cost_items: [
      { label: "Facility", amount: 0, per_participant: false },
      { label: "Materials", amount: 0, per_participant: true },
      { label: "Mentor stipends", amount: 0, per_participant: true },
      { label: "Marketing", amount: 0, per_participant: false },
      { label: "Platform", amount: 0, per_participant: false },
    ],
    org_split: { palette: 34, arena: 33, exit_momentum: 33 },
    sort_order: (last?.sort_order ?? 0) + 10,
  });

  revalidatePath(PATH);
}

export async function deleteScenario(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("pricing_scenarios").delete().eq("id", id);
  revalidatePath(PATH);
}
