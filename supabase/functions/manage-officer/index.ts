// Supabase Edge Function: manage-officer
// Deploy with: supabase functions deploy manage-officer
//
// Lets an Administrative ("admin" role) account edit an existing
// officer's account details, reset their password to the default,
// or delete their account entirely -- the counterpart to
// create-officer for the rest of the account lifecycle.
//
// Requires these secrets set on the function (same as create-officer):
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Body shape:
//   { action: 'update', userId, name?, email?, position?, department?, division?, role? }
//   { action: 'reset-password', userId }
//   { action: 'delete', userId }
//
// @ts-ignore
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Reset-to-default password, per Student Council policy.
const DEFAULT_PASSWORD = 'SCSSC20262027'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header.')

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Not authenticated.')

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') throw new Error('Only Administrative Department officers can manage accounts.')

    const body = await req.json()
    const { action, userId } = body
    if (!action || !userId) throw new Error('Missing action or userId.')

    if (action === 'update') {
      const { name, email, position, department, division, role } = body

      // Keep auth.users' email (used to sign in) in sync with the
      // profiles row if email changed.
      if (email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(userId, { email })
        if (authErr) throw authErr
      }

      const patch: Record<string, unknown> = {}
      if (name !== undefined) patch.name = name
      if (email !== undefined) patch.email = email
      if (position !== undefined) patch.position = position
      if (department !== undefined) patch.department = department
      if (division !== undefined) patch.division = division || null
      if (role !== undefined) patch.role = role

      const { error: profileErr } = await admin.from('profiles').update(patch).eq('id', userId)
      if (profileErr) throw profileErr

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'reset-password') {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, { password: DEFAULT_PASSWORD })
      if (authErr) throw authErr

      return new Response(JSON.stringify({ ok: true, password: DEFAULT_PASSWORD }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      // Deleting the auth.users row cascades to delete the matching
      // public.profiles row (profiles.id references auth.users.id
      // on delete cascade) -- no separate profile delete needed.
      const { error: authErr } = await admin.auth.admin.deleteUser(userId)
      if (authErr) throw authErr

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
