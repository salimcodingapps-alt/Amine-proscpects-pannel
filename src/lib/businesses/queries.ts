import type { SupabaseClient } from "@supabase/supabase-js";

import type { Business, BusinessStatus } from "@/lib/businesses/types";

/** Columns selected for the app-facing Business view. */
const BUSINESS_COLUMNS =
  "id, workspace_id, company_name, contact_name, phone, email, website, " +
  "address, city, wilaya, country, business_type, supported_brands, notes, " +
  "status, created_at, updated_at";

/** Shape of a raw row as returned by PostgREST for BUSINESS_COLUMNS. */
interface BusinessRow {
  id: string;
  workspace_id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  country: string | null;
  business_type: string | null;
  supported_brands: string[] | null;
  notes: string | null;
  status: BusinessStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(row: BusinessRow): Business {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    companyName: row.company_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    city: row.city,
    wilaya: row.wilaya,
    country: row.country,
    businessType: row.business_type,
    supportedBrands: row.supported_brands ?? [],
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List the businesses for a workspace, newest first. RLS already restricts rows
 * to workspaces the caller belongs to; the explicit workspace_id filter is
 * defense-in-depth and lets the partial index do its job. Soft-deleted records
 * are hidden unless includeDeleted is set.
 */
export async function listBusinesses(
  supabase: SupabaseClient,
  workspaceId: string,
  options: { includeDeleted?: boolean } = {}
): Promise<Business[]> {
  let query = supabase
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as BusinessRow[]).map(mapRow);
}
