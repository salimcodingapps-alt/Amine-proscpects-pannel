"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/workspace/invites";

/**
 * Client step of the invite-accept flow (Block 13), rendered when the visitor is
 * already signed in. The token stays opaque on the client; acceptance goes
 * through the `acceptInvite` server action -> SECURITY DEFINER RPC, which
 * enforces email-binding/expiry/revocation/single-use. On success the joined
 * workspace is already active, so we just navigate into the app.
 */
export function InviteAccept({
  token,
  userEmail,
}: {
  token: string;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">
          {userEmail ?? "your account"}
        </span>
        . Accept to join the workspace. The invitation must match this
        account&apos;s email address.
      </p>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleAccept} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Accept invitation"
          )}
        </Button>
        <Button asChild variant="ghost" disabled={pending}>
          <Link href="/dashboard">Not now</Link>
        </Button>
      </div>
    </div>
  );
}
