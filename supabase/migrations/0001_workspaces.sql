-- ============================================================================
-- Block 3 — Workspace Architecture
-- Migration 0001: workspaces, workspace_members, roles, RLS, signup trigger,
--                 and a one-time backfill for pre-existing users.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor.
--   2. Paste this entire file and Run.
--   3. Run the verification queries at the bottom and confirm the results.
--
-- SAFETY NOTES:
--   * This script is IDEMPOTENT — safe to run more than once.
--   * RLS is enabled on every table from the start (multi-tenant from line one).
--   * Membership checks use SECURITY DEFINER helpers with a hardened search_path,
--     so RLS policies never query workspace_members directly -> NO recursion.
--   * Scope: workspace provisioning + role structure ONLY. No business records,
--     no supplier/contact tables, no invites/accept flow (deferred to a later
--     dedicated block).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Role enum
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.workspace_role as enum ('owner', 'manager', 'member');
exception
  when duplicate_object then null; -- already created by a previous run
end
$$;


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 100),
  slug        text,                       -- reserved for future friendly URLs
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Speeds up "list the workspaces I belong to".
create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);


-- ----------------------------------------------------------------------------
-- 3. SECURITY DEFINER helper functions (recursion-safe)
--    These run as the function owner and therefore bypass RLS when reading
--    workspace_members, which is exactly what lets the policies below avoid
--    infinite recursion. search_path is pinned to prevent hijacking.
-- ----------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.current_user_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = ws
    and m.user_id = auth.uid();
$$;

-- Only signed-in users should call these.
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.current_user_role(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.current_user_role(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3b. create_workspace() RPC — the ONLY client path to create a workspace.
--     A direct client INSERT cannot work: at creation time the creator is not
--     yet a member, so the membership-based SELECT policy hides the new row
--     (breaking INSERT ... RETURNING) and a self-bootstrap membership insert
--     can't satisfy a WITH CHECK that queries the (invisible) workspaces row.
--     This SECURITY DEFINER function does both inserts atomically while
--     bypassing RLS, then returns the new workspace id. Membership stays
--     strictly membership-based — no created_by visibility leak.
-- ----------------------------------------------------------------------------
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid   uuid := auth.uid();
  nm    text := nullif(trim(workspace_name), '');
  ws_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if nm is null or char_length(nm) > 100 then
    raise exception 'Workspace name must be between 1 and 100 characters';
  end if;

  insert into public.workspaces (name, created_by)
  values (nm, uid)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  return ws_id;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

-- Table-level privileges. RLS only filters ROWS; the role must still hold the
-- table privilege or every query fails with "permission denied for table"
-- (error 42501). Tables created via raw SQL don't inherit the dashboard's
-- default grants, so we grant them explicitly. No INSERT: all row creation
-- happens through SECURITY DEFINER code (signup trigger, backfill,
-- create_workspace RPC), which bypasses these grants and RLS alike.
grant select, update, delete on public.workspaces        to authenticated;
grant select, update, delete on public.workspace_members to authenticated;

-- --- workspaces ---------------------------------------------------------------

-- SELECT: you can see a workspace if you are a member of it.
drop policy if exists "workspaces_select_members" on public.workspaces;
create policy "workspaces_select_members"
  on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id));

-- INSERT: deliberately NO client INSERT policy. Workspace creation goes
-- through the create_workspace() SECURITY DEFINER RPC defined above, which is
-- the only way to create a workspace + its owner membership atomically. A direct
-- client insert is disallowed (default-deny). Drop the policy if a prior run of
-- an earlier version of this migration created it.
drop policy if exists "workspaces_insert_self" on public.workspaces;

-- UPDATE: owners and managers may edit (e.g. rename) the workspace.
drop policy if exists "workspaces_update_admins" on public.workspaces;
create policy "workspaces_update_admins"
  on public.workspaces
  for update
  to authenticated
  using (public.current_user_role(id) in ('owner', 'manager'))
  with check (public.current_user_role(id) in ('owner', 'manager'));

-- DELETE: owners only.
drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
  on public.workspaces
  for delete
  to authenticated
  using (public.current_user_role(id) = 'owner');

-- --- workspace_members --------------------------------------------------------

-- SELECT: members of a workspace can see that workspace's membership list.
drop policy if exists "members_select" on public.workspace_members;
create policy "members_select"
  on public.workspace_members
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- INSERT: deliberately NO client INSERT policy on workspace_members. All
-- membership creation happens through SECURITY DEFINER code that bypasses RLS:
-- the signup trigger, the backfill, and the create_workspace() RPC. This closes
-- the bootstrap chicken-and-egg (a creator cannot satisfy a WITH CHECK that
-- queries the not-yet-visible workspaces row) and keeps a default-deny posture
-- until the future invite block adds a vetted owner-adds-member path. Drop the
-- old bootstrap policy if a prior run of an earlier version created it.
drop policy if exists "members_insert_bootstrap" on public.workspace_members;

-- UPDATE: owners may change member roles.
drop policy if exists "members_update_owner" on public.workspace_members;
create policy "members_update_owner"
  on public.workspace_members
  for update
  to authenticated
  using (public.current_user_role(workspace_id) = 'owner')
  with check (public.current_user_role(workspace_id) = 'owner');

-- DELETE: an owner may remove any member; any member may remove themselves
-- (i.e. leave the workspace).
drop policy if exists "members_delete" on public.workspace_members;
create policy "members_delete"
  on public.workspace_members
  for delete
  to authenticated
  using (
    public.current_user_role(workspace_id) = 'owner'
    or user_id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 5. Signup trigger — auto-provision a default workspace + owner membership.
--    Runs as definer (bypasses RLS) and is idempotent per user.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ws_id        uuid;
  display_name text;
begin
  -- Idempotency: never create a second default workspace for the same user.
  if exists (
    select 1 from public.workspace_members m where m.user_id = new.id
  ) then
    return new;
  end if;

  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.workspaces (name, created_by)
  values (display_name || '''s Workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

-- The trigger function must not be callable directly by clients.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 6. Backfill — give every EXISTING user without any membership a default
--    workspace + owner row. Guarded by "has no membership" so it is safe to
--    re-run and will never create duplicates.
-- ----------------------------------------------------------------------------
do $$
declare
  u            record;
  ws_id        uuid;
  display_name text;
begin
  for u in
    select usr.id, usr.email, usr.raw_user_meta_data
    from auth.users usr
    where not exists (
      select 1 from public.workspace_members m where m.user_id = usr.id
    )
  loop
    display_name := coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    );

    insert into public.workspaces (name, created_by)
    values (display_name || '''s Workspace', u.id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, u.id, 'owner');
  end loop;
end
$$;


-- ============================================================================
-- VERIFICATION QUERIES — run these after applying and eyeball the results.
-- (They are read-only; nothing here changes data.)
-- ============================================================================
--
-- a) Tables exist:
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('workspaces', 'workspace_members');
--    -- expect 2 rows.
--
-- b) RLS is ON for both tables:
--    select relname, relrowsecurity
--    from pg_class
--    where relname in ('workspaces', 'workspace_members');
--    -- expect relrowsecurity = true for both.
--
-- c) Policies are present:
--    select tablename, policyname, cmd
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in ('workspaces', 'workspace_members')
--    order by tablename, policyname;
--    -- expect: workspaces -> select/update/delete (3);
--    --         workspace_members -> select/update/delete (3).
--    -- (No INSERT policies by design — creation is via create_workspace().)
--
-- d) Signup trigger is installed:
--    select tgname from pg_trigger where tgname = 'on_auth_user_created';
--    -- expect 1 row.
--
-- e) Helper/RPC functions are SECURITY DEFINER:
--    select proname, prosecdef
--    from pg_proc
--    where proname in ('is_workspace_member', 'current_user_role',
--                      'handle_new_user', 'create_workspace');
--    -- expect prosecdef = true for all four.
--
-- f) Backfill covered every user (this should return 0):
--    select count(*) as users_without_workspace
--    from auth.users usr
--    where not exists (
--      select 1 from public.workspace_members m where m.user_id = usr.id
--    );
--    -- expect 0.
--
-- g) Every user has exactly one owner membership from provisioning:
--    select m.user_id, count(*) filter (where m.role = 'owner') as owner_rows
--    from public.workspace_members m
--    group by m.user_id;
--    -- expect owner_rows >= 1 for each user (1 from the default workspace).
-- ============================================================================
