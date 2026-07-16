import { createClient } from '@supabase/supabase-js'

// ⚠️ Replace these with your actual Supabase project credentials.
// You can find them in: Supabase Dashboard > Project Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-PUBLIC-KEY'

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
