// Optional Supabase Edge Function: create-officer
// Deploy with: supabase functions deploy create-officer
// Lets an Administrative Department account create new officer logins
// instantly (auto-confirmed, no email verification step required).
//
// Requires these secrets set on the function:
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// @ts-ignore
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    if (callerProfile?.role !== 'admin') throw new Error('Only Administrative Department officers can create accounts.')

    const { email, password, name, position, department, division, role } = await req.json()
    if (!email || !password || !name || !position || !department) {
      throw new Error('Missing required fields.')
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr) throw createErr

    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id, name, position, department, division: division || null, role: role || 'officer',
    })
    if (profileErr) throw profileErr

    return new Response(JSON.stringify({ ok: true, userId: created.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
