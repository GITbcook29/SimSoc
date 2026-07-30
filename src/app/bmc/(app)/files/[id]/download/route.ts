import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/bmc/auth";
import { FILES_BUCKET } from "@/lib/bmc/files";

/**
 * Hands back a short-lived signed URL for a private object. Ownership is
 * checked here as well as by RLS, so a mismatched id 404s rather than leaking
 * whether the file exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (!profile) return new NextResponse("Not authorized", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  const query = supabase
    .from("bmc_files")
    .select("storage_path, filename, owner_id")
    .eq("id", id);

  // Admins can retrieve any participant's file; everyone else only their own.
  if (profile.role !== "admin") query.eq("owner_id", profile.id);

  const { data: row } = await query.maybeSingle();
  if (!row) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(row.storage_path, 60, { download: row.filename });

  if (error || !data) {
    return new NextResponse("Could not generate a download link", { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
