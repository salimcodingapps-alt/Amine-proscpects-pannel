-- ============================================================================
-- Block 15 — Contact Status
-- Migration 0005: a SEPARATE outreach-tracking status on `businesses`.
--                 Adds a new `contact_status` enum + a `contact_status` column.
--                 The existing lifecycle enum `business_status`
--                 (new/contacted/qualified/inactive) and the `status` column are
--                 deliberately left UNTOUCHED — this is a distinct concept.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor.
--   2. Paste this entire file and Run.
--   3. Run the verification queries at the bottom and confirm the results.
--
-- SAFETY NOTES:
--   * ADDITIVE ONLY. Creates ONE new enum and ADDS ONE new column to the existing
--     `businesses` table. It ALTERS NOTHING in 0001 (workspaces/members), 0002
--     (businesses schema/RLS/grants/policies/indexes/trigger), 0003 (invites), or
--     0004 (watchlist). The lifecycle `business_status` enum and `status` column
--     are NOT modified.
--   * NO new table -> NO new RLS policies and NO new grants are needed. The new
--     column is automatically governed by the existing `businesses` policies
--     (select/insert/update, membership-gated) and the existing table grants.
--     (Verification (g) confirms the businesses policy count is still 3.)
--   * IDEMPOTENT — safe to run more than once (enum guarded by duplicate_object;
--     column added with IF NOT EXISTS).
--   * BACKFILL: the column is NOT NULL with a constant DEFAULT, so every existing
--     row is set to 'not_contacted' at add time. On PostgreSQL 11+ (Supabase) a
--     constant-default ADD COLUMN is a fast metadata-only operation.
--
--   * Prerequisite: migration 0002_businesses.sql must already be applied
--     (this migration depends on public.businesses).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Contact-status enum (separate from the lifecycle business_status enum)
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.contact_status as enum
    ('not_contacted', 'contacted', 'no_answer', 'not_interested');
exception
  when duplicate_object then null; -- already created by a previous run
end
$$;


-- ----------------------------------------------------------------------------
-- 2. Column
--    Additive. NOT NULL + DEFAULT 'not_contacted' backfills all existing rows.
-- ----------------------------------------------------------------------------
alter table public.businesses
  add column if not exists contact_status public.contact_status
  not null default 'not_contacted';


-- ============================================================================
-- VERIFICATION QUERIES — run these after applying and eyeball the results.
-- (They are read-only; nothing here changes data.)
-- ============================================================================
--
-- a) Contact-status enum has the 4 expected labels, in order:
--    select enumlabel
--    from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'contact_status'
--    order by e.enumsortorder;
--    -- expect: not_contacted, contacted, no_answer, not_interested.
--
-- b) The column exists, is NOT NULL, with the expected default:
--    select column_name, data_type, udt_name, is_nullable, column_default
--    from information_schema.columns
--    where table_schema = 'public' and table_name = 'businesses'
--      and column_name = 'contact_status';
--    -- expect: udt_name = contact_status, is_nullable = NO,
--    --         column_default = 'not_contacted'::public.contact_status.
--
-- c) Every existing row was backfilled (no nulls; all default unless changed):
--    select contact_status, count(*)
--    from public.businesses
--    group by contact_status
--    order by contact_status;
--    -- expect: all pre-existing rows under 'not_contacted' (0 nulls).
--
-- d) The lifecycle enum is UNCHANGED (still exactly 4 labels):
--    select enumlabel
--    from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'business_status'
--    order by e.enumsortorder;
--    -- expect: new, contacted, qualified, inactive (unchanged).
--
-- e) Table grants UNCHANGED (still exactly INSERT/SELECT/UPDATE for
--    authenticated; 0 rows for anon — no new grant was added):
--    select grantee, privilege_type
--    from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'businesses'
--      and grantee in ('authenticated', 'anon')
--    order by grantee, privilege_type;
--    -- expect authenticated -> INSERT, SELECT, UPDATE only; anon -> no rows.
--
-- f) RLS still ON:
--    select relname, relrowsecurity from pg_class where relname = 'businesses';
--    -- expect relrowsecurity = true.
--
-- g) businesses policies UNCHANGED (still 3 — select/insert/update; no new policy):
--    select count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'businesses';
--    -- expect 3 — same as after 0002.
-- ============================================================================


-- ============================================================================
-- ROLLBACK (manual; run only if you need to remove Block 15 entirely).
-- ADDITIVE migration -> safe to reverse. Only discards contact-status values;
-- NO other business data is affected (the rest of `businesses` is untouched).
--
--   alter table public.businesses drop column if exists contact_status;
--   drop type if exists public.contact_status;
-- ============================================================================
