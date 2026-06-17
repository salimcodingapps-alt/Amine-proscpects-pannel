"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessesByIds } from "@/lib/businesses/queries";
import { buildValues, isUuid } from "@/lib/businesses/validation";
import {
  MAX_IMPORT_ROWS,
  type BusinessActionResult,
  type BusinessImportResult,
  type BusinessInput,
  type ImportRowError,
  type MergeInput,
  type MergeResult,
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

/**
 * Manually merge a single group of duplicate records (Block 8). The client
 * chooses a survivor, the losers, and WHICH record supplies each field — it
 * sends only ids, never field values. This action is deliberately write-careful:
 *
 *   1. Validate the id shapes (exactly one survivor, >=1 loser, all distinct,
 *      survivor not among the losers, every field-source id within the set).
 *   2. RE-FETCH every involved record from the DB (active + workspace-scoped) and
 *      confirm the set is exactly what was requested — a record archived or moved
 *      since detection aborts the merge cleanly.
 *   3. Compose the surviving record's new values FROM THE REFETCHED DB ROWS only
 *      (never from client-supplied text), then re-validate with buildValues.
 *   4. SURVIVOR-FIRST: update the survivor; only if that succeeds, soft-archive
 *      each loser (deleted_at) — there is NO hard delete. A partial failure
 *      leaves the survivor merged and any un-archived duplicates still active and
 *      re-mergeable; nothing is unrecoverable (losers are soft-deleted).
 *
 * RLS is the backstop: the update policy still enforces workspace membership and
 * modified_by = auth.uid() regardless of these checks.
 */
export async function mergeBusinesses(
  workspaceId: string,
  input: MergeInput
): Promise<MergeResult> {
  const fail = (error: string): MergeResult => ({
    survivorUpdated: false,
    archivedIds: [],
    failedIds: [],
    error,
  });

  // ----- 1. Shape validation (ids only) ------------------------------------
  if (!isUuid(workspaceId)) return fail("Invalid workspace.");

  const survivorId = input?.survivorId;
  const loserIds = Array.isArray(input?.loserIds) ? input.loserIds : [];
  const fieldSources = input?.fieldSources ?? {};

  if (!survivorId || !isUuid(survivorId)) return fail("Invalid surviving record.");
  if (loserIds.length === 0) return fail("Select at least one record to merge in.");
  if (!loserIds.every((id) => isUuid(id))) return fail("Invalid record in the merge set.");

  const mergeIds = [survivorId, ...loserIds];
  if (new Set(mergeIds).size !== mergeIds.length) {
    return fail("The surviving record cannot also be a record being merged in.");
  }

  const mergeIdSet = new Set(mergeIds);
  for (const sourceId of Object.values(fieldSources)) {
    if (sourceId && !mergeIdSet.has(sourceId)) {
      return fail("A field source is not part of this merge group.");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.");

  // ----- 2. Re-fetch + verify the set (trust the DB, not the client) -------
  const records = await getActiveBusinessesByIds(supabase, workspaceId, mergeIds);
  const byId = new Map(records.map((r) => [r.id, r]));
  if (records.length !== mergeIds.length || !mergeIds.every((id) => byId.has(id))) {
    return fail(
      "One or more records are no longer available (archived, edited, or in another workspace). Refresh and try again."
    );
  }

  // ----- 3. Compose the survivor's new values FROM DB ROWS ONLY ------------
  const sourceFor = (key: keyof BusinessInput): (typeof records)[number] =>
    byId.get(fieldSources[key] ?? survivorId)!; // existence guaranteed above

  const composed: BusinessInput = {
    companyName: sourceFor("companyName").companyName,
    contactName: sourceFor("contactName").contactName,
    phone: sourceFor("phone").phone,
    email: sourceFor("email").email,
    website: sourceFor("website").website,
    address: sourceFor("address").address,
    city: sourceFor("city").city,
    wilaya: sourceFor("wilaya").wilaya,
    country: sourceFor("country").country,
    businessType: sourceFor("businessType").businessType,
    supportedBrands: sourceFor("supportedBrands").supportedBrands,
    notes: sourceFor("notes").notes,
    status: sourceFor("status").status,
  };
  // NOTE: the fields above mirror MERGEABLE_FIELDS in types.ts (the list the UI
  // offers); keep them in sync if that list changes.

  const built = buildValues(composed);
  if (built.error || !built.values) {
    return fail(built.error ?? "The merged record is not valid.");
  }

  // ----- 4. Survivor-first write -------------------------------------------
  const { data: updated, error: updateError } = await supabase
    .from("businesses")
    .update({ ...built.values, modified_by: user.id })
    .eq("id", survivorId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select("id");

  if (updateError) return fail(updateError.message);
  if (!updated || updated.length === 0) {
    return fail("The surviving record could not be updated. Refresh and try again.");
  }

  // Survivor is merged. Now soft-archive each loser; collect per-record outcome.
  const archivedIds: string[] = [];
  const failedIds: string[] = [];
  const stamp = new Date().toISOString();
  for (const loserId of loserIds) {
    const { data: archived, error: archiveError } = await supabase
      .from("businesses")
      .update({ deleted_at: stamp, modified_by: user.id })
      .eq("id", loserId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .select("id");

    if (archiveError || !archived || archived.length === 0) {
      failedIds.push(loserId);
    } else {
      archivedIds.push(loserId);
    }
  }

  return {
    survivorUpdated: true,
    archivedIds,
    failedIds,
    error:
      failedIds.length > 0
        ? `The surviving record was merged, but ${failedIds.length} duplicate(s) could not be archived. They are still active — review them and merge again.`
        : undefined,
  };
}
