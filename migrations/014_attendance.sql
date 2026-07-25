-- =========================================================
-- 014. DAILY ATTENDANCE (Time In / Time Out) + APPROVAL
--
-- Adds a Daily Attendance feature, surfaced on the Dashboard:
--   - Officer taps "Time In" when they start their day.
--   - Officer taps "Time Out" when they're done, which requires
--     filling out Accomplishments for the Day + a Detailed Report,
--     and mandatorily attaching at least one photo as evidence,
--     before the record can be submitted.
--   - Submitting Time Out sends the record for approval:
--       - Vice Presidents and the Executive Secretary/Deputy
--         Secretary -> approved by the Council President.
--       - Everyone else (subordinates) -> approved by their own
--         department's head (their department's Vice President,
--         or the Executive Secretary for GENERAL/Commissions/
--         Administrative Department, which has no VP of its own).
--       - The Council President has nobody above them, so their
--         own attendance auto-approves on submission.
--
-- One row per officer per calendar day (public.attendance_records).
-- The officer who is due to review a record ("approver_position")
-- is computed server-side from the *live* profiles table via a
-- trigger -- never trusted from the client -- the same
-- typo-proof, drift-proof approach as approval_chain_steps in
-- migrations 008/011.
--
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.profiles(id) on delete cascade,
  officer_name text not null,
  department text not null,
  position text not null,

  work_date date not null default current_date,
  time_in timestamptz not null default now(),
  time_out timestamptz,

  accomplishments text,
  report text,
  evidence_paths text[] not null default '{}',

  -- Who is due to review this record. NULL means "nobody" (only the
  -- Council President has no approver above them) -- see trigger below,
  -- which auto-approves that case instead of leaving it stuck pending.
  approver_position text,

  status text not null default 'open' check (status in ('open', 'pending', 'approved', 'denied')),

  reviewed_by uuid references public.profiles(id),
  reviewed_by_name text,
  review_note text,

  created_at timestamptz default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,

  unique (officer_id, work_date),

  -- Can only move past "open" once Time Out + Accomplishments + Report
  -- + at least one evidence photo are all present. Enforced at the DB
  -- level as a backstop, in addition to the UI requiring it.
  constraint attendance_submission_complete check (
    status = 'open'
    or (
      time_out is not null
      and accomplishments is not null and length(trim(accomplishments)) > 0
      and report is not null and length(trim(report)) > 0
      and coalesce(array_length(evidence_paths, 1), 0) >= 1
    )
  )
);

create index if not exists idx_attendance_officer on public.attendance_records(officer_id, work_date desc);
create index if not exists idx_attendance_approver_status on public.attendance_records(approver_position, status);

-- ---------------------------------------------------------
-- 2. SERVER-SIDE APPROVER COMPUTATION
--    (mirrors the org chart: department -> VP, GENERAL/Commissions/
--    Administrative -> Executive Secretary, VPs & Exec/Deputy
--    Secretary -> Council President, Council President -> nobody)
-- ---------------------------------------------------------
create or replace function public.compute_attendance_approver(p_position text, p_department text)
returns text
language plpgsql
stable
as $$
begin
  if p_position = 'Council President' then
    return null;
  end if;

  if p_position like 'Vice President for%' or p_position in ('Executive Secretary', 'Deputy Secretary') then
    return 'Council President';
  end if;

  return case p_department
    when 'Internal Affairs Department' then 'Vice President for Internal Affairs'
    when 'External Affairs Department' then 'Vice President for External Affairs'
    when 'Operations Department' then 'Vice President for Operations'
    else 'Executive Secretary' -- GENERAL, Commissions, Administrative Department
  end;
end;
$$;

-- Always re-derives officer_name/department/position/approver_position
-- from the live profiles row (never trusts the client), and auto-
-- approves the one case with no approver above it (Council President).
create or replace function public.attendance_sync_officer_fields()
returns trigger
language plpgsql
as $$
declare
  v_position text;
  v_department text;
  v_name text;
begin
  select position, department, name into v_position, v_department, v_name
  from public.profiles where id = new.officer_id;

  if v_position is null then
    raise exception 'No profile found for officer_id %', new.officer_id;
  end if;

  new.position := v_position;
  new.department := v_department;
  new.officer_name := v_name;
  new.approver_position := public.compute_attendance_approver(v_position, v_department);

  if new.approver_position is null and new.status = 'pending' then
    new.status := 'approved';
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.review_note := coalesce(new.review_note, 'Auto-approved -- no position exists above the Council President.');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_sync_fields on public.attendance_records;
create trigger trg_attendance_sync_fields
  before insert or update on public.attendance_records
  for each row
  execute function public.attendance_sync_officer_fields();

-- ---------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------
alter table public.attendance_records enable row level security;

-- View: the officer themselves, whoever holds the approver position
-- for that record (current or past), and admins.
drop policy if exists "View own, assigned approver, or admin" on public.attendance_records;
create policy "View own, assigned approver, or admin"
  on public.attendance_records for select
  using (
    officer_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.position = attendance_records.approver_position)
  );

-- Insert: officers time themselves in only (admins may also insert on
-- someone's behalf, e.g. to fix a missed entry).
drop policy if exists "Officer can time self in" on public.attendance_records;
create policy "Officer can time self in"
  on public.attendance_records for insert
  with check (
    officer_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Update, case 1: the owner can fill in Time Out + accomplishments +
-- report + evidence and submit, but only while still 'open'.
drop policy if exists "Owner can submit time out while open" on public.attendance_records;
create policy "Owner can submit time out while open"
  on public.attendance_records for update
  using (officer_id = auth.uid() and status = 'open');

-- Update, case 2: the matching department head / Council President can
-- act (approve/deny) only while the record is 'pending', and only if
-- their live position still matches the record's approver_position.
drop policy if exists "Assigned approver can act while pending" on public.attendance_records;
create policy "Assigned approver can act while pending"
  on public.attendance_records for update
  using (
    status = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.position = attendance_records.approver_position)
  );

-- Update, case 3: admins can always correct/override.
drop policy if exists "Admins can update attendance" on public.attendance_records;
create policy "Admins can update attendance"
  on public.attendance_records for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Delete: the owner may discard their own record only while it's still
-- 'open' (undo an accidental Time In) or was 'denied' (start over for
-- the day). Admins may always delete.
drop policy if exists "Owner can discard open/denied, admin any" on public.attendance_records;
create policy "Owner can discard open/denied, admin any"
  on public.attendance_records for delete
  using (
    (officer_id = auth.uid() and status in ('open', 'denied'))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------
-- 4. EVIDENCE PHOTO STORAGE
--    Private bucket, one folder per officer (their own uid), same
--    read-broadly / write-your-own-folder shape as other buckets in
--    this app -- every signed-in officer can already see everyone's
--    file listings, so attendance evidence follows the same model.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attendance-evidence', 'attendance-evidence', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated read attendance evidence" on storage.objects;
create policy "Authenticated read attendance evidence"
  on storage.objects for select
  using (bucket_id = 'attendance-evidence' and auth.role() = 'authenticated');

drop policy if exists "Officers upload own attendance evidence" on storage.objects;
create policy "Officers upload own attendance evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'attendance-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Officers delete own attendance evidence" on storage.objects;
create policy "Officers delete own attendance evidence"
  on storage.objects for delete
  using (
    bucket_id = 'attendance-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
