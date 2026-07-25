-- =========================================================
-- SCS Student Council File Repository System
-- FULL SCHEMA — ONE FILE, ONE RUN
--
-- Paste this ENTIRE file into a brand-new Supabase project's
-- SQL Editor and hit Run, once. It will:
--   1. Drop anything this app owns (safe on a fresh project —
--      the DROPs are all "if exists" so they no-op on empty DBs)
--   2. Create every table, function, trigger and RLS policy
--   3. Create the storage buckets + their policies
--   4. Seed the 4 bootstrap Administrative accounts directly
--      into auth.users / auth.identities / public.profiles —
--      no service_role key, no Node script, no Dashboard
--      clicking required. They can log in immediately after
--      this script finishes.
--
-- Safe to re-run any time: every step is idempotent (uses
-- "if exists" / "if not exists" / "on conflict do nothing").
-- =========================================================

-- ---------------------------------------------------------
-- 0. EXTENSIONS + CLEANUP (reverse dependency order)
-- ---------------------------------------------------------
create extension if not exists pgcrypto;

drop table if exists public.file_access_grants cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.access_requests cascade;
drop table if exists public.files cascade;
drop table if exists public.folders cascade;
drop table if exists public.profiles cascade;
drop table if exists public.member_id_counters cascade;
drop table if exists public.grievances cascade;
drop table if exists public.grievance_ticket_counters cascade;

drop function if exists public.set_profile_member_id() cascade;
drop function if exists public.generate_member_id(int) cascade;
drop function if exists public.submit_grievance cascade;
drop function if exists public.track_grievance cascade;
drop function if exists public.generate_grievance_ticket cascade;
drop function if exists public.generate_access_code cascade;
drop function if exists public.touch_grievance_updated_at cascade;

drop policy if exists "Authenticated read storage" on storage.objects;
drop policy if exists "Authenticated upload storage" on storage.objects;
drop policy if exists "Admins delete storage" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Public can view avatars" on storage.objects;


-- ---------------------------------------------------------
-- 1. PROFILES (extends auth.users)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  member_id text unique,
  name text not null,
  email text,
  avatar_url text,
  position text not null,
  department text not null check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  )),
  division text,
  role text not null default 'officer' check (role in ('admin','officer')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or not exists (select 1 from public.profiles) -- allow first bootstrap admin
  );

create policy "Admins can update profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Human-readable Member ID (e.g. "20260001"). Auto-generated as
-- <YEAR><4-digit sequence>: 20260001, 20260002, ... rolling to
-- 20270001 in 2027, etc. `id` stays a uuid (FK into auth.users);
-- `member_id` is the display-friendly one.
create table public.member_id_counters (
  year int primary key,
  next_seq int not null default 1
);

create or replace function public.generate_member_id(p_year int default extract(year from now())::int)
returns text
language plpgsql
security definer
set search_path = public
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
security definer
set search_path = public
as $$
begin
  if new.member_id is null then
    new.member_id := public.generate_member_id(extract(year from now())::int);
  end if;
  return new;
end;
$$;

create trigger trg_set_profile_member_id
  before insert on public.profiles
  for each row execute function public.set_profile_member_id();


-- ---------------------------------------------------------
-- 2. FOLDERS (custom sub-folders created inside module/department/[stage])
-- ---------------------------------------------------------
create table public.folders (
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

create policy "Authenticated can read folders"
  on public.folders for select
  using (auth.role() = 'authenticated');

create policy "Authenticated can create folders"
  on public.folders for insert
  with check (auth.role() = 'authenticated');

-- Admins can edit/delete any folder. A regular officer may only edit/delete
-- a folder they created themselves, and only in a module/department/stage
-- combination they'd currently be allowed to upload into (own department,
-- Document Drafts). View-only access never grants edit/delete.
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


-- ---------------------------------------------------------
-- 3. FILES
-- ---------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  document_name text not null,
  module text not null check (module in ('templates','documents')),
  department text not null check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
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
  date_uploaded timestamptz default now(),
  -- Privacy lock: ANY department's document (Draft or Final Copy) can be
  -- marked Confidential. Once marked, (see the select policy below) it is
  -- only ever visible to Administrative Department members / admins --
  -- regardless of which department actually owns/uploaded the file.
  is_confidential boolean not null default false
);

alter table public.files enable row level security;

-- Everyone authenticated can SEE the listing (name/metadata) of every file,
-- even outside their department (per requirements: "they can only see the
-- list that other departments have but they must request access") --
-- EXCEPT Confidential documents (which any department can mark on their own
-- Drafts or Final Copies), which are only visible to Administrative
-- Department members and admins. Confidential files don't even show up in
-- another department's listing (no "request access" workaround for them),
-- no matter which department originally owns/uploaded the file.
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

-- Insert rules enforced primarily in application logic + this policy:
-- Admins: can insert anywhere, any stage.
-- Officers: can insert only into module='documents', stage='Document Drafts',
-- and only within their own department.
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

-- Admins can edit/delete any file. A regular officer may only edit/delete a
-- file they uploaded themselves, and only where they'd currently be allowed
-- to upload (own department, Document Drafts). View-only access never
-- grants edit/delete.
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


-- ---------------------------------------------------------
-- 4. ACCESS REQUESTS (Ticketing System)
-- ---------------------------------------------------------
create table public.access_requests (
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

create policy "Users can view own requests, admins view all"
  on public.access_requests for select
  using (
    requested_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Authenticated can create requests"
  on public.access_requests for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update requests"
  on public.access_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------
-- 5. GRANTED ACCESS (created automatically when a request is approved)
-- ---------------------------------------------------------
create table public.file_access_grants (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files(id) on delete cascade,
  granted_to uuid references public.profiles(id) on delete cascade,
  granted_at timestamptz default now(),
  unique (file_id, granted_to)
);

alter table public.file_access_grants enable row level security;

create policy "Users can view own grants"
  on public.file_access_grants for select
  using (granted_to = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can insert grants"
  on public.file_access_grants for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------
-- 5B. LEAVE REQUESTS (Leave Form — lives in the same "Requests"
--     area as Access Requests, and follows the same simple
--     Approval Process: pending -> approved/denied by an Admin)
-- ---------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  department text,
  position text,
  reason text not null,
  substitute_id uuid references public.profiles(id),
  substitute_name text,
  date_from date not null,
  date_to date not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  responded_by uuid references public.profiles(id),
  response_note text,
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint leave_requests_date_range check (date_to >= date_from)
);

alter table public.leave_requests enable row level security;

create policy "Users can view own leave requests, admins view all"
  on public.leave_requests for select
  using (
    requested_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Authenticated can create leave requests"
  on public.leave_requests for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update leave requests"
  on public.leave_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------
-- 6. STORAGE BUCKETS
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scs-files', 'scs-files', false)
on conflict (id) do nothing;

create policy "Authenticated read storage"
  on storage.objects for select
  using (bucket_id = 'scs-files' and auth.role() = 'authenticated');

create policy "Authenticated upload storage"
  on storage.objects for insert
  with check (bucket_id = 'scs-files' and auth.role() = 'authenticated');

create policy "Admins delete storage"
  on storage.objects for delete
  using (bucket_id = 'scs-files' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Owners can delete/replace the storage object behind a file they uploaded
-- (matches the "Owners and admins can delete/update files" policies above).
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

-- Public avatar bucket (display pictures, not sensitive documents)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

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

create policy "Public can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');


-- ---------------------------------------------------------
-- 7. GRIEVANCES
-- 1. TABLE
-- ---------------------------------------------------------
create table public.grievances (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  access_code text not null,
  type text not null check (type in ('feedback', 'formal_complaint')),
  is_anonymous boolean not null default false,
  submitter_name text,
  submitter_email text,
  submitter_contact text,
  subject text not null,
  details text not null,
  department text,
  evidence_paths text[] not null default '{}',
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'resolved', 'dismissed')),
  admin_notes text,       -- internal only, never returned to the public
  resolution text,        -- shown to the submitter when they track their ticket
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grievances enable row level security;

-- Staff only. No anon/public policies on this table at all --
-- public interaction happens exclusively through the two functions below.
create policy "Staff can view grievances"
  on public.grievances for select
  using (auth.role() = 'authenticated');

create policy "Admins can update grievances"
  on public.grievances for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.touch_grievance_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_grievance_updated_at
  before update on public.grievances
  for each row execute function public.touch_grievance_updated_at();

-- ---------------------------------------------------------
-- 2. TICKET NUMBER + ACCESS CODE GENERATION
-- ---------------------------------------------------------
create table public.grievance_ticket_counters (
  year int primary key,
  next_seq int not null default 1
);

create or replace function public.generate_grievance_ticket(p_year int default extract(year from now())::int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.grievance_ticket_counters (year, next_seq)
  values (p_year, 2)
  on conflict (year) do update set next_seq = public.grievance_ticket_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'GRV-' || p_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- 8 chars from a set with no ambiguous characters (no 0/O, 1/I).
-- Paired with the ticket_number, this is what proves someone tracking
-- a ticket is the person who submitted it (or was given the code).
create or replace function public.generate_access_code()
returns text
language plpgsql
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1);
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------
-- 3. PUBLIC RPCs
-- ---------------------------------------------------------
create or replace function public.submit_grievance(
  p_type text,
  p_is_anonymous boolean,
  p_submitter_name text,
  p_submitter_email text,
  p_submitter_contact text,
  p_subject text,
  p_details text,
  p_department text,
  p_evidence_paths text[]
)
returns table(ticket_number text, access_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket text;
  v_code text;
  v_anonymous boolean;
begin
  if p_type not in ('feedback', 'formal_complaint') then
    raise exception 'Invalid grievance type.';
  end if;
  if coalesce(trim(p_subject), '') = '' then
    raise exception 'Subject is required.';
  end if;
  if coalesce(trim(p_details), '') = '' then
    raise exception 'Details are required.';
  end if;

  -- Formal complaints can never be anonymous, and need evidence + a name.
  if p_type = 'formal_complaint' then
    if coalesce(trim(p_submitter_name), '') = '' then
      raise exception 'Name is required for a formal complaint.';
    end if;
    if p_evidence_paths is null or array_length(p_evidence_paths, 1) is null then
      raise exception 'At least one piece of evidence is required for a formal complaint.';
    end if;
    v_anonymous := false;
  else
    v_anonymous := coalesce(p_is_anonymous, false);
  end if;

  v_ticket := public.generate_grievance_ticket();
  v_code := public.generate_access_code();

  insert into public.grievances (
    ticket_number, access_code, type, is_anonymous,
    submitter_name, submitter_email, submitter_contact,
    subject, details, department, evidence_paths
  ) values (
    v_ticket, v_code, p_type, v_anonymous,
    case when v_anonymous then null else nullif(trim(p_submitter_name), '') end,
    case when v_anonymous then null else nullif(trim(p_submitter_email), '') end,
    case when v_anonymous then null else nullif(trim(p_submitter_contact), '') end,
    trim(p_subject), trim(p_details), nullif(trim(p_department), ''),
    coalesce(p_evidence_paths, '{}')
  );

  return query select v_ticket, v_code;
end;
$$;

create or replace function public.track_grievance(p_ticket_number text, p_access_code text)
returns table(
  ticket_number text,
  type text,
  status text,
  subject text,
  department text,
  submitted_at timestamptz,
  updated_at timestamptz,
  resolution text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select g.ticket_number, g.type, g.status, g.subject, g.department,
         g.created_at, g.updated_at, g.resolution
  from public.grievances g
  where g.ticket_number = upper(trim(p_ticket_number))
  and g.access_code = upper(trim(p_access_code));
end;
$$;

grant execute on function public.submit_grievance to anon, authenticated;
grant execute on function public.track_grievance to anon, authenticated;

-- ---------------------------------------------------------
-- 4. EVIDENCE STORAGE
-- Private bucket. Anyone can upload (the report form runs with no
-- login), but only staff can read the files back.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('grievance-evidence', 'grievance-evidence', false)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload grievance evidence" on storage.objects;
drop policy if exists "Staff can view grievance evidence" on storage.objects;

create policy "Anyone can upload grievance evidence"
  on storage.objects for insert
  with check (bucket_id = 'grievance-evidence');

create policy "Staff can view grievance evidence"
  on storage.objects for select
  using (bucket_id = 'grievance-evidence' and auth.role() = 'authenticated');


-- ---------------------------------------------------------
-- 8. SEED DATA — the 4 bootstrap Administrative Department accounts
--
-- Inserted straight into auth.users + auth.identities (this works
-- because the SQL Editor runs as the Postgres superuser, which has
-- full access to the auth schema — no service_role key needed here).
-- Each account is created pre-confirmed, so you can log in with the
-- email/password below the second this script finishes.
--
--   lance.deleon@scs-sc.edu.ph        password: SCSSC20262027
--   franchezka.nazareno@scs-sc.edu.ph password: SCSSC20262027
--   hann.bacsa@scs-sc.edu.ph          password: SCSSC20262027
--   randlyn.monares@scs-sc.edu.ph     password: SCSSC20262027
--
-- ⚠️ Change these passwords after first login (Settings page).
-- Safe to re-run: existing accounts (matched by email) are skipped.
-- ---------------------------------------------------------
do $$
declare
  v_admins jsonb := '[
    {"email":"lance.deleon@scs-sc.edu.ph","name":"Lance Win Alexandrei De Leon","position":"Council President","division":"Office of the President","member_id":"20260001"},
    {"email":"franchezka.nazareno@scs-sc.edu.ph","name":"Franchezka Nazareno","position":"Executive Secretary","division":"Executive Support","member_id":"20260002"},
    {"email":"hann.bacsa@scs-sc.edu.ph","name":"Hann Dareen Bacsa","position":"Deputy Secretary","division":"Executive Support","member_id":"20260003"},
    {"email":"randlyn.monares@scs-sc.edu.ph","name":"Randlyn Faith Monares","position":"Administrative Aide","division":"Executive Support","member_id":"20260004"}
  ]';
  v_password text := 'SCSSC20262027';
  v_admin jsonb;
  v_user_id uuid;
  v_existing_id uuid;
begin
  for v_admin in select * from jsonb_array_elements(v_admins)
  loop
    select id into v_existing_id from auth.users where email = v_admin->>'email' limit 1;

    if v_existing_id is not null then
      v_user_id := v_existing_id;
    else
      v_user_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id, 'authenticated', 'authenticated',
        v_admin->>'email', crypt(v_password, gen_salt('bf')),
        now(), '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', v_admin->>'name'),
        false, now(), now()
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id::text, v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_admin->>'email'),
        'email', now(), now(), now()
      );
    end if;

    insert into public.profiles (id, member_id, name, email, position, department, division, role)
    values (
      v_user_id, v_admin->>'member_id', v_admin->>'name', v_admin->>'email',
      v_admin->>'position', 'Administrative Department', v_admin->>'division', 'admin'
    )
    on conflict (id) do update set
      member_id = excluded.member_id,
      name = excluded.name,
      email = excluded.email,
      position = excluded.position,
      department = excluded.department,
      division = excluded.division,
      role = excluded.role;
  end loop;
end $$;

-- Keep the per-year member_id counter in sync with the seeded accounts above,
-- so the NEXT account created (2026) starts at 20260005, not 20260001 again.
insert into public.member_id_counters (year, next_seq)
values (extract(year from now())::int, 5)
on conflict (year) do update set
  next_seq = greatest(public.member_id_counters.next_seq, excluded.next_seq);

-- =========================================================
-- Done. Every other officer account can now be created straight
-- from the app's "Manage Accounts" page (Administrative accounts
-- only) — no more manual SQL needed after this one run.
-- =========================================================
-- =========================================================
-- 008. APPROVALS + PRINTING WORKFLOW
--
-- Adds:
--   - public.approval_chain_steps  (admin-configured, ordered list
--     of positions that must sign off on a department's documents,
--     e.g. Accounting Officer -> Finance Director -> VP for
--     Internal Affairs -> President)
--   - public.file_approvals        (one row per file per step —
--     the actual, in-progress approval trail for a given file)
--   - new columns on public.files  (approval_status, printed /
--     wet_signed flags for the Executive Secretary + Deputy
--     Secretary "For Review and Printing" workflow)
--
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 1. FILES: new workflow columns
-- ---------------------------------------------------------
alter table public.files
  add column if not exists approval_status text not null default 'none'
    check (approval_status in ('none', 'pending_approval', 'approved_for_printing', 'rejected')),
  add column if not exists printed boolean not null default false,
  add column if not exists printed_by uuid references public.profiles(id),
  add column if not exists printed_by_name text,
  add column if not exists printed_at timestamptz,
  add column if not exists wet_signed boolean not null default false,
  add column if not exists wet_signed_by uuid references public.profiles(id),
  add column if not exists wet_signed_by_name text,
  add column if not exists wet_signed_at timestamptz,
  add column if not exists submitted_for_approval_by uuid references public.profiles(id),
  add column if not exists submitted_for_approval_at timestamptz;

-- ---------------------------------------------------------
-- 2. APPROVAL CHAIN STEPS (admin-configured, per department)
--    Example (Internal Affairs Department):
--      1. Accounting Officer
--      2. Finance Director
--      3. Vice President for Internal Affairs
--      4. President            <- is_president = true (final step,
--                                  "Approve for Printing")
-- ---------------------------------------------------------
create table if not exists public.approval_chain_steps (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  )),
  step_order int not null check (step_order > 0),
  position_title text not null,
  is_president boolean not null default false,
  created_at timestamptz default now(),
  unique (department, step_order)
);

alter table public.approval_chain_steps enable row level security;

drop policy if exists "Authenticated can view approval chains" on public.approval_chain_steps;
create policy "Authenticated can view approval chains"
  on public.approval_chain_steps for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins manage approval chains" on public.approval_chain_steps;
create policy "Admins manage approval chains"
  on public.approval_chain_steps for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------
-- 3. FILE APPROVALS (the live trail for one submitted file —
--    a snapshot of the chain at time of submission, so editing
--    the chain later doesn't rewrite history for files already
--    in progress)
-- ---------------------------------------------------------
create table if not exists public.file_approvals (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  step_order int not null,
  position_title text not null,
  is_president boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  action text check (action in ('approved', 'approved_for_printing', 'rejected')),
  approved_by uuid references public.profiles(id),
  approved_by_name text,
  note text,
  acted_at timestamptz,
  created_at timestamptz default now(),
  unique (file_id, step_order)
);

alter table public.file_approvals enable row level security;

drop policy if exists "Authenticated can view file approvals" on public.file_approvals;
create policy "Authenticated can view file approvals"
  on public.file_approvals for select
  using (auth.role() = 'authenticated');

-- Submitted only by the file's owner (or an admin) — application
-- inserts one row per chain step at submission time.
drop policy if exists "Owner or admin can submit approvals" on public.file_approvals;
create policy "Owner or admin can submit approvals"
  on public.file_approvals for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.files f
      where f.id = file_approvals.file_id
      and f.uploaded_by = auth.uid()
    )
  );

-- A step can only be acted on by the officer/exec whose position
-- matches that step, and only once every earlier step in the same
-- file's chain has already been approved (enforces in-order sign-off
-- even if someone bypasses the UI). Admins can override.
drop policy if exists "Position holder can act on their pending step" on public.file_approvals;
create policy "Position holder can act on their pending step"
  on public.file_approvals for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      file_approvals.status = 'pending'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and p.position = file_approvals.position_title
      )
      and not exists (
        select 1 from public.file_approvals earlier
        where earlier.file_id = file_approvals.file_id
        and earlier.step_order < file_approvals.step_order
        and earlier.status <> 'approved'
      )
    )
  );

-- Owner/admin can clear a rejected/in-progress chain to resubmit.
drop policy if exists "Owner or admin can delete file approvals" on public.file_approvals;
create policy "Owner or admin can delete file approvals"
  on public.file_approvals for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.files f
      where f.id = file_approvals.file_id
      and f.uploaded_by = auth.uid()
    )
  );
