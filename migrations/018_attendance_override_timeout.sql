-- =========================================================
-- 018. TIME OUT ON BEHALF (Council President / admin override)
--
-- Lets the Council President (or an admin) manually close out an
-- officer's still-'open' attendance record -- e.g. the officer forgot
-- to time out, is on leave, or is unreachable -- instead of it being
-- stuck open forever. Requires a note explaining why, and sends the
-- record straight to 'pending' for the normal approval chain (the
-- existing trg_attendance_sync_fields trigger from migration 014
-- still recomputes approver_position and still auto-approves if the
-- record happens to belong to the Council President themselves).
--
-- These records never went through the officer's own Time Out form,
-- so they won't have accomplishments/report/evidence -- the existing
-- attendance_submission_complete check is relaxed for these
-- override-closed rows only. Manual self-submissions are unaffected
-- and still require all three.
--
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 1. COLUMNS
-- ---------------------------------------------------------
alter table public.attendance_records
  add column if not exists override_closed_by uuid references public.profiles(id);

alter table public.attendance_records
  add column if not exists override_closed_by_name text;

alter table public.attendance_records
  add column if not exists override_note text;

alter table public.attendance_records
  add column if not exists override_closed_at timestamptz;

-- ---------------------------------------------------------
-- 2. RELAX THE COMPLETION CHECK FOR OVERRIDE-CLOSED ROWS
-- ---------------------------------------------------------
alter table public.attendance_records
  drop constraint if exists attendance_submission_complete;

alter table public.attendance_records
  add constraint attendance_submission_complete check (
    status = 'open'
    or override_closed_by is not null
    or (
      time_out is not null
      and accomplishments is not null and length(trim(accomplishments)) > 0
      and report is not null and length(trim(report)) > 0
      and coalesce(array_length(evidence_paths, 1), 0) >= 1
    )
  );

-- Override-closed rows still need a time_out and a note -- enforced at
-- the DB level as a backstop, same spirit as the constraint above.
alter table public.attendance_records
  drop constraint if exists attendance_override_needs_note;

alter table public.attendance_records
  add constraint attendance_override_needs_note check (
    override_closed_by is null
    or (time_out is not null and override_note is not null and length(trim(override_note)) > 0)
  );

-- ---------------------------------------------------------
-- 3. RLS -- Council President can close anyone's open record
--    (admins already can, via the existing "Admins can update
--    attendance" policy from migration 014).
-- ---------------------------------------------------------
drop policy if exists "Council President can time out others while open" on public.attendance_records;
create policy "Council President can time out others while open"
  on public.attendance_records for update
  using (
    status = 'open'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.position = 'Council President')
  );
