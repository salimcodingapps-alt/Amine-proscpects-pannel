/** Shared business-record types for Block 4 (Schema / Business Data). */

export type BusinessStatus = "new" | "contacted" | "qualified" | "inactive";

export const BUSINESS_STATUSES: BusinessStatus[] = [
  "new",
  "contacted",
  "qualified",
  "inactive",
];

/**
 * Block 15 — Contact status. A SEPARATE outreach-tracking field, independent of
 * the lifecycle `BusinessStatus` above (which the dashboard metrics rely on).
 * Enum labels are snake_case to match the DB enum `public.contact_status`;
 * human labels live in CONTACT_STATUSES below.
 */
export type ContactStatus =
  | "not_contacted"
  | "contacted"
  | "no_answer"
  | "not_interested";

/** Display labels for the contact statuses, in select order. */
export const CONTACT_STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "no_answer", label: "No answer" },
  { value: "not_interested", label: "Not interested" },
];

/** New records start here; existing rows are backfilled to this in migration 0005. */
export const DEFAULT_CONTACT_STATUS: ContactStatus = "not_contacted";

/** Quick membership check for validating untrusted (URL / client) values. */
export const CONTACT_STATUS_VALUES: ContactStatus[] = CONTACT_STATUSES.map(
  (s) => s.value
);

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
  /** Block 15: outreach-tracking status, separate from the lifecycle status. */
  contactStatus: ContactStatus;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete timestamp: null = active; non-null = archived (Block 9). */
  deletedAt: string | null;
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
  /** Block 15: defaults to 'not_contacted' when omitted. */
  contactStatus?: ContactStatus;
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
  /** Block 15: exact-match filter on the contact (outreach) status. */
  contactStatus?: ContactStatus;
  wilaya?: string;
  businessType?: string;
  /** Single supported-brand value; matched against the supported_brands array. */
  brand?: string;
  sort?: BusinessSort;
  /** 1-based page number. */
  page?: number;
  pageSize?: number;
  /**
   * Block 9: when true, list ARCHIVED records (deleted_at IS NOT NULL) instead of
   * active ones. Absent/false = active records only (the default, unchanged).
   */
  archived?: boolean;
  /**
   * Block 14: restrict the result to this set of business ids (e.g. the
   * watchlisted ids). When provided AND empty, the result is empty. When absent
   * (undefined), no id restriction is applied (the default, unchanged).
   */
  onlyIds?: string[];
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

/** ----------------------------------------------------------------------------
 * Block 6 — CSV import
 * --------------------------------------------------------------------------- */

/** Hard cap on rows per import (safety; enforced client- AND server-side). */
export const MAX_IMPORT_ROWS = 500;

/** A field of BusinessInput that a CSV column can be mapped to. */
export type ImportFieldKey =
  | "companyName"
  | "contactName"
  | "phone"
  | "email"
  | "website"
  | "address"
  | "city"
  | "wilaya"
  | "country"
  | "businessType"
  | "supportedBrands"
  | "status";

/** Mappable fields, in display order. `required` blocks import until mapped. */
export const IMPORTABLE_FIELDS: {
  key: ImportFieldKey;
  label: string;
  required?: boolean;
}[] = [
  { key: "companyName", label: "Company name", required: true },
  { key: "contactName", label: "Contact name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "wilaya", label: "Wilaya" },
  { key: "country", label: "Country" },
  { key: "businessType", label: "Business type" },
  { key: "supportedBrands", label: "Supported brands (comma-separated)" },
  { key: "status", label: "Status" },
];

/** Per-row error reported by the import (1-based row number as seen by the user). */
export interface ImportRowError {
  row: number;
  message: string;
}

/** Outcome of importBusinesses. */
export interface BusinessImportResult {
  /** Rows the server was asked to insert. */
  attempted: number;
  inserted: number;
  skipped: number;
  errors: ImportRowError[];
  /** Set only on a whole-request failure (auth, bad workspace, over cap, DB). */
  error?: string;
}

/** ----------------------------------------------------------------------------
 * Block 8 — Manual duplicate merge
 * --------------------------------------------------------------------------- */

/**
 * Fields a merge can carry across from a chosen source record. These are exactly
 * the writable BusinessInput fields; each one's value is taken from ONE record in
 * the merge set (chosen by the user, defaulting to the survivor). No free-text
 * editing — only existing values from the involved records are ever written.
 */
export const MERGEABLE_FIELDS: { key: keyof BusinessInput; label: string }[] = [
  { key: "companyName", label: "Company name" },
  { key: "contactName", label: "Contact name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "wilaya", label: "Wilaya" },
  { key: "country", label: "Country" },
  { key: "businessType", label: "Business type" },
  { key: "supportedBrands", label: "Supported brands" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
];

/**
 * Per-field choice of WHICH record supplies that field's value. The value is a
 * record id that MUST belong to the merge set; absent fields default to the
 * survivor. The server never trusts field VALUES from the client — only these
 * source ids — and reads the actual value from the refetched DB record.
 */
export type MergeFieldSources = Partial<Record<keyof BusinessInput, string>>;

/** Input to the mergeBusinesses server action. Ids only — never field values. */
export interface MergeInput {
  survivorId: string;
  loserIds: string[];
  fieldSources: MergeFieldSources;
}

/** Outcome of mergeBusinesses. */
export interface MergeResult {
  /** True once the surviving record's UPDATE succeeded. */
  survivorUpdated: boolean;
  /** Loser ids that were successfully soft-archived. */
  archivedIds: string[];
  /** Loser ids whose archive UPDATE failed (survivor already merged; re-runnable). */
  failedIds: string[];
  /** Set on a whole-request failure or a clean abort before any write. */
  error?: string;
}

/** ----------------------------------------------------------------------------
 * Block 11 — Dashboard metrics (read-only overview)
 * --------------------------------------------------------------------------- */

/** A label with an occurrence count — used for the top-wilaya / top-brand lists. */
export interface ValueCount {
  label: string;
  count: number;
}

/** Active-record count for each of the four business (lifecycle) statuses. */
export type StatusCounts = Record<BusinessStatus, number>;

/** Block 15: active-record count for each of the four contact statuses. */
export type ContactStatusCounts = Record<ContactStatus, number>;

/**
 * Read-only metrics for the dashboard overview, scoped to one workspace.
 *
 * `activeTotal`, `archivedTotal`, and `contactStatusCounts` are EXACT (computed
 * with head-only `count` queries — no rows transferred). `topWilayas` /
 * `topBrands` are aggregated in-app from a capped scan of active rows:
 * `topCapped` is true when the cap was hit (so the lists may be incomplete) and
 * `topScanned` is how many active rows were actually examined. Nothing here
 * writes to the database.
 */
export interface WorkspaceDashboardStats {
  /** Active (not soft-deleted) records — equals the sum of contactStatusCounts. */
  activeTotal: number;
  /** Soft-deleted (archived) records. */
  archivedTotal: number;
  /**
   * Block 15: active-record counts by CONTACT status (the user-facing outreach
   * workflow). The dashboard breakdown now uses this instead of the lifecycle
   * status counts. contact_status is a NOT NULL enum, so the four counts sum to
   * activeTotal — same invariant the lifecycle counts had.
   */
  contactStatusCounts: ContactStatusCounts;
  /** Most common wilayas among scanned active rows (desc by count). */
  topWilayas: ValueCount[];
  /** Most common supported brands among scanned active rows (desc by count). */
  topBrands: ValueCount[];
  /** True when the top-list scan hit the cap, so those lists may be incomplete. */
  topCapped: boolean;
  /** Number of active rows scanned for the top lists (<= cap). */
  topScanned: number;
  /** A few most-recently-updated active records, newest first. */
  recentlyUpdated: Business[];
}
