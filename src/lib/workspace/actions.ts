"use server";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/queries";
import {
  WORKSPACE_ROLES,
  type WorkspaceActionResult,
  type WorkspaceRole,
} from "@/lib/workspace/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

function activeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  };
}

/**
 * Create a workspace via the create_workspace() SECURITY DEFINER RPC. This is
 * the ONLY creation path — no direct inserts into workspaces/workspace_members
 * (a direct insert can't bootstrap the owner membership under RLS). The RPC
 * makes the caller the owner and returns the new workspace id, which we then
 * set as the active workspace.
 */
export async function createWorkspace(
  name: string
): Promise<WorkspaceActionResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    return { error: "Workspace name must be between 1 and 100 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: trimmed,
  });
  if (error) return { error: error.message };

  const id = data as string;
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, id, activeCookieOptions());
  return { id };
}

/**
 * Switch the active workspace. The target is verified against the caller's
 * real memberships before the cookie is set — the cookie is never trusted.
 */
export async function switchWorkspace(
  workspaceId: string
): Promise<WorkspaceActionResult> {
  if (!isUuid(workspaceId)) return { error: "Invalid workspace." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "You are not a member of that workspace." };
  }

  (await cookies()).set(
    ACTIVE_WORKSPACE_COOKIE,
    workspaceId,
    activeCookieOptions()
  );
  return {};
}

/** Rename a workspace. Owners and managers only (also enforced by RLS). */
export async function renameWorkspace(
  workspaceId: string,
  name: string
): Promise<WorkspaceActionResult> {
  if (!isUuid(workspaceId)) return { error: "Invalid workspace." };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    return { error: "Workspace name must be between 1 and 100 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const myRole = await getMyRole(supabase, workspaceId, user.id);
  if (myRole !== "owner" && myRole !== "manager") {
    return { error: "You don't have permission to rename this workspace." };
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) return { error: error.message };

  return {};
}

/** Change a member's role. Owners only; the last owner cannot be demoted. */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): Promise<WorkspaceActionResult> {
  if (!isUuid(workspaceId) || !isUuid(userId)) {
    return { error: "Invalid request." };
  }
  if (!WORKSPACE_ROLES.includes(role)) return { error: "Invalid role." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const myRole = await getMyRole(supabase, workspaceId, user.id);
  if (myRole !== "owner") {
    return { error: "Only an owner can change member roles." };
  }

  // Protect the last owner: don't demote the only owner.
  const targetRole = await getMemberRole(supabase, workspaceId, userId);
  if (targetRole === "owner" && role !== "owner") {
    const owners = await countOwners(supabase, workspaceId);
    if (owners <= 1) {
      return { error: "A workspace must have at least one owner." };
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return {};
}

/**
 * Remove a member, or leave a workspace (when removing yourself). Owners may
 * remove anyone; any member may remove themselves. The last owner can neither
 * be removed nor leave.
 */
export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<WorkspaceActionResult> {
  if (!isUuid(workspaceId) || !isUuid(userId)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const removingSelf = userId === user.id;
  const myRole = await getMyRole(supabase, workspaceId, user.id);
  if (!removingSelf && myRole !== "owner") {
    return { error: "Only an owner can remove members." };
  }

  const targetRole = await getMemberRole(supabase, workspaceId, userId);
  if (targetRole === "owner") {
    const owners = await countOwners(supabase, workspaceId);
    if (owners <= 1) {
      return {
        error: removingSelf
          ? "You're the only owner — transfer ownership before leaving."
          : "A workspace must have at least one owner.",
      };
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  // If you just left the workspace you were acting in, drop the stale cookie
  // so the next request falls back to another workspace.
  if (removingSelf) {
    const store = await cookies();
    if (store.get(ACTIVE_WORKSPACE_COOKIE)?.value === workspaceId) {
      store.delete(ACTIVE_WORKSPACE_COOKIE);
    }
  }

  return {};
}

// --- internal helpers --------------------------------------------------------

async function getMyRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  return getMemberRole(supabase, workspaceId, userId);
}

async function getMemberRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as WorkspaceRole | undefined) ?? null;
}

async function countOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<number> {
  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");
  return count ?? 0;
}
