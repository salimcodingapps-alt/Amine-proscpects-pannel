import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { DuplicateGroups } from "@/components/business/duplicate-groups";
import { createClient } from "@/lib/supabase/server";
import { listActiveBusinessesForDedup } from "@/lib/businesses/queries";
import { findDuplicateGroups } from "@/lib/businesses/duplicates";
import {
  listMyWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

/**
 * Block 7 — Duplicate detection (read-only).
 *
 * Resolves the active workspace (mirrors /database), loads its active records,
 * and runs deterministic duplicate grouping in memory. Detection only: nothing
 * is written, merged, or deleted here.
 */
export default async function DuplicatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guards auth; this is a defensive fallback.
  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Duplicates" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

  let content;
  if (active) {
    const { items, capped } = await listActiveBusinessesForDedup(
      supabase,
      active.id
    );
    const report = findDuplicateGroups(items, { capped });
    content = (
      <DuplicateGroups key={active.id} report={report} workspaceId={active.id} />
    );
  } else {
    content = <Placeholder block="No workspace found for your account." />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Duplicates"
        description="Likely duplicate records detected in this workspace. Review only — nothing is changed automatically."
      />
      {content}
    </div>
  );
}
