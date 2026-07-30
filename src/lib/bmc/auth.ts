import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "./types";

/**
 * Current user's BMC profile, or null when signed out. The profile row is
 * created by the `bmc_on_auth_user_created` trigger, so a signed-in user
 * without one means the migration hasn't been applied yet.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("bmc_profiles")
    .select("id, email, full_name, org, role, business_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  return data as Profile;
}

/** Any signed-in user with a profile. Redirects to login otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/bmc/login");
  return profile;
}

/** Build-team pages: admin + staff. Participants are bounced to their own side. */
export async function requireTeam(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "participant") redirect("/bmc/dashboard");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(landingFor(profile.role));
  return profile;
}

/** Participant pages. Staff and admins are sent back to the build-team side. */
export async function requireParticipant(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "participant") redirect("/bmc/matrix");
  return profile;
}

export function landingFor(role: Profile["role"]): string {
  return role === "participant" ? "/bmc/dashboard" : "/bmc/matrix";
}

export function isTeam(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "staff";
}
