-- =========================================================
-- Human-readable Member IDs (e.g. "20260001")
--
-- Why: public.profiles.id must stay a uuid because it is a
-- foreign key into auth.users(id) — that's how Supabase Auth
-- links a login to a profile row, and it's why pasting a value
-- like '20260001' into `id` throws:
--   ERROR 22P02: invalid input syntax for type uuid
--
-- This migration adds a SEPARATE text column, member_id, that
-- holds the "20260001"-style ID. It's auto-generated in the
-- format <YEAR><4-digit sequence>, e.g. 20260001, 20260002...
-- and rolls to 20270001 for accounts created in 2027, etc.
-- The generator is atomic (safe even if two accounts are
-- created at the exact same time).
-- =========================================================

alter table public.profiles add column if not exists member_id text unique;

-- Per-year running counter (2026 -> 1, 2, 3..., 2027 -> 1, 2, 3...)
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

-- Auto-assign member_id on insert whenever it isn't explicitly provided,
-- so both the app's "Create Officer Account" form and any manual SQL
-- inserts (like migrations/003_first_admins.sql) get the same format.
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

-- Backfill member_id for any existing rows that don't have one yet
-- (ordered by created_at so earlier accounts get earlier numbers).
do $$
declare
  r record;
begin
  for r in
    select id from public.profiles where member_id is null order by created_at asc
  loop
    update public.profiles
    set member_id = public.generate_member_id(extract(year from now())::int)
    where id = r.id;
  end loop;
end $$;
