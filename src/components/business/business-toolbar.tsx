"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_SORTS,
  BUSINESS_STATUSES,
  DEFAULT_BUSINESS_SORT,
} from "@/lib/businesses/types";

/** Match the native-control styling used by BusinessManager's form fields. */
const FIELD_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const SEARCH_DEBOUNCE_MS = 350;

/** URL param keys owned by the toolbar. */
const PARAM_KEYS = ["q", "status", "wilaya", "type", "brand", "sort", "page", "view"];

/**
 * Search / filter / sort controls for the database list. The toolbar holds no
 * canonical state of its own — the URL is the source of truth. It reads the
 * committed values from useSearchParams and writes changes back by pushing a
 * new query string, which re-runs the server page. Text inputs are debounced;
 * selects commit immediately. Any filter change resets the page to 1.
 */
export function BusinessToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for the debounced text inputs, seeded from the URL.
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [wilaya, setWilaya] = useState(searchParams.get("wilaya") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [brand, setBrand] = useState(searchParams.get("brand") ?? "");

  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? DEFAULT_BUSINESS_SORT;
  const archived = searchParams.get("view") === "archived";

  // The exact query string this toolbar last pushed itself. The sync effect
  // below uses it to tell our OWN (debounced) commits apart from genuinely
  // external URL changes (back/forward, Clear, view toggle). Without this, a
  // debounced push that lands while the user is still typing would echo a now
  // stale URL value back into local state and visibly "eat" characters.
  const lastPushedRef = useRef<string | null>(null);

  // Re-sync local inputs ONLY on external URL changes (back/forward navigation,
  // Clear, view toggle) — never from our own commit, which would overwrite what
  // the user is actively typing. If the current query string is exactly what we
  // last pushed, the change is self-caused, so we leave local state alone.
  useEffect(() => {
    if (searchParams.toString() === lastPushedRef.current) return;
    setSearch(searchParams.get("q") ?? "");
    setWilaya(searchParams.get("wilaya") ?? "");
    setType(searchParams.get("type") ?? "");
    setBrand(searchParams.get("brand") ?? "");
  }, [searchParams]);

  /** Build the next query string from the current URL + updates, then push. */
  function commit(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter/sort change returns to the first page unless page is set here.
    if (!("page" in updates)) next.delete("page");

    const qs = next.toString();
    lastPushedRef.current = qs;
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  // Debounce the four text fields: whenever a local value diverges from the URL,
  // schedule a single push. Cleared on every change so only the last edit fires.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const urlSearch = searchParams.get("q") ?? "";
    const urlWilaya = searchParams.get("wilaya") ?? "";
    const urlType = searchParams.get("type") ?? "";
    const urlBrand = searchParams.get("brand") ?? "";
    if (
      search === urlSearch &&
      wilaya === urlWilaya &&
      type === urlType &&
      brand === urlBrand
    ) {
      return; // nothing pending
    }
    timer.current = setTimeout(() => {
      commit({
        q: search.trim(),
        wilaya: wilaya.trim(),
        type: type.trim(),
        brand: brand.trim(),
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, wilaya, type, brand]);

  const hasActiveFilters = PARAM_KEYS.some(
    (k) =>
      k !== "page" &&
      k !== "sort" &&
      k !== "view" &&
      (searchParams.get(k) ?? "") !== ""
  );

  function clearAll() {
    setSearch("");
    setWilaya("");
    setType("");
    setBrand("");
    // Clearing filters keeps the current view (Active vs Archived).
    const qs = archived ? "view=archived" : "";
    lastPushedRef.current = qs;
    startTransition(() =>
      router.push(qs ? `${pathname}?${qs}` : pathname)
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-md border border-input p-0.5"
          role="group"
          aria-label="Active or archived records"
        >
          <button
            type="button"
            onClick={() => commit({ view: "" })}
            aria-pressed={!archived}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              !archived
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => commit({ view: "archived" })}
            aria-pressed={archived}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              archived
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, contact, phone, email, city, wilaya, type, notes…"
            className="pl-9"
            aria-label="Search businesses"
          />
        </div>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-status">Status</Label>
          <select
            id="bt-status"
            value={status}
            onChange={(e) => commit({ status: e.target.value })}
            className={`${FIELD_CLASS} capitalize`}
          >
            <option value="">All statuses</option>
            {BUSINESS_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-wilaya">Wilaya</Label>
          <Input
            id="bt-wilaya"
            value={wilaya}
            onChange={(e) => setWilaya(e.target.value)}
            placeholder="e.g. Alger"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-type">Business type</Label>
          <Input
            id="bt-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. supplier"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-brand">Supported brand</Label>
          <Input
            id="bt-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Renault"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-sort">Sort by</Label>
          <select
            id="bt-sort"
            value={sort}
            onChange={(e) => commit({ sort: e.target.value })}
            className={FIELD_CLASS}
          >
            {BUSINESS_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
