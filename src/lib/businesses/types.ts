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
