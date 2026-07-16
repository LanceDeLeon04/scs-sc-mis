-- =========================================================
-- Bootstrap: first 4 Administrative Department accounts
-- Run AFTER you have created the 4 corresponding auth users in
-- Supabase Dashboard > Authentication > Users > Add user, and
-- copied each user's UUID into the placeholders below.
-- =========================================================

insert into public.profiles (id, name, position, department, division, role)
values
  ('PASTE-LANCE-UUID-HERE',    'Lance Win Alexandrei De Leon', 'Council President',
   'Administrative Department', 'Office of the President', 'admin'),

  ('PASTE-FRANCHEZKA-UUID-HERE', 'Franchezka Nazareno',        'Executive Secretary',
   'Administrative Department', 'Executive Support', 'admin'),

  ('PASTE-HANN-UUID-HERE',       'Hann Dareen Bacsa',          'Deputy Secretary',
   'Administrative Department', 'Executive Support', 'admin'),

  ('PASTE-RANDLYN-UUID-HERE',    'Randlyn Faith Monares',      'Council President',
   'Administrative Department', 'Executive Support', 'admin');
