import { NextResponse } from "next/server";
import { createClient } from "@/lib/bmc/supabase/server";
import { getProfile, isTeam } from "@/lib/bmc/auth";
import { leadsToCSV } from "@/lib/bmc/leads";
import type { Lead } from "@/lib/bmc/types";

/**
 * CSV export of the leads list. Guarded explicitly — a route handler doesn't
 * go through the page-level `requireTeam` redirect, and leads are never
 * participant-visible.
 */
export async function GET() {
  const profile = await getProfile();
  if (!isTeam(profile)) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("stage")
    .order("name");

  const csv = leadsToCSV((data ?? []) as Lead[]);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bmc-leads-${stamp}.csv"`,
    },
  });
}
