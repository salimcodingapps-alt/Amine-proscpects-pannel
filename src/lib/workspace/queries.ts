import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PendingInvite,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/workspace/types";

/** Cookie that records which workspace the user is currently acting in. */
export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

/**
 * List the workspaces the signed-in user belongs to, with their role in each.
 * RLS guarantees only the user's own memberships/workspaces are returned.
 * Ordered oldest-first so the default (auto-provisioned) workspace is first
 * and makes a stable fallback for the active workspace.
 */
export async function listMyWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceSummary[]> {
  // Two-step (no relationship embed): first the memberships, then the
  // workspaces by id. Avoids relying on PostgREST's relationship cache.
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const roleById = new Map<string, WorkspaceRole>(
    memberships.map((m) => [m.workspace_id as string, m.role as WorkspaceRole])
  );

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .in("id", Array.from(roleById.keys()))
    .order("created_at", { ascending: true });

  if (!workspaces) return [];

  return workspaces
    .map((ws) => {
      const role = roleById.get(ws.id as string);
      if (!role) return null;
      return { id: ws.id as string, name: ws.name as string, role };
    })
    .filter((w): w is WorkspaceSummary => w !== null);
}

/**
 * Resolve the active workspace from the cookie, ALWAYS validated against the
 * user's real memberships (never trust the cookie). Falls back to the first
 * workspace if the cookie is missing or points somewhere the user can't access.
 */
export async function resolveActiveWorkspace(
  workspaces: WorkspaceSummary[]
): Promise<WorkspaceSummary | null> {
  if (workspaces.length === 0) return null;
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const matched = cookieId
    ? workspaces.find((w) => w.id === cookieId)
    : undefined;
  return matched ?? workspaces[0];
}

/**
 * List the members of a workspace for the Settings UI. RLS ensures this only
 * succeeds for workspaces the caller belongs to. Only the caller's own email
 * is resolvable (no profiles table yet).
 */
export async function listWorkspaceMembers(
  supabase: SupabaseClient,
  workspaceId: string,
  currentUserId: string,
  currentUserEmail: string | null
): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const r = row as { user_id: string; role: WorkspaceRole };
    const isSelf = r.user_id === currentUserId;
    return {
      userId: r.user_id,
      role: r.role,
      isSelf,
      email: isSelf ? currentUserEmail : null,
    };
  });
}

/**
 * List PENDING invites for a workspace (Block 13). RLS restricts this to owners/
 * managers of the workspace, so a non-admin simply gets an empty list. The raw
 * token/link is intentionally NOT recoverable here (only its hash is stored) —
 * the link is shown once at creation. `expired` is derived from `expires_at`.
 */
export async function listPendingInvites(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const now = Date.now();
  return data.map((row) => {
    const r = row as {
      id: string;
      email: string;
      role: WorkspaceRole;
      created_at: string;
      expires_at: string;
    };
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      expired: new Date(r.expires_at).getTime() < now,
    };
  });
}
