"use server";

import { randomBytes, createHash } from "crypto";
import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/queries";
import {
  INVITABLE_ROLES,
  type AcceptInviteResult,
  type CreateInviteResult,
  type WorkspaceActionResult,
  type WorkspaceRole,
} from "@/lib/workspace/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately simple: a non-exhaustive sanity check, not an RFC validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_TTL_DAYS = 7;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

/** SHA-256 hex of the raw token. Only the hash is ever stored / sent to the DB. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Look up the caller's role in a workspace (membership-scoped by RLS). */
async function myRole(
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

function activeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  };
}

/**
 * Create an email-bound invite (owner/manager only; role limited to
 * member/manager). Generates a 256-bit token, stores ONLY its SHA-256 hash, and
 * returns the one-time accept link for the inviter to share manually. No email
 * is sent. RLS is the backstop for the role gate; the table CHECK + INSERT policy
 * also forbid an 'owner' invite.
 */
export async function createInvite(
  workspaceId: string,
  email: string,
  role: WorkspaceRole
): Promise<CreateInviteResult> {
  if (!isUuid(workspaceId)) return { error: "Invalid workspace." };

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 320) {
    return { error: "Enter a valid email address." };
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return { error: "Invites can only grant the member or manager role." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const role_ = await myRole(supabase, workspaceId, user.id);
  if (role_ !== "owner" && role_ !== "manager") {
    return { error: "Only owners and managers can invite people." };
  }

  if (normalizedEmail === (user.email ?? "").toLowerCase()) {
    return { error: "You're already a member of this workspace." };
  }

  // The partial unique index treats EXPIRED invites as still 'pending', so an old
  // expired invite for this same email would block a fresh one. Revoke any such
  // expired-pending rows first (admin-permitted UPDATE; no background job, RLS
  // intact). An ACTIVE (unexpired) pending invite is intentionally left alone, so
  // the insert below still collides and returns the "revoke it first" message.
  await supabase
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("workspace_id", workspaceId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId,
    email: normalizedEmail,
    role,
    token_hash: tokenHash,
    status: "pending",
    invited_by: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    // 23505 = unique violation on the partial (workspace, lower(email)) index.
    if (error.code === "23505") {
      return {
        error: "There's already a pending invite for that email. Revoke it first to send a new one.",
      };
    }
    return { error: error.message };
  }

  // Build the absolute accept link from the incoming request.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const link = `${proto}://${host}/invite/${token}`;

  return { link };
}

/**
 * Revoke a pending invite (owner/manager only). Soft — sets status='revoked' so
 * the link can no longer be accepted. RLS is the backstop.
 */
export async function revokeInvite(
  workspaceId: string,
  inviteId: string
): Promise<WorkspaceActionResult> {
  if (!isUuid(workspaceId) || !isUuid(inviteId)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const role_ = await myRole(supabase, workspaceId, user.id);
  if (role_ !== "owner" && role_ !== "manager") {
    return { error: "Only owners and managers can revoke invites." };
  }

  const { data, error } = await supabase
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That invite is no longer pending." };
  }
  return {};
}

/**
 * Accept an invite via the SECURITY DEFINER RPC — the ONLY path that turns an
 * invite into a membership. The caller must be signed in; the RPC enforces
 * email-binding, expiry, single-use, and revocation. On success the joined
 * workspace becomes active.
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  if (!token || typeof token !== "string") {
    return { error: "Invalid invitation." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to accept this invitation." };

  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token_hash: hashToken(token),
  });

  if (error) {
    // The RPC raises friendly messages (expired / revoked / wrong email / etc.).
    return { error: error.message };
  }

  const workspaceId = data as string;
  (await cookies()).set(
    ACTIVE_WORKSPACE_COOKIE,
    workspaceId,
    activeCookieOptions()
  );
  return { workspaceId };
}
