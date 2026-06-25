import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceDashboardStats } from "@/lib/businesses/queries";
import {
  listMyWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

/**
 * Dashboard — read-only CRM overview for the active workspace (Block 11).
 * Mirrors /database's auth + workspace resolution, then renders real metrics
 * computed by getWorkspaceDashboardStats. Dynamic (resolves auth/workspace at
 * request time), like the other (app) data pages.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guards auth; this is a defensive fallback.
  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Dashboard" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

  let content;
  if (active) {
    const stats = await getWorkspaceDashboardStats(supabase, active.id);
    content = <DashboardOverview key={active.id} stats={stats} />;
  } else {
    content = <Placeholder block="No workspace found for your account." />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Dashboard"
        description="Overview of your automotive supplier database."
      />
      {content}
    </div>
  );
}
