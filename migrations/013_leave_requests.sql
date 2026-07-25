-- =========================================================
-- 013. LEAVE REQUESTS
--
-- Adds a Leave Form to the same "Requests" area as Access
-- Requests (Tickets page), so officers can:
--   - File a Leave Form with a Reason, a Substitute (who covers
--     their tasks while away), and a Date From / Date To range
--   - Have it go through the same simple Approval Process as
--     Access Requests (pending -> approved/denied by an Admin)
--
-- public.leave_requests mirrors public.access_requests in shape
-- and RLS style on purpose, so the two "Requests" tabs behave
-- identically for the person filling them out and the admin
-- approving them.
--
-- Safe to re-run (idempotent).
-- =========================================================

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  department text,
  position text,
  reason text not null,
  substitute_id uuid references public.profiles(id),
  substitute_name text,
  date_from date not null,
  date_to date not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  responded_by uuid references public.profiles(id),
  response_note text,
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint leave_requests_date_range check (date_to >= date_from)
);

alter table public.leave_requests enable row level security;

drop policy if exists "Users can view own leave requests, admins view all" on public.leave_requests;
create policy "Users can view own leave requests, admins view all"
  on public.leave_requests for select
  using (
    requested_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Authenticated can create leave requests" on public.leave_requests;
create policy "Authenticated can create leave requests"
  on public.leave_requests for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Admins can update leave requests" on public.leave_requests;
create policy "Admins can update leave requests"
  on public.leave_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
