"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { InvitePanel } from "@/components/workspace/invite-panel";
import {
  removeMember,
  renameWorkspace,
  updateMemberRole,
} from "@/lib/workspace/actions";
import {
  WORKSPACE_ROLES,
  type PendingInvite,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/workspace/types";

/**
 * Settings UI for the active workspace: rename (owner/manager) + members list
 * with owner-only role/remove controls. Destructive controls only render for
 * OTHER members, which keeps a single owner from locking themselves out (the
 * server actions also guard the last owner as a backstop).
 */
export function WorkspaceSettings({
  workspaceId,
  workspaceName,
  myRole,
  members,
  invites,
}: {
  workspaceId: string;
  workspaceName: string;
  myRole: WorkspaceRole;
  members: WorkspaceMember[];
  /** Block 13: pending invites (owner/manager only; empty otherwise). */
  invites: PendingInvite[];
}) {
  const router = useRouter();
  const canRename = myRole === "owner" || myRole === "manager";
  const canManageMembers = myRole === "owner";
  const canInvite = myRole === "owner" || myRole === "manager";

  const [name, setName] = useState(workspaceName);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await renameWorkspace(workspaceId, name);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setNotice("Workspace name updated.");
      router.refresh();
    });
  }

  function handleRoleChange(userId: string, role: WorkspaceRole) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await updateMemberRole(workspaceId, userId, role);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await removeMember(workspaceId, userId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The workspace you are currently working in.
        </p>
        <form onSubmit={handleRename} className="mt-4 flex flex-col gap-2">
          <Label htmlFor="workspace-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={!canRename || pending}
            />
            {canRename ? (
              <Button
                type="submit"
                disabled={pending || name.trim() === workspaceName}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            ) : null}
          </div>
          {!canRename ? (
            <p className="text-xs text-muted-foreground">
              Only owners and managers can rename the workspace.
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Members</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          People with access to this workspace.
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase text-foreground">
                {(m.email ?? m.userId).charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {m.email ?? `Member ${m.userId.slice(0, 8)}`}
                  {m.isSelf ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (You)
                    </span>
                  ) : null}
                </p>
              </div>

              {canManageMembers && !m.isSelf ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) =>
                      handleRoleChange(
                        m.userId,
                        e.target.value as WorkspaceRole
                      )
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {WORKSPACE_ROLES.map((r) => (
                      <option key={r} value={r} className="capitalize">
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRemove(m.userId)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {m.role}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {canInvite ? (
        <InvitePanel workspaceId={workspaceId} invites={invites} />
      ) : null}
    </div>
  );
}
