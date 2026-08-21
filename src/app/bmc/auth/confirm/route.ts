import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/bmc/supabase/server";

/**
 * Magic-link and invite landing page for BMC. Separate from SimSoc's
 * /auth/confirm because the token was issued by a different Supabase project
 * and can only be verified by a client pointed at that project.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only ever redirect within BMC, so a crafted `next` can't bounce a verified
  // session somewhere unexpected.
  const requested = searchParams.get("next") ?? "/bmc";
  const next = requested.startsWith("/bmc") ? requested : "/bmc";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/bmc/login?error=${encodeURIComponent(
      "That link has expired or has already been used. Request a new one.",
    )}`,
  );
}
