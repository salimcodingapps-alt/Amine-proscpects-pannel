import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Paths reachable without a session (no redirect to /login). */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/reset-password",
  "/update-password",
  // Block 13: the invite-accept page must render for logged-out invitees so it
  // can prompt them to sign in/up. It does its own auth handling before accept.
  "/invite",
];

/**
 * Auth pages an *already-authenticated* user should be bounced away from.
 * NOTE: /update-password is intentionally excluded — the password-reset
 * link establishes a recovery session, and the user must stay on that page
 * (while authenticated) to set a new password.
 */
const REDIRECT_IF_AUTHED = ["/login", "/signup", "/reset-password"];

function matches(paths: string[], pathname: string) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * route protection:
 *  - unauthenticated users are redirected to /login,
 *  - authenticated users on an auth page are redirected to /dashboard.
 *
 * Returns the response (possibly a redirect) and always carries forward
 * any refreshed auth cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If env isn't set, don't gate routes — let the app render its
  // "not configured" error instead of redirect-looping.
  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

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

  // IMPORTANT: getUser() revalidates the token with Supabase. Do not run
  // arbitrary logic between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !matches(PUBLIC_PATHS, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && matches(REDIRECT_IF_AUTHED, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
