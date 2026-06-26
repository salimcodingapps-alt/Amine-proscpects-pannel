"use server";

import { createClient } from "@/lib/supabase/server";
import type { BusinessActionResult } from "@/lib/businesses/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

/**
 * Add a business to the workspace's shared watchlist (Block 14). Forces
 * created_by = auth.uid(); RLS enforces membership and that the business belongs
 * to the workspace. Idempotent — re-adding an already-watchlisted business is a
 * no-op success (PK conflict is swallowed).
 */
export async function addToWatchlist(
  workspaceId: string,
  businessId: string
): Promise<BusinessActionResult> {
  if (!isUuid(workspaceId) || !isUuid(businessId)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("business_watchlist_items")
    .upsert(
      { workspace_id: workspaceId, business_id: businessId, created_by: user.id },
      { onConflict: "workspace_id,business_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };
  return {};
}

/**
 * Remove a business from the workspace's shared watchlist (Block 14). Any member
 * may remove (shared model); RLS enforces membership. Removing something that
 * isn't watchlisted is a no-op success.
 */
export async function removeFromWatchlist(
  workspaceId: string,
  businessId: string
): Promise<BusinessActionResult> {
  if (!isUuid(workspaceId) || !isUuid(businessId)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("business_watchlist_items")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("business_id", businessId);

  if (error) return { error: error.message };
  return {};
}
