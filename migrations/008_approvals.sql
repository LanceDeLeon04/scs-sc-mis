-- =========================================================
-- 008. APPROVALS + PRINTING WORKFLOW
--
-- Adds:
--   - public.approval_chain_steps  (admin-configured, ordered list
--     of positions that must sign off on a department's documents,
--     e.g. Accounting Officer -> Finance Director -> VP for
--     Internal Affairs -> President)
--   - public.file_approvals        (one row per file per step —
--     the actual, in-progress approval trail for a given file)
--   - new columns on public.files  (approval_status, printed /
--     wet_signed flags for the Executive Secretary + Deputy
--     Secretary "For Review and Printing" workflow)
--
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 1. FILES: new workflow columns
-- ---------------------------------------------------------
alter table public.files
  add column if not exists approval_status text not null default 'none'
    check (approval_status in ('none', 'pending_approval', 'approved_for_printing', 'rejected')),
  add column if not exists printed boolean not null default false,
  add column if not exists printed_by uuid references public.profiles(id),
  add column if not exists printed_by_name text,
  add column if not exists printed_at timestamptz,
  add column if not exists wet_signed boolean not null default false,
  add column if not exists wet_signed_by uuid references public.profiles(id),
  add column if not exists wet_signed_by_name text,
  add column if not exists wet_signed_at timestamptz,
  add column if not exists submitted_for_approval_by uuid references public.profiles(id),
  add column if not exists submitted_for_approval_at timestamptz;

-- ---------------------------------------------------------
-- 2. APPROVAL CHAIN STEPS (admin-configured, per department)
--    Example (Internal Affairs Department):
--      1. Accounting Officer
--      2. Finance Director
--      3. Vice President for Internal Affairs
--      4. President            <- is_president = true (final step,
--                                  "Approve for Printing")
-- ---------------------------------------------------------
create table if not exists public.approval_chain_steps (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in (
    'GENERAL','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  )),
  step_order int not null check (step_order > 0),
  position_title text not null,
  is_president boolean not null default false,
  created_at timestamptz default now(),
  unique (department, step_order)
);

alter table public.approval_chain_steps enable row level security;

drop policy if exists "Authenticated can view approval chains" on public.approval_chain_steps;
create policy "Authenticated can view approval chains"
  on public.approval_chain_steps for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins manage approval chains" on public.approval_chain_steps;
create policy "Admins manage approval chains"
  on public.approval_chain_steps for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------
-- 3. FILE APPROVALS (the live trail for one submitted file —
--    a snapshot of the chain at time of submission, so editing
--    the chain later doesn't rewrite history for files already
--    in progress)
-- ---------------------------------------------------------
create table if not exists public.file_approvals (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  step_order int not null,
  position_title text not null,
  is_president boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  action text check (action in ('approved', 'approved_for_printing', 'rejected')),
  approved_by uuid references public.profiles(id),
  approved_by_name text,
  note text,
  acted_at timestamptz,
  created_at timestamptz default now(),
  unique (file_id, step_order)
);

alter table public.file_approvals enable row level security;

drop policy if exists "Authenticated can view file approvals" on public.file_approvals;
create policy "Authenticated can view file approvals"
  on public.file_approvals for select
  using (auth.role() = 'authenticated');

-- Submitted only by the file's owner (or an admin) — application
-- inserts one row per chain step at submission time.
drop policy if exists "Owner or admin can submit approvals" on public.file_approvals;
create policy "Owner or admin can submit approvals"
  on public.file_approvals for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.files f
      where f.id = file_approvals.file_id
      and f.uploaded_by = auth.uid()
    )
  );

-- A step can only be acted on by the officer/exec whose position
-- matches that step, and only once every earlier step in the same
-- file's chain has already been approved (enforces in-order sign-off
-- even if someone bypasses the UI). Admins can override.
drop policy if exists "Position holder can act on their pending step" on public.file_approvals;
create policy "Position holder can act on their pending step"
  on public.file_approvals for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      file_approvals.status = 'pending'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.position = file_approvals.position_title
      )
      and not exists (
        select 1 from public.file_approvals earlier
        where earlier.file_id = file_approvals.file_id
        and earlier.step_order < file_approvals.step_order
        and earlier.status <> 'approved'
      )
    )
  );

-- Owner/admin can clear a rejected/in-progress chain to resubmit.
drop policy if exists "Owner or admin can delete file approvals" on public.file_approvals;
create policy "Owner or admin can delete file approvals"
  on public.file_approvals for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.files f
      where f.id = file_approvals.file_id
      and f.uploaded_by = auth.uid()
    )
  );
