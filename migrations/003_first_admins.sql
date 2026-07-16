-- =========================================================
-- Bootstrap: first 4 Administrative Department accounts
--
-- STEP 0: Run migrations/004_member_ids.sql FIRST (it adds the
-- `member_id` column this script writes to). If you run this
-- script before 004, you'll get "column member_id does not exist".
--
-- STEP 1: In Supabase Dashboard > Authentication > Users > Add user,
-- create these 4 users manually with "Auto Confirm User" checked:
--
--   lance.deleon@scs-sc.edu.ph        password: SCSSC20262027
--   franchezka.nazareno@scs-sc.edu.ph password: SCSSC20262027
--   hann.bacsa@scs-sc.edu.ph          password: SCSSC20262027
--   randlyn.monares@scs-sc.edu.ph     password: SCSSC20262027
--
-- STEP 2: Copy each user's UUID (shown in the Users table) into the
-- placeholders below, then run this script in the SQL editor.
--
-- NOTE: `id` MUST be the real auth.users UUID (it's a foreign key into
-- auth.users) -- that's why pasting something like '20260001' there
-- fails with "invalid input syntax for type uuid". The human-readable
-- "20260001"-style ID instead goes in the `member_id` column below, and
-- migrations/004_member_ids.sql makes sure every account created from
-- now on (including through the app's "Create Officer Account" form)
-- automatically gets the same YEAR + 4-digit-sequence format.
-- =========================================================

insert into public.profiles (id, member_id, name, email, position, department, division, role)
values
  ('PASTE-LANCE-UUID-HERE',      '20260001', 'Lance Win Alexandrei De Leon', 'lance.deleon@scs-sc.edu.ph', 'Council President',
   'Administrative Department', 'Office of the President', 'admin'),

  ('PASTE-FRANCHEZKA-UUID-HERE', '20260002', 'Franchezka Nazareno', 'franchezka.nazareno@scs-sc.edu.ph', 'Executive Secretary',
   'Administrative Department', 'Executive Support', 'admin'),

  ('PASTE-HANN-UUID-HERE',       '20260003', 'Hann Dareen Bacsa', 'hann.bacsa@scs-sc.edu.ph', 'Deputy Secretary',
   'Administrative Department', 'Executive Support', 'admin'),

  ('PASTE-RANDLYN-UUID-HERE',    '20260004', 'Randlyn Faith Monares', 'randlyn.monares@scs-sc.edu.ph', 'Administrative Aide',
   'Administrative Department', 'Executive Support', 'admin')
on conflict (id) do update set
  member_id = excluded.member_id,
  name = excluded.name,
  email = excluded.email,
  position = excluded.position,
  department = excluded.department,
  division = excluded.division,
  role = excluded.role;
