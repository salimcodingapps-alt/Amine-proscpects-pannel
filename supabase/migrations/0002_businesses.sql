-- ============================================================================
-- Block 4 — Schema / Business Data
-- Migration 0002: the core `businesses` table — one workspace-scoped business
--                 record table (suppliers, importers, garages, prospects, ...),
--                 with RLS, table GRANTs, indexes, an updated_at trigger, and
--                 soft-delete. Reuses Block 3's recursion-safe membership helper.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor.
--   2. Paste this entire file and Run.
--   3. Run the verification queries at the bottom and confirm the results.
--
-- SAFETY NOTES:
--   * This script is IDEMPOTENT — safe to run more than once.
--   * RLS is enabled from the start (multi-tenant from line one).
--   * Every business row is scoped to a workspace_id; all policies gate on
--     public.is_workspace_member(workspace_id) — the SECURITY DEFINER helper
--     created in migration 0001, so there is NO new recursion surface.
--   * RLS alone is NOT enough: the `authenticated` role is also GRANTed the
--     table privileges (select/insert/update). Without the GRANT every query
--     fails with "permission denied for table" (error 42501).
--   * SOFT DELETE ONLY: there is no DELETE grant and no DELETE policy. "Deleting"
--     a record is an UPDATE that sets deleted_at; the app hides such rows by
--     default. This keeps records recoverable and prevents accidental loss.
--   * Scope: ONE business-record table only. No upload/import, no AI, no dedupe,
--     no merge, no invites (all deferred to later blocks). The duplicate_score,
--     latitude, and longitude columns are reserved placeholders, unused for now.
--
--   * Prerequisite: migration 0001_workspaces.sql must already be applied
--     (this migration depends on public.workspaces and
--     public.is_workspace_member(uuid)).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Status enum
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.business_status as enum
    ('new', 'contacted', 'qualified', 'inactive');
exception
  when duplicate_object then null; -- already created by a previous run
end
$$;


-- ----------------------------------------------------------------------------
-- 2. Table
--    Every row belongs to exactly one workspace (the tenant scope) and carries
--    audit columns. company_name is the only required business field.
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,

  -- Core business fields
  company_name     text not null check (char_length(trim(company_name)) between 1 and 200),
  contact_name     text,
  phone            text,                       -- text: preserve leading 0 / +213 / formatting
  email            text,                       -- format validated in the app layer, not here
  website          text,
  address          text,
  city             text,
  wilaya           text,                       -- Algeria-first; free text for MVP
  country          text not null default 'Algeria',
  business_type    text,                       -- free text (supplier/importer/garage/...); no enum yet
  supported_brands text[] not null default '{}',  -- simple array; no brands table yet
  notes            text,
  status           public.business_status not null default 'new',

  -- Reserved placeholders for later blocks (unused for now)
  duplicate_score  real,                       -- Block 9 (duplicate detection)
  latitude         double precision,           -- future map view
  longitude        double precision,

  -- Audit trail
  created_by       uuid not null references auth.users (id) on delete cascade,
  modified_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Soft delete: null = active; non-null = archived/hidden
  deleted_at       timestamptz
);


-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
-- Scope lookups by workspace.
create index if not exists businesses_workspace_id_idx
  on public.businesses (workspace_id);

-- Optimizes the default list query: active records for a workspace, newest first.
create index if not exists businesses_active_idx
  on public.businesses (workspace_id, created_at desc)
  where deleted_at is null;


-- ----------------------------------------------------------------------------
-- 4. updated_at trigger
--    Keeps updated_at fresh on every UPDATE at the DB level. modified_by stays
--    app-set (the database can't infer who acted). Reusable across future tables.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row
  execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.businesses enable row level security;

-- Table-level privileges. RLS only filters ROWS; the role must still hold the
-- table privilege or every query fails with "permission denied for table"
-- (error 42501).
--
-- Supabase ships ALTER DEFAULT PRIVILEGES that grant ALL on new public tables
-- to `authenticated` (and SELECT-ish privileges to `anon`). "ALL" includes
-- REFERENCES, TRIGGER, and TRUNCATE — too permissive for a tenant table. So we
-- first REVOKE everything from both roles, then grant back ONLY the minimum we
-- want. This makes the privilege set explicit and is idempotent on re-run.
--
-- NO delete grant — business records are soft-deleted via UPDATE only.
-- anon gets nothing — only signed-in users touch business data.
revoke all on table public.businesses from anon, authenticated;
grant select, insert, update on table public.businesses to authenticated;

-- SELECT: you can read a business if you belong to its workspace. (Soft-deleted
-- rows are still returned here; the app filters deleted_at IS NULL by default so
-- that edit/restore remains possible.)
drop policy if exists "businesses_select_members" on public.businesses;
create policy "businesses_select_members"
  on public.businesses
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- INSERT: any member of the target workspace may create a record, and cannot
-- forge authorship — created_by and modified_by must be the caller.
drop policy if exists "businesses_insert_members" on public.businesses;
create policy "businesses_insert_members"
  on public.businesses
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and modified_by = auth.uid()
  );

-- UPDATE: any member may edit (this also covers the soft-delete path, which is
-- an UPDATE that sets deleted_at). Both the existing and the resulting row must
-- be in a workspace the caller belongs to, and modified_by must be the caller.
drop policy if exists "businesses_update_members" on public.businesses;
create policy "businesses_update_members"
  on public.businesses
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and modified_by = auth.uid()
  );

-- DELETE: deliberately NO delete grant and NO delete policy. Records are
-- soft-deleted (deleted_at) only; hard deletes from the client are impossible.


-- ============================================================================
-- VERIFICATION QUERIES — run these after applying and eyeball the results.
-- (They are read-only; nothing here changes data.)
-- ============================================================================
--
-- a) Table exists:
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'businesses';
--    -- expect 1 row.
--
-- b) RLS is ON:
--    select relname, relrowsecurity
--    from pg_class where relname = 'businesses';
--    -- expect relrowsecurity = true.
--
-- c) Policies are present (3 — select/insert/update, NO delete):
--    select tablename, policyname, cmd
--    from pg_policies
--    where schemaname = 'public' and tablename = 'businesses'
--    order by policyname;
--    -- expect exactly: select, insert, update. (No DELETE by design.)
--
-- d) Table GRANTs to authenticated (select/insert/update ONLY — no DELETE,
--    no REFERENCES/TRIGGER/TRUNCATE, since we revoked ALL first):
--    select privilege_type
--    from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'businesses'
--      and grantee = 'authenticated'
--    order by privilege_type;
--    -- expect EXACTLY 3 rows: INSERT, SELECT, UPDATE.
--
-- d2) anon has NO privileges on the table (this should return 0 rows):
--    select privilege_type
--    from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'businesses'
--      and grantee = 'anon';
--    -- expect 0 rows.
--
-- e) Status enum has the 4 expected labels:
--    select enumlabel
--    from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'business_status'
--    order by e.enumsortorder;
--    -- expect: new, contacted, qualified, inactive.
--
-- f) updated_at trigger is installed:
--    select tgname from pg_trigger where tgname = 'businesses_set_updated_at';
--    -- expect 1 row.
--
-- g) Indexes are present:
--    select indexname from pg_indexes
--    where schemaname = 'public' and tablename = 'businesses'
--    order by indexname;
--    -- expect: businesses_pkey, businesses_workspace_id_idx, businesses_active_idx.
-- ============================================================================
