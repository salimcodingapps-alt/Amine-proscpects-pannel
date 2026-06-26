import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { BusinessManager } from "@/components/business/business-manager";
import { createClient } from "@/lib/supabase/server";
import {
  listBusinesses,
  listWorkspaceWatchlistIds,
} from "@/lib/businesses/queries";
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

/**
 * Block 14 — Watchlist page. Reuses the exact /database flow (toolbar +
 * BusinessManager) but restricts the business query to the workspace's shared
 * watchlist via listBusinesses' `onlyIds` filter, so search/filter/sort/pagination
 * all work, scoped to watchlisted records. Active by default; ?view=archived shows
 * archived watchlisted records.
 */
export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Watchlist" />
      </div>
    );
  }

  const workspaces = await listMyWorkspaces(supabase, user.id);
  const active = await resolveActiveWorkspace(workspaces);

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
    const watchlistedIds = await listWorkspaceWatchlistIds(supabase, active.id);
    const result = await listBusinesses(supabase, active.id, {
      search,
      status,
      wilaya,
      businessType,
      brand,
      sort,
      page: pageNum,
      archived,
      onlyIds: watchlistedIds,
    });
    content = (
      <BusinessManager
        key={`${active.id}:${archived ? "archived" : "active"}`}
        workspaceId={active.id}
        businesses={result.items}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        hasFilters={hasFilters}
        archived={archived}
        watchlist
        watchlistedIds={watchlistedIds}
      />
    );
  } else {
    content = <Placeholder block="No workspace found for your account." />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Watchlist"
        description="Businesses your team has starred for follow-up."
      />
      {content}
    </div>
  );
}
