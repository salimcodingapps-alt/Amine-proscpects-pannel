# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-15 — end of Block 5 (Search / Filter / Sort), smoke-tested, awaiting checkpoint commit._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1–5 complete and validated. App runs against a real Supabase project, is auth-gated end-to-end, is multi-tenant (workspaces), has its business-data table (`businesses`) with workspace-scoped RLS + minimal grants, manual CRUD, and now **server-side search / filter / sort / pagination** at `/database`. **Blocks 1–4 are committed (latest `b32d8dd`); Block 5 is implemented + smoke-tested but NOT yet committed** — see §13 for the recommended checkpoint.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication), Block 3 (Workspace Architecture), Block 4 (Schema / Business Data), Block 5 (Search / Filter / Sort — pending checkpoint commit).
- **Next up:** **Block 6 — NOT started; do not start without confirmation.** Likely candidate from the master spec: data ingestion (spreadsheet/image upload → review/import pipeline). Confirm scope with the user before planning.

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

**Block 5 — Search / Filter / Sort (commit PENDING)**
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

(See git history for Block 1–3 file lists; Block 3 files listed in prior handoff revisions.)

## 5. Files modified (Block 5)

- `src/lib/businesses/types.ts` (sort/filter/result types: `BusinessSort`, `BUSINESS_SORTS`, `BUSINESS_PAGE_SIZE`, `BusinessListFilters`, `BusinessListResult`).
- `src/lib/businesses/queries.ts` (`listBusinesses` rewritten for server-side search/filter/sort/pagination; search-term sanitizer; brand canonicalization).
- `src/lib/businesses/actions.ts` (`buildValues` normalizes brands via `normalizeBrandList`).
- `src/components/business/business-manager.tsx` (renders toolbar + pagination; total-count + no-match empty state; CRUD untouched).
- `src/app/(app)/database/page.tsx` (awaits/parses/validates `searchParams`; calls filtered query; passes paging metadata).
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

- `npx tsc --noEmit` → **clean** (exit 0) after Block 5 + brand fix.
- `npm run build` → **clean**; 11 routes. `/database`, `/settings`, `/dashboard`, `/upload`, `/auth/callback` dynamic; auth pages static. (`/database` dynamic is expected — `searchParams` is a request-time API.)
- **Block 4 smoke test (user-confirmed, real Supabase):** all 8 checks PASS.
- **Block 5 smoke test (user-confirmed, real Supabase + dev seed):** PASS — search across all 8 fields, status/wilaya/type/brand filters, all 4 sorts, pagination, URL + refresh/back/forward state, workspace isolation, CRUD-still-works. Brand filter confirmed case-insensitive (`renault`/`Renault`/`bmw`/`mercedes`→Mercedes-Benz/`vw`→Volkswagen) and brand create/edit normalizes casing + de-dups.

## 12. Known bugs or unfinished items

- No known bugs. Limitations by design (deferred):
  - **Ingestion not built** — no spreadsheet/image upload, import, AI cleaning, OCR, duplicate detection, merge UI, or map view yet. (`duplicate_score`/`latitude`/`longitude` columns exist but are unused.) Business data is manual-entry only (search/filter/sort now exist as of Block 5).
  - **No restore UI** for archived records (soft-delete works; un-archive deferred). `listBusinesses` always hides `deleted_at` rows (the `includeDeleted` option was removed in Block 5 — re-add when building restore).
  - **Brand filter is canonical-match only** — unknown/odd-cased brands stored *before* Block 5 won't retroactively match a different-cased filter; new/edited records and the dev seed are canonical.
  - **Invites still deferred** — members are only auto-provisioned on signup; most workspaces have one member.
  - **Member identity:** only the current user's own email resolves (no profiles table).
- Email confirmation off (dev only) — re-enable for prod.
- A background `next dev` server (port 3000) was used for the smoke test — stop it before relaunching.

## 13. Git status summary

- Branch: **main**. Commits: `92a2354` (Block 1), `c92a059` (Block 2), `36a02b1` (docs), `1feb3c3` (Block 3), `b32d8dd` (Block 4).
- **Blocks 1–4 committed** (latest `b32d8dd`).
- **Block 5 (Search / Filter / Sort) — implemented + smoke-tested, NOT yet committed.** Working tree:
  - Modified: `src/lib/businesses/types.ts`, `src/lib/businesses/queries.ts`, `src/lib/businesses/actions.ts`, `src/components/business/business-manager.tsx`, `src/app/(app)/database/page.tsx`, `docs/NEXT_HANDOFF.md`.
  - New (untracked): `src/components/business/business-toolbar.tsx`, `src/components/business/business-pagination.tsx`, `src/lib/businesses/brands.ts`, `supabase/seeds/dev_businesses.sql`.
  - Also a pre-existing `.claude/settings.local.json` change (local settings, incidental).
  - No new migration (Block 5 is query/UI only; the seed is dev-only data, not a migration).
- **Recommended checkpoint (smoke test passed — safe to commit now):**
  ```
  git add .
  git commit -m "Block 5: search / filter / sort"
  ```
  (Consider committing `.claude/settings.local.json` separately or leaving it; it is incidental local settings.)

## 14. Exact next prompt to paste after `/clear`

> First confirm Block 5 is committed (see §13). If not, commit the checkpoint before starting Block 6.

```
Resuming the Automotive BI CRM build after a context reset.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md
- docs/CLAUDE_WORKFLOW.md

Then summarize: current project state, the last completed block (Block 5 — Search /
Filter / Sort), confirm Block 5 is committed, and propose what Block 6 should cover
(likely data ingestion: spreadsheet/image upload → review/import pipeline). Confirm
scope with me.

Do NOT write code yet. After summarizing, wait for my confirmation.
When approved, plan Block 6 only. Follow the block-by-block + 100k smart-zone rules.
Standing rule for every NEW table: RLS enabled AND minimal table GRANTs (revoke all
from anon/authenticated, then grant only what's needed). Scope all business data to
workspace_id and reuse the is_workspace_member() helper in policies. No hard delete
unless explicitly approved. If an index/migration seems needed, stop and ask first.
```
