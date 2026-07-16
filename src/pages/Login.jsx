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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-nublue-900 via-nublue-700 to-nublue-500 relative overflow-hidden">
      {/* decorative grid / glow */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(255,199,44,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,199,44,0.15) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-nugold-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-nugold-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur rounded-2xl card-glow border-t-4 border-nugold-500 p-8 animate-fade-in">
          <div className="flex flex-col items-center mb-6">
            <img src="/SCSLogo.png" alt="SCS Logo" className="w-20 h-20 object-contain mb-3 drop-shadow" />
            <h1 className="text-xl font-extrabold text-nublue-700 text-center tracking-tight">
              SCS Student Council
            </h1>
            <p className="text-sm text-slate-500 gold-underline pb-1 mt-1">File Repository System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
              <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500 focus-within:border-nublue-500 transition">
                <Mail size={18} className="text-nublue-400 mr-2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@scs.edu.ph"
                  className="w-full outline-none text-sm bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</label>
              <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500 focus-within:border-nublue-500 transition">
                <Lock size={18} className="text-nublue-400 mr-2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full outline-none text-sm bg-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-nublue-600 hover:bg-nublue-700 text-white font-semibold py-2.5 rounded-xl transition shadow-glow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <ShieldCheck size={18} />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            Accounts are created by Administrative Department officers only.
            <br /> Contact your SCS Admin for access.
          </p>
        </div>
      </div>
    </div>
  )
}
