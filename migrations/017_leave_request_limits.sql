-- =========================================================
-- 017. LEAVE REQUEST LIMITS
--
-- Two rules on top of public.leave_requests (013_leave_requests.sql):
--   1. A single leave request can't span more than 5 straight days.
--   2. An officer's leave days can't add up to more than 5 in any
--      one calendar month, counting across all their requests that
--      are still 'pending' or already 'approved' (a 'denied' request
--      doesn't count against the limit -- it never happened).
--      A request that itself straddles two months is split at the
--      month boundary and each side is checked against that month's
--      running total.
--
-- Enforced at the DB level (checked on both insert and update) so it
-- can't be bypassed by a client bug, same as the UI-level checks in
-- LeaveFormModal.jsx.
--
-- Safe to re-run (idempotent).
-- =========================================================

-- Rule 1: simple table-level check, cheapest to enforce.
alter table public.leave_requests
  drop constraint if exists leave_requests_max_5_consecutive_days;
alter table public.leave_requests
  add constraint leave_requests_max_5_consecutive_days
  check ((date_to - date_from) + 1 <= 5);

-- Rule 2: needs to look across an officer's other requests, so it's a
-- trigger rather than a plain check constraint.
create or replace function public.leave_requests_enforce_monthly_cap()
returns trigger
language plpgsql
as $$
declare
  v_month date;
  v_month_start date;
  v_month_end date;
  v_existing_days int;
  v_new_days int;
begin
  v_month := date_trunc('month', new.date_from)::date;

  while v_month <= date_trunc('month', new.date_to)::date loop
    v_month_start := v_month;
    v_month_end := (v_month + interval '1 month' - interval '1 day')::date;

    -- Days already committed (pending or approved) by this officer that
    -- fall inside this month, across their OTHER requests.
    select coalesce(sum(
      least(lr.date_to, v_month_end) - greatest(lr.date_from, v_month_start) + 1
    ), 0)
    into v_existing_days
    from public.leave_requests lr
    where lr.requested_by = new.requested_by
      and lr.status in ('pending', 'approved')
      and lr.id is distinct from new.id
      and lr.date_from <= v_month_end
      and lr.date_to >= v_month_start;

    -- Days of THIS request that fall inside this month.
    v_new_days := least(new.date_to, v_month_end) - greatest(new.date_from, v_month_start) + 1;

    if new.status in ('pending', 'approved') and (v_existing_days + v_new_days) > 5 then
      raise exception
        'Monthly leave limit exceeded: % already has % day(s) of leave filed for %, and this request adds % more (max 5 per month).',
        new.requested_by_name, v_existing_days, to_char(v_month, 'FMMonth YYYY'), v_new_days;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_leave_requests_monthly_cap on public.leave_requests;
create trigger trg_leave_requests_monthly_cap
  before insert or update on public.leave_requests
  for each row
  execute function public.leave_requests_enforce_monthly_cap();
