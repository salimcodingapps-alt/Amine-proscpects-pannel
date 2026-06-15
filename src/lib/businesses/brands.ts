/**
 * Brand normalization for business records (Block 5 fix).
 *
 * `supported_brands` is a `text[]` column and PostgREST array-contains is exact
 * and case-sensitive, so a filter for "renault" would miss a stored "Renault".
 * To keep the column as text[] (no migration) while making brand filtering
 * reliable, we canonicalize brand strings to a single agreed spelling/casing
 * BOTH on write (create/update) and when building the filter query. With stored
 * values canonical, exact array-contains then works regardless of input casing.
 *
 * Unknown brands (not in the table below) are kept as-is (trimmed) so the app
 * never silently drops a brand it doesn't recognize.
 */

/** Canonical display names for the brands we know about. */
export const CANONICAL_BRANDS = [
  "Renault",
  "Peugeot",
  "Citroen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volkswagen",
  "Toyota",
  "Nissan",
  "Hyundai",
  "Kia",
  "Ford",
  "Opel",
  "Seat",
  "Skoda",
  "Dacia",
  "Porsche",
  "Volvo",
  "Land Rover",
] as const;

/** lowercase alias -> canonical name. */
const BRAND_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  // Every canonical brand maps from its own lowercased form.
  for (const name of CANONICAL_BRANDS) {
    map[name.toLowerCase()] = name;
  }
  // Common alternate spellings / abbreviations / accented forms.
  Object.assign(map, {
    "citroën": "Citroen",
    "mercedes": "Mercedes-Benz",
    "mercedes benz": "Mercedes-Benz",
    "merc": "Mercedes-Benz",
    "benz": "Mercedes-Benz",
    "vw": "Volkswagen",
    "volks": "Volkswagen",
    "škoda": "Skoda",
    "landrover": "Land Rover",
    "land-rover": "Land Rover",
    "range rover": "Land Rover",
  });
  return map;
})();

/**
 * Canonicalize a single brand string: trim, collapse internal whitespace, and
 * map known aliases (case-insensitively) to their canonical name. Returns "" if
 * the input is blank. Unrecognized brands are returned trimmed, unchanged.
 */
export function canonicalizeBrand(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed === "") return "";
  const key = trimmed.toLowerCase();
  return BRAND_ALIASES[key] ?? trimmed;
}

/**
 * Normalize a list of brands for storage: canonicalize each, drop blanks, and
 * deduplicate case-insensitively (keeping the first canonical form seen).
 */
export function normalizeBrandList(inputs: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of inputs) {
    const brand = canonicalizeBrand(raw);
    if (brand === "") continue;
    const key = brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(brand);
  }
  return result;
}
