/**
 * Pure validation + normalization for business records.
 *
 * IMPORTANT: this module must stay free of `"use server"`, Supabase, Next.js,
 * cookies, or any server-only logic. It is imported by BOTH the client-side
 * import-preview UI and the server actions, so it must be safe in either
 * environment. Keep it pure (no I/O, no globals).
 */

import { normalizeBrandList } from "@/lib/businesses/brands";
import {
  BUSINESS_STATUSES,
  CONTACT_STATUS_VALUES,
  DEFAULT_CONTACT_STATUS,
  type BusinessInput,
} from "@/lib/businesses/types";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** Trim a free-text field; empty -> null so we don't store blank strings. */
export function cleanText(v?: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Validate + normalize the writable fields shared by create, update, and
 * import. Returns a column->value map ready to merge with authorship/workspace
 * columns, or an error message. Does NOT include workspace_id / created_by /
 * modified_by (those are forced by the server action).
 */
export function buildValues(
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

  // Block 15: separate outreach status; defaults to 'not_contacted'.
  const contactStatus = input.contactStatus ?? DEFAULT_CONTACT_STATUS;
  if (!CONTACT_STATUS_VALUES.includes(contactStatus)) {
    return { error: "Invalid contact status." };
  }

  // Normalize brands: trim, drop blanks, map aliases to canonical names, and
  // deduplicate case-insensitively. Storing canonical values is what makes the
  // brand filter reliable (see lib/businesses/brands.ts).
  const supportedBrands = normalizeBrandList(
    Array.isArray(input.supportedBrands) ? input.supportedBrands : []
  );

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
      contact_status: contactStatus,
    },
  };
}
