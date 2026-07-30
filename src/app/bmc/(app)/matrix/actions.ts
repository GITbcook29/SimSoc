"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { ORGS, RACI, type Org, type Raci } from "@/lib/bmc/config";

const PATH = "/bmc/matrix";

function asOrg(value: string): Org {
  if ((ORGS as readonly string[]).includes(value)) return value as Org;
  throw new Error(`Unknown org: ${value}`);
}

function asRaci(value: string): Raci | null {
  if (value === "") return null;
  if ((RACI as readonly string[]).includes(value)) return value as Raci;
  throw new Error(`Unknown RACI value: ${value}`);
}

/**
 * Cells are created lazily: a workstream/org pairing only gets a row once
 * someone assigns something to it, so the seeded matrix stays sparse and the
 * gap check below stays meaningful.
 */
async function upsertCell(
  workstream: string,
  org: Org,
  patch: { raci?: Raci | null; owner_name?: string | null; notes?: string | null },
) {
  await requireTeam();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("bmc_responsibility_matrix")
    .select("id")
    .eq("workstream", workstream)
    .eq("org", org)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("bmc_responsibility_matrix")
      .update(patch)
      .eq("id", existing.id);
  } else {
    await supabase
      .from("bmc_responsibility_matrix")
      .insert({ workstream, org, ...patch });
  }

  revalidatePath(PATH);
}

export async function setCellRaci(workstream: string, org: string, value: string) {
  await upsertCell(workstream, asOrg(org), { raci: asRaci(value) });
}

export async function setCellOwner(workstream: string, org: string, value: string) {
  await upsertCell(workstream, asOrg(org), { owner_name: value.trim() || null });
}

export async function setCellNotes(workstream: string, org: string, value: string) {
  await upsertCell(workstream, asOrg(org), { notes: value.trim() || null });
}

export async function addWorkstream(formData: FormData) {
  await requireTeam();
  const name = String(formData.get("workstream") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("bmc_responsibility_matrix")
    .select("id")
    .eq("workstream", name)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: last } = await supabase
    .from("bmc_responsibility_matrix")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Seed the row with no RACI so the new workstream shows up as a gap until
  // somebody is made Accountable for it.
  await supabase.from("bmc_responsibility_matrix").insert({
    workstream: name,
    org: "shared",
    sort_order: (last?.sort_order ?? 0) + 10,
  });

  revalidatePath(PATH);
}

export async function renameWorkstream(oldName: string, value: string) {
  await requireTeam();
  const name = value.trim();
  if (!name || name === oldName) return;

  const supabase = await createClient();
  await supabase
    .from("bmc_responsibility_matrix")
    .update({ workstream: name })
    .eq("workstream", oldName);

  revalidatePath(PATH);
}

export async function deleteWorkstream(formData: FormData) {
  await requireTeam();
  const workstream = String(formData.get("workstream") ?? "");
  if (!workstream) return;

  const supabase = await createClient();
  await supabase
    .from("bmc_responsibility_matrix")
    .delete()
    .eq("workstream", workstream);

  revalidatePath(PATH);
}
