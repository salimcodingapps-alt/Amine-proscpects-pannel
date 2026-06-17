# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-18 — end of Block 8 (Safe Manual Duplicate Merge UI), smoke-tested (12/12 PASS), awaiting checkpoint commit._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1–8 complete and validated. App runs against a real Supabase project, is auth-gated end-to-end, is multi-tenant (workspaces), has its business-data table (`businesses`) with workspace-scoped RLS + minimal grants, manual CRUD, **server-side search / filter / sort / pagination** at `/database`, **CSV import** (upload → map → review → confirmed bulk insert) at `/upload`, **read-only deterministic duplicate detection** at `/duplicates`, and now a **safe manual duplicate merge UI** (pick survivor → choose field sources → preview → confirm → update survivor + soft-archive losers) on those same `/duplicates` groups. **Blocks 1–7 are committed (latest `3bb6e0e`); Block 8 is implemented + smoke-tested but NOT yet committed** — see §13 for the recommended checkpoint.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication), Block 3 (Workspace Architecture), Block 4 (Schema / Business Data), Block 5 (Search / Filter / Sort), Block 6 (CSV Import), Block 7 (Duplicate Detection — read-only), Block 8 (Safe Manual Duplicate Merge UI — pending checkpoint commit).
- **Next up:** **Block 9 — NOT started; do not start without confirmation.** Confirm scope with the user before planning. Candidates from the master spec / deferred list: a **Restore / archive-history UI** (un-archive soft-deleted records — now more valuable since Block 8 archives merge losers; would re-add the `includeDeleted` option removed in Block 5), **member invites**, the deferred **Google Maps scraper CSV preset**, or AI-assisted cleaning/dedupe. NOTE: Block 8 covers merge only (manual, one group at a time); there is still NO restore/undo/history — recovery from a bad merge is via the SQL Editor (clear `deleted_at`).

## 3. What has been implemented so far

**Block 1 — App Foundation (commit `92a2354`)**
- Next.js **16.2.9** (App Router, Turbopack), React 19, TypeScript, **Tailwind v4**.
- shadcn/ui set up **manually** (CLI doesn't yet detect Next 16) — `button`, `card`, `sheet`, `input`, `label`.
- Brand dark theme in `globals.css` (gold `#F4C430` primary, `#0A0A0A` background; dark-only).
- App shell: desktop sidebar + mobile drawer (Sheet), shared nav source of truth.
- `(app)` route group: dashboard + database/upload/settings stubs; `/` → `/dashboard`.

**Block 2 — Authentication (commit `c92a059`)**
- Supabase email/password auth via **`@supabase/ssr`** (httpOnly cookie sessions).
- Browser + server clients; middleware session refresh + route protection.
- Server actions: signIn, signUp (`full_name` in `user_metadata`), signOut, requestPasswordReset, updatePassword.
- `(auth)` route group + `/auth/callback`. Server-side auth guard in `(app)/layout.tsx`.

**Block 3 — Workspace Architecture (commit `1feb3c3`)**
- First real DB tables + RLS (migration `0001_workspaces.sql`, applied + verified):
  - `workspace_role` enum; `workspaces`, `workspace_members` tables.
  - `SECURITY DEFINER` helpers `is_workspace_member(ws)` / `current_user_role(ws)` (hardened `search_path`) — recursion-safe.
  - **RLS enabled** + policies (select/update/delete; **no client INSERT**).
  - **`create_workspace(name)` SECURITY DEFINER RPC** — the ONLY workspace-creation path.
  - **`handle_new_user()` trigger** on `auth.users` (auto-provision) + idempotent backfill.
  - **Table GRANTs** to `authenticated` (mandatory alongside RLS).
- App: `src/lib/workspace/{types,queries,actions}.ts`, `workspace-switcher`, `workspace-settings`. Active workspace = httpOnly cookie `active_workspace_id`, always membership-validated server-side.

**Block 4 — Schema / Business Data (commit `b32d8dd`)**
- **First business-data table** (migration `supabase/migrations/0002_businesses.sql`, applied + verified in the SQL Editor):
  - `business_status` enum (`new | contacted | qualified | inactive`).
  - `businesses` table — workspace-scoped (`workspace_id` FK → `workspaces`, `on delete cascade`); `company_name` required; Algeria-first fields (`wilaya`, `country` default `'Algeria'`); `business_type` **free text**; `supported_brands text[]`; `status`; audit columns (`created_by`, `modified_by`, `created_at`, `updated_at`); `deleted_at` for **soft delete**; reserved-but-unused `duplicate_score`, `latitude`, `longitude`.
  - Indexes: `workspace_id`, plus partial `(workspace_id, created_at desc) where deleted_at is null`.
  - Reusable `set_updated_at()` trigger on the table.
  - **RLS enabled** + 3 policies (select/insert/update; **no delete** — soft-delete only); all gated on Block 3's `is_workspace_member(workspace_id)`. Insert/update forbid forging `created_by`/`modified_by`.
  - **Table GRANTs:** `revoke all ... from anon, authenticated` first, then `grant select, insert, update to authenticated` (no delete). See lesson in §6.
- App layer:
  - `src/lib/businesses/{types,queries,actions}.ts` — `listBusinesses` (workspace-scoped, hides soft-deleted), `createBusiness` / `updateBusiness` / `archiveBusiness`. Validation in `buildValues()`; authorship forced to `auth.uid()`.
  - `src/components/business/business-manager.tsx` — client CRUD UI (list / add / inline edit / archive), native styled select+textarea (no new shadcn deps).
  - `/database` page wired to the active workspace, keyed by `active.id`.
- **Validated:** full 8-point smoke test PASSED against real Supabase (create, list+status, edit-persist, archive-hides, tenant isolation on switch, scoped create in 2nd workspace, reload persistence).

**Block 5 — Search / Filter / Sort (commit `53a0a8f`)**
- **Server-side** search / filter / sort / pagination over `businesses`; no schema change, no migration, no index. RLS unchanged.
- `listBusinesses(supabase, workspaceId, filters)` now returns `{ items, total, page, pageSize, pageCount }`. Always keeps `workspace_id` scope + `deleted_at is null`.
  - **Search:** case-insensitive `ilike %term%` OR'd across 8 columns (company_name, contact_name, phone, email, city, wilaya, business_type, notes). The term is **sanitized** (strips PostgREST/`LIKE` meta chars `, . ( ) " : % _ * \`) so user input can't break or inject into the `.or()` string.
  - **Filters:** `status` exact enum; `wilaya` / `business_type` `ilike` contains; `brand` → canonicalized then `.contains("supported_brands", [brand])`.
  - **Sort:** newest / oldest / company A–Z / Z–A, with `id` as a stable tiebreaker for deterministic paging.
  - **Pagination:** `count: "exact"` + `.range()`, page size **25**.
- **Brand normalization** (`src/lib/businesses/brands.ts`): `canonicalizeBrand` / `normalizeBrandList` map aliases/casing to canonical names (e.g. `vw`→Volkswagen, `mercedes`→Mercedes-Benz). Used in the brand filter AND on create/update write (trim, drop blanks, case-insensitive dedup). This fixed the case-sensitive brand-filter bug found in smoke testing.
- **URL state:** `q`, `status`, `wilaya`, `type`, `brand`, `sort`, `page` — refresh/back/forward preserve the view. Debounced (~350ms) text inputs; selects commit immediately; any filter change resets to page 1.
- `/database/page.tsx` awaits Next 16 async `searchParams`, validates/clamps them, runs the filtered query. (`/database` is dynamic `ƒ` — expected, since `searchParams` opts into request-time rendering.)
- **Dev seed** (`supabase/seeds/dev_businesses.sql`): DEV-ONLY, ~41 realistic automotive records into one existing workspace; re-runnable (skips already-seeded rows); does NOT create tables / alter RLS / add features. Apply manually in the SQL Editor (which bypasses RLS — required for seeding).
- **Validated:** full Block 5 smoke test PASSED with seed data — search across all fields, all filters, all sorts, pagination, URL/back/forward state, workspace isolation, CRUD-still-works, and the brand filter is now case-insensitive (`renault`/`bmw`/`mercedes`/`vw` all match).

**Block 6 — CSV Import (commit PENDING)**
- **CSV-only** bulk import at `/upload`: upload → map columns → review/validate → **explicitly confirmed** bulk insert into the active workspace's `businesses`. No XLSX, no AI, no OCR, no dedupe, no merge UI, no Supabase Storage, **no new tables, no migration, no staging table**.
- **`papaparse` dependency added** (+ `@types/papaparse` dev). CSV is parsed **in the browser**; the uploaded file is **never stored** (parse and discard).
- **Shared pure validation module** `src/lib/businesses/validation.ts` — extracted `buildValues` / `cleanText` / `isUuid` / `EMAIL_RE` / `UUID_RE` out of `actions.ts` (which is `"use server"` and can only export async fns) so the SAME validation runs in the client preview AND the server action. The module is intentionally free of `"use server"`, Supabase, Next, cookies — safe in both environments. **Existing create/update behavior is unchanged** by this refactor.
- **Server action** `importBusinesses(workspaceId, inputs)` (in `actions.ts`): re-validates EVERY row server-side (client preview is not the gate), skips + reports invalid rows, batch-inserts valid rows with `workspace_id` and `created_by`/`modified_by` forced to `auth.uid()`, brands canonicalized via `normalizeBrandList`. **No dedupe** — every valid row becomes a new record. Caps at `MAX_IMPORT_ROWS = 500` (enforced in BOTH the parser and the action).
- **UI** `src/components/business/business-importer.tsx` (client, 4 steps: upload / map / review / done). Auto-maps clean semantic headers; manual override per field; `company_name` required. Review shows valid·invalid counts, lists invalid rows with reasons, previews first 10 valid rows. Nothing writes until the "Import N valid rows" click.
- **`/upload/page.tsx`** resolves the active workspace (mirrors `/database`) and renders `<BusinessImporter>` keyed by workspace id.
- **Dark-mode dropdown fix** (`src/app/globals.css`): native `<select>` option popups used the browser's light palette (text unreadable until hover). Added `:root { color-scheme: dark }` + `option { background/color }` — fixes ALL native selects app-wide (database status/sort filters, import mapping, business-form status). No new shadcn components.
- **Raw Google Maps scraper CSVs:** real exports have non-semantic headers (`hfpxzc href`, `qBF1Pd`, …), so auto-mapping can't recognize them — they fall back to all-manual mapping. **DECISION: Block 6 stays a generic CSV importer; no scraper-specific logic.** Interim workflow: the user cleans/normalizes the CSV to semantic headers before importing. A **Google Maps scraper CSV preset** (map known raw column codes by position/pattern) is **deferred to a future block** (see §12).
- **Validated:** Block 6 smoke test PASSED — happy path + invalid-row handling (bad email, blank company name shown & skipped), a real cleaned **Boumerdes** CSV import of **64 rows**, imported records appear in `/database`, search + wilaya + brand filters work on them, workspace scoping holds, dropdown readability fixed. `tsc --noEmit` + `npm run build` clean. (>500-row cap not manually exercised — deferred; guarded in code.)

**Block 7 — Duplicate Detection, read-only (commit PENDING)**
- **Detection ONLY** at `/duplicates`: detects likely-duplicate records inside the active workspace, groups them, and explains *why* each group was flagged. **NO merge, NO delete, NO auto-update, NO `duplicate_score` writes, NO AI, NO OCR, NO import logic, NO Google Maps preset. NO new table, NO migration, NO index** (existing columns only; the reserved `duplicate_score` column is left untouched).
- **Deterministic** — field normalization + union-find connected-component grouping. No fuzzy/edit-distance, no AI. Two records join the same group when they share any normalized signal value.
- **Signals (5):** `phone`, `email`, `website`, `name_wilaya` (normalized company name **+** wilaya), `name_city` (normalized company name **+** city). **Company name is NEVER used alone** — a name signal only forms when paired with a non-empty wilaya or city. **Address similarity excluded from v1** (Google Maps addresses are noisy → false positives).
- **Normalizers** (`src/lib/businesses/duplicates.ts`, pure module): `normalizePhone` (digits only; strip `00`/`213`/leading zeros; `<6` digits → ignored; else `0`+digits — so `0550 12 34 56`, `+213 550 12 34 56`, `00213550123456` are equal); `normalizeEmail` (trim+lowercase); `normalizeWebsite` (lowercase, strip scheme/`www.`/trailing slash); `normalizeCompanyName` (lowercase, strip diacritics, drop punctuation, collapse whitespace, remove legal-form noise tokens `sarl/eurl/spa/snc/sas/ets/etablissement(s)/societe/ste`); `normalizeLocality`. Blank/normalized-empty values never form a key (so blank phone/email/website never group together).
- **Scan cap:** `DEDUP_SCAN_CAP = 2000` active rows per workspace; if hit, the UI shows a clear amber "scanned only the first 2000, may be incomplete" warning. Full-scale detection deferred to a future optimization.
- **App layer:** `listActiveBusinessesForDedup(supabase, workspaceId, limit=2000)` in `queries.ts` — **read-only** select of existing columns, `deleted_at is null`, ordered `created_at, id`, `.limit(cap)`, returns `{ items, capped }`. `/duplicates/page.tsx` resolves the active workspace (mirrors `/database`), loads rows, runs `findDuplicateGroups(items, { capped })` **in memory**, renders `<DuplicateGroups>`. The component shows scan summary, optional cap warning, a green empty-state when no dupes, and one card per group with **reason badges** (signal label + shared value) and member records, each with an **"Inspect in database →"** link to `/database?q=<company>`. **Deliberately NO action buttons** (no merge/delete/dismiss/edit).
- **Validated:** Block 7 smoke test PASSED (15/15) against real Supabase — nav + page load, scan count, no cap warning under 2000, group cards, phone detection across formats, case-insensitive email, normalized website, name+wilaya/city, **name-only control did NOT group** (no false positives), **blank-contact controls did NOT group**, multi-signal badges, Inspect links filter `/database`, workspace isolation, and detection is read-only (records unchanged). `tsc --noEmit` + `npm run build` clean.

**Block 8 — Safe Manual Duplicate Merge UI (commit PENDING)**
- **Manual, write-careful merge** of ONE detected duplicate group at a time, launched from the `/duplicates` group cards. Flow: pick the **surviving record** (default = oldest) → for each **field where records differ**, pick **which record supplies the value** → see a full **merged preview** + an explicit **archive notice** → **Confirm merge**. On confirm: the survivor is UPDATEd; the other members are **soft-archived** (`deleted_at`). **NO hard delete, NO bulk, NO AI, NO auto-merge, NO `duplicate_score` write, NO new table / migration / RPC / index.**
- **Server never trusts client field values.** The client sends only `survivorId`, `loserIds`, and `fieldSources` (a map of *field → source record id*). The server action `mergeBusinesses` (in `actions.ts`): validates id shapes (one survivor, ≥1 loser, all distinct, survivor ∉ losers, every field-source id ∈ the merge set) → **re-fetches** all involved records from the DB (active + workspace-scoped, via new read-only `getActiveBusinessesByIds`) → verifies it got **exactly** the requested active set → **composes the survivor's new values from the refetched DB rows only** → re-validates with the shared `buildValues` → writes.
- **Survivor-first ordering for safe partial failure.** The survivor UPDATE runs first with `.select("id")` to confirm a row was hit; only then are losers soft-archived one-by-one (each also `.select("id")`-confirmed). If the survivor update fails, **zero** losers are archived (clean abort). If a loser archive fails mid-way, the survivor is already merged and the un-archived duplicates stay active and re-mergeable — `MergeResult` reports `{ survivorUpdated, archivedIds, failedIds, error? }`, and the UI surfaces partial outcomes. Nothing is ever unrecoverable (losers are soft-deleted).
- **Decisions (locked with the user):** (1) **No "Undo this merge" in Block 8** — without a proper restore/history mechanism, an undo would reactivate losers but could NOT restore overwritten survivor fields, which would mislead. Recovery interim = SQL Editor (clear `deleted_at`). A real Restore UI / merge history is a future block. (2) **Accept survivor-first sequential writes; no RPC/migration for atomicity** — all changes are recoverable (soft-archive), so true transactionality isn't worth a migration here. (3) **No free-text editing inside merge** — only existing values from the group's records may be chosen.
- **App layer:** `mergeBusinesses(workspaceId, { survivorId, loserIds, fieldSources })` + read-only `getActiveBusinessesByIds(supabase, workspaceId, ids)`. UI: `merge-sheet.tsx` (client, Sheet-based; survivor radios, per-field source `<select>`s shown only for conflicting fields, full preview table, archive notice, Confirm) — uses `useTransition`, inline error bar, `router.refresh()` on success (re-runs detection). `merge-sheet` owns its own trigger button and open state, rendered per group inside `duplicate-groups.tsx`; the planned separate `merge-launcher.tsx` was **not needed** (folded into `merge-sheet`). No new shadcn component (reused the existing `sheet`); no new dependency.
- **Validated:** Block 8 smoke test PASSED (12/12) against real Supabase — Merge button on groups, sheet opens, survivor/default selection, field-source selection, preview matches sources, **Cancel writes nothing**, **Confirm updates only the survivor**, losers **soft-archived** and gone from active `/database`, group disappears/shrinks on refresh, **SQL check confirms loser rows still exist with `deleted_at` set**, workspace isolation holds, and no hard delete / no AI / no bulk / no `duplicate_score` write. `tsc --noEmit` + `npm run build` clean (`/duplicates` stays dynamic `ƒ`).

## 4. Files created

**Block 4:**
- `supabase/migrations/0002_businesses.sql`
- `src/lib/businesses/{types,queries,actions}.ts`
- `src/components/business/business-manager.tsx`

**Block 5:**
- `src/components/business/business-toolbar.tsx` (search/filter/sort controls; URL-driven, client)
- `src/components/business/business-pagination.tsx` (Previous/Next, URL-driven, client)
- `src/lib/businesses/brands.ts` (brand canonicalization helpers)
- `supabase/seeds/dev_businesses.sql` (DEV-ONLY seed data)

**Block 6:**
- `src/lib/businesses/validation.ts` (PURE shared validation — `buildValues`/`cleanText`/`isUuid`/regexes; no `"use server"`/Supabase/Next)
- `src/lib/businesses/csv.ts` (papaparse wrapper → `{ headers, rows }`; trims, skips blanks, enforces ≤500 cap)
- `src/components/business/business-importer.tsx` (client 4-step import UI)

**Block 7:**
- `src/lib/businesses/duplicates.ts` (PURE detection module — normalizers, `recordKeys`, `UnionFind`, `findDuplicateGroups`; signal types/labels/order; `DEDUP_SCAN_CAP`. No `"use server"`/Supabase/Next.)
- `src/app/(app)/duplicates/page.tsx` (server component — resolves active workspace, loads rows read-only, runs detection in memory)
- `src/components/business/duplicate-groups.tsx` (server presentational — group cards, reason badges, Inspect links; no actions)

**Block 8:**
- `src/components/business/merge-sheet.tsx` (client — Sheet-based merge UI: survivor radios, per-field source pickers for conflicting fields, merged preview, archive notice, Confirm; `useTransition` + inline error bar + `router.refresh()`. Owns its own trigger button/open state — the planned `merge-launcher.tsx` was folded in here.)

(See git history for Block 1–3 file lists; Block 3 files listed in prior handoff revisions.)

## 5. Files modified

**Block 5:**
- `src/lib/businesses/types.ts` (sort/filter/result types: `BusinessSort`, `BUSINESS_SORTS`, `BUSINESS_PAGE_SIZE`, `BusinessListFilters`, `BusinessListResult`).
- `src/lib/businesses/queries.ts` (`listBusinesses` rewritten for server-side search/filter/sort/pagination; search-term sanitizer; brand canonicalization).
- `src/lib/businesses/actions.ts` (`buildValues` normalizes brands via `normalizeBrandList`).
- `src/components/business/business-manager.tsx` (renders toolbar + pagination; total-count + no-match empty state; CRUD untouched).
- `src/app/(app)/database/page.tsx` (awaits/parses/validates `searchParams`; calls filtered query; passes paging metadata).

**Block 6:**
- `src/lib/businesses/actions.ts` (imports `buildValues`/`isUuid` from the new `validation.ts`; removed the now-extracted private helpers; added `importBusinesses`).
- `src/lib/businesses/types.ts` (import types: `MAX_IMPORT_ROWS`, `ImportFieldKey`, `IMPORTABLE_FIELDS`, `ImportRowError`, `BusinessImportResult`).
- `src/app/(app)/upload/page.tsx` (replaced the placeholder; resolves active workspace, renders `<BusinessImporter>`).
- `src/app/globals.css` (dark-mode native `<select>`/`<option>` readability fix).
- `package.json` / `package-lock.json` (papaparse + `@types/papaparse`).

**Block 7:**
- `src/lib/businesses/queries.ts` (added **read-only** `listActiveBusinessesForDedup`; imports `DEDUP_SCAN_CAP`. No change to `listBusinesses`).
- `src/lib/nav.ts` (added **Duplicates** nav item + `CopyCheck` icon, between Database and Upload).
- `docs/NEXT_HANDOFF.md` (this file).

**Block 8:**
- `src/lib/businesses/types.ts` (added merge types: `MERGEABLE_FIELDS`, `MergeFieldSources`, `MergeInput`, `MergeResult`).
- `src/lib/businesses/queries.ts` (added **read-only** `getActiveBusinessesByIds` — fetch specific active records by id for the merge action to re-load from the DB; reuses `BUSINESS_COLUMNS`/`mapRow`. No change to existing queries).
- `src/lib/businesses/actions.ts` (added `mergeBusinesses`; imports `getActiveBusinessesByIds` + merge types. Existing create/update/archive/import untouched).
- `src/components/business/duplicate-groups.tsx` (threaded a new `workspaceId` prop through; renders `<MergeSheet>` per group card — still otherwise read-only presentation).
- `src/app/(app)/duplicates/page.tsx` (passes `active.id` into `<DuplicateGroups>`).
- `docs/NEXT_HANDOFF.md` (this file).

## 6. Important decisions made

- **Backend:** Supabase (Auth + Database + Storage + RLS). **Geography:** Algeria-first (`wilaya`) but international-capable. **Duplicates:** deterministic first, AI later. **Merge:** user picks fields. **Ingestion:** spreadsheets + images share ONE review/import pipeline (OCR deferred). **Audit trail:** created_by/modified_by/timestamps at schema level (done in Block 4).
- **Auth:** email/password only for MVP; display name in `user_metadata` (no profiles table).
- **Block 4 specifics:**
  - **One core table named `businesses`** (not `suppliers`) — the CRM holds suppliers, importers, wholesalers, garages, retailers, prospects, etc. `business_type` is **free text** for now (no enum/table).
  - **All workspace members** can create/view/update/soft-delete records (CRUD is membership-gated, **not** role-gated).
  - **Soft delete only** (`deleted_at`) — no hard-delete grant or policy. The app hides archived rows by default (no restore UI yet — deferred). NOTE: Block 5 simplified `listBusinesses` so it ALWAYS filters `deleted_at is null` (the old `includeDeleted` option was removed; add it back when a restore UI is built).
  - **Standard client INSERT** (no RPC needed — no workspace-bootstrap chicken-and-egg like Block 3). RLS `with check` enforces membership + non-forgeable authorship.
- **Block 4 lesson — table GRANTs must be tightened, not just added:** Supabase ships `ALTER DEFAULT PRIVILEGES` that grant **ALL** on new `public` tables to `authenticated` (incl. `REFERENCES`/`TRIGGER`/`TRUNCATE`). A bare additive `grant select, insert, update` leaves those in place. **Pattern:** `revoke all on table <t> from anon, authenticated;` then `grant <minimal> to authenticated;`. Verify with `information_schema.role_table_grants` (expect exactly the intended privileges; `anon` should have 0 rows). This refines the Block 3 lesson ("RLS needs grants") — the grant must also be *minimal*.
- **Block 5 specifics:**
  - **All search/filter/sort/pagination is server-side** (no client-side filtering of a pre-loaded array) — keeps `count`, pagination, and workspace scope correct. **URL search params are the source of truth** so refresh/back/forward work.
  - **Page size = 25**; simple Previous/Next (no infinite scroll). Search debounced ~350ms.
  - **Brand filter is canonical-match, not fuzzy:** `supported_brands` stays `text[]`. Because PostgREST array-contains is exact/case-sensitive, we **canonicalize brands both on write and in the filter** (`lib/businesses/brands.ts`) so e.g. `renault`/`RENAULT`/`vw` all resolve to the stored canonical name. Unknown brands are kept as-typed (trimmed). No brands table (deferred).
  - **No migration / no index in Block 5** — `ilike`/sort are fine at MVP row counts. STANDING DECISION: if row counts grow enough to need an index (e.g. trigram on `company_name`), STOP and ask before adding a migration.
- **Block 6 specifics:**
  - **CSV only** (no XLSX — Excel exports to CSV). **papaparse** for parsing (no hand-rolled CSV). Parse **in-browser**; **never store** the uploaded file (no Supabase Storage bucket/policies).
  - **Review state is in-memory** during the flow — **no staging table, no migration**. The existing `businesses` INSERT path is reused (standard client insert under RLS).
  - **Explicit confirmation required** before any insert; **server re-validates every row** (client preview is not the gate); **invalid rows are skipped + reported**, never auto-fixed. **≤500 rows** per import, enforced client- AND server-side. **No dedupe** (duplicates possible by design — documented to the user).
  - **Validation is shared via a pure module** (`validation.ts`) precisely because `actions.ts` is `"use server"` and may only export async functions — a sync helper had to live elsewhere to be usable client-side. Keep `validation.ts` pure.
  - **Generic importer only** — NO Google Maps scraper logic. Raw scraper headers are non-semantic, so the user cleans/normalizes CSVs to semantic headers first. A scraper preset is deferred (see §12).
  - **Dark-mode select fix** is global (`color-scheme: dark` + `option` colors in `globals.css`); no shadcn select component added.
- **Block 7 specifics:**
  - **Detection-only, read-only.** This block detects + explains duplicates; it does NOT merge, delete, auto-update, or write `duplicate_score`. Any of those is Block 8+ and needs explicit scope confirmation. No new table / migration / index — existing columns only.
  - **Deterministic, not AI/fuzzy.** Normalize fields, then union-find connected components: records sharing any normalized signal value land in one group. No edit-distance/fuzzy matching (avoids unexplainable false positives; keeps every group justifiable via its reason badges).
  - **Signals = phone, email, website, name+wilaya, name+city.** **Company name is never a signal on its own** — too many legitimate distinct businesses share a name within Algeria; a name only matches when paired with wilaya or city. **Address similarity is excluded from v1** because scraped Google Maps addresses are noisy and would create false positives.
  - **Blank values never group.** A normalized-empty field produces no key, so records with blank phone/email/website are not joined on "shared blank."
  - **2000-row scan cap per workspace** (`DEDUP_SCAN_CAP`), with a visible warning when hit. Keeps the in-memory O(n) bucketing fast and bounded; full-scale detection is a deferred optimization (would likely need DB-side support — STOP and ask before adding any index/migration for it).
  - **Detection module is pure** (`duplicates.ts`, no `"use server"`/Supabase/Next) so the same logic could later run client- or server-side; the page does the Supabase read and runs detection in memory.
- **Block 8 specifics:**
  - **Manual, one-group-at-a-time merge; write-careful.** No auto-merge, no bulk, no AI. Reuses the existing UPDATE paths and RLS — **no new table / migration / RPC / index**, and **no `duplicate_score` write**. Soft-archive (`deleted_at`) is the only "deletion."
  - **Server does not trust client field values.** The client sends only ids (`survivorId`, `loserIds`) + `fieldSources` (field → source record id). The action re-fetches every involved record from the DB, verifies the exact set is active + in-workspace, and **composes the survivor from DB row values only**, then re-validates via `buildValues`. A field-source id outside the merge set, or any record that has since been archived/moved, aborts cleanly before any write.
  - **Survivor-first sequential writes** (no transaction/RPC by design). Survivor UPDATE first (`.select("id")` confirms a hit); only then archive losers. Partial failure is always recoverable and re-runnable — losers are soft-deleted, never destroyed. `MergeResult` carries `{ survivorUpdated, archivedIds, failedIds, error? }`.
  - **No Undo / no restore UI in Block 8** (locked). A partial undo would mislead (can't restore overwritten survivor fields without history). Interim recovery from a bad merge = SQL Editor (clear `deleted_at` on the archived losers; the survivor's pre-merge values still live in those archived rows). A proper Restore UI / merge history is a clean future block.
  - **UI reuses the existing `sheet` primitive** (no new shadcn component, no new dependency); native `<select>`/`<table>`, inline error bar, `useTransition`, `router.refresh()` — same conventions as `business-manager`/`business-importer`.

## 7. Standing rules for every NEW table (carry forward)

1. **RLS enabled** from creation.
2. **Table GRANTs**: `revoke all from anon, authenticated`, then grant only what's needed to `authenticated`. RLS alone ⇒ `42501 permission denied`; default grants alone ⇒ too permissive.
3. **Scope all business data to `workspace_id`**; gate every policy on `is_workspace_member(workspace_id)` / `current_user_role(workspace_id)` (Block 3 helpers — reuse them, don't query membership inline → avoids recursion).
4. Audit columns (`created_by`/`modified_by`/`created_at`/`updated_at`); force authorship to `auth.uid()` in policies.
5. Migrations: tracked idempotent `.sql` in `supabase/migrations/`, applied manually via SQL Editor, with verification queries at the bottom.

## 8. Supabase / auth configuration assumptions

- Real Supabase project wired via `.env.local` (validated).
- **Migrations `0001_workspaces.sql` and `0002_businesses.sql` have been applied** in the SQL Editor and verified. For `0002`: table + RLS on, 3 policies (select/insert/update), grants = exactly INSERT/SELECT/UPDATE for `authenticated` (0 for `anon`), enum with 4 labels, `set_updated_at` trigger, 3 indexes.
- **"Confirm email" is DISABLED** in Supabase Auth (dev convenience). **Must be re-enabled before production.**
- Auth URL config: Site URL `http://localhost:3000`; redirect `http://localhost:3000/**`.

## 9. Environment variables required

In `.env.local` (gitignored; template in `.env.local.example`):

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **required** | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required** | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | server-only; later admin tasks. NEVER expose to client |
| `OPENAI_API_KEY` | not yet | first used in a later AI block |

## 10. Commands / environment notes

- **Windows.** Run `node`/`npm`/`npx`/`git` via PowerShell, prepending `$env:ProgramFiles\nodejs` and `$env:ProgramFiles\Git\cmd` (not on the Bash tool's PATH).
- **Next.js 16** — read bundled docs in `node_modules/next/dist/docs/` before relying on framework APIs.
- shadcn CLI doesn't detect Next 16 → add UI components manually.
- Stop any background `next dev` before relaunching (Next 16 refuses a second instance). Stop strays by killing the PID on port 3000.
- **Migrations:** tracked `.sql` files in `supabase/migrations/`, applied manually via the Supabase SQL Editor (no Supabase CLI for now).

## 11. Build / typecheck / test results

- `npx tsc --noEmit` → **clean** (exit 0) after Block 8.
- `npm run build` → **clean**. `/database`, `/upload`, and `/duplicates` dynamic (each resolves auth/workspace at request time); auth pages static.
- **Block 4 smoke test (user-confirmed, real Supabase):** all 8 checks PASS.
- **Block 5 smoke test (user-confirmed, real Supabase + dev seed):** PASS — search/filter/sort/pagination/URL state/workspace isolation/CRUD; brand filter case-insensitive.
- **Block 6 smoke test (user-confirmed, real Supabase):** PASS — upload + in-browser parse, header detection, column mapping (clean semantic headers), review/validation counts, confirmed import, **real cleaned Boumerdes CSV of 64 rows** imported, records appear in `/database`, search + wilaya + brand filters work on imported records, workspace scoping holds, invalid-row handling (bad email + blank company name skipped & shown), dark-mode dropdown readability fixed. (>500-row cap not manually exercised — guarded in code.)
- **Block 7 smoke test (user-confirmed, real Supabase):** PASS (15/15) — Duplicates nav + page load, read-only header/description, scanned-count, no cap warning under 2000, group cards, same-phone across formats, case-insensitive email, normalized website, name+wilaya/city, **name-only control not grouped** (no false positive), **blank-contact controls not grouped**, multi-signal reason badges, Inspect-in-database links filter `/database`, workspace isolation, detection read-only (no record changes).
- **Block 8 smoke test (user-confirmed, real Supabase):** PASS (12/12) — Merge button on groups, sheet opens, survivor/default selection, field-source selection, **preview matches selected sources**, **Cancel writes nothing**, **Confirm updates only the chosen survivor**, losers soft-archived + gone from active `/database`, duplicate group disappears/shrinks on refresh, **SQL check: loser rows still exist with `deleted_at` set**, workspace isolation holds, and no hard delete / no AI / no bulk / no `duplicate_score` write.

## 12. Known bugs or unfinished items

- No known bugs. Limitations by design (deferred):
  - **CSV import is generic only** — raw Google Maps scraper CSVs (non-semantic headers like `hfpxzc href`, `qBF1Pd`) require the user to clean/normalize to semantic headers first. **DEFERRED FUTURE BLOCK: a "Google Maps scraper CSV" preset** that maps known raw column codes by position/pattern (one-click "apply preset" on the mapping step). Not started.
  - **Duplicate detection (Block 7)** is still read-only deterministic detection; it does **not** write `duplicate_score`. Detection is **capped at 2000 active rows/workspace** (full-scale scan deferred) and **excludes address similarity** from v1.
  - **Duplicate merge (Block 8)** now exists on the `/duplicates` groups: **manual, one group at a time** — pick survivor, choose field sources, preview, confirm → survivor UPDATEd + losers soft-archived. By design it has **no auto-merge, no bulk merge, no AI, no `duplicate_score` write, and no Undo/restore/history**. Recovery from a regretted merge is currently **manual via the SQL Editor** (clear `deleted_at` on the archived losers). A **Restore / archive-history UI** is the natural next deferred block (would also re-add the `includeDeleted` option removed in Block 5).
  - **No XLSX import** (CSV only). No AI cleaning, no OCR, no merge UI, no map view. (`duplicate_score`/`latitude`/`longitude` columns exist but are unused — `duplicate_score` is intentionally NOT written by Block 7.) **No import dedupe** — re-importing the same file creates duplicates (by design for now; detection at `/duplicates` surfaces them after the fact).
  - **No restore UI** for archived records (soft-delete works; un-archive deferred). `listBusinesses` always hides `deleted_at` rows (the `includeDeleted` option was removed in Block 5 — re-add when building restore).
  - **Brand filter is canonical-match only** — unknown/odd-cased brands stored *before* Block 5 won't retroactively match a different-cased filter; new/edited records, imports, and the dev seed are canonical.
  - **Invites still deferred** — members are only auto-provisioned on signup; most workspaces have one member.
  - **Member identity:** only the current user's own email resolves (no profiles table).
- Email confirmation off (dev only) — re-enable for prod.
- A background `next dev` server (port 3000) was used for the smoke test — stop it before relaunching.

## 13. Git status summary

- Branch: **main** (tracks `origin/main` on GitHub `salimcodingapps-alt/Amine-proscpects-pannel`). Commits: `92a2354` (Block 1), `c92a059` (Block 2), `36a02b1` (docs), `1feb3c3` (Block 3), `b32d8dd` (Block 4), `53a0a8f` (Block 5), `05461db` (Block 6), `3bb6e0e` (Block 7).
- **Blocks 1–7 committed and pushed** (latest `3bb6e0e`).
- **Block 8 (Safe Manual Duplicate Merge UI) — implemented + smoke-tested (12/12), NOT yet committed.** Working tree:
  - Modified: `src/lib/businesses/types.ts`, `src/lib/businesses/queries.ts`, `src/lib/businesses/actions.ts`, `src/components/business/duplicate-groups.tsx`, `src/app/(app)/duplicates/page.tsx`, `docs/NEXT_HANDOFF.md`.
  - New (untracked): `src/components/business/merge-sheet.tsx`.
  - Also a pre-existing `.claude/settings.local.json` change (local settings, incidental — exclude from the commit).
  - No new migration / no schema / no index / no RPC (Block 8 reuses existing UPDATE paths + RLS).
- **Recommended checkpoint (smoke test passed — safe to commit now):** stage the Block 8 project files (NOT `.claude/settings.local.json`):
  ```
  git add src/lib/businesses/types.ts src/lib/businesses/queries.ts \
    src/lib/businesses/actions.ts src/components/business/merge-sheet.tsx \
    src/components/business/duplicate-groups.tsx "src/app/(app)/duplicates/page.tsx" \
    docs/NEXT_HANDOFF.md
  git commit -m "Block 8: safe manual duplicate merge UI"
  ```
  Then push: `git push origin main`.

## 14. Exact next prompt to paste after `/clear`

> First confirm Block 8 is committed (see §13). If not, commit + push the checkpoint before starting Block 9.

```
Resuming the Automotive BI CRM build after a context reset.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md
- docs/CLAUDE_WORKFLOW.md

Then summarize: current project state, the last completed block (Block 8 — Safe Manual
Duplicate Merge UI), confirm Block 8 is committed + pushed, and propose what Block 9
should cover (candidates: a RESTORE / archive-history UI — un-archive soft-deleted
records, now more valuable since Block 8 archives merge losers, and would re-add the
includeDeleted option removed in Block 5; member invites; the deferred Google Maps
scraper CSV preset; or AI-assisted cleaning/dedupe). Confirm scope with me.

Do NOT write code yet. After summarizing, wait for my confirmation.
When approved, plan Block 9 only. Follow the block-by-block + 100k smart-zone rules.
Standing rule for every NEW table: RLS enabled AND minimal table GRANTs (revoke all
from anon/authenticated, then grant only what's needed). Scope all business data to
workspace_id and reuse the is_workspace_member() helper in policies. No hard delete
unless explicitly approved. If an index/migration/RPC seems needed, stop and ask first.
Any write/restore feature: get explicit approval on exactly what it may modify before
coding, and prefer recoverable (soft) operations.
```
