import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { BusinessManager } from "@/components/business/business-manager";
import { createClient } from "@/lib/supabase/server";
import { listBusinesses } from "@/lib/businesses/queries";
import {
  BUSINESS_SORTS,
  BUSINESS_STATUSES,
  type BusinessSort,
  type BusinessStatus,
} from "@/lib/businesses/types";
import {
  listMyWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace/queries";

/** Read a single string value from a Next searchParams entry (arrays -> first). */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

  // Parse the URL search params into typed, validated filters. Invalid values
  // are dropped (status must be a known enum; sort falls back to the default).
  const sp = await searchParams;
  const search = firstParam(sp.q);
  const statusRaw = firstParam(sp.status);
  const status = BUSINESS_STATUSES.includes(statusRaw as BusinessStatus)
    ? (statusRaw as BusinessStatus)
    : undefined;
  const wilaya = firstParam(sp.wilaya);
  const businessType = firstParam(sp.type);
  const brand = firstParam(sp.brand);
  const sortRaw = firstParam(sp.sort);
  const sort = BUSINESS_SORTS.some((s) => s.value === sortRaw)
    ? (sortRaw as BusinessSort)
    : undefined;
  const pageNum = Math.max(1, Number.parseInt(firstParam(sp.page), 10) || 1);
  // Block 9: ?view=archived lists soft-deleted records (restore view). Any other
  // value (or none) keeps the default active-records view.
  const archived = firstParam(sp.view) === "archived";

  const hasFilters = Boolean(
    search.trim() ||
      status ||
      wilaya.trim() ||
      businessType.trim() ||
      brand.trim()
  );

  let content;
  if (active) {
    const result = await listBusinesses(supabase, active.id, {
      search,
      status,
      wilaya,
      businessType,
      brand,
      sort,
      page: pageNum,
      archived,
    });
    content = (
      <BusinessManager
        // Remount when the active workspace OR view changes so any open form and
        // its local state reset to the newly-selected context.
        key={`${active.id}:${archived ? "archived" : "active"}`}
        workspaceId={active.id}
        businesses={result.items}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        hasFilters={hasFilters}
        archived={archived}
      />
    );
  } else {
    content = <Placeholder block="No workspace found for your account." />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Database"
        description="Manage your automotive business records."
      />
      {content}
    </div>
  );
}
