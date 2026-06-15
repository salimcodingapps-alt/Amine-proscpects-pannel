# NEXT HANDOFF

> Single source of truth for resuming work after `/clear`. Read this, `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE_WORKFLOW.md` before doing anything.

_Last updated: 2026-06-15 — end of Block 2 (Authentication)._

---

## 1. Current project status

**Automotive Business Intelligence CRM** — a multi-tenant, AI-native web app to upload messy automotive supplier data (spreadsheets/images), have AI clean + dedupe + brand-tag it, and let teams search/manage it. Built block-by-block per the master spec.

**Status:** Blocks 1 and 2 complete, committed, and validated. App runs and is auth-gated end-to-end against a real Supabase project. Ready to begin Block 3 in a fresh context.

## 2. Current block

- **Completed:** Block 1 (App Foundation), Block 2 (Authentication).
- **Next up:** **Block 3 — Workspace Architecture** (NOT started; do not start without confirmation).

## 3. What has been implemented so far

**Block 1 — App Foundation (commit `92a2354`)**
- Next.js **16.2.9** (App Router, Turbopack), React 19, TypeScript, **Tailwind v4**.
- shadcn/ui set up **manually** (CLI doesn't yet detect Next 16) — `button`, `card`, `sheet`.
- Brand dark theme (spec color system) as Tailwind v4 tokens in `globals.css`. Gold `#F4C430` = primary, `#0A0A0A` background. Dark-only (`dark` class on `<html>`).
- App shell: desktop left **sidebar** + **mobile drawer** (Sheet), shared nav source of truth.
- `(app)` route group: dashboard (placeholder stat cards), database/upload/settings stubs. `/` redirects to `/dashboard`.

**Block 2 — Authentication (commit `c92a059`)**
- Supabase email/password auth via **`@supabase/ssr`** (cookie sessions).
- Browser + server Supabase clients; middleware session refresh + route protection.
- Server actions: signIn, signUp (stores `full_name` in `user_metadata`), signOut, requestPasswordReset, updatePassword (all input-validated).
- `(auth)` route group: login, signup, reset-password, update-password pages + forms.
- `/auth/callback` route handler (exchanges email-link code for session).
- Server-side auth guard in `(app)/layout.tsx` + friendly "Supabase not configured" screen.
- Sidebar/mobile drawer show signed-in user + Log out.
- **No database tables, no RLS yet** (deferred to Block 4).

## 4. Files created

**Block 1:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/(app)/layout.tsx`, `src/app/(app)/{dashboard,database,upload,settings}/page.tsx`, `src/components/ui/{button,card,sheet}.tsx`, `src/components/layout/{sidebar,mobile-nav,nav-links,app-shell,brand-mark,page-header,placeholder}.tsx`, `src/lib/{utils,nav}.ts`, `components.json`, `.env.local.example`.

**Block 2:**
- `middleware.ts` (root)
- `src/lib/supabase/{env,client,server,middleware}.ts`
- `src/lib/auth/actions.ts`
- `src/app/auth/callback/route.ts`
- `src/app/(auth)/layout.tsx` + `src/app/(auth)/{login,signup,reset-password,update-password}/page.tsx`
- `src/components/auth/{auth-form,login-form,signup-form,reset-password-form,update-password-form}.tsx`
- `src/components/layout/user-menu.tsx`
- `src/components/ui/{input,label}.tsx`

**This handoff step:** `docs/NEXT_HANDOFF.md`, `docs/CLAUDE_WORKFLOW.md`.

## 5. Files modified

- **Block 2:** `src/app/(app)/layout.tsx` (auth guard + `force-dynamic` + not-configured screen), `src/components/layout/{app-shell,sidebar,mobile-nav}.tsx` (carry `user`), `src/app/layout.tsx` & `brand-mark.tsx` (app name "Automotive BI CRM"), `package.json` (+`@supabase/supabase-js`, `@supabase/ssr`).
- **This handoff step:** `.gitignore` (ignore dev-server runtime artifacts).

## 6. Important decisions made

- **Backend:** Supabase for Auth + Database + Storage + RLS.
- **Geography:** Algeria-first (`wilaya` field) but international-capable.
- **Duplicates:** deterministic first, AI scoring later (Block 9).
- **Merge:** user picks which fields to keep.
- **Ingestion:** spreadsheets + images must share ONE review/import pipeline (design from the start; OCR itself deferred).
- **Audit trail:** `created_by` / `modified_by` / timestamps / changed-fields on records (schema-level, Block 4).
- **Auth specifics:** email/password only (no OAuth) for MVP; display name in `auth.user_metadata` (no profiles table); RLS deferred to Block 4 (nothing to protect yet).
- **Sessions:** httpOnly cookies via `@supabase/ssr` `getAll`/`setAll` adapter + Next 16 async `cookies()`.
- **Route protection:** middleware (primary) + server-side `getUser()` guard in `(app)/layout.tsx` (defense in depth). `/update-password` is public-reachable AND exempt from the authed→dashboard redirect (recovery session needs it).

## 7. Supabase / auth configuration assumptions

- A real Supabase project exists and is wired via `.env.local` (validated working).
- **"Confirm email" is DISABLED** in Supabase Auth (dev convenience) → signup logs in immediately. **Must be re-enabled before production.**
- Auth → URL Configuration: Site URL `http://localhost:3000`; redirect `http://localhost:3000/**`.
- Password-reset emails use Supabase's built-in (rate-limited) mailer unless SMTP is configured.

## 8. Environment variables required

In `.env.local` (gitignored; template in `.env.local.example`):

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **required now** | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required now** | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | optional now | server-only; for later admin tasks. NEVER expose to client |
| `OPENAI_API_KEY` | not yet | first used in Block 7 |

## 9. Commands already run

- Installed Node LTS (v24.16.0) via `winget` — already on User PATH; new terminals have `node`/`npm`.
- `create-next-app` (scaffolded in a temp dir then moved, because the working-dir name has a space → invalid npm package name; internal package name is `automotive-bi-crm`).
- `npm install` + added: shadcn deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `tw-animate-css`), Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- `npm run dev`, `npm run build`, `npx tsc --noEmit`.
- `git init`; commits `92a2354`, `c92a059`.

**Note on environment:** Node/npm/npx and git are NOT on the Bash tool's PATH; run them via PowerShell, prepending `$env:ProgramFiles\nodejs` and `$env:ProgramFiles\Git\cmd`. shadcn CLI doesn't detect Next 16 → add UI components manually.

## 10. Build / typecheck / test results

- `npx tsc --noEmit` → **clean** (exit 0).
- `npm run build` → **clean**; 11 routes. Static: `/`, `/login`, `/signup`, `/reset-password`, `/update-password`. Dynamic: `/dashboard`, `/database`, `/settings`, `/upload`, `/auth/callback`. Middleware active.
- Automated smoke test (throwaway fake env): auth pages render 200; all protected routes 307-redirect when unauthenticated.
- **Real-Supabase validation (user-confirmed):** signup, login, logout, session persistence, protected routes, dashboard access all working.

## 11. Known bugs or unfinished items

- No real bugs known. Limitations by design (deferred to later blocks): no DB tables/RLS, no workspaces, no business records, no upload/AI/OCR/duplicates, no activity log.
- Email confirmation off (dev only) — re-enable for prod.
- 2 moderate `npm audit` warnings (transitive, dev-only) — not addressed.
- A background `next dev` server may still be running (PID was 10516). Stop with Ctrl+C or kill the PID before relaunching (Next 16 refuses a second dev instance).

## 12. Git status summary

- Branch: **main**. Commits: `92a2354` (Block 1), `c92a059` (Block 2).
- At handoff time the working tree was clean except untracked dev-server logs (now gitignored).
- **Uncommitted after this step:** `docs/NEXT_HANDOFF.md`, `docs/CLAUDE_WORKFLOW.md`, and the `.gitignore` edit. Optional checkpoint: `git add . && git commit -m "docs: Block 2 handoff + workflow protocol"`.

## 13. Exact next prompt to paste after `/clear`

```
Resuming the Automotive BI CRM build after a context reset.

First, read these before doing anything:
- CLAUDE.md and AGENTS.md
- docs/NEXT_HANDOFF.md
- docs/CLAUDE_WORKFLOW.md

Then summarize: current project state, the last completed block, and what Block 3 (Workspace Architecture) entails.

Do NOT write code yet. After summarizing, wait for my confirmation.
When approved, plan Block 3 only (workspaces, workspace_members, Owner/Manager/Member roles, workspace switcher, invite structure if simple). Follow the block-by-block + 100k smart-zone rules. Block 4 (schema) and beyond stay untouched.
```
