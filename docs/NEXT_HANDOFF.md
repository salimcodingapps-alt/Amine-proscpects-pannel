# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-25 — **Blocks 1–12 complete, committed, pushed.** Block 12 (Brand logo chips with fallback) is finished, smoke-tested, committed (`Block 12: brand logo chips`) and pushed to `origin/main`. Presentation-only: brand strings on `/database` (desktop Brands column + mobile cards) and `/dashboard` Top brands now render as compact chips. `LOGO_ALLOWLIST` is empty, so every brand currently shows the neutral fallback chip (gold initial on a light tile + name); real local SVG logos can be added later under `public/brand-logos/` and registered in the allowlist to light up automatically. No backend/schema/RLS/grants/RPC/migration/import/dedupe/merge/restore/auth/globals.css/ui-primitive/dependency changes. See §2._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1–9 complete and validated. App runs against a real Supabase project, is auth-gated end-to-end, is multi-tenant (workspaces), has its business-data table (`businesses`) with workspace-scoped RLS + minimal grants, manual CRUD, **server-side search / filter / sort / pagination** at `/database`, **CSV import** (upload → map → review → confirmed bulk insert) at `/upload`, **read-only deterministic duplicate detection** at `/duplicates`, a **safe manual duplicate merge UI** (pick survivor → choose field sources → preview → confirm → update survivor + soft-archive losers) on those `/duplicates` groups, and now a **Restore / Archive UI** at `/database` (Active / Archived toggle → un-archive soft-deleted records one at a time). **Blocks 1–9 are complete, smoke-tested, committed, and pushed (latest `d9abed3`).** Only `.claude/settings.local.json` remains uncommitted (local settings — do not commit). See §13.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication), Block 3 (Workspace Architecture), Block 4 (Schema / Business Data), Block 5 (Search / Filter / Sort), Block 6 (CSV Import), Block 7 (Duplicate Detection — read-only), Block 8 (Safe Manual Duplicate Merge UI), Block 9 (Restore / Archive UI), Block 10 (Database UI/UX polish), Block 11 (Dashboard metrics / CRM overview), Block 12 (Brand logo chips with fallback) — **all committed + pushed.**
- **Block 12 — Brand logo chips with fallback (✅ COMPLETE — smoke-tested, committed as `Block 12: brand logo chips`, pushed).** Replaced the comma-joined brand strings with compact, premium **brand chips** in the VIP TUNING identity. **Presentation-only — NO new tables, migrations, RLS changes, grants, RPC, AI, import logic, duplicate logic, merge logic, `restoreBusiness` logic, auth logic, `queries.ts` dashboard-stats logic, `globals.css`, `src/components/ui/*`, `business-toolbar.tsx`, `nav.ts`, or package/dependency changes.**
  - **What it does:** each brand in `supportedBrands` renders as a chip. When a **local** logo asset is registered, the chip shows the real logo on a small **light rounded tile** (so monochrome/dark marks stay readable on the dark theme); otherwise it shows a **neutral fallback chip** — a gold initial on the same light-tile footprint + the brand name. Overflow is capped (desktop table: first 3 chips on one line + a `+N` chip; mobile cards: first 6, wrapping).
  - **Current behavior:** **`LOGO_ALLOWLIST` is empty**, so EVERY brand currently renders the fallback chip. The feature works end-to-end with **zero asset files**.
  - **Adding real logos later (no code risk):** drop `public/brand-logos/<slug>.svg` (lowercase kebab-case slug matching `brandSlug()`; SVG preferred) AND register that `<slug>` in `LOGO_ALLOWLIST` (`src/lib/businesses/brand-logos.ts`). The chip swaps to the logo automatically. A `<img>` is never rendered for an unregistered slug, so a missing file can't break. `public/brand-logos/README.md` lists the 19 expected filenames (renault, peugeot, citroen, bmw, mercedes-benz, audi, volkswagen, toyota, nissan, hyundai, kia, ford, opel, seat, skoda, dacia, porsche, volvo, land-rover). Logos are used internally / non-commercially. **No remote logo APIs, no runtime fetching, no scraping** (uses a plain `<img>` from `public/`, not `next/image` → no config/dependency change).
  - **Screens updated (only):** `/database` desktop Brands column, `/database` mobile cards, and `/dashboard` Top brands (Top wilayas unchanged — `RankedList` got an optional `renderLabel` prop used only by brands).
  - **Files (new):** `src/lib/businesses/brand-logos.ts` (PURE — `brandSlug`/`brandInitial`/`LOGO_ALLOWLIST`/`brandLogoSrc`; imports/reuses `canonicalizeBrand`, does not modify it), `src/components/business/brand-logo-chip.tsx` (**new** presentational `BrandLogoChip` + `BrandChips` overflow wrapper; no hooks → works in server & client trees), `public/brand-logos/README.md` (**new**). **Files (modified, markup only):** `src/components/business/business-manager.tsx` (table cell + mobile card render `<BrandChips>`; handlers/state/form logic untouched), `src/components/dashboard/dashboard-overview.tsx` (`RankedList` `renderLabel` prop; Top brands uses `<BrandLogoChip>`), `docs/NEXT_HANDOFF.md`.
  - **Verification:** `npx tsc --noEmit` clean (exit 0); `npm run build` clean; `/database` and `/dashboard` stay dynamic `ƒ`. User-confirmed browser smoke test PASSED.
- **Block 11 — Dashboard metrics / CRM overview (✅ COMPLETE — smoke-tested, committed as `Block 11: dashboard metrics overview`, pushed).** Turned the placeholder `/dashboard` (six static `—` cards) into a **real, read-only, workspace-scoped CRM overview** in the VIP TUNING identity. **No new tables, migrations, RLS changes, grants, RPC, AI, import logic, duplicate logic, merge logic, `restoreBusiness` logic, auth logic, or package/dependency changes.**
  - **What it shows:** active total, archived total, the four status counts (new / contacted / qualified / inactive), top wilayas, top supported brands, recently-updated records, and quick links to Database / Upload / Duplicates / Archived view (`/database?view=archived`).
  - **Read-only data strategy:** counts (active total, archived, per-status) are **EXACT** via head-only `count` queries (zero rows transferred); `activeTotal` is derived as the sum of the four status counts (status is a non-null enum). **Top wilayas / top brands use capped app-side aggregation over the first 2000 active records** (`DASHBOARD_TOP_SCAN_CAP = 2000`) — one read selecting only `wilaya, supported_brands`, aggregated in memory (wilayas grouped case-insensitively; brands canonicalized via the existing `canonicalizeBrand`). When the cap is hit the UI shows a *"based on the first N active records — may be incomplete"* note. Recently-updated = `order(updated_at desc).limit(5)`. All reads run in parallel via `Promise.all`. **No index/RPC/view** — exact top-N at large scale was explicitly deferred (would need an RPC or SQL view → stop and ask).
  - **Files touched (only):** `src/app/(app)/dashboard/page.tsx` (rewritten as an async server component mirroring `/database`'s auth + workspace resolution; no-workspace → `Placeholder`), `src/lib/businesses/queries.ts` (added read-only `getWorkspaceDashboardStats` + private helpers — **no existing query modified**), `src/lib/businesses/types.ts` (additive types `ValueCount`, `StatusCounts`, `WorkspaceDashboardStats` only), `src/components/dashboard/dashboard-overview.tsx` (**new** presentational component — reuses `Card` + `StatusBadge`, no `globals.css`/`ui/*` change), and `docs/NEXT_HANDOFF.md`.
  - **NOT changed (verified):** `actions.ts`, `validation.ts`, `duplicates.ts`, `brands.ts`, all `business-*` / `merge-sheet` / `duplicate-groups` components, `nav.ts` (quick links are plain `<Link>`s), `globals.css`, `src/components/ui/*`, migrations/RLS/grants/RPC/schema, and all import/dedupe/merge/restore/auth logic. (`canonicalizeBrand` from `brands.ts` is **imported/reused**, not modified.)
  - **Verification:** `npx tsc --noEmit` clean (exit 0); `npm run build` clean; **`/dashboard` is now dynamic `ƒ`** (was static — it resolves auth/workspace + metrics at request time, like `/database`). User-confirmed browser smoke test PASSED.
- **Block 10 — Database UI/UX polish (✅ COMPLETE — smoke-tested, committed as `Block 10: database UI polish`, pushed).** This was a **presentation-only** block: improve the look/feel/UX of the `/database` experience using the **Refero design MCP for inspiration only** (researched modern CRM/database UX patterns — Attio / Linear / Rox dark-CRM references; nothing copied). The user explicitly chose this over the deferred Google Maps CSV preset / member invites / AI work, and wanted Refero specifically. **Plan/research history retained in the sub-bullets below; the as-shipped summary follows the invariants bullet.**
  - **Refero MCP status:** added to project local config via `claude mcp add --transport http refero https://api.refero.design/mcp --header "Authorization: Bearer <token>"` (written to `C:\Users\Shadow\.claude.json`, project-scoped). **Its tools were NOT live in the session where it was added** — Claude Code loads MCP servers at startup, so a **restart is required** (a one-time trust prompt for the new server may appear on relaunch). If a Refero tool still isn't available after restart, check `claude mcp list` / re-add.
  - **Block 10 STRICT constraints (from the user):** NO new tables, migrations, RLS changes, grants, RPC, AI feature work, import-logic changes, duplicate-detection logic changes, merge-logic changes, and **no `restoreBusiness` logic changes unless a UI bug directly requires it**. No Block 11 work. Do not commit or push until told.
  - **Research targets (Refero, inspiration only):** database list layouts; filter/search bars; Active/Archived toggles; record cards or tables; action buttons; empty states; restore/archive flows; mobile CRM layouts.
  - **Likely files (database UI only):** `src/components/business/business-manager.tsx` (list/cards/action buttons/empty states/count/form layout — **markup/className only; leave all handlers, state, props, and server-action calls intact**), `src/components/business/business-toolbar.tsx` (filter bar + Active/Archived control — **do NOT touch the `lastPushedRef` URL-sync/debounce/commit logic or the `q/status/wilaya/type/brand/sort/page/view` param contract**), `src/components/business/business-pagination.tsx` (pager styling; keep `goTo`/URL logic), `src/app/(app)/database/page.tsx` (header/description/container; keep `searchParams`/query logic). **Flag before touching anything app-wide:** `src/components/layout/{page-header,placeholder}.tsx`, shared `src/components/ui/*` primitives, and `src/app/globals.css` theme tokens — prefer per-call-site classes + small local presentational components in `components/business/` over editing shared files. No new dependency.
  - **Approved checklist:** (1) research patterns via Refero; (2) polish filter/search bar + Active/Archived segmented control + Clear affordance; (3) record list hierarchy/spacing (optional desktop table / mobile cards — presentation only); (4) clearer action-button affordances (distinguish Archive from Edit/Restore); (5) friendlier empty states for the 3 existing branches (no records / no match / no archived); (6) restore/archive flow polish — **keep the restore confirm wording**: *"This restores the archived business as an active record. It does not undo changes made to any merge survivor."*; (7) pagination styling; (8) responsive/mobile pass; (9) verify `tsc --noEmit` + `npm run build` clean and behavior unchanged (search/filter/sort/page/toggle/restore); (10) stop for the user's smoke test — no commit/push.
  - **Invariants to preserve:** the toolbar typing-stability fix (`lastPushedRef`), the Active/Archived behavior + URL param contract, remount keys, and `/database` staying dynamic `ƒ`. NOTE (unchanged): Block 9 restore is single-record only and is NOT a merge undo; no merge history / audit log exists.
  - **✅ AS SHIPPED (Block 10):**
    - **Desktop = table-style business list** (columns: Business · Brands · Type · Wilaya · Status · Updated · Actions) in a rounded, elevated container with a gold left-accent **on row hover only** (inset shadow — purely visual, NO real selection state). **Mobile = cards** (switch at the `md` breakpoint). Both render the same `businesses` array via the same handlers.
    - **New `src/components/business/status-badge.tsx`** — color-codes the **existing** four statuses only (new = gold, contacted = blue, qualified = green, inactive = gray) as ring-pills. **No new status types, no new DB field.**
    - **Balanced toolbar (chosen direction):** compact, right-aligned "Quick find…" search (deliberately not dominant); the **filters are the main discovery controls**; the **Active / Archived** segmented toggle stays clearly on the left.
    - **`Add business` (gold) and `Import CSV` are prominent full-size actions.** **Import CSV is a simple `<Link href="/upload">`** — no import logic touched, no new route.
    - Compact Edit / Archive / Restore row actions with hover affordances; friendlier empty states for the 3 branches; **Restore confirm wording unchanged**: *"This restores the archived business as an active record. It does not undo changes made to any merge survivor."*
    - **Files touched (only):** `business-manager.tsx`, `business-toolbar.tsx`, `business-pagination.tsx`, `status-badge.tsx` (new), and `docs/NEXT_HANDOFF.md`. **`src/app/(app)/database/page.tsx` was NOT modified.** No new dependency; `globals.css` and `src/components/ui/*` untouched.
    - **NOT changed (verified):** no backend, database, RLS, grants, RPC, migration, import logic, duplicate logic, merge logic, or `restoreBusiness` logic.
    - **Brand logos: NOT implemented** — remain a future possible UI enhancement (feasible from existing `supportedBrands` via bundled local SVGs + an initial-chip fallback, no DB change; deferred — do not add logo files / icon packages / remote logo APIs without a new scope).
    - **Rollback patches on the Desktop (not in git):** `block10-ui-table-v1.patch` (first table pass) and `block10-ui-table-balanced.patch` (the shipped balanced version). Restore either with `git apply "<path>"`.
    - **Verification:** `npx tsc --noEmit` clean (exit 0); `npm run build` clean; `/database` stays dynamic `ƒ`. User-confirmed browser smoke test PASSED.
- **Next up:** **Block 13 — not yet scoped.** Deferred backlog: Google Maps scraper CSV preset, member invites, AI cleaning/OCR, bulk restore, merge history / field-level merge undo. **Block 12 follow-up:** add the real local brand-logo SVGs under `public/brand-logos/` and register their slugs in `LOGO_ALLOWLIST` (no code change needed beyond the manifest); chips in forms / import review / merge sheet remain a deferred presentation enhancement. Dashboard follow-ups (deferred): exact top-N at scale (needs an RPC/SQL view → stop and ask), date-range / trend metrics, clickable status cards that deep-link into `/database?status=…`.

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

**Block 9 — Restore / Archive UI (commit `d9abed3`)**
- **Restore (un-archive) of soft-deleted records**, surfaced as an **Active / Archived toggle** on the existing `/database` page. Closes the "bad-merge recovery = SQL Editor" gap from Block 8 and re-adds the `includeDeleted` capability removed in Block 5. **Pure app-layer change — NO migration, NO RLS/policy/grant change, NO new table, NO index, NO RPC, NO new dependency, NO new shadcn component, NO new route.**
- **No schema/RLS work was needed because `0002_businesses.sql` was already designed for it:** the SELECT policy returns soft-deleted rows to members ("so edit/restore remains possible"), the UPDATE policy's `USING` is membership-only (NOT restricted to `deleted_at IS NULL`), and `UPDATE` is already granted. So restoring (an `UPDATE` that clears `deleted_at`) is permitted by the existing policies.
- **View model:** **Active view is the default** (unchanged — lists `deleted_at IS NULL`). **Archived view is `?view=archived`** and lists **only archived records (`deleted_at IS NOT NULL`)**. The toggle preserves current search/filters and resets the page; "Clear filters" stays in the current view. Search / filter / sort / pagination are **reused** in both views.
- **Server action `restoreBusiness(workspaceId, id)`** (in `actions.ts`), the mirror of `archiveBusiness`: validates UUIDs → `getUser()` → `UPDATE … SET deleted_at = null, modified_by = auth.uid()` guarded by `id` + `workspace_id` + `deleted_at IS NOT NULL`, with `.select("id")` to confirm a row was hit (an already-active / foreign / missing row aborts cleanly with an error). **One record at a time — no bulk restore.** RLS is still the backstop (membership + `modified_by = auth.uid()`).
- **Restore is NOT a merge undo.** It only reactivates the archived record; it does NOT restore fields overwritten on a merge survivor. The confirmation dialog says exactly this: *"This restores the archived business as an active record. It does not undo changes made to any merge survivor."*
- **Query layer:** `listBusinesses` gained an optional `filters.archived` flag — when true it applies `.not("deleted_at", "is", null)` instead of `.is("deleted_at", null)`; everything else (workspace scope, search, filters, sort, pagination, count) is unchanged. `Business` now carries `deletedAt` (added to `BUSINESS_COLUMNS`/`BusinessRow`/`mapRow`); `listActiveBusinessesForDedup` and `getActiveBusinessesByIds` stay active-only and untouched.
- **UI:** `business-manager.tsx` takes an `archived` prop — in Archived view it renders **Restore** (with a `window.confirm`) instead of Edit/Archive, **hides the Add-business form**, and uses archived-aware count/empty-state copy. `business-toolbar.tsx` adds the Active/Archived toggle (writes `view`).
- **Input-state bug found + patched before commit (in `business-toolbar.tsx`).** Symptom: characters occasionally disappeared while typing in the search/filter inputs. Cause: the URL→local re-sync `useEffect` fired on *every* `searchParams` change — including the toolbar's own debounced `router.push` — so a self-caused URL update landing mid-typing echoed a stale value back and overwrote newer keystrokes. Fix: a `lastPushedRef` records the exact query string the toolbar pushes (in `commit`/`clearAll`); the sync effect early-returns when the incoming `searchParams` equals it, so it re-syncs ONLY on genuinely external changes (back/forward, Clear, view toggle) — never during the user's own typing. Local React state stays authoritative while typing. Re-tested PASS.
- **Validated:** Block 9 smoke test PASSED against real Supabase — Active/Archived toggle, archived list shows soft-deleted rows (incl. Block 8 merge losers), search/filter/sort/pagination work in Archived, **Restore** returns a record to Active (and a restored merge-loser reappears in `/database`), confirmation wording correct, Cancel writes nothing, Add-business hidden in Archived, workspace isolation holds, no hard delete — plus the typing-stability patch retested. `tsc --noEmit` + `npm run build` clean (`/database` stays dynamic `ƒ`).

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

**Block 9:** *(no new files — pure modifications of existing files; see §5.)*

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

**Block 9:**
- `src/lib/businesses/types.ts` (added `deletedAt: string | null` to `Business`; added optional `archived?: boolean` to `BusinessListFilters`).
- `src/lib/businesses/queries.ts` (selected `deleted_at` → `BUSINESS_COLUMNS`/`BusinessRow`/`mapRow`; `listBusinesses` applies the active-vs-archived `deleted_at` filter based on `filters.archived`. Dedup/merge queries untouched).
- `src/lib/businesses/actions.ts` (added `restoreBusiness`; existing create/update/archive/import/merge untouched).
- `src/app/(app)/database/page.tsx` (parses `?view=archived`, passes `archived` to the query + `<BusinessManager>`; remount key includes the view).
- `src/components/business/business-toolbar.tsx` (Active/Archived toggle; `view` added to owned params; **input-state typing bug patched** — `lastPushedRef` gates the URL→local sync so self-caused commits don't overwrite active typing).
- `src/components/business/business-manager.tsx` (`archived` prop → Restore instead of Edit/Archive, hides Add-business form, archived-aware copy; `restoreBusiness` + confirm dialog).
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
- **Block 9 specifics:**
  - **Restore is a pure app-layer feature — no migration/RLS/grant/RPC/table/index.** The `0002` schema already permits it (SELECT returns archived rows to members; UPDATE `USING` is membership-only, not `deleted_at IS NULL`-gated; `UPDATE` granted). This satisfied the "stop and ask before any migration" rule — none was required.
  - **Active view stays the default; Archived view is `?view=archived`** (lists `deleted_at IS NOT NULL`). The Archived view reuses the same search/filter/sort/pagination via a single optional `filters.archived` flag on `listBusinesses` (default false = active, unchanged).
  - **Restore = clear `deleted_at` + set `modified_by`, one record at a time.** Guarded by `deleted_at IS NOT NULL` + `.select("id")` so only an actually-archived in-workspace row is affected. **No bulk restore, no hard delete.**
  - **Restore is explicitly NOT a merge undo** — it reactivates the record but does not restore overwritten survivor fields. The confirm dialog states this. A real merge history / field-level undo remains a future block (would need a new table → stop and ask).
  - **Restore requires confirmation** (`window.confirm`), same pattern as Archive.
  - **Toolbar typing-stability invariant:** local React state is authoritative for text inputs while typing; the URL→local sync must only run on EXTERNAL navigation (back/forward, Clear, view toggle), never on the toolbar's own debounced commit. Enforced via `lastPushedRef` in `business-toolbar.tsx`. (Regression guard: if you change how the toolbar pushes the URL, keep `lastPushedRef` in sync or typing will eat characters again.)

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

- `npx tsc --noEmit` → **clean** (exit 0) after Block 9.
- `npm run build` → **clean**. `/database`, `/upload`, and `/duplicates` dynamic (each resolves auth/workspace at request time); auth pages static.
- **Block 4 smoke test (user-confirmed, real Supabase):** all 8 checks PASS.
- **Block 5 smoke test (user-confirmed, real Supabase + dev seed):** PASS — search/filter/sort/pagination/URL state/workspace isolation/CRUD; brand filter case-insensitive.
- **Block 6 smoke test (user-confirmed, real Supabase):** PASS — upload + in-browser parse, header detection, column mapping (clean semantic headers), review/validation counts, confirmed import, **real cleaned Boumerdes CSV of 64 rows** imported, records appear in `/database`, search + wilaya + brand filters work on imported records, workspace scoping holds, invalid-row handling (bad email + blank company name skipped & shown), dark-mode dropdown readability fixed. (>500-row cap not manually exercised — guarded in code.)
- **Block 7 smoke test (user-confirmed, real Supabase):** PASS (15/15) — Duplicates nav + page load, read-only header/description, scanned-count, no cap warning under 2000, group cards, same-phone across formats, case-insensitive email, normalized website, name+wilaya/city, **name-only control not grouped** (no false positive), **blank-contact controls not grouped**, multi-signal reason badges, Inspect-in-database links filter `/database`, workspace isolation, detection read-only (no record changes).
- **Block 8 smoke test (user-confirmed, real Supabase):** PASS (12/12) — Merge button on groups, sheet opens, survivor/default selection, field-source selection, **preview matches selected sources**, **Cancel writes nothing**, **Confirm updates only the chosen survivor**, losers soft-archived + gone from active `/database`, duplicate group disappears/shrinks on refresh, **SQL check: loser rows still exist with `deleted_at` set**, workspace isolation holds, and no hard delete / no AI / no bulk / no `duplicate_score` write.
- **Block 9 smoke test (user-confirmed, real Supabase):** PASS — Active/Archived toggle, Archived lists soft-deleted rows (incl. Block 8 merge losers), search/filter/sort/pagination in Archived, **Restore** returns a record to Active (restored merge-loser reappears in `/database`), confirm wording correct, Cancel writes nothing, Add-business hidden in Archived, workspace isolation. **Plus the toolbar typing-stability patch retested PASS** (no characters dropped while typing in search/wilaya/type/brand inputs; toggle + Clear + restore all still work).

- No known bugs. Limitations by design (deferred):
  - **CSV import is generic only** — raw Google Maps scraper CSVs (non-semantic headers like `hfpxzc href`, `qBF1Pd`) require the user to clean/normalize to semantic headers first. **DEFERRED FUTURE BLOCK: a "Google Maps scraper CSV" preset** that maps known raw column codes by position/pattern (one-click "apply preset" on the mapping step). Not started.
  - **Duplicate detection (Block 7)** is still read-only deterministic detection; it does **not** write `duplicate_score`. Detection is **capped at 2000 active rows/workspace** (full-scale scan deferred) and **excludes address similarity** from v1.
  - **Duplicate merge (Block 8)** exists on the `/duplicates` groups: **manual, one group at a time** — pick survivor, choose field sources, preview, confirm → survivor UPDATEd + losers soft-archived. By design it has **no auto-merge, no bulk merge, no AI, no `duplicate_score` write**. Merge losers can now be reactivated via the Block 9 Restore UI, BUT restore is **not a merge undo** — it does not restore fields overwritten on the survivor. Full field-level merge undo / merge history is still deferred (would need a new table → stop and ask).
  - **No XLSX import** (CSV only). No AI cleaning, no OCR, no merge UI, no map view. (`duplicate_score`/`latitude`/`longitude` columns exist but are unused — `duplicate_score` is intentionally NOT written by Block 7.) **No import dedupe** — re-importing the same file creates duplicates (by design for now; detection at `/duplicates` surfaces them after the fact).
  - **Restore UI shipped in Block 9** — archived records can be un-archived one at a time from the `/database` Archived view (`?view=archived`). `listBusinesses` now takes an optional `archived` flag (re-adds the `includeDeleted` capability removed in Block 5); the default remains active-only. Still **no bulk restore** and **no merge-undo / merge history**.
  - **Brand filter is canonical-match only** — unknown/odd-cased brands stored *before* Block 5 won't retroactively match a different-cased filter; new/edited records, imports, and the dev seed are canonical.
  - **Invites still deferred** — members are only auto-provisioned on signup; most workspaces have one member.
  - **Member identity:** only the current user's own email resolves (no profiles table).
- Email confirmation off (dev only) — re-enable for prod.
- A background `next dev` server (port 3000) was used for the smoke test — stop it before relaunching.

## 13. Git status summary

- Branch: **main** (tracks `origin/main` on GitHub `salimcodingapps-alt/Amine-proscpects-pannel`). Commits: `92a2354` (Block 1), `c92a059` (Block 2), `36a02b1` (docs), `1feb3c3` (Block 3), `b32d8dd` (Block 4), `53a0a8f` (Block 5), `05461db` (Block 6), `3bb6e0e` (Block 7), `be07fbd` (Block 8), `d9abed3` (Block 9), `3038111` (docs), plus the **Block 10** commit (`Block 10: database UI polish`) on top.
- **Blocks 1–10 are complete, smoke-tested, committed, and pushed.** Block 10 (database UI polish) sits on top of Block 9 (`d9abed3`). Local `HEAD` == `origin/main`.
- Block 9 was all modifications — no new files: `src/lib/businesses/types.ts`, `src/lib/businesses/queries.ts`, `src/lib/businesses/actions.ts`, `src/components/business/business-toolbar.tsx`, `src/components/business/business-manager.tsx`, `src/app/(app)/database/page.tsx`, `docs/NEXT_HANDOFF.md`. No new migration / schema / RLS / grant / index / RPC (reused existing UPDATE paths + RLS).
- **Only `.claude/settings.local.json` remains uncommitted** (local settings — do NOT commit). Never stage `.env.local` (gitignored).
- **No pending checkpoint** — the working tree is clean apart from that local settings file. Next work is Block 11 (not yet scoped).
- **Block 10 rollback patches (Desktop, not in git):** `block10-ui-table-v1.patch` (first table pass) and `block10-ui-table-balanced.patch` (shipped balanced version). Restore via `git apply "<path>"`.

## 14. Exact next prompt to paste after the restart (resuming Block 10)

> Block 10 is already scoped + approved (see §2). The restart was to load the Refero design MCP. After relaunch, approve any Refero trust prompt, then confirm a Refero tool is available (e.g. `claude mcp list` shows `refero`, or a Refero tool appears) BEFORE doing design research.

```
Resuming the Automotive BI CRM build after restarting Claude Code to load the Refero MCP.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md  (Block 10 scope + checklist is in §2)
- docs/CLAUDE_WORKFLOW.md

Then: confirm the Refero MCP is connected and a Refero tool is callable. Verify repo state
(git log --oneline -5, git status --short) — expect HEAD 3038111, only
.claude/settings.local.json modified locally, nothing to commit.

Block 10 = Database UI/UX polish ONLY, using Refero for inspiration (do NOT copy any design
exactly). Honor the §2 STRICT constraints: no tables/migrations/RLS/grants/RPC/AI/import/
dedupe/merge changes; no restoreBusiness logic changes unless a UI bug requires it; no
Block 11 work; do not commit or push until I say so. Preserve the toolbar lastPushedRef
typing-stability fix, the Active/Archived URL param contract, and /database staying dynamic.

Start by using Refero to research the §2 target patterns, summarize the pattern notes, then
work the approved checklist. Wait for my confirmation before editing files.
```
