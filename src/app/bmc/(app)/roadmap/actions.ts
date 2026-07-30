"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { ORGS, PHASES, STATUSES, type Org, type Phase, type Status } from "@/lib/bmc/config";

const PATH = "/bmc/roadmap";

const COLUMNS = ["title", "start_date", "due_date"] as const;

export async function setMilestoneField(id: string, column: string, value: string) {
  await requireTeam();
  if (!(COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }

  const supabase = await createClient();
  await supabase
    .from("roadmap_milestones")
    .update({ [column]: value.trim() || null })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function setMilestoneStatus(id: string, value: string) {
  await requireTeam();
  if (!(STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown status: ${value}`);
  }

  const supabase = await createClient();
  await supabase
    .from("roadmap_milestones")
    .update({ status: value as Status })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function setMilestoneOrg(id: string, value: string) {
  await requireTeam();
  const org = value === "" ? null : (value as Org);
  if (org && !(ORGS as readonly string[]).includes(org)) {
    throw new Error(`Unknown org: ${value}`);
  }

  const supabase = await createClient();
  await supabase.from("roadmap_milestones").update({ org }).eq("id", id);
  revalidatePath(PATH);
}

export async function setMilestoneOwner(id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("roadmap_milestones")
    .update({ owner_profile_id: value || null })
    .eq("id", id);
  revalidatePath(PATH);
}

export async function addMilestone(formData: FormData) {
  await requireTeam();
  const phase = String(formData.get("phase") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title || !(PHASES as readonly string[]).includes(phase)) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("roadmap_milestones")
    .select("sort_order")
    .eq("phase", phase)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("roadmap_milestones").insert({
    phase: phase as Phase,
    title,
    sort_order: (last?.sort_order ?? 0) + 10,
  });

  revalidatePath(PATH);
}

export async function deleteMilestone(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Drop the milestone, then clear it from anything that depended on it so no
  // dangling ids are left behind in the arrays.
  const { data: dependents } = await supabase
    .from("roadmap_milestones")
    .select("id, dependency_ids")
    .contains("dependency_ids", [id]);

  await supabase.from("roadmap_milestones").delete().eq("id", id);

  for (const d of dependents ?? []) {
    await supabase
      .from("roadmap_milestones")
      .update({
        dependency_ids: (d.dependency_ids as string[]).filter((x) => x !== id),
      })
      .eq("id", d.id);
  }

  revalidatePath(PATH);
}

export async function addDependency(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const dependsOn = String(formData.get("depends_on") ?? "");
  if (!id || !dependsOn || id === dependsOn) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("roadmap_milestones")
    .select("dependency_ids")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const current = (data.dependency_ids ?? []) as string[];
  if (current.includes(dependsOn)) return;

  await supabase
    .from("roadmap_milestones")
    .update({ dependency_ids: [...current, dependsOn] })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function removeDependency(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const dependsOn = String(formData.get("depends_on") ?? "");
  if (!id || !dependsOn) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("roadmap_milestones")
    .select("dependency_ids")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  await supabase
    .from("roadmap_milestones")
    .update({
      dependency_ids: ((data.dependency_ids ?? []) as string[]).filter(
        (x) => x !== dependsOn,
      ),
    })
    .eq("id", id);

  revalidatePath(PATH);
}
