import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteAccept } from "@/components/workspace/invite-accept";
import { createClient } from "@/lib/supabase/server";

/**
 * Invite-accept route (Block 13). Lives OUTSIDE the (app) route group so it is
 * reachable while logged out (and is allowlisted in middleware). It deliberately
 * reveals no invite details to anonymous visitors — the actual validation
 * (email-binding, expiry, revocation) happens server-side in the accept RPC once
 * the user is signed in.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Return the invitee to this exact page after they authenticate.
  const nextParam = `?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-foreground">
          Workspace invitation
        </h1>

        {user ? (
          <div className="mt-4">
            <InviteAccept token={token} userEmail={user.email ?? null} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited to join a workspace. Sign in or create an
              account using the email address the invitation was sent to —
              you&apos;ll return here automatically to accept.
            </p>
            <div className="flex items-center gap-2">
              <Button asChild>
                <Link href={`/login${nextParam}`}>Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/signup${nextParam}`}>Create account</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
