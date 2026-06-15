/** Shared business-record types for Block 4 (Schema / Business Data). */

export type BusinessStatus = "new" | "contacted" | "qualified" | "inactive";

export const BUSINESS_STATUSES: BusinessStatus[] = [
  "new",
  "contacted",
  "qualified",
  "inactive",
];

/**
 * A business record as used in the app (camelCase view of the DB row). Only the
 * columns the UI actually needs are surfaced; reserved placeholder columns
 * (duplicate_score, latitude, longitude) are intentionally omitted for now.
 */
export interface Business {
  id: string;
  workspaceId: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  country: string | null;
  businessType: string | null;
  supportedBrands: string[];
  notes: string | null;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
}

/** Writable fields accepted by createBusiness / updateBusiness. */
export interface BusinessInput {
  companyName: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  wilaya?: string | null;
  country?: string | null;
  businessType?: string | null;
  supportedBrands?: string[];
  notes?: string | null;
  status?: BusinessStatus;
}

/** Result shape returned by business server actions. */
export interface BusinessActionResult {
  error?: string;
  /** Set by createBusiness with the new record id. */
  id?: string;
}

/** ----------------------------------------------------------------------------
 * Block 5 — Search / Filter / Sort
 * --------------------------------------------------------------------------- */

/** Sort orders offered in the database list UI. */
export type BusinessSort = "newest" | "oldest" | "name_asc" | "name_desc";

export const BUSINESS_SORTS: { value: BusinessSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Company name A–Z" },
  { value: "name_desc", label: "Company name Z–A" },
];

export const DEFAULT_BUSINESS_SORT: BusinessSort = "newest";

/** Default and only page size for Block 5 pagination. */
export const BUSINESS_PAGE_SIZE = 25;

/**
 * Server-side filters for listBusinesses. All optional; absent/empty fields are
 * simply not applied. Workspace scope and the deleted_at filter are NOT part of
 * this object — they are always enforced by the query itself.
 */
export interface BusinessListFilters {
  /** Free-text search across the configured columns (sanitized server-side). */
  search?: string;
  status?: BusinessStatus;
  wilaya?: string;
  businessType?: string;
  /** Single supported-brand value; matched against the supported_brands array. */
  brand?: string;
  sort?: BusinessSort;
  /** 1-based page number. */
  page?: number;
  pageSize?: number;
}

/** Paginated result returned by listBusinesses. */
export interface BusinessListResult {
  items: Business[];
  /** Total rows matching the filters (across all pages). */
  total: number;
  /** 1-based current page (clamped to a valid range). */
  page: number;
  pageSize: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
}
