/**
 * Brand logo mapping for the brand chips UI (Block 12). PURE module — no
 * `"use server"`, Supabase, Next, or runtime fetching. Safe in both server and
 * client components.
 *
 * Strategy (locked with the user):
 * - Logos are LOCAL bundled assets under `public/brand-logos/<slug>.svg`. No
 *   remote logo APIs, no runtime fetching, no scraping.
 * - We never render a `<img>` for a logo that isn't actually present, so a
 *   missing file can't produce a broken image. Presence is declared explicitly
 *   by `LOGO_ALLOWLIST`. When a real asset is added under `public/brand-logos/`,
 *   add its slug here and the chip lights up automatically.
 * - Until then `LOGO_ALLOWLIST` is empty, so EVERY brand renders the neutral
 *   fallback chip (initial + label) — the feature works end-to-end with zero
 *   asset files.
 */

import { canonicalizeBrand } from "@/lib/businesses/brands";

/** Combining diacritical marks, stripped after NFD normalization. */
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Deterministic file slug for a brand: canonicalize (so aliases/casing collapse
 * to the agreed name), strip diacritics, lowercase, and reduce to ASCII
 * kebab-case. e.g. "Mercedes-Benz" -> "mercedes-benz", "Land Rover" ->
 * "land-rover", "vw" -> "volkswagen". Returns "" for blank input.
 */
export function brandSlug(brand: string): string {
  const canonical = canonicalizeBrand(brand);
  if (canonical === "") return "";
  return canonical
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric runs -> single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

/** First alphanumeric character of a brand, uppercased, for the fallback chip. */
export function brandInitial(brand: string): string {
  const match = brand.normalize("NFD").replace(DIACRITICS, "").match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : "?";
}

/**
 * Slugs that have a real local logo asset under `public/brand-logos/`.
 *
 * EMPTY for now — every brand falls back to the initial chip. As you add files,
 * register their slug here (e.g. add "renault" once `public/brand-logos/renault.svg`
 * exists). The slug must match `brandSlug()` and the filename (minus extension).
 */
export const LOGO_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // "renault", "peugeot", "citroen", ...
]);

/** File extension to look for. SVG preferred (see public/brand-logos/README.md). */
const LOGO_EXT = "svg";

/**
 * Public path to a brand's local logo, or `null` when no asset is registered.
 * `null` => the chip renders the fallback (never a broken `<img>`).
 */
export function brandLogoSrc(brand: string): string | null {
  const slug = brandSlug(brand);
  if (slug === "" || !LOGO_ALLOWLIST.has(slug)) return null;
  return `/brand-logos/${slug}.${LOGO_EXT}`;
}
