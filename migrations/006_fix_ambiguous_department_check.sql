-- ---------------------------------------------------------
-- 006_fix_ambiguous_department_check.sql
--
-- BUG FIXED: in every owner-check policy added by 005, the clause
--   ... and department = p.department
-- is ambiguous. `profiles` (aliased `p`) also has a `department`
-- column, so PostgreSQL resolves the unqualified `department` on
-- the left-hand side to `p.department` too -- meaning it silently
-- compares p.department to itself (always true) instead of
-- comparing the file/folder's department to the profile's
-- department. Same bug in the INSERT "Upload rules" policy.
--
-- Net effect: the department restriction for officers was a no-op.
-- This didn't cause incorrect DENIALS (the opposite -- it was too
-- permissive), but it's wrong and is fixed here by explicitly
-- qualifying every column with its table.
--
-- Safe to re-run.
-- ---------------------------------------------------------

-- FILES ------------------------------------------------------
drop policy if exists "Owners and admins can delete files" on public.files;
drop policy if exists "Owners and admins can update files" on public.files;
drop policy if exists "Upload rules" on public.files;

create policy "Owners and admins can delete files"
  on public.files for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      files.uploaded_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and files.module = 'documents'
        and files.stage = 'Document Drafts'
        and files.department = p.department
      )
    )
  );

create policy "Owners and admins can update files"
  on public.files for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      files.uploaded_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and files.module = 'documents'
        and files.stage = 'Document Drafts'
        and files.department = p.department
      )
    )
  );

create policy "Upload rules"
  on public.files for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (
          p.role = 'officer'
          and files.module = 'documents'
          and files.stage = 'Document Drafts'
          and files.department = p.department
        )
      )
    )
  );

-- FOLDERS ------------------------------------------------------
drop policy if exists "Owners and admins can update folders" on public.folders;
drop policy if exists "Owners and admins can delete folders" on public.folders;

create policy "Owners and admins can update folders"
  on public.folders for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      folders.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and folders.module = 'documents'
        and folders.stage = 'Document Drafts'
        and folders.department = p.department
      )
    )
  );

create policy "Owners and admins can delete folders"
  on public.folders for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      folders.created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and folders.module = 'documents'
        and folders.stage = 'Document Drafts'
        and folders.department = p.department
      )
    )
  );
