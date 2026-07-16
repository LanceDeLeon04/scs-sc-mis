-- =========================================================
-- Migration: Profile Picture support
-- Run this in Supabase SQL Editor (safe to run on an existing project)
-- =========================================================

-- 1. Add avatar_url column to profiles
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Create a public bucket for avatars (public = true, since these are
--    just display pictures, not sensitive documents)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Anyone signed in can upload/replace their OWN avatar
--    (object path convention enforced by the app: "<user-id>/avatar.<ext>")
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Since the bucket is public, anyone (including logged-out visitors on
--    the login screen) can view avatar images
create policy "Public can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
