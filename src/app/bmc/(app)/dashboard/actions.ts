"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";

const PATH = "/bmc/dashboard";

/**
 * All of these scope writes to the signed-in participant's own id. RLS
 * enforces the same rule at the database level; doing it here too means a
 * mistake surfaces as a no-op rather than a policy error.
 */

export async function addTask(formData: FormData) {
  const me = await requireProfile();
  const text = String(formData.get("text") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  if (!text) return;

  const supabase = await createClient();
  await supabase.from("bmc_participant_tasks").insert({
    participant_id: me.id,
    text,
    due_date: dueDate || null,
    created_by: me.id,
  });

  revalidatePath(PATH);
}

export async function setTaskDone(id: string, value: string) {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("bmc_participant_tasks")
    .update({ done: value === "true" })
    .eq("id", id)
    .eq("participant_id", me.id);

  revalidatePath(PATH);
}

export async function setTaskField(id: string, column: string, value: string) {
  const me = await requireProfile();
  if (column !== "text" && column !== "due_date") {
    throw new Error(`Column not editable: ${column}`);
  }

  const supabase = await createClient();
  await supabase
    .from("bmc_participant_tasks")
    .update({ [column]: value.trim() || null })
    .eq("id", id)
    .eq("participant_id", me.id);

  revalidatePath(PATH);
}

export async function deleteTask(formData: FormData) {
  const me = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("bmc_participant_tasks")
    .delete()
    .eq("id", id)
    .eq("participant_id", me.id);

  revalidatePath(PATH);
}

export async function setBusinessName(value: string) {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("bmc_profiles")
    .update({ business_name: value.trim() || null })
    .eq("id", me.id);

  revalidatePath(PATH);
}
