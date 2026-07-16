import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

// =========================================================
// TEMPORARY BYPASS ACCOUNT
// Lets you log in and see the UI even while Supabase is being
// fixed/re-pointed. Does NOT touch Supabase at all -- so pages
// that fetch real data (Documents, Templates, Tickets, Accounts)
// will still come back empty/error until Supabase itself works,
// since that data has to come from the database either way.
//
// >>> DELETE this whole block (and the `if` that checks it in
// signIn/signOut below) once the real Supabase project is
// confirmed working. Do not ship this to production. <<<
// =========================================================
const BYPASS_USERNAME = 'Admin_SCSSC'
const BYPASS_PASSWORD = 'Admin_SCSSC20262027&'
const BYPASS_USER_ID = '00000000-0000-0000-0000-00000000ad01'
const BYPASS_PROFILE = {
  id: BYPASS_USER_ID,
  member_id: 'BYPASS-001',
  name: 'Lance Win De Leon',
  email: 'admin.bypass@scs-sc.local',
  avatar_url: '/Lance.png',
  position: 'System Administrator',
  department: 'Administrative Department',
  division: 'Office of the President',
  role: 'admin',
  created_at: new Date().toISOString(),
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // row from public.profiles
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    // TEMPORARY bypass -- see block above. Checked first so it works even
    // if Supabase is completely unreachable.
    if (email === BYPASS_USERNAME && password === BYPASS_PASSWORD) {
      setSession({ user: { id: BYPASS_USER_ID, email: BYPASS_PROFILE.email } })
      setProfile(BYPASS_PROFILE)
      setLoading(false)
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    if (session?.user?.id === BYPASS_USER_ID) {
      setSession(null)
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, signIn, signOut, refreshProfile: () => loadProfile(session?.user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
