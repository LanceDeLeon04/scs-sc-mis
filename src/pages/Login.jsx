import React, { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail, ShieldCheck, Eye, EyeOff, GraduationCap, ShieldAlert } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

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
      className="h-screen w-full relative overflow-y-auto overflow-x-hidden bg-nublue-900 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/LogInBG.png')" }}
    >
      {/* dark gradient wash so the blueprint art recedes behind the glass card */}
      <div className="fixed inset-0 bg-gradient-to-r from-nublue-900/90 via-nublue-900/70 to-nublue-900/30" />
      <div className="fixed inset-0 bg-gradient-to-t from-nublue-900/60 via-transparent to-nublue-900/40" />

      {/* decorative glow orbs */}
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-nugold-500/20 rounded-full blur-3xl" />
      <div className="fixed bottom-0 right-0 w-[30rem] h-[30rem] bg-nublue-400/20 rounded-full blur-3xl" />
      <div className="fixed top-1/3 left-1/2 w-72 h-72 bg-nugold-400/10 rounded-full blur-3xl" />

      {/* content: form pinned left, empty space right shows the artwork */}
      <div className="relative z-10 min-h-full w-full flex items-center justify-center lg:justify-start px-4 sm:px-8 lg:pl-20 xl:pl-28 py-3">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/25 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-5 sm:p-6 relative overflow-hidden">
            {/* subtle inner top sheen for extra glass depth */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl" />
            <div className="pointer-events-none absolute -top-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-nugold-400/80 to-transparent" />
            {/* corner seal flourish */}
            <div className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full border border-nugold-400/20" />

            {/* eyebrow badge */}
            <div className="relative inline-flex items-center gap-1.5 bg-nugold-400/10 border border-nugold-400/30 rounded-full px-2.5 py-0.5 mb-2.5">
              <GraduationCap size={11} className="text-nugold-300" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-nugold-300">
                Official Council Portal
              </span>
            </div>

            {/* logo + wordmark */}
            <div className="relative flex items-center gap-3 mb-2.5">
              <img
                src="/SCSLogo.png"
                alt="SCS Logo"
                className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)] flex-shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm leading-tight">
                  SCS Student Council
                </h1>
                <p className="text-sm sm:text-base font-bold text-nugold-300 tracking-tight leading-snug mt-0.5">
                  My Council Portal
                </p>
                <div className="h-[3px] w-10 bg-gradient-to-r from-nugold-400 to-nugold-400/0 rounded-full mt-1" />
              </div>
            </div>

            <p className="relative text-[11px] text-white/70 leading-snug mb-3">
              Sign in with your council-issued credentials to access department files, templates, and requests.
            </p>

            <form onSubmit={handleSubmit} className="relative space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Email</label>
                <div className="mt-1 flex items-center gap-2 bg-white/10 border border-white/25 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-nugold-400 focus-within:border-nugold-400 transition">
                  <div className="w-5 h-5 rounded-md bg-nugold-400/15 flex items-center justify-center flex-shrink-0">
                    <Mail size={11} className="text-nugold-300" />
                  </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowHelp((v) => !v)}
                    className="text-[10px] font-semibold text-nugold-300 hover:text-nugold-200 transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2 bg-white/10 border border-white/25 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-nugold-400 focus-within:border-nugold-400 transition">
                  <div className="w-5 h-5 rounded-md bg-nugold-400/15 flex items-center justify-center flex-shrink-0">
                    <Lock size={11} className="text-nugold-300" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full outline-none text-sm bg-transparent text-white placeholder-white/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-white/50 hover:text-white/80 transition flex-shrink-0"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {showHelp && (
                  <p className="text-[10px] text-white/60 mt-1 pl-1 leading-snug">
                    Password resets aren't self-service. Contact your Administrative Department officer to have it reset.
                  </p>
                )}
              </div>

              {error && (
                <div className="text-xs text-red-100 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-nugold-400 to-nugold-500 hover:from-nugold-300 hover:to-nugold-400 text-nublue-900 font-bold py-2 rounded-xl transition shadow-[0_8px_20px_-6px_rgba(255,199,44,0.5)] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="relative flex items-center gap-2 mt-3 bg-white/5 border border-white/15 rounded-xl px-3 py-1.5">
              <ShieldCheck size={13} className="text-nugold-300 flex-shrink-0" />
              <p className="text-[10px] text-white/60 leading-snug">
                Accounts are created by Admins only. Contact your SCS Admin for access.
              </p>
            </div>

            <Link
              to="/grievance"
              className="relative mt-2.5 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold py-2 rounded-xl transition"
            >
              <ShieldAlert size={14} className="text-nugold-300" />
              Report a Concern / Track a Ticket
            </Link>

            <p className="relative text-[9px] text-white/35 text-center mt-2 tracking-wide">
              SCS Student Council · A.Y. 2026–2027
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
