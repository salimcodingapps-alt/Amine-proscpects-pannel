import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import { createClient } from "@/lib/supabase/server";
import {
  listMyWorkspaces,
  listWorkspaceMembers,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guards auth; this is a defensive fallback.
  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Settings" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Settings"
        description="Workspace, team, and account configuration."
      />
      {active ? (
        <WorkspaceSettings
          // Remount when the active workspace changes so local form state
          // (name field, transient messages) resets to the new workspace.
          key={active.id}
          workspaceId={active.id}
          workspaceName={active.name}
          myRole={active.role}
          members={await listWorkspaceMembers(
            supabase,
            active.id,
            user.id,
            user.email ?? null
          )}
        />
      ) : (
        <Placeholder block="No workspace found for your account." />
      )}
    </div>
  );
}
