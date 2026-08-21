"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/bmc/supabase/server";
import { landingFor } from "@/lib/bmc/auth";
import type { Role } from "@/lib/bmc/config";

async function siteOrigin() {
  const h = await headers();
  return (
    h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  );
}

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/bmc/login?${qs}`);
}

/** Where to send a user right after sign-in, based on their role. */
async function landingForCurrentUser(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/bmc/login";

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return landingFor((data?.role as Role) ?? "participant");
}

export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back({ error: error.message });

  redirect(await landingForCurrentUser());
}

export async function signUpWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/bmc/auth/confirm`,
    },
  });
  if (error) back({ error: error.message });

  // With email confirmation disabled, signUp already returns a live session.
  if (data.session) redirect(await landingForCurrentUser());

  back({
    message: "Check your email to confirm your account, then sign in.",
  });
}

export async function sendMagicLink(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const origin = await siteOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/bmc/auth/confirm` },
  });
  if (error) back({ error: error.message });

  back({ message: `Magic link sent to ${email}. Check your inbox.` });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/bmc/login");
}
