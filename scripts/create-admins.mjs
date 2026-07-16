// =========================================================
// ONE-COMMAND admin account creation.
//
// Run: node scripts/create-admins.mjs
//
// This does EVERYTHING in one shot, for real, no dashboard
// clicking and no SQL matching required:
//   1. Creates each auth user (pre-confirmed, real password)
//   2. Creates their public.profiles row (name, position, etc.)
// using the service_role key, which bypasses RLS entirely --
// that's why this works where the SQL Editor couldn't.
//
// Safe to re-run: if an account already exists, it's skipped
// (or its profile is refreshed), no duplicates or errors.
// =========================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

// ---- Load .env manually (no extra dependency needed) ----
function loadEnv() {
  const path = existsSync('.env') ? '.env' : null
  if (!path) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
❌ Missing config. Add these two lines to your .env file:

  VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY

Get the service_role key from:
  Supabase Dashboard > Project Settings > API > Project API keys > service_role (click "Reveal")

⚠️  This key is secret -- never put it in VITE_ variables or ship it to the browser.
    It's only used here, locally, to run this one-time setup script.
`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMINS = [
  {
    email: 'lance.deleon@scs-sc.edu.ph',
    password: 'SCSSC20262027',
    name: 'Lance Win Alexandrei De Leon',
    position: 'Council President',
    division: 'Office of the President',
    member_id: '20260001',
  },
  {
    email: 'franchezka.nazareno@scs-sc.edu.ph',
    password: 'SCSSC20262027',
    name: 'Franchezka Nazareno',
    position: 'Executive Secretary',
    division: 'Executive Support',
    member_id: '20260002',
  },
  {
    email: 'hann.bacsa@scs-sc.edu.ph',
    password: 'SCSSC20262027',
    name: 'Hann Dareen Bacsa',
    position: 'Deputy Secretary',
    division: 'Executive Support',
    member_id: '20260003',
  },
  {
    email: 'randlyn.monares@scs-sc.edu.ph',
    password: 'SCSSC20262027',
    name: 'Randlyn Faith Monares',
    position: 'Administrative Aide',
    division: 'Executive Support',
    member_id: '20260004',
  },
]

async function findExistingUserByEmail(email) {
  // admin.listUsers doesn't filter by email directly in older SDKs,
  // so we page through (fine for small user counts like this).
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 200) return null
    page++
  }
}

async function run() {
  console.log('Creating admin accounts...\n')

  for (const admin of ADMINS) {
    try {
      let userId

      const existing = await findExistingUserByEmail(admin.email)
      if (existing) {
        userId = existing.id
        console.log(`↺  ${admin.email} already exists — reusing it`)
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: admin.email,
          password: admin.password,
          email_confirm: true, // pre-confirmed, can log in immediately
        })
        if (error) throw error
        userId = data.user.id
        console.log(`✓  Created auth user for ${admin.email}`)
      }

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        member_id: admin.member_id,
        name: admin.name,
        email: admin.email,
        position: admin.position,
        department: 'Administrative Department',
        division: admin.division,
        role: 'admin',
      })
      if (profileErr) throw profileErr

      console.log(`✓  Profile ready: ${admin.name} (${admin.member_id})\n`)
    } catch (err) {
      console.error(`✗  Failed for ${admin.email}:`, err.message, '\n')
    }
  }

  console.log('All done. Sign in at your app with any of the 4 emails above, password: SCSSC20262027')
}

run()
