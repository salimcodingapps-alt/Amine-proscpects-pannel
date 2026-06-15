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
