"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { STATUSES, type Status } from "@/lib/bmc/config";
import type { ArenaBlock, ExitMomentumBlock, PrepItem } from "@/lib/bmc/types";

const PATH = "/bmc/sessions";

/** Columns a staff member may edit directly on a session row. */
const SCALAR_COLUMNS = [
  "session_date",
  "title",
  "breakout_takeaway",
  "mentor_focus",
  "recording_url",
  "location",
] as const;

type ScalarColumn = (typeof SCALAR_COLUMNS)[number];

export async function setSessionField(
  id: string,
  column: string,
  value: string,
) {
  await requireTeam();
  if (!(SCALAR_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Column not editable: ${column}`);
  }

  const trimmed = value.trim();
  const supabase = await createClient();
  await supabase
    .from("sessions")
    .update({ [column as ScalarColumn]: trimmed || null })
    .eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/bmc/program");
}

export async function setSessionStatus(id: string, value: string) {
  await requireTeam();
  if (!(STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown status: ${value}`);
  }

  const supabase = await createClient();
  await supabase
    .from("sessions")
    .update({ status: value as Status })
    .eq("id", id);

  revalidatePath(PATH);
}

const ARENA_KEYS = ["topic", "objective", "presenter", "materials_url"] as const;
const EM_KEYS = ["topic", "process_stage", "presenter", "notes"] as const;

/** Merge one key into a jsonb block without clobbering the others. */
async function patchBlock(
  id: string,
  column: "arena_block" | "exit_momentum_block",
  key: string,
  value: string,
) {
  await requireTeam();
  const allowed = column === "arena_block" ? ARENA_KEYS : EM_KEYS;
  if (!(allowed as readonly string[]).includes(key)) {
    throw new Error(`Field not editable: ${column}.${key}`);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(column)
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const current = ((data as Record<string, unknown>)[column] ?? {}) as Record<
    string,
    string
  >;
  const trimmed = value.trim();
  const next = { ...current };
  if (trimmed) next[key] = trimmed;
  else delete next[key];

  await supabase
    .from("sessions")
    .update({ [column]: next })
    .eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/bmc/program");
}

export async function setArenaField(
  id: string,
  key: keyof ArenaBlock,
  value: string,
) {
  await patchBlock(id, "arena_block", key, value);
}

export async function setExitMomentumField(
  id: string,
  key: keyof ExitMomentumBlock,
  value: string,
) {
  await patchBlock(id, "exit_momentum_block", key, value);
}

export async function togglePrepItem(id: string, index: number, value: string) {
  await requireTeam();
  const supabase = await createClient();

  const { data } = await supabase
    .from("sessions")
    .select("prep_checklist")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const list = (data.prep_checklist ?? []) as PrepItem[];
  if (index < 0 || index >= list.length) return;

  const next = list.map((item, i) =>
    i === index ? { ...item, done: value === "true" } : item,
  );

  await supabase.from("sessions").update({ prep_checklist: next }).eq("id", id);
  revalidatePath(PATH);
}

export async function addPrepItem(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("session_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!id || !text) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("prep_checklist")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const list = (data.prep_checklist ?? []) as PrepItem[];
  await supabase
    .from("sessions")
    .update({ prep_checklist: [...list, { text, done: false }] })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function removePrepItem(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("session_id") ?? "");
  const index = Number(formData.get("index"));
  if (!id || Number.isNaN(index)) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("prep_checklist")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const list = (data.prep_checklist ?? []) as PrepItem[];
  await supabase
    .from("sessions")
    .update({ prep_checklist: list.filter((_, i) => i !== index) })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function togglePublished(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("session_id") ?? "");
  const publish = formData.get("publish") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sessions").update({ published: publish }).eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/bmc/program");
}

/**
 * Push a session's tangible takeaway to every enrolled participant as a task.
 * The unique index on (participant_id, source_session_id) makes this safely
 * repeatable — re-running after editing the takeaway updates the wording
 * rather than creating duplicates.
 */
export async function pushTakeawayToParticipants(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("session_id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_number, breakout_takeaway, session_date")
    .eq("id", id)
    .maybeSingle();
  if (!session?.breakout_takeaway?.trim()) return;

  const { data: participants } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "participant");
  if (!participants?.length) return;

  const text = `Session ${session.session_number}: ${session.breakout_takeaway.trim()}`;

  await supabase.from("participant_tasks").upsert(
    participants.map((p) => ({
      participant_id: p.id,
      source_session_id: session.id,
      text,
      due_date: session.session_date,
    })),
    { onConflict: "participant_id,source_session_id" },
  );

  revalidatePath(PATH);
  revalidatePath("/bmc/dashboard");
}
