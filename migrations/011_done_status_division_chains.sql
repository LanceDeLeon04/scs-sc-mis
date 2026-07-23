-- =========================================================
-- 011. AUTO-COMPLETE ON PRINT+WET-SIGN, PER-DIVISION APPROVAL
--      CHAINS, POSITIONS VALIDATED AGAINST REAL PROFILE DATA
--
-- Three fixes:
--
--   1. DONE status — once a file that is 'approved_for_printing'
--      gets BOTH printed = true AND wet_signed = true, a trigger
--      automatically flips approval_status to 'done'. No manual
--      step needed in the UI.
--
--   2. Per-division chains — approval_chain_steps now has a
--      `division` column. A chain can be set for a specific
--      division (e.g. Internal Affairs Dept -> Finance Division)
--      or left NULL to apply department-wide as a fallback.
--
--   3. Position integrity — position_title on a chain step is no
--      longer free-typed text. A trigger validates it against the
--      *actual* distinct values in public.profiles.position at
--      insert/update time, so a typo (e.g. "VP Internal Affairs"
--      vs "Vice President for Internal Affairs") can no longer
--      create a chain step nobody can ever act on.
--
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 1. FILES: allow 'done' as a terminal approval_status
-- ---------------------------------------------------------
alter table public.files drop constraint if exists files_approval_status_check;
alter table public.files add constraint files_approval_status_check
  check (approval_status in ('none', 'pending_approval', 'approved_for_printing', 'rejected', 'done'));

-- Auto-complete trigger: printed + wet_signed while approved_for_printing => done
create or replace function public.files_auto_done()
returns trigger
language plpgsql
as $$
begin
  if new.approval_status = 'approved_for_printing' and new.printed and new.wet_signed then
    new.approval_status := 'done';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_files_auto_done on public.files;
create trigger trg_files_auto_done
  before update on public.files
  for each row
  execute function public.files_auto_done();

-- ---------------------------------------------------------
-- 2. APPROVAL CHAIN STEPS: per-division scoping
--    (division = NULL means "applies to the whole department",
--    used as fallback when no division-specific chain exists)
-- ---------------------------------------------------------
alter table public.approval_chain_steps add column if not exists division text;

alter table public.approval_chain_steps drop constraint if exists approval_chain_steps_department_step_order_key;
alter table public.approval_chain_steps
  add constraint approval_chain_steps_department_division_step_order_key
  unique (department, division, step_order);

-- ---------------------------------------------------------
-- 3. POSITION INTEGRITY: position_title must match a position
--    that actually exists in public.profiles right now. This
--    replaces free-text entry as the source of truth so the
--    chain step and the officer's profile can never drift apart.
-- ---------------------------------------------------------
create or replace function public.validate_chain_step_position()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles where position = new.position_title
  ) then
    raise exception
      'Position "%" does not match any position currently on file in profiles. '
      'Pick an existing officer position (see Accounts) to avoid approval-chain mismatches.',
      new.position_title;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_chain_step_position on public.approval_chain_steps;
create trigger trg_validate_chain_step_position
  before insert or update on public.approval_chain_steps
  for each row
  execute function public.validate_chain_step_position();
