-- =========================================================
-- Run this in Supabase SQL Editor. It bypasses RLS (runs as
-- postgres) so you can SEE the raw data and compare it against
-- what the policies require.
-- =========================================================

-- 1. Confirm the 005 policies actually exist (should show 4 rows:
--    update+delete for both files and folders)
select tablename, policyname, cmd
from pg_policies
where tablename in ('files','folders')
order by tablename, cmd;

-- 2. Your own profile row — paste YOUR email below
select id, email, role, department
from public.profiles
where email = 'PASTE_YOUR_EMAIL_HERE';

-- 3. The specific file you're trying to edit/delete — paste its name
select id, document_name, module, department, stage, uploaded_by, uploaded_by_name
from public.files
where document_name ilike '%PASTE_PART_OF_FILENAME_HERE%';

-- 4. The specific folder you're trying to edit/delete — paste its name
select id, name, module, department, stage, created_by
from public.folders
where name ilike '%PASTE_FOLDER_NAME_HERE%';

-- 5. Sanity check: does uploaded_by/created_by even match the id from
--    step 2? (For an admin this doesn't matter, but the admin's own
--    role must literally read 'admin', not 'Admin' or 'Administrator')
