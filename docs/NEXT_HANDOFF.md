# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-15 — end of Block 3 (Workspace Architecture)._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1, 2, and 3 complete, committed, and validated. App runs against a real Supabase project, is auth-gated end-to-end, and is now multi-tenant: every user is auto-provisioned a workspace, can create/switch workspaces, and manage workspace settings/members. Ready to begin Block 4 in a fresh context.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication), Block 3 (Workspace Architecture).
- **Next up:** **Block 4 — Schema / Business Data** (NOT started; do not start without confirmation). This is where supplier/contact/business-record tables + their RLS land.

## 3. What has been implemented so far

**Block 1 — App Foundation (commit `92a2354`)**
- Next.js **16.2.9** (App Router, Turbopack), React 19, TypeScript, **Tailwind v4**.
- shadcn/ui set up **manually** (CLI doesn't yet detect Next 16) — `button`, `card`, `sheet`, later `input`, `label`.
- Brand dark theme in `globals.css` (gold `#F4C430` primary, `#0A0A0A` background; dark-only).
- App shell: desktop sidebar + mobile drawer (Sheet), shared nav source of truth.
- `(app)` route group: dashboard + database/upload/settings stubs; `/` → `/dashboard`.

**Block 2 — Authentication (commit `c92a059`)**
- Supabase email/password auth via **`@supabase/ssr`** (httpOnly cookie sessions).
- Browser + server clients; middleware session refresh + route protection.
- Server actions: signIn, signUp (`full_name` in `user_metadata`), signOut, requestPasswordReset, updatePassword.
- `(auth)` route group + `/auth/callback`. Server-side auth guard in `(app)/layout.tsx`.

**Block 3 — Workspace Architecture (this block — commit PENDING)**
- **First real DB tables + RLS** (migration `supabase/migrations/0001_workspaces.sql`, applied manually in the Supabase SQL Editor and verified):
  - `workspace_role` enum (`owner | manager | member`).
  - `workspaces`, `workspace_members` (PK = workspace_id+user_id), index on `user_id`.
  - `SECURITY DEFINER` helpers `is_workspace_member(ws)` / `current_user_role(ws)` (hardened `search_path`) — recursion-safe.
  - **RLS enabled on both tables** + policies (select/update/delete; **no client INSERT** by design).
  - **`create_workspace(name)` SECURITY DEFINER RPC** — the ONLY workspace-creation path (does workspace + owner-membership inserts atomically, bypassing RLS; avoids the bootstrap chicken-and-egg).
  - **`handle_new_user()` trigger** on `auth.users` — auto-provisions a default workspace + owner membership on signup (idempotent).
  - **Idempotent backfill** for pre-existing users.
  - **Table GRANTs** (`select, update, delete` to `authenticated`) on both tables — required even with RLS, or queries fail `42501 permission denied`.
- App layer:
  - `src/lib/workspace/{types,queries,actions}.ts` — list/resolve workspaces, members, and the server actions (`createWorkspace` via RPC, `switchWorkspace`, `renameWorkspace`, `updateMemberRole`, `removeMember`). Active workspace is an **httpOnly cookie `active_workspace_id`, always membership-validated server-side (never trusted)**.
  - `src/components/workspace/workspace-switcher.tsx` — sidebar/drawer picker (switch + create), no new deps.
  - `src/components/workspace/workspace-settings.tsx` — rename + members list with owner-only role/remove controls (last owner protected; destructive controls hidden for self).
- **Validated:** full 10-point smoke test passed (provision, create, switch, persist-on-reload, settings, owner role, rename, no self-destruct controls, live Settings update on switch).

## 4. Files created

**Block 3:**
- `supabase/migrations/0001_workspaces.sql`
- `src/lib/workspace/{types,queries,actions}.ts`
- `src/components/workspace/{workspace-switcher,workspace-settings}.tsx`

(See git history for Block 1 & 2 file lists.)

## 5. Files modified (Block 3)

- `src/app/(app)/layout.tsx` (loads workspaces + active, passes to AppShell)
- `src/components/layout/{app-shell,sidebar,mobile-nav}.tsx` (carry workspace data + render switcher)
- `src/app/(app)/settings/page.tsx` (server-fetches members; renders `WorkspaceSettings` with `key={active.id}` so local form state resets on switch)

## 6. Important decisions made

- **Backend:** Supabase (Auth + Database + Storage + RLS). **Geography:** Algeria-first (`wilaya`) but international-capable. **Duplicates:** deterministic first, AI later (Block 9). **Merge:** user picks fields. **Ingestion:** spreadsheets + images share ONE review/import pipeline (OCR deferred). **Audit trail:** created_by/modified_by/timestamps at schema level (Block 4).
- **Auth:** email/password only for MVP; display name in `user_metadata` (no profiles table).
- **Block 3 specifics:**
  - Workspace tables + RLS introduced now (overrode the earlier "no tables until Block 4" note — a workspace is meaningless without tables, and RLS can't wait once there's something to protect).
  - Provisioning via **DB trigger** on `auth.users` (atomic) + idempotent backfill for existing users.
  - **Invites: role structure only.** Full invite/accept flow (pending-invites table, token links, public accept route, email, service-role lookup) is **deferred to a later dedicated block.** No client INSERT policy on `workspace_members` until then.
  - Creation via **`create_workspace` RPC only** — no direct client inserts.
  - **Table GRANTs are mandatory alongside RLS** (lesson learned mid-block).
  - `listMyWorkspaces` uses a **two-step query (no relationship embed)** to avoid PostgREST relationship-cache fragility.

## 7. Supabase / auth configuration assumptions

- Real Supabase project wired via `.env.local` (validated).
- **Migration `0001_workspaces.sql` has been applied** in the SQL Editor and verified (tables, RLS, 3+3 policies, trigger, 4 SECURITY DEFINER functions, backfill → 0 users without a workspace, **table grants applied**).
- **"Confirm email" is DISABLED** in Supabase Auth (dev convenience) → signup logs in immediately + fires the provisioning trigger. **Must be re-enabled before production.**
- Auth URL config: Site URL `http://localhost:3000`; redirect `http://localhost:3000/**`.

## 8. Environment variables required

In `.env.local` (gitignored; template in `.env.local.example`):

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **required** | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required** | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | server-only; later admin tasks. NEVER expose to client |
| `OPENAI_API_KEY` | not yet | first used in Block 7 |

## 9. Commands / environment notes

- **Windows.** Run `node`/`npm`/`npx`/`git` via PowerShell, prepending `$env:ProgramFiles\nodejs` and `$env:ProgramFiles\Git\cmd` (not on the Bash tool's PATH).
- **Next.js 16** — read bundled docs in `node_modules/next/dist/docs/` before relying on framework APIs.
- shadcn CLI doesn't detect Next 16 → add UI components manually.
- Stop any background `next dev` before relaunching (Next 16 refuses a second instance).
- **Migrations:** tracked `.sql` files in `supabase/migrations/`, applied manually via the Supabase SQL Editor (no Supabase CLI for now).

## 10. Build / typecheck / test results

- `npx tsc --noEmit` → **clean** (exit 0).
- `npm run build` → **clean**; 11 routes. `/settings`, `/dashboard`, `/database`, `/upload`, `/auth/callback` dynamic; auth pages static.
- **Block 3 smoke test (user-confirmed, real Supabase):** all 10 checks PASS.

## 11. Known bugs or unfinished items

- No known bugs. Limitations by design (deferred):
  - **No business data yet** (supplier/contact/records tables, audit columns) — Block 4.
  - **Invites deferred** — no way to add another user to a workspace yet; members are only auto-provisioned on signup. Practically every workspace currently has exactly one member (the owner).
  - **Member identity:** only the current user's own email is shown in the members list (no profiles table; anon client can't read other users' auth records). Other members would show as `Member <id-prefix>`. A profiles table / identity resolution is a future concern.
  - `workspaces` has an owner-only DELETE policy as foundation, but there is **no delete-workspace UI** in Block 3.
- Email confirmation off (dev only) — re-enable for prod.
- 2 moderate `npm audit` warnings (transitive, dev-only) — not addressed.
- A background `next dev` server was used for the smoke test — stop it (Ctrl+C / kill the PID) before relaunching.

## 12. Git status summary

- Branch: **main**. Commits: `92a2354` (Block 1), `c92a059` (Block 2), `36a02b1` (docs).
- **Uncommitted (Block 3):** the new `supabase/`, `src/lib/workspace/`, `src/components/workspace/` files; modified `(app)/layout.tsx`, `(app)/settings/page.tsx`, `layout/{app-shell,sidebar,mobile-nav}.tsx`; this handoff doc. Also a pre-existing `.claude/settings.local.json` change (local settings, incidental).
- **Recommended checkpoint:** `git add . && git commit -m "Block 3: workspace architecture"`.

## 13. Exact next prompt to paste after `/clear`

```
Resuming the Automotive BI CRM build after a context reset.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md
- docs/CLAUDE_WORKFLOW.md

Then summarize: current project state, the last completed block (Block 3 — Workspace
Architecture), and what Block 4 (Schema / Business Data) entails.

Do NOT write code yet. After summarizing, wait for my confirmation.
When approved, plan Block 4 only. Follow the block-by-block + 100k smart-zone rules.
Remember: every new table needs RLS AND table GRANTs to `authenticated` from the start
(RLS alone => 42501 permission denied). Scope all business data to workspace_id.
```
