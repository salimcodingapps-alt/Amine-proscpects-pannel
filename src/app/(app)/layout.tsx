import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/components/layout/user-menu";

// Authenticated, per-user pages — never prerender them.
export const dynamic = "force-dynamic";

/**
 * Layout for the authenticated application area.
 * Server-side auth guard (defense in depth alongside middleware): if there
 * is no authenticated user, redirect to /login before any page renders.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sessionUser: SessionUser = {
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
  };

  return <AppShell user={sessionUser}>{children}</AppShell>;
}

function SupabaseNotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-base font-semibold text-foreground">
          Supabase is not configured
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy <code className="text-foreground">.env.local.example</code> to{" "}
          <code className="text-foreground">.env.local</code> and set{" "}
          <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
          then restart the dev server.
        </p>
      </div>
    </div>
  );
}
