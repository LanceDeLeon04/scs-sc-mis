import React, { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, ShieldCheck } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden bg-nublue-900 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/LogInBG.png')" }}
    >
      {/* dark gradient wash so the blueprint art recedes behind the glass card */}
      <div className="absolute inset-0 bg-gradient-to-r from-nublue-900/90 via-nublue-900/70 to-nublue-900/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-nublue-900/60 via-transparent to-nublue-900/40" />

      {/* decorative glow orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-nugold-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-nublue-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/3 left-1/2 w-72 h-72 bg-nugold-400/10 rounded-full blur-3xl" />

      {/* content: form pinned left, empty space right shows the artwork */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center lg:justify-start px-4 sm:px-8 lg:pl-20 xl:pl-28">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/25 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-8 sm:p-10 relative overflow-hidden">
            {/* subtle inner top sheen for extra glass depth */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl" />
            <div className="pointer-events-none absolute -top-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-nugold-400/80 to-transparent" />

            <div className="relative flex flex-col items-center mb-7">
              <div className="w-20 h-20 mb-3 rounded-2xl bg-white/90 shadow-lg flex items-center justify-center p-2">
                <img src="/SCSLogo.png" alt="SCS Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xl font-extrabold text-white text-center tracking-tight drop-shadow-sm">
                SCS Student Council
              </h1>
              <p className="text-sm text-nugold-200 gold-underline pb-1 mt-1">File Repository System</p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Email</label>
                <div className="mt-1 flex items-center bg-white/10 border border-white/25 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nugold-400 focus-within:border-nugold-400 transition">
                  <Mail size={18} className="text-nugold-300 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@scs.edu.ph"
                    className="w-full outline-none text-sm bg-transparent text-white placeholder-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Password</label>
                <div className="mt-1 flex items-center bg-white/10 border border-white/25 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nugold-400 focus-within:border-nugold-400 transition">
                  <Lock size={18} className="text-nugold-300 mr-2 flex-shrink-0" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full outline-none text-sm bg-transparent text-white placeholder-white/40"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-100 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2 backdrop-blur-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-nugold-500 hover:bg-nugold-400 text-nublue-900 font-bold py-2.5 rounded-xl transition shadow-[0_8px_20px_-6px_rgba(255,199,44,0.5)] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ShieldCheck size={18} />
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="relative text-[11px] text-white/60 text-center mt-6">
              Accounts are created by Administrative Department officers only.
              <br /> Contact your SCS Admin for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
