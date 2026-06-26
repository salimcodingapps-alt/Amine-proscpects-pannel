-- ============================================================================
-- Block 14 — Watchlist (workspace-shared)
-- Migration 0004: business_watchlist_items table, RLS, grants.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor.
--   2. Paste this entire file and Run.
--   3. Run the verification queries at the bottom and confirm the results.
--
-- SAFETY NOTES:
--   * ADDITIVE ONLY. Creates ONE new table + its RLS/grants and ALTERS NOTHING in
--     0001 (workspaces/members), 0002 (businesses), or 0003 (invites). Existing
--     RLS, grants, policies, and behavior are untouched.
--   * WORKSPACE-SHARED: one watchlist per workspace; every member sees and curates
--     it. Membership gating reuses the Block 3 SECURITY DEFINER helper
--     is_workspace_member(...) -> no recursion.
--   * This is a bookmark/junction table, so a client DELETE is appropriate
--     (removing a watchlist entry is non-destructive — it touches no business
--     data). businesses itself is never modified here.
--   * created_by is INFORMATIONAL and NULLABLE: ON DELETE SET NULL keeps the
--     shared watchlist entry intact if the user who added it is later deleted.
--     The INSERT policy still forces created_by = auth.uid() at insert time.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
create table if not exists public.business_watchlist_items (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  -- Who added it (informational). Nullable + ON DELETE SET NULL so the shared
  -- entry survives the deletion of the user account that created it.
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  -- One entry per business per workspace (no duplicates). Leading workspace_id
  -- also indexes the "list this workspace's watchlist" query.
  primary key (workspace_id, business_id)
);

-- Supports the business_id foreign key (cascade) and reverse lookups.
create index if not exists business_watchlist_items_business_id_idx
  on public.business_watchlist_items (business_id);


-- ----------------------------------------------------------------------------
-- 2. Row Level Security + table grants
--    RLS only filters ROWS; the role must also hold the table privilege or every
--    query fails with 42501. Raw-SQL tables don't inherit dashboard defaults, so
--    we revoke-all then grant the minimum. NO UPDATE: a watchlist entry is only
--    ever added (INSERT) or removed (DELETE).
-- ----------------------------------------------------------------------------
alter table public.business_watchlist_items enable row level security;

revoke all on public.business_watchlist_items from anon, authenticated;
grant select, insert, delete on public.business_watchlist_items to authenticated;

-- SELECT: members see the shared workspace watchlist.
drop policy if exists "watchlist_select_members" on public.business_watchlist_items;
create policy "watchlist_select_members"
  on public.business_watchlist_items
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- INSERT: members add; authorship can't be forged; and the business must actually
-- belong to the claimed workspace (closes cross-workspace inserts — the businesses
-- subquery is itself RLS-filtered, so you can only watchlist a business you can
-- see in a workspace you're a member of).
drop policy if exists "watchlist_insert_members" on public.business_watchlist_items;
create policy "watchlist_insert_members"
  on public.business_watchlist_items
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.workspace_id = workspace_id
    )
  );

-- DELETE: any member may remove (shared model — the team curates one list).
drop policy if exists "watchlist_delete_members" on public.business_watchlist_items;
create policy "watchlist_delete_members"
  on public.business_watchlist_items
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));


-- ============================================================================
-- VERIFICATION QUERIES — run these after applying and eyeball the results.
-- (Read-only; nothing here changes data.)
-- ============================================================================
--
-- a) Table exists:
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'business_watchlist_items';
--    -- expect 1 row.
--
-- b) RLS is ON:
--    select relname, relrowsecurity from pg_class where relname = 'business_watchlist_items';
--    -- expect relrowsecurity = true.
--
-- c) Policies present (select/insert/delete; NO update):
--    select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'business_watchlist_items'
--    order by policyname;
--    -- expect exactly: watchlist_delete_members (DELETE),
--    --                 watchlist_insert_members (INSERT),
--    --                 watchlist_select_members (SELECT).
--
-- d) Grants are minimal (exactly SELECT/INSERT/DELETE for authenticated, 0 for anon):
--    select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'business_watchlist_items'
--    order by grantee, privilege_type;
--    -- expect authenticated -> DELETE, INSERT, SELECT only; anon -> no rows.
--
-- e) created_by is NULLABLE with ON DELETE SET NULL:
--    select column_name, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'business_watchlist_items'
--      and column_name = 'created_by';
--    -- expect is_nullable = YES.
--    select rc.delete_rule from information_schema.referential_constraints rc
--    join information_schema.key_column_usage k on k.constraint_name = rc.constraint_name
--    where k.table_name = 'business_watchlist_items' and k.column_name = 'created_by';
--    -- expect delete_rule = SET NULL.
--
-- f) Composite primary key (workspace_id, business_id):
--    select a.attname from pg_index i
--    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
--    where i.indrelid = 'public.business_watchlist_items'::regclass and i.indisprimary
--    order by a.attname;
--    -- expect: business_id, workspace_id.
--
-- g) businesses is untouched (its INSERT policy count is unchanged from before):
--    select count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'businesses';
--    -- expect 3 (select/insert/update) — same as after 0002.
-- ============================================================================


-- ============================================================================
-- ROLLBACK (manual; run only if you need to remove Block 14 entirely).
-- ADDITIVE migration -> safe to drop. Only discards watchlist bookmarks; no
-- business data is affected (businesses is never structurally touched).
--
--   drop table if exists public.business_watchlist_items;   -- drops its policies + index
-- ============================================================================
