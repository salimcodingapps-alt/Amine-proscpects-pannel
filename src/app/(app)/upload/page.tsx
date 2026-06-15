import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { BusinessImporter } from "@/components/business/business-importer";
import { createClient } from "@/lib/supabase/server";
import {
  listMyWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guards auth; this is a defensive fallback.
  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Upload" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Upload"
        description="Import business records from a CSV file."
      />
      {active ? (
        <BusinessImporter key={active.id} workspaceId={active.id} />
      ) : (
        <Placeholder block="No workspace found for your account." />
      )}
    </div>
  );
}
