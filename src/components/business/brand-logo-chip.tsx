import {
  brandInitial,
  brandLogoSrc,
} from "@/lib/businesses/brand-logos";

/**
 * Brand chip (Block 12). Pure presentation — renders a compact, premium chip for
 * one brand: a real LOCAL logo when an asset is registered, otherwise a neutral
 * fallback (gold initial + label). No hooks, so it works in both server and
 * client component trees. Uses theme tokens + Tailwind only — no globals.css /
 * ui/* change, no new dependency, no remote/runtime logo fetching.
 *
 * The logo (and the fallback initial) sit on a fixed-size light rounded tile so
 * monochrome/dark brand marks stay readable on the dark theme and both variants
 * share the exact same footprint (no row-height jitter).
 */

const TILE = "h-[18px] w-[18px] shrink-0 rounded-[5px]";

export function BrandLogoChip({ brand }: { brand: string }) {
  const src = brandLogoSrc(brand);

  return (
    <span
      title={brand}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/40 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-foreground"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- static local asset; next/image would need config + a dependency decision (out of scope).
        <img
          src={src}
          alt={brand}
          width={18}
          height={18}
          loading="lazy"
          className={`${TILE} bg-white object-contain p-[2px]`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${TILE} flex items-center justify-center bg-primary/15 text-[10px] font-semibold leading-none text-primary`}
        >
          {brandInitial(brand)}
        </span>
      )}
      <span className="truncate">{brand}</span>
    </span>
  );
}

/**
 * Renders a list of brand chips with overflow control.
 * - `max` caps the number of visible chips; the rest collapse into a "+N" chip
 *   (full list available on hover via `title`).
 * - `nowrap` keeps everything on a single line (desktop table cell); the default
 *   wraps (mobile cards, dashboard).
 * Empty/absent brands render a muted em dash, matching the prior UI.
 */
export function BrandChips({
  brands,
  max = 3,
  nowrap = false,
  className = "",
}: {
  brands: string[];
  max?: number;
  nowrap?: boolean;
  className?: string;
}) {
  if (!brands || brands.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const shown = brands.slice(0, max);
  const extra = brands.length - shown.length;

  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 ${
        nowrap ? "flex-nowrap overflow-hidden" : "flex-wrap"
      } ${className}`}
    >
      {shown.map((brand) => (
        <BrandLogoChip key={brand} brand={brand} />
      ))}
      {extra > 0 ? (
        <span
          title={brands.join(", ")}
          className="inline-flex shrink-0 items-center rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
