-- =========================================================
-- 015. COUNCIL PRESIDENT: VIEW ALL + DELETE ANY ATTENDANCE RECORD
--
-- The Council President sits at the top of the approval chain
-- (see migrations/014_attendance.sql) but previously could only
-- see their own record plus records currently pending their
-- approval, and could only delete their OWN record while 'open'
-- or 'denied', same as any other officer.
--
-- This lets whoever currently holds the "Council President"
-- position:
--   - View every officer's attendance records (needed for the
--     per-officer Attendance Summary tab), and
--   - Delete any officer's attendance record for any day -- e.g.
--     to correct a mistaken/duplicate entry -- the same override
--     power admins already have.
--
-- Whoever holds the position is resolved live from profiles.position,
-- same drift-proof pattern used by approver_position in 014.
--
-- Safe to re-run (idempotent).
-- =========================================================

drop policy if exists "Council President can view all attendance" on public.attendance_records;
create policy "Council President can view all attendance"
  on public.attendance_records for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.position = 'Council President')
  );

drop policy if exists "Owner can discard open/denied, admin any" on public.attendance_records;
drop policy if exists "Owner can discard open/denied, admin or council president any" on public.attendance_records;
create policy "Owner can discard open/denied, admin or council president any"
  on public.attendance_records for delete
  using (
    (officer_id = auth.uid() and status in ('open', 'denied'))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.position = 'Council President')
  );
