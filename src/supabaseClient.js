import { createClient } from '@supabase/supabase-js'

// ⚠️ Replace these with your actual Supabase project credentials.
// You can find them in: Supabase Dashboard > Project Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co'
// Supabase now calls this the "publishable key" (formerly "anon key") — same
// thing, safe to expose client-side. We check both env var names so either
// naming convention works.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'YOUR-PUBLISHABLE-KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

// Departments used throughout the app
export const DEPARTMENTS = [
  'GENERAL',
  'Commissions',
  'Administrative Department',
  'Internal Affairs Department',
  'External Affairs Department',
  'Operations Department',
]

export const DOC_SUBFOLDERS = ['Document Drafts', 'Final Copies']

// Divisions available under each department. Used to populate the Division
// dropdown wherever a department + division are chosen together (file
// upload, account creation, etc).
export const DIVISIONS_BY_DEPARTMENT = {
  'Internal Affairs Department': [
    'Finance Division',
    'Quality Assurance Division',
    'Vice President for Internal Affairs',
  ],
  'Operations Department': [
    'Planning Division',
    'Creatives Division',
    'Vice President for Operations',
  ],
  'External Affairs Department': [
    'Public Relations Division',
    'Social Media Division',
    'Vice President for External Affairs',
  ],
  'Administrative Department': [
    'Office of the President',
    'Secretariat Office',
  ],
  // GENERAL isn't its own division-holding department -- it's the shared
  // space every division can see. So instead of a placeholder like "ALL
  // DIVISIONS", the dropdown lists every real division from every
  // department, so a specific one can be picked when it matters.
  'GENERAL': [
    'Finance Division',
    'Quality Assurance Division',
    'Vice President for Internal Affairs',
    'Planning Division',
    'Creatives Division',
    'Vice President for Operations',
    'Public Relations Division',
    'Social Media Division',
    'Vice President for External Affairs',
    'Office of the President',
    'Secretariat Office',
  ],
  'Commissions': [
    'Commission on Audit',
    'Commission on Elections',
    'Commission on Grievances',
  ],
}

// Any department's document (Draft or Final Copy) may be marked
// Confidential. Once marked, only Administrative Department members
// (and admins) may see/access it -- enforced by the RLS select policy
// in migrations/010_confidential_any_department.sql.
export const CONFIDENTIAL_ACCESS_DEPARTMENT = 'Administrative Department'

export const STORAGE_BUCKET = 'scs-files'

export const AVATAR_BUCKET = 'avatars'

export const GRIEVANCE_EVIDENCE_BUCKET = 'grievance-evidence'

export const GRIEVANCE_STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

// Approvals + Printing workflow
export const APPROVAL_STATUS_LABELS = {
  none: 'Not Submitted',
  pending_approval: 'Pending Approval',
  approved_for_printing: 'Approved for Printing',
  rejected: 'Rejected',
  done: 'Done',
}
