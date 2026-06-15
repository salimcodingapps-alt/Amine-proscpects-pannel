# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-15 — end of Block 4 (Schema / Business Data)._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1–4 complete, validated. App runs against a real Supabase project, is auth-gated end-to-end, is multi-tenant (workspaces), and now has its **first business-data table** (`businesses`) with workspace-scoped RLS + grants and a working manual CRUD UI at `/database`. Block 4 is implemented and smoke-tested but **not yet committed** (see §12). Ready to commit Block 4, then begin Block 5 in a fresh context.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication), Block 3 (Workspace Architecture), Block 4 (Schema / Business Data).
- **Next up:** **Block 5 — NOT started; do not start without confirmation.** Scope to be confirmed with the user. Likely candidates from the master spec: data ingestion (spreadsheet upload → review/import pipeline) or search/filter UX over the `businesses` table. Decide with the user before planning.

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

**Block 4 — Schema / Business Data (this block — commit PENDING)**
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

## 4. Files created

**Block 4:**
- `supabase/migrations/0002_businesses.sql`
- `src/lib/businesses/{types,queries,actions}.ts`
- `src/components/business/business-manager.tsx`

(See git history for Block 1–3 file lists; Block 3 files listed in prior handoff revisions.)

## 5. Files modified (Block 4)

- `src/app/(app)/database/page.tsx` (replaced the placeholder; server-fetches businesses for the active workspace and renders `BusinessManager`).
- `docs/NEXT_HANDOFF.md` (this file).

## 6. Important decisions made

- **Backend:** Supabase (Auth + Database + Storage + RLS). **Geography:** Algeria-first (`wilaya`) but international-capable. **Duplicates:** deterministic first, AI later. **Merge:** user picks fields. **Ingestion:** spreadsheets + images share ONE review/import pipeline (OCR deferred). **Audit trail:** created_by/modified_by/timestamps at schema level (done in Block 4).
- **Auth:** email/password only for MVP; display name in `user_metadata` (no profiles table).
- **Block 4 specifics:**
  - **One core table named `businesses`** (not `suppliers`) — the CRM holds suppliers, importers, wholesalers, garages, retailers, prospects, etc. `business_type` is **free text** for now (no enum/table).
  - **All workspace members** can create/view/update/soft-delete records (CRUD is membership-gated, **not** role-gated).
  - **Soft delete only** (`deleted_at`) — no hard-delete grant or policy. The app hides archived rows by default; `listBusinesses({ includeDeleted: true })` can surface them later (no restore UI yet — deferred).
  - **Standard client INSERT** (no RPC needed — no workspace-bootstrap chicken-and-egg like Block 3). RLS `with check` enforces membership + non-forgeable authorship.
- **Block 4 lesson — table GRANTs must be tightened, not just added:** Supabase ships `ALTER DEFAULT PRIVILEGES` that grant **ALL** on new `public` tables to `authenticated` (incl. `REFERENCES`/`TRIGGER`/`TRUNCATE`). A bare additive `grant select, insert, update` leaves those in place. **Pattern:** `revoke all on table <t> from anon, authenticated;` then `grant <minimal> to authenticated;`. Verify with `information_schema.role_table_grants` (expect exactly the intended privileges; `anon` should have 0 rows). This refines the Block 3 lesson ("RLS needs grants") — the grant must also be *minimal*.

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

- `npx tsc --noEmit` → **clean** (exit 0).
- `npm run build` → **clean**; 11 routes. `/database`, `/settings`, `/dashboard`, `/upload`, `/auth/callback` dynamic; auth pages static.
- **Block 4 smoke test (user-confirmed, real Supabase):** all 8 checks PASS.

## 12. Known bugs or unfinished items

- No known bugs. Limitations by design (deferred):
  - **Business data is manual-entry only** — no spreadsheet/image upload, import, AI cleaning, OCR, duplicate detection, merge UI, advanced search/filter, or map view yet. (`duplicate_score`/`latitude`/`longitude` columns exist but are unused.)
  - **No restore UI** for archived records (soft-delete works; un-archive deferred).
  - **Invites still deferred** — members are only auto-provisioned on signup; most workspaces have one member.
  - **Member identity:** only the current user's own email resolves (no profiles table).
- Email confirmation off (dev only) — re-enable for prod.
- A background `next dev` server (port 3000) was used for the smoke test — stop it before relaunching.

## 13. Git status summary

- Branch: **main**. Commits: `92a2354` (Block 1), `c92a059` (Block 2), `36a02b1` (docs), `1feb3c3` (Block 3).
- **Uncommitted (Block 4):** new `supabase/migrations/0002_businesses.sql`, `src/lib/businesses/`, `src/components/business/`; modified `src/app/(app)/database/page.tsx` and this handoff doc. Also a pre-existing `.claude/settings.local.json` change (local settings, incidental).
- **Recommended checkpoint:** `git add . && git commit -m "Block 4: schema / business data"`.

## 14. Exact next prompt to paste after `/clear`

```
Resuming the Automotive BI CRM build after a context reset.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md
- docs/CLAUDE_WORKFLOW.md

Then summarize: current project state, the last completed block (Block 4 — Schema /
Business Data), and propose what Block 5 should cover (confirm scope with me).

Do NOT write code yet. After summarizing, wait for my confirmation.
When approved, plan Block 5 only. Follow the block-by-block + 100k smart-zone rules.
Remember the standing rule for every new table: RLS enabled AND minimal table GRANTs
(revoke all from anon/authenticated, then grant only what's needed). Scope all business
data to workspace_id and reuse the is_workspace_member() helper in policies.
```
