-- =========================================================
-- 010. CONFIDENTIAL — ALLOW ANY DEPARTMENT TO MARK
--
-- Migration 009 restricted the is_confidential flag so it could
-- only ever be set on Administrative Department files (via a check
-- constraint). This migration lifts that restriction: a document
-- belonging to ANY department, in either Document Drafts or Final
-- Copies, may now be marked Confidential.
--
-- The visibility rule is UNCHANGED and still applies regardless of
-- which department owns the file: once is_confidential = true, only
-- Administrative Department members and admins can see/access it
-- (enforced by the "Authenticated can view file listings" select
-- policy, which was already department-agnostic).
--
-- Safe to re-run (idempotent).
-- =========================================================

alter table public.files
  drop constraint if exists files_confidential_admin_only;

-- No replacement constraint -- is_confidential is now legal on any
-- department's files. The select policy from 009 already handles
-- restricting *visibility* to Administrative Department / admins and
-- does not need to change, but it's re-created here defensively in
-- case this migration is ever run standalone against an older schema.
drop policy if exists "Authenticated can view file listings" on public.files;
create policy "Authenticated can view file listings"
  on public.files for select
  using (
    not is_confidential
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'admin' or p.department = 'Administrative Department')
    )
  );
