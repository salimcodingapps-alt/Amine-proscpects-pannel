"use server";

import { createClient } from "@/lib/supabase/server";
import { buildValues, isUuid } from "@/lib/businesses/validation";
import {
  MAX_IMPORT_ROWS,
  type BusinessActionResult,
  type BusinessImportResult,
  type BusinessInput,
  type ImportRowError,
} from "@/lib/businesses/types";

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

/**
 * Bulk-insert business records from a CSV import, after the user has explicitly
 * confirmed. Every row is RE-VALIDATED server-side (never trust the client):
 * invalid rows are skipped and reported, not silently fixed or imported. Valid
 * rows are inserted in one batch with workspace_id and authorship forced —
 * created_by/modified_by = auth.uid() — exactly like createBusiness. Brands are
 * canonicalized by buildValues. There is NO dedupe: every valid row becomes a
 * new record. `inputs[i]` is reported as row i+1 (data-row order).
 */
export async function importBusinesses(
  workspaceId: string,
  inputs: BusinessInput[]
): Promise<BusinessImportResult> {
  const attempted = Array.isArray(inputs) ? inputs.length : 0;
  const empty: BusinessImportResult = {
    attempted,
    inserted: 0,
    skipped: attempted,
    errors: [],
  };

  if (!isUuid(workspaceId)) return { ...empty, error: "Invalid workspace." };
  if (!Array.isArray(inputs) || attempted === 0) {
    return { ...empty, error: "No rows to import." };
  }
  if (attempted > MAX_IMPORT_ROWS) {
    return {
      ...empty,
      error: `Too many rows: ${attempted}. The limit is ${MAX_IMPORT_ROWS} per import.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...empty, error: "Not authenticated." };

  // Re-validate every row; collect the DB-ready values for the valid ones and
  // per-row errors for the rest.
  const rows: Record<string, unknown>[] = [];
  const errors: ImportRowError[] = [];
  inputs.forEach((input, i) => {
    const built = buildValues(input);
    if (built.error || !built.values) {
      errors.push({ row: i + 1, message: built.error ?? "Invalid row." });
      return;
    }
    rows.push({
      ...built.values,
      workspace_id: workspaceId,
      created_by: user.id,
      modified_by: user.id,
    });
  });

  if (rows.length === 0) {
    return { attempted, inserted: 0, skipped: attempted, errors };
  }

  const { error } = await supabase.from("businesses").insert(rows);
  if (error) {
    // The batch failed as a whole; nothing was inserted.
    return {
      attempted,
      inserted: 0,
      skipped: attempted,
      errors,
      error: error.message,
    };
  }

  return {
    attempted,
    inserted: rows.length,
    skipped: attempted - rows.length,
    errors,
  };
}
