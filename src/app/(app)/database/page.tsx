import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { BusinessManager } from "@/components/business/business-manager";
import { createClient } from "@/lib/supabase/server";
import { listBusinesses } from "@/lib/businesses/queries";
import {
  listMyWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

export default async function DatabasePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guards auth; this is a defensive fallback.
  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Database" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Database"
        description="Manage your automotive business records."
      />
      {active ? (
        <BusinessManager
          // Remount when the active workspace changes so any open form and its
          // local state reset to the newly-selected workspace.
          key={active.id}
          workspaceId={active.id}
          businesses={await listBusinesses(supabase, active.id)}
        />
      ) : (
        <Placeholder block="No workspace found for your account." />
      )}
    </div>
  );
}
