import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * BMC talks to its own Supabase project, separate from SimSoc's. Both apps
 * live in one Next.js deployment, so the two projects are distinguished purely
 * by which env vars each client reads.
 *
 * Auth sessions don't collide: @supabase/ssr names its cookie after the
 * project ref (`sb-<ref>-auth-token`), so a user can be signed into SimSoc and
 * BMC at the same time without either clobbering the other.
 */
export function bmcSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BMC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_BMC_SUPABASE_URL is not set. BMC uses its own Supabase project — see .env.example.",
    );
  }
  return url;
}

export function bmcSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_BMC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_BMC_SUPABASE_ANON_KEY is not set. BMC uses its own Supabase project — see .env.example.",
    );
  }
  return key;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(bmcSupabaseUrl(), bmcSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // called from a Server Component; the proxy refreshes the session instead
        }
      },
    },
  });
}
