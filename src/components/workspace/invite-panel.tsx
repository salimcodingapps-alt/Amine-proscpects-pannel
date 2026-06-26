"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createInvite, revokeInvite } from "@/lib/workspace/invites";
import {
  INVITABLE_ROLES,
  type PendingInvite,
  type WorkspaceRole,
} from "@/lib/workspace/types";

/**
 * Invite panel (Block 13) — owners/managers only. Create an email-bound invite
 * (member/manager role), then copy the one-time link to share manually (no email
 * is sent). Pending invites can be revoked. The link is shown ONCE at creation
 * because only its hash is stored; it cannot be recovered from the pending list.
 */
export function InvitePanel({
  workspaceId,
  invites,
}: {
  workspaceId: string;
  invites: PendingInvite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createInvite(workspaceId, email, role);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setLink(res.link ?? null);
      setEmail("");
      router.refresh();
    });
  }

  function handleRevoke(inviteId: string) {
    setError(null);
    startTransition(async () => {
      const res = await revokeInvite(workspaceId, inviteId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the link stays visible to copy manually.
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">Invite people</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send an invite link for someone to join this workspace. They must sign in
        with the email you invite. No email is sent — copy the link and share it.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            maxLength={320}
            disabled={pending}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            disabled={pending}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="h-9 rounded-md border border-border bg-background px-2 py-1 text-sm capitalize text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending || email.trim() === ""}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invite"}
        </Button>
      </form>

      {link ? (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-foreground">
            Invite link (shown once — copy it now):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs text-muted-foreground">
              {link}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copyLink}>
              {copied ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invites
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The invite link is only shown once, when created. To send a fresh
            link, revoke and create a new invite.
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{inv.role}</span>
                    {" · "}
                    {inv.expired ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <>Expires {inv.expiresAt.slice(0, 10)}</>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleRevoke(inv.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
