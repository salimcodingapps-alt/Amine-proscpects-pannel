import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server-side Supabase client bound to the request cookie store.
 * Use in Server Components, Route Handlers, and Server Actions.
 *
 * The `setAll` adapter can throw when called from a Server Component
 * (cookies are read-only there); that's expected and safe to ignore
 * because the middleware refreshes the session cookie on every request.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — safe to ignore; middleware
          // is responsible for writing the refreshed session cookie.
        }
      },
    },
  });
}
