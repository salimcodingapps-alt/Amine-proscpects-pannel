"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BUSINESS_STATUSES,
  type BusinessActionResult,
  type BusinessInput,
} from "@/lib/businesses/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

/** Trim a free-text field; empty -> null so we don't store blank strings. */
function cleanText(v?: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Validate + normalize the writable fields shared by create and update. Returns
 * a column->value map ready to merge with authorship/workspace columns, or an
 * error message. Does NOT include workspace_id / created_by / modified_by.
 */
function buildValues(
  input: BusinessInput
): { values?: Record<string, unknown>; error?: string } {
  const companyName = (input.companyName ?? "").trim();
  if (companyName.length < 1 || companyName.length > 200) {
    return { error: "Company name is required (1–200 characters)." };
  }

  const email = cleanText(input.email);
  if (email && !EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const status = input.status ?? "new";
  if (!BUSINESS_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supportedBrands = Array.isArray(input.supportedBrands)
    ? input.supportedBrands.map((b) => b.trim()).filter((b) => b !== "")
    : [];

  return {
    values: {
      company_name: companyName,
      contact_name: cleanText(input.contactName),
      phone: cleanText(input.phone),
      email,
      website: cleanText(input.website),
      address: cleanText(input.address),
      city: cleanText(input.city),
      wilaya: cleanText(input.wilaya),
      // country is NOT NULL in the DB; fall back to the Algeria-first default.
      country: cleanText(input.country) ?? "Algeria",
      business_type: cleanText(input.businessType),
      supported_brands: supportedBrands,
      notes: cleanText(input.notes),
      status,
    },
  };
}

/**
 * Create a business record in the given workspace. Authorship is forced to the
 * caller (created_by/modified_by = auth.uid()), which the INSERT policy also
 * requires. RLS enforces that the caller is a member of the workspace.
 */
export async function createBusiness(
  workspaceId: string,
  input: BusinessInput
): Promise<BusinessActionResult> {
  if (!isUuid(workspaceId)) return { error: "Invalid workspace." };

  const built = buildValues(input);
  if (built.error) return { error: built.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      ...built.values,
      workspace_id: workspaceId,
      created_by: user.id,
      modified_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id as string };
}

/**
 * Update an existing (non-archived) business record. modified_by is set to the
 * caller, as the UPDATE policy requires. RLS enforces workspace membership.
 */
export async function updateBusiness(
  workspaceId: string,
  id: string,
  input: BusinessInput
): Promise<BusinessActionResult> {
  if (!isUuid(workspaceId) || !isUuid(id)) {
    return { error: "Invalid request." };
  }

  const built = buildValues(input);
  if (built.error) return { error: built.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("businesses")
    .update({ ...built.values, modified_by: user.id })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (error) return { error: error.message };
  return {};
}

/**
 * Soft-delete (archive) a business record by setting deleted_at. This is an
 * UPDATE — there is intentionally no hard-delete path. The record stays in the
 * DB and is simply hidden from the default list.
 */
export async function archiveBusiness(
  workspaceId: string,
  id: string
): Promise<BusinessActionResult> {
  if (!isUuid(workspaceId) || !isUuid(id)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("businesses")
    .update({ deleted_at: new Date().toISOString(), modified_by: user.id })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (error) return { error: error.message };
  return {};
}
