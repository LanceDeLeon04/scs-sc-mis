-- ---------------------------------------------------------
-- 005_owner_edit_delete.sql
--
-- Lets a user edit/delete a file or folder ONLY in places they'd
-- currently be allowed to upload into (own department + Document
-- Drafts for officers, anywhere for admins), and only items they
-- created themselves. View-only access never grants edit/delete.
--
-- Run this once on an existing Supabase project that was created
-- from an older version of schema.sql. New projects don't need this
-- -- it's already included directly in schema.sql.
-- ---------------------------------------------------------

-- FILES: replace the old admin-only update/delete policies with
-- owner-or-admin versions.
drop policy if exists "Admins can delete/update files" on public.files;
drop policy if exists "Admins can update files" on public.files;
drop policy if exists "Owners and admins can delete files" on public.files;
drop policy if exists "Owners and admins can update files" on public.files;

create policy "Owners and admins can delete files"
  on public.files for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      uploaded_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and module = 'documents'
        and stage = 'Document Drafts'
        and department = p.department
      )
    )
  );

create policy "Owners and admins can update files"
  on public.files for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      uploaded_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and module = 'documents'
        and stage = 'Document Drafts'
        and department = p.department
      )
    )
  );

-- FOLDERS: previously had no update/delete policy at all (default deny).
drop policy if exists "Owners and admins can update folders" on public.folders;
drop policy if exists "Owners and admins can delete folders" on public.folders;

create policy "Owners and admins can update folders"
  on public.folders for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and module = 'documents'
        and stage = 'Document Drafts'
        and department = p.department
      )
    )
  );

create policy "Owners and admins can delete folders"
  on public.folders for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      created_by = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.role = 'officer'
        and module = 'documents'
        and stage = 'Document Drafts'
        and department = p.department
      )
    )
  );

-- STORAGE: let a user delete/replace the object behind a file they own.
drop policy if exists "Owners delete own storage" on storage.objects;

create policy "Owners delete own storage"
  on storage.objects for delete
  using (
    bucket_id = 'scs-files'
    and exists (
      select 1 from public.files f
      where f.storage_path = storage.objects.name
      and f.uploaded_by = auth.uid()
    )
  );
