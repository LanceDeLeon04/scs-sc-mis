-- ---------------------------------------------------------
-- 007_grievances.sql
--
-- Public complaints/feedback system. Students never log in.
--
-- DESIGN NOTE: rather than exposing the `grievances` table directly
-- to anon via RLS (which is how the edit/delete bugs happened --
-- RLS conditions are easy to get subtly wrong), all public access
-- goes through two SECURITY DEFINER functions that bypass RLS
-- internally and only return exactly the fields a stranger on the
-- internet should see:
--
--   submit_grievance(...)          -- anyone can call; inserts a row,
--                                      returns {ticket_number, access_code}
--   track_grievance(ticket, code)  -- anyone can call; returns status
--                                      ONLY if both ticket + code match
--
-- The `grievances` table itself has no public select/insert policy at
-- all -- only staff (authenticated) can query it directly, to review
-- and manage submissions from inside the app.
--
-- Safe to re-run.
-- ---------------------------------------------------------

drop table if exists public.grievances cascade;
drop table if exists public.grievance_ticket_counters cascade;
drop function if exists public.submit_grievance cascade;
drop function if exists public.track_grievance cascade;
drop function if exists public.generate_grievance_ticket cascade;
drop function if exists public.generate_access_code cascade;
drop function if exists public.touch_grievance_updated_at cascade;

-- ---------------------------------------------------------
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
