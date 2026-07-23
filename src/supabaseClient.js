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
  'Administrative Department',
  'Internal Affairs Department',
  'External Affairs Department',
  'Operations Department',
]

export const DOC_SUBFOLDERS = ['Document Drafts', 'Final Copies']

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
}
