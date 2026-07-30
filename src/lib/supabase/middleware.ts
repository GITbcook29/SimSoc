import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // The two apps in this repo have separate sign-in pages, so an unauthenticated
  // request goes to whichever login belongs to the app it was trying to reach.
  const isBmc = path === "/bmc" || path.startsWith("/bmc/");
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/bmc/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/display"); // public projector display, no login

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isBmc ? "/bmc/login" : "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
