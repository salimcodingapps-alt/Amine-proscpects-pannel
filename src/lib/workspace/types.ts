/** Shared workspace/membership types for Block 3 (Workspace Architecture). */

export type WorkspaceRole = "owner" | "manager" | "member";

export const WORKSPACE_ROLES: WorkspaceRole[] = ["owner", "manager", "member"];

/** A workspace the current user belongs to, plus their role in it. */
export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

/** A member row for the Settings members list. */
export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  /** Whether this row is the currently signed-in user. */
  isSelf: boolean;
  /**
   * Email is only known for the current user (self): there is no profiles
   * table yet, and the anon client cannot read other users' auth records.
   * Resolving other members' identities is deferred to a later block.
   */
  email: string | null;
}

/** Result shape returned by workspace server actions. */
export interface WorkspaceActionResult {
  error?: string;
  /** Set by createWorkspace with the new workspace id. */
  id?: string;
}

// --- Block 13: invites -------------------------------------------------------

export type InviteStatus = "pending" | "accepted" | "revoked";

/**
 * Roles an invite may grant. Owners and managers can both invite, but ONLY as
 * member/manager — nobody can invite an 'owner' (ownership transfer is deferred).
 * Enforced in the action, the INSERT policy, and a table CHECK.
 */
export const INVITABLE_ROLES: WorkspaceRole[] = ["member", "manager"];

/** A pending invite row shown to owners/managers in Settings. */
export interface PendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
  expiresAt: string;
  /** Derived: pending but past its expiry (no background job flips it). */
  expired: boolean;
}

/**
 * Result of creating an invite. `link` is the full accept URL containing the
 * RAW token — it is returned exactly ONCE (only the SHA-256 hash is stored), so
 * the UI must surface it immediately for the inviter to copy.
 */
export interface CreateInviteResult {
  error?: string;
  link?: string;
}

/** Result of accepting an invite. */
export interface AcceptInviteResult {
  error?: string;
  /** The workspace the caller just joined (set active on success). */
  workspaceId?: string;
}
