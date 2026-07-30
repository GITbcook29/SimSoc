"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { ORGS, PIPELINE_STAGES, type Org, type PipelineStage } from "@/lib/bmc/config";
import { parseLeadsCSV, suggestFitScore } from "@/lib/bmc/leads";
import type { Lead } from "@/lib/bmc/types";

const PATH = "/bmc/leads";

function backWith(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params).toString()}`);
}

const TEXT_COLUMNS = [
  "name",
  "business",
  "industry",
  "revenue_band",
  "source",
  "referred_by",
  "notes",
] as const;

const NUMBER_COLUMNS = ["years_in_business", "employees", "fit_score"] as const;
const DATE_COLUMNS = ["last_touch", "next_follow_up"] as const;

export async function setLeadField(id: string, column: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  const trimmed = value.trim();

  if ((TEXT_COLUMNS as readonly string[]).includes(column)) {
    await supabase
      .from("leads")
      .update({ [column]: trimmed || null })
      .eq("id", id);
  } else if ((NUMBER_COLUMNS as readonly string[]).includes(column)) {
    const n = trimmed === "" ? null : Number(trimmed);
    if (n !== null && Number.isNaN(n)) return;
    await supabase
      .from("leads")
      .update({ [column]: n })
      .eq("id", id);
  } else if ((DATE_COLUMNS as readonly string[]).includes(column)) {
    await supabase
      .from("leads")
      .update({ [column]: trimmed || null })
      .eq("id", id);
  } else {
    throw new Error(`Column not editable: ${column}`);
  }

  revalidatePath(PATH);
}

export async function setLeadStage(id: string, value: string) {
  await requireTeam();
  if (!(PIPELINE_STAGES as readonly string[]).includes(value)) {
    throw new Error(`Unknown stage: ${value}`);
  }

  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ stage: value as PipelineStage })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function setLeadOwner(id: string, value: string) {
  await requireTeam();
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ owner_profile_id: value || null })
    .eq("id", id);
  revalidatePath(PATH);
}

export async function setLeadOwnerOrg(id: string, value: string) {
  await requireTeam();
  const org = value === "" ? null : (value as Org);
  if (org && !(ORGS as readonly string[]).includes(org)) {
    throw new Error(`Unknown org: ${value}`);
  }

  const supabase = await createClient();
  await supabase.from("leads").update({ owner_org: org }).eq("id", id);
  revalidatePath(PATH);
}

export async function addLead(formData: FormData) {
  await requireTeam();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("leads").insert({
    name,
    business: String(formData.get("business") ?? "").trim() || null,
  });

  revalidatePath(PATH);
}

export async function deleteLead(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("leads").delete().eq("id", id);
  revalidatePath(PATH);
}

/** Recompute the ICP fit score from the fields currently on the record. */
export async function rescoreLead(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("years_in_business, employees, revenue_band, industry, referred_by")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  await supabase
    .from("leads")
    .update({ fit_score: suggestFitScore(data as Partial<Lead>) })
    .eq("id", id);

  revalidatePath(PATH);
}

export async function importLeadsCSV(formData: FormData) {
  await requireTeam();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    backWith({ error: "Choose a CSV file to import." });
  }

  const text = await (file as File).text();
  const { rows, error } = parseLeadsCSV(text);
  if (error) backWith({ error });

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("leads").insert(rows);
  if (insertError) backWith({ error: insertError.message });

  revalidatePath(PATH);
  backWith({ message: `Imported ${rows.length} lead${rows.length === 1 ? "" : "s"}.` });
}

/**
 * Turn a committed lead into a participant account. Uses the service-role key
 * to send an invite email, then links the new profile back to the lead record.
 * The key is server-only and never reaches the client.
 */
export async function convertLeadToParticipant(formData: FormData) {
  await requireTeam();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!id) return;
  if (!email) backWith({ error: "An email address is required to invite a participant." });

  const serviceKey = process.env.BMC_SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_BMC_SUPABASE_URL;
  if (!serviceKey || !url) {
    backWith({
      error:
        "BMC_SUPABASE_SERVICE_ROLE_KEY is not configured, so invites can't be sent from here. Invite the participant from the Supabase dashboard and link the record manually.",
    });
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, business")
    .eq("id", id)
    .maybeSingle();
  if (!lead) backWith({ error: "Lead not found." });

  const admin = createServerClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: lead.name, business_name: lead.business },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/bmc/auth/confirm?next=/bmc`,
    },
  );

  if (inviteError || !invited?.user) {
    backWith({ error: inviteError?.message ?? "Could not send the invite." });
  }

  const participantId = invited.user.id;

  // The signup trigger creates the profile; fill in the details we already know.
  await admin
    .from("profiles")
    .update({
      full_name: lead.name,
      business_name: lead.business,
      role: "participant",
      email,
    })
    .eq("id", participantId);

  await supabase
    .from("leads")
    .update({ stage: "committed", converted_participant_id: participantId })
    .eq("id", id);

  revalidatePath(PATH);
  backWith({ message: `Invite sent to ${email}.` });
}
