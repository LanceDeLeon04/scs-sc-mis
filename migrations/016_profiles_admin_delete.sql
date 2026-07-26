-- =========================================================
-- 016. ADMINS CAN DELETE PROFILES
--
-- profiles already has "Admins can update profiles" (schema.sql),
-- which covers editing name/position/email/department/division/role
-- from the Accounts page. This adds the matching delete policy.
--
-- Note: deleting a profile row here does NOT delete the matching
-- auth.users row (profiles.id -> auth.users.id is one-way FK with
-- on delete cascade, not the reverse). Actually removing someone's
-- login must go through the manage-officer Edge Function (service
-- role), which deletes the auth.users row and lets the FK cascade
-- remove the profile automatically. This RLS policy exists as a
-- defense-in-depth backstop, not the primary deletion path.
--
-- Safe to re-run (idempotent).
-- =========================================================

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
