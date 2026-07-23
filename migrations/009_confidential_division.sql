-- =========================================================
-- 009. CONFIDENTIAL PRIVACY LOCK
--
-- Adds an is_confidential flag to public.files. A Confidential
-- document can only ever belong to the Administrative Department
-- (enforced by a check constraint), and can only be SEEN (not just
-- downloaded -- the row itself is hidden from the listing) by
-- Administrative Department members and admins.
--
-- Division values themselves (Finance Division, Planning Division,
-- etc.) are just free text on public.files.division / public.profiles
-- .division, matched in the UI against src/supabaseClient.js's
-- DIVISIONS_BY_DEPARTMENT map -- no DB constraint needed there.
--
-- Safe to re-run (idempotent).
-- =========================================================

alter table public.files
  add column if not exists is_confidential boolean not null default false;

alter table public.files
  drop constraint if exists files_confidential_admin_only;

alter table public.files
  add constraint files_confidential_admin_only check (
    not is_confidential or department = 'Administrative Department'
  );

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
