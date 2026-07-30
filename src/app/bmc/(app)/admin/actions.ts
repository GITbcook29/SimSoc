"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/bmc/auth";
import { ORGS, ROLES, type Org, type Role } from "@/lib/bmc/config";

const PATH = "/bmc/admin";

export async function setProfileRole(id: string, value: string) {
  const admin = await requireAdmin();

  // Guard against an admin removing their own access and locking the team out
  // of user management entirely.
  if (id === admin.id && value !== "admin") {
    throw new Error("You cannot remove your own admin access.");
  }
  if (!(ROLES as readonly string[]).includes(value)) {
    throw new Error(`Unknown role: ${value}`);
  }

  const supabase = await createClient();
  await supabase
    .from("bmc_profiles")
    .update({ role: value as Role })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function setProfileOrg(id: string, value: string) {
  await requireAdmin();
  const org = value === "" ? null : (value as Org);
  if (org && !(ORGS as readonly string[]).includes(org)) {
    throw new Error(`Unknown org: ${value}`);
  }

  const supabase = await createClient();
  await supabase.from("bmc_profiles").update({ org }).eq("id", id);
  revalidatePath(PATH);
}

const PROFILE_COLUMNS = ["full_name", "business_name"] as const;

export async function setProfileField(id: string, column: string, value: string) {
  await requireAdmin();
  if (!(PROFILE_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }

  const supabase = await createClient();
  await supabase
    .from("bmc_profiles")
    .update({ [column]: value.trim() || null })
    .eq("id", id);

  revalidatePath(PATH);
}

// --- Build team roster (independent of auth accounts) ----------------------

const ROSTER_COLUMNS = ["full_name", "role_title", "email"] as const;

export async function setRosterField(id: string, column: string, value: string) {
  await requireAdmin();
  if (!(ROSTER_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }

  const supabase = await createClient();
  await supabase
    .from("bmc_team_roster")
    .update({ [column]: value.trim() || null })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function setRosterOrg(id: string, value: string) {
  await requireAdmin();
  const org = value === "" ? null : (value as Org);
  if (org && !(ORGS as readonly string[]).includes(org)) {
    throw new Error(`Unknown org: ${value}`);
  }

  const supabase = await createClient();
  await supabase.from("bmc_team_roster").update({ org }).eq("id", id);
  revalidatePath(PATH);
}

export async function addRosterMember(formData: FormData) {
  await requireAdmin();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("bmc_team_roster")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("bmc_team_roster").insert({
    full_name: fullName,
    role_title: String(formData.get("role_title") ?? "").trim() || null,
    sort_order: (last?.sort_order ?? 0) + 10,
  });

  revalidatePath(PATH);
}

export async function removeRosterMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("bmc_team_roster").delete().eq("id", id);
  revalidatePath(PATH);
}
