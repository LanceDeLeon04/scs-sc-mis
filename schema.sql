-- =========================================================
-- SCS Student Council File Repository System
-- Supabase SQL Schema (run in Supabase SQL Editor)
-- =========================================================

-- 1. PROFILES (extends auth.users) --------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  position text not null,
  department text not null check (department in (
    'GENERAL','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  )),
  division text,
  role text not null default 'officer' check (role in ('admin','officer')),
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;

-- Human-readable Member ID (e.g. "20260001"), separate from the uuid
-- `id` above (which must stay a uuid since it's a foreign key into
-- auth.users). Auto-generated as <YEAR><4-digit sequence>: 20260001,
-- 20260002, ... rolling to 20270001 in 2027, etc. See
-- migrations/004_member_ids.sql for the same logic with more comments.
alter table public.profiles add column if not exists member_id text unique;

create table if not exists public.member_id_counters (
  year int primary key,
  next_seq int not null default 1
);

create or replace function public.generate_member_id(p_year int default extract(year from now())::int)
returns text
language plpgsql
as $$
declare
  v_seq int;
begin
  insert into public.member_id_counters (year, next_seq)
  values (p_year, 2)
  on conflict (year) do update set next_seq = public.member_id_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  return p_year::text || lpad(v_seq::text, 4, '0');
end;
$$;

create or replace function public.set_profile_member_id()
returns trigger
language plpgsql
as $$
begin
  if new.member_id is null then
    new.member_id := public.generate_member_id(extract(year from now())::int);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_profile_member_id on public.profiles;
create trigger trg_set_profile_member_id
  before insert on public.profiles
  for each row execute function public.set_profile_member_id();

alter table public.profiles enable row level security;

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins can insert profiles" on public.profiles;
create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or not exists (select 1 from public.profiles) -- allow first bootstrap admin
  );

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- 2. FOLDERS (custom sub-folders created inside module/department/[stage]) --
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('templates','documents')),
  department text not null,
  stage text check (stage in ('Document Drafts','Final Copies')), -- only for documents module
  name text not null,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.folders enable row level security;

drop policy if exists "Authenticated can read folders" on public.folders;
create policy "Authenticated can read folders"
  on public.folders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated can create folders" on public.folders;
create policy "Authenticated can create folders"
  on public.folders for insert
  with check (auth.role() = 'authenticated');


-- 3. FILES ----------------------------------------------------------------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  document_name text not null,
  module text not null check (module in ('templates','documents')),
  department text not null check (department in (
    'GENERAL','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  )),
  stage text check (stage in ('Document Drafts','Final Copies')), -- required if module = 'documents'
  folder_id uuid references public.folders(id) on delete set null,
  division text,
  version_number text default '1.0',
  storage_path text,           -- path in storage bucket (actual attachment)
  external_link text,          -- OR an external link instead of a file
  uploaded_by uuid references public.profiles(id),
  uploaded_by_name text,
  date_uploaded timestamptz default now()
);

alter table public.files enable row level security;

-- Everyone authenticated can SEE the listing (name/metadata) of every file,
-- even outside their department (per requirements: "they can only see the
-- list that other departments have but they must request access").
drop policy if exists "Authenticated can view file listings" on public.files;
create policy "Authenticated can view file listings"
  on public.files for select
  using (auth.role() = 'authenticated');

-- Insert rules enforced primarily in application logic + this policy:
-- Admins: can insert anywhere, any stage.
-- Officers: can insert only into module='documents', stage='Document Drafts',
-- and only within their own department.
drop policy if exists "Upload rules" on public.files;
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
          and module = 'documents'
          and stage = 'Document Drafts'
          and department = p.department
        )
      )
    )
  );

drop policy if exists "Admins can delete/update files" on public.files;
create policy "Admins can delete/update files"
  on public.files for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update files" on public.files;
create policy "Admins can update files"
  on public.files for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- 4. ACCESS REQUESTS (Ticketing System) ------------------------------------
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  requester_department text,
  target_department text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  responded_by uuid references public.profiles(id),
  response_note text,
  created_at timestamptz default now(),
  responded_at timestamptz
);

alter table public.access_requests enable row level security;

drop policy if exists "Users can view own requests, admins view all" on public.access_requests;
create policy "Users can view own requests, admins view all"
  on public.access_requests for select
  using (
    requested_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Authenticated can create requests" on public.access_requests;
create policy "Authenticated can create requests"
  on public.access_requests for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Admins can update requests" on public.access_requests;
create policy "Admins can update requests"
  on public.access_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- 5. GRANTED ACCESS (created automatically when a request is approved) -----
create table if not exists public.file_access_grants (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files(id) on delete cascade,
  granted_to uuid references public.profiles(id) on delete cascade,
  granted_at timestamptz default now(),
  unique (file_id, granted_to)
);

alter table public.file_access_grants enable row level security;

drop policy if exists "Users can view own grants" on public.file_access_grants;
create policy "Users can view own grants"
  on public.file_access_grants for select
  using (granted_to = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can insert grants" on public.file_access_grants;
create policy "Admins can insert grants"
  on public.file_access_grants for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- 6. STORAGE BUCKET ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scs-files', 'scs-files', false)
on conflict (id) do nothing;

-- Authenticated users can read objects (actual gating happens at the `files`
-- table row level + application layer, which only reveals storage_path/URLs
-- to users who own the department or have an approved grant).
drop policy if exists "Authenticated read storage" on storage.objects;
create policy "Authenticated read storage"
  on storage.objects for select
  using (bucket_id = 'scs-files' and auth.role() = 'authenticated');

drop policy if exists "Authenticated upload storage" on storage.objects;
create policy "Authenticated upload storage"
  on storage.objects for insert
  with check (bucket_id = 'scs-files' and auth.role() = 'authenticated');

drop policy if exists "Admins delete storage" on storage.objects;
create policy "Admins delete storage"
  on storage.objects for delete
  using (bucket_id = 'scs-files' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- =========================================================
-- BOOTSTRAP: after creating your first user via Supabase Auth
-- (Dashboard > Authentication > Users > Add user), run this
-- to make them an admin. Replace the UUID + values.
-- =========================================================
-- insert into public.profiles (id, name, position, department, division, role)
-- values ('PASTE-USER-UUID-HERE', 'Juan Dela Cruz', 'Secretary General',
--         'Administrative Department', 'Executive', 'admin');
