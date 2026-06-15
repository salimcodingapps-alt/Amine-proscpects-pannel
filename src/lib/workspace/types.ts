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
