-- ============================================================================
-- Block 13 — Member Invites / Team Workflow
-- Migration 0003: workspace_invites table, invite_status enum, RLS, grants,
--                 and the accept_workspace_invite() SECURITY DEFINER RPC.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor.
--   2. Paste this entire file and Run.
--   3. Run the verification queries at the bottom and confirm the results.
--
-- SAFETY NOTES:
--   * ADDITIVE ONLY. This migration creates NEW objects and ALTERS NOTHING in
--     0001 (workspaces / workspace_members) or 0002 (businesses). Existing RLS,
--     grants, policies, and behavior are untouched.
--   * Multi-tenant from line one: RLS is enabled on workspace_invites from the
--     start; every policy is gated on the Block 3 SECURITY DEFINER helpers
--     (current_user_role / is_workspace_member) -> no recursion.
--   * workspace_members keeps its default-deny posture: there is STILL no client
--     INSERT policy on it. The ONLY way an invite turns into a membership is the
--     accept_workspace_invite() SECURITY DEFINER RPC below (mirrors how
--     create_workspace() is the only workspace-creation path).
--   * Invites are EMAIL-BOUND, single-use, expiring, and revocable. Only the
--     SHA-256 hash of the token is stored — never the raw token.
--   * Invite role is limited to 'manager' | 'member' (a CHECK + the INSERT
--     policy both enforce it). Nobody can invite an 'owner'. Ownership transfer
--     is a separate, deferred concern.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Invite status enum
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.invite_status as enum ('pending', 'accepted', 'revoked');
exception
  when duplicate_object then null; -- already created by a previous run
end
$$;


-- ----------------------------------------------------------------------------
-- 2. Table
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (char_length(trim(email)) between 3 and 320),
  role         public.workspace_role not null,
  token_hash   text not null,
  status       public.invite_status not null default 'pending',
  invited_by   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  -- Invites may NEVER grant 'owner' (ownership transfer is deferred).
  constraint workspace_invites_role_not_owner check (role in ('manager', 'member'))
);

-- One unguessable token per invite; we look up an invite by its hash.
create unique index if not exists workspace_invites_token_hash_key
  on public.workspace_invites (token_hash);

-- At most one PENDING invite per (workspace, email). Accepted/revoked rows don't
-- block re-inviting later.
create unique index if not exists workspace_invites_pending_email_uq
  on public.workspace_invites (workspace_id, lower(email))
  where status = 'pending';

-- Speeds up "list this workspace's invites".
create index if not exists workspace_invites_ws_status_idx
  on public.workspace_invites (workspace_id, status);


-- ----------------------------------------------------------------------------
-- 3. Row Level Security + table grants
--    RLS only filters ROWS; the role must also hold the table privilege or every
--    query fails with 42501. Raw-SQL tables don't inherit dashboard defaults, so
--    we revoke-all then grant the minimum. NO DELETE: revoking an invite is an
--    UPDATE to status = 'revoked' (soft). NO client INSERT on workspace_members
--    is added anywhere — accepting is done by the SECURITY DEFINER RPC only.
-- ----------------------------------------------------------------------------
alter table public.workspace_invites enable row level security;

revoke all on public.workspace_invites from anon, authenticated;
grant select, insert, update on public.workspace_invites to authenticated;

-- SELECT: only owners/managers of the workspace can see its invites (emails are
-- sensitive — regular members must not enumerate them).
drop policy if exists "invites_select_admins" on public.workspace_invites;
create policy "invites_select_admins"
  on public.workspace_invites
  for select
  to authenticated
  using (public.current_user_role(workspace_id) in ('owner', 'manager'));

-- INSERT: owners/managers create invites in their own workspace; authorship can't
-- be forged; role is limited to manager/member; new rows start pending.
drop policy if exists "invites_insert_admins" on public.workspace_invites;
create policy "invites_insert_admins"
  on public.workspace_invites
  for insert
  to authenticated
  with check (
    public.current_user_role(workspace_id) in ('owner', 'manager')
    and invited_by = auth.uid()
    and role in ('manager', 'member')
    and status = 'pending'
  );

-- UPDATE: owners/managers may update invites in their workspace (the app only
-- ever uses this to revoke: status -> 'revoked'). Acceptance is NOT done here —
-- it flips to 'accepted' inside the SECURITY DEFINER RPC, which bypasses RLS.
-- Note: an admin manually flipping status grants no access on its own, because a
-- membership row is only ever created by the RPC below.
drop policy if exists "invites_update_admins" on public.workspace_invites;
create policy "invites_update_admins"
  on public.workspace_invites
  for update
  to authenticated
  using (public.current_user_role(workspace_id) in ('owner', 'manager'))
  with check (public.current_user_role(workspace_id) in ('owner', 'manager'));


-- ----------------------------------------------------------------------------
-- 4. accept_workspace_invite() — the ONLY path an invite becomes a membership.
--    SECURITY DEFINER so it can read auth.users (for the email check) and INSERT
--    into workspace_members (which has no client INSERT policy). It validates the
--    invite is pending, unexpired, and EMAIL-BOUND to the caller, then adds the
--    membership idempotently and marks the invite accepted. Returns the joined
--    workspace id. The caller passes the SHA-256 hash of their raw token (the
--    app hashes it); the raw token is never sent to or stored by the database.
-- ----------------------------------------------------------------------------
create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid     uuid := auth.uid();
  uemail  text;
  inv     public.workspace_invites%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token_hash is null or char_length(p_token_hash) = 0 then
    raise exception 'Invalid invitation';
  end if;

  select email into uemail from auth.users where id = uid;

  -- Lock the invite row so two concurrent accepts can't both proceed.
  select * into inv
  from public.workspace_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if inv.status = 'revoked' then
    raise exception 'This invitation has been revoked';
  end if;

  if inv.status = 'accepted' then
    -- Idempotent: if this same user already holds the membership, succeed.
    if exists (
      select 1 from public.workspace_members m
      where m.workspace_id = inv.workspace_id and m.user_id = uid
    ) then
      return inv.workspace_id;
    end if;
    raise exception 'This invitation has already been used';
  end if;

  if inv.expires_at < now() then
    raise exception 'This invitation has expired';
  end if;

  -- EMAIL-BOUND: the accepting account must match the invited address.
  if lower(coalesce(uemail, '')) is distinct from lower(inv.email) then
    raise exception 'This invitation is for a different email address';
  end if;

  -- Add membership (idempotent) + mark the invite accepted, atomically.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
    set status = 'accepted',
        accepted_by = uid,
        accepted_at = now()
  where id = inv.id;

  return inv.workspace_id;
end;
$$;

-- Only signed-in users may accept; never anon/public.
revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;


-- ============================================================================
-- VERIFICATION QUERIES — run these after applying and eyeball the results.
-- (Read-only; nothing here changes data.)
-- ============================================================================
--
-- a) Table exists:
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'workspace_invites';
--    -- expect 1 row.
--
-- b) RLS is ON:
--    select relname, relrowsecurity from pg_class where relname = 'workspace_invites';
--    -- expect relrowsecurity = true.
--
-- c) Policies present (select/insert/update; NO delete):
--    select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'workspace_invites'
--    order by policyname;
--    -- expect exactly: invites_insert_admins (INSERT),
--    --                 invites_select_admins (SELECT),
--    --                 invites_update_admins (UPDATE).
--
-- d) Grants are minimal (exactly SELECT/INSERT/UPDATE for authenticated, 0 for anon):
--    select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'workspace_invites'
--    order by grantee, privilege_type;
--    -- expect authenticated -> INSERT, SELECT, UPDATE only; anon -> no rows.
--
-- e) Accept RPC is SECURITY DEFINER:
--    select proname, prosecdef from pg_proc where proname = 'accept_workspace_invite';
--    -- expect prosecdef = true.
--
-- f) workspace_members STILL has no INSERT policy (default-deny preserved):
--    select count(*) as member_insert_policies from pg_policies
--    where schemaname = 'public' and tablename = 'workspace_members' and cmd = 'INSERT';
--    -- expect 0.
--
-- g) Enum + role CHECK exist:
--    select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'invite_status' order by enumlabel;
--    -- expect: accepted, pending, revoked.
-- ============================================================================


-- ============================================================================
-- ROLLBACK (manual; run only if you need to remove Block 13 entirely).
-- ADDITIVE migration -> safe to drop. NOTE: memberships already created by
-- ACCEPTED invites are real members and are NOT removed by this (workspace_members
-- is never structurally touched). Dropping the invites table does not un-add them.
--
--   drop function if exists public.accept_workspace_invite(text);
--   drop table if exists public.workspace_invites;     -- drops its policies + indexes
--   drop type if exists public.invite_status;
-- ============================================================================
