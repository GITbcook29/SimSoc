import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { bmcSupabaseAnonKey, bmcSupabaseUrl } from "./server";

/**
 * Session refresh for /bmc/* requests, against BMC's own Supabase project.
 * SimSoc's equivalent lives in src/lib/supabase/middleware.ts and points at a
 * different project; src/proxy.ts picks between them by path.
 */
export async function updateBmcSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(bmcSupabaseUrl(), bmcSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/bmc/login") || path.startsWith("/bmc/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/bmc/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
