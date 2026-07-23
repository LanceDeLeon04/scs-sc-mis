-- =========================================================
-- 012. ADD "Commissions" AS AN ALLOWED DEPARTMENT
--
-- The app now shows separate GENERAL and Commissions folders
-- (previously "Commissions" was buried inside GENERAL as a division
-- placeholder). The three tables that whitelist department values
-- via a check constraint need "Commissions" added, or any insert
-- tagged department = 'Commissions' (profiles, files, or an
-- approval chain step) will be rejected by Postgres.
--
-- Safe to re-run (idempotent).
-- =========================================================

-- PROFILES ------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check
  check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  ));

-- FILES ------------------------------------------------------
alter table public.files drop constraint if exists files_department_check;
alter table public.files add constraint files_department_check
  check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  ));

-- APPROVAL CHAIN STEPS ------------------------------------------
alter table public.approval_chain_steps drop constraint if exists approval_chain_steps_department_check;
alter table public.approval_chain_steps add constraint approval_chain_steps_department_check
  check (department in (
    'GENERAL','Commissions','Administrative Department','Internal Affairs Department',
    'External Affairs Department','Operations Department'
  ));
