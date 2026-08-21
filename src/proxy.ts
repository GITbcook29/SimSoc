import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { updateBmcSession } from "@/lib/bmc/supabase/middleware";

/**
 * Two apps, two Supabase projects. Each request refreshes the session for
 * whichever project owns that route — BMC under /bmc, SimSoc everywhere else.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/bmc" || path.startsWith("/bmc/")) {
    return updateBmcSession(request);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
