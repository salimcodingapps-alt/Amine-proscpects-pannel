/**
 * Block 7 — Deterministic Duplicate Detection (read-only foundation).
 *
 * PURE module — like `validation.ts` and `brands.ts`, it is intentionally free
 * of `"use server"`, Supabase, Next, and cookies so the SAME logic is safe to
 * run anywhere (and is trivially testable). It only computes; it NEVER writes.
 *
 * The approach is deliberately deterministic (no AI, no fuzzy/edit-distance):
 * normalize a few high-signal fields, then group records that share a
 * normalized key. Records are connected transitively (a record matched by phone
 * AND by name+wilaya pulls both clusters into one group) via union-find, so each
 * record appears in at most one group and every contributing reason is reported.
 *
 * Signals, by confidence:
 *   strong   — same normalized phone / email / website (unique-ish identifiers)
 *   medium   — same normalized company name + wilaya, or + city
 * Company name ALONE is never a signal (too many false positives); it must be
 * paired with a locality. Address similarity is intentionally excluded from v1
 * (Google Maps addresses are noisy — deferred until we see real results).
 */

import type { Business } from "@/lib/businesses/types";

/** Max active rows scanned per workspace. Beyond this, detection is partial. */
export const DEDUP_SCAN_CAP = 2000;

/** The deterministic signals that can mark two records as likely duplicates. */
export type DuplicateSignal =
  | "phone"
  | "email"
  | "website"
  | "name_wilaya"
  | "name_city";

/** Human-readable label for each signal (shown as the "why" badge in the UI). */
export const SIGNAL_LABELS: Record<DuplicateSignal, string> = {
  phone: "Same phone",
  email: "Same email",
  website: "Same website",
  name_wilaya: "Same name + wilaya",
  name_city: "Same name + city",
};

/** Signal display order (strong signals first). */
export const SIGNAL_ORDER: DuplicateSignal[] = [
  "phone",
  "email",
  "website",
  "name_wilaya",
  "name_city",
];

/** One reason a group of records is considered duplicates. */
export interface DuplicateMatch {
  signal: DuplicateSignal;
  /** The normalized value the records share (for display / explanation). */
  value: string;
  /** How many records in the group share this value. */
  count: number;
}

/** A set of likely-duplicate records plus the reasons they were grouped. */
export interface DuplicateGroup {
  /** Stable id derived from the sorted member ids (good React key). */
  id: string;
  members: Business[];
  matches: DuplicateMatch[];
}

/** The full read-only detection result for a workspace. */
export interface DuplicateReport {
  groups: DuplicateGroup[];
  /** How many active records were actually scanned. */
  scannedCount: number;
  /** True if the scan hit the cap and the result may be incomplete. */
  capped: boolean;
}

// ---------------------------------------------------------------------------
// Field normalizers (all pure; all return "" when there is nothing to match on)
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to a canonical Algerian national form so that
 * `0550 12 34 56`, `+213 550 12 34 56`, and `00213550123456` all compare equal.
 * Strategy: keep digits only, strip an international prefix (`00` / `213`),
 * drop leading zeros to get the national significant number, then re-apply a
 * single leading `0`. Returns "" when there are too few digits to trust.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("213")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  // Guard against grouping on stray short fragments.
  if (d.length < 6) return "";
  return "0" + d;
}

/** Normalize an email: trim + lowercase. Returns "" if blank. */
export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().toLowerCase();
}

/**
 * Normalize a website to host+path: lowercase, strip scheme, leading `www.`,
 * and trailing slashes, so `https://www.acme.dz/` and `acme.dz` compare equal.
 * Returns "" if blank.
 */
export function normalizeWebsite(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().toLowerCase();
  if (s === "") return "";
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\/+$/, "");
  return s;
}

/** Legal-form / structural tokens stripped from company names (conservative). */
const NAME_NOISE = new Set([
  "sarl",
  "eurl",
  "spa",
  "snc",
  "sas",
  "ets",
  "etablissement",
  "etablissements",
  "societe",
  "ste",
]);

/**
 * Normalize a company name for matching: lowercase, strip accents/diacritics,
 * drop punctuation, remove a small conservative set of legal-form tokens
 * (sarl, eurl, ets, …), and collapse whitespace. Returns "" if nothing is left.
 *
 * Conservative on purpose — we strip only clear noise so that distinct names
 * stay distinct. Name is never a standalone signal regardless.
 */
export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned === "") return "";
  const tokens = cleaned.split(" ").filter((t) => !NAME_NOISE.has(t));
  return tokens.join(" ");
}

/** Normalize a locality (city / wilaya): lowercase, strip accents, collapse. */
export function normalizeLocality(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** Compute the (signal, value) keys a single record participates in. */
function recordKeys(b: Business): { signal: DuplicateSignal; value: string }[] {
  const keys: { signal: DuplicateSignal; value: string }[] = [];

  const phone = normalizePhone(b.phone);
  if (phone) keys.push({ signal: "phone", value: phone });

  const email = normalizeEmail(b.email);
  if (email) keys.push({ signal: "email", value: email });

  const website = normalizeWebsite(b.website);
  if (website) keys.push({ signal: "website", value: website });

  const name = normalizeCompanyName(b.companyName);
  if (name) {
    const wilaya = normalizeLocality(b.wilaya);
    if (wilaya) keys.push({ signal: "name_wilaya", value: `${name} · ${wilaya}` });
    const city = normalizeLocality(b.city);
    if (city) keys.push({ signal: "name_city", value: `${name} · ${city}` });
  }

  return keys;
}

/** Minimal union-find over record indices. */
class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    // Path compression.
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

/**
 * Detect likely-duplicate groups within a single workspace's active records.
 *
 * Pure and read-only. Records are bucketed by every (signal, value) key they
 * own; any bucket with >= 2 records both (a) unions those records into one
 * group and (b) becomes a reported match reason. Groups are returned largest
 * first; members and matches are deterministically ordered so the UI is stable.
 *
 * @param businesses Active records to scan (already workspace-scoped + not deleted).
 * @param options.cap    Safety ceiling; if exceeded the input is truncated and
 *                       `capped` is set. Defaults to DEDUP_SCAN_CAP.
 * @param options.capped Force the capped flag (e.g. when the DB query already
 *                       hit its row limit). OR'd with the in-module cap check.
 */
export function findDuplicateGroups(
  businesses: Business[],
  options: { cap?: number; capped?: boolean } = {}
): DuplicateReport {
  const cap = options.cap ?? DEDUP_SCAN_CAP;
  const truncated = businesses.length > cap;
  const scanned = truncated ? businesses.slice(0, cap) : businesses;
  const capped = Boolean(options.capped) || truncated;

  // Bucket records by (signal, value). Map value -> record indices.
  const buckets = new Map<string, { signal: DuplicateSignal; value: string; members: number[] }>();
  scanned.forEach((b, i) => {
    for (const { signal, value } of recordKeys(b)) {
      const k = `${signal}::${value}`;
      const bucket = buckets.get(k);
      if (bucket) bucket.members.push(i);
      else buckets.set(k, { signal, value, members: [i] });
    }
  });

  // Union records that share any bucket of size >= 2.
  const uf = new UnionFind(scanned.length);
  const sharedBuckets = [...buckets.values()].filter((bk) => bk.members.length >= 2);
  for (const bk of sharedBuckets) {
    for (let j = 1; j < bk.members.length; j++) {
      uf.union(bk.members[0], bk.members[j]);
    }
  }

  // Assemble groups by union-find root.
  const byRoot = new Map<number, { members: number[]; matches: DuplicateMatch[] }>();
  for (const bk of sharedBuckets) {
    const root = uf.find(bk.members[0]);
    let group = byRoot.get(root);
    if (!group) {
      group = { members: [], matches: [] };
      byRoot.set(root, group);
    }
    group.matches.push({ signal: bk.signal, value: bk.value, count: bk.members.length });
  }
  // Collect member indices per root (only records that landed in a shared bucket).
  const memberSets = new Map<number, Set<number>>();
  for (const bk of sharedBuckets) {
    for (const idx of bk.members) {
      const root = uf.find(idx);
      let set = memberSets.get(root);
      if (!set) {
        set = new Set<number>();
        memberSets.set(root, set);
      }
      set.add(idx);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [root, group] of byRoot) {
    const memberIdx = [...(memberSets.get(root) ?? [])];
    const members = memberIdx
      .map((i) => scanned[i])
      .sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)
      );
    const matches = group.matches.sort(
      (a, b) =>
        SIGNAL_ORDER.indexOf(a.signal) - SIGNAL_ORDER.indexOf(b.signal) ||
        a.value.localeCompare(b.value)
    );
    const id = members.map((m) => m.id).join("|");
    groups.push({ id, members, matches });
  }

  // Largest groups first; stable tiebreak by id.
  groups.sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id));

  return { groups, scannedCount: scanned.length, capped };
}
