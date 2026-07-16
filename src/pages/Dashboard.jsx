import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { FileSpreadsheet, FileStack, Inbox, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [stats, setStats] = useState({ files: 0, templates: 0, pending: 0 })

  useEffect(() => {
    (async () => {
      const [{ count: fileCount }, { count: templateCount }, { count: pendingCount }] = await Promise.all([
        supabase.from('files').select('*', { count: 'exact', head: true }).eq('module', 'documents'),
        supabase.from('files').select('*', { count: 'exact', head: true }).eq('module', 'templates'),
        isAdmin
          ? supabase.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
          : supabase.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('requested_by', profile.id),
      ])
      setStats({ files: fileCount || 0, templates: templateCount || 0, pending: pendingCount || 0 })
    })()
  }, [isAdmin, profile])

  const cards = [
    { to: '/templates', label: 'Templates', icon: FileSpreadsheet, value: stats.templates, sub: 'total templates', color: 'from-nublue-600 to-nublue-500' },
    { to: '/documents', label: 'Documents', icon: FileStack, value: stats.files, sub: 'total documents', color: 'from-nublue-700 to-nublue-600' },
    { to: '/tickets', label: 'Access Requests', icon: Inbox, value: stats.pending, sub: 'pending', color: 'from-nugold-500 to-nugold-400' },
  ]

  return (
    <div>
      <Navbar title={`Welcome, ${profile?.name?.split(' ')[0] || 'Officer'}`} />
      <div className="p-8">
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {cards.map(c => (
            <Link key={c.to} to={c.to}
              className="group relative overflow-hidden rounded-2xl p-6 text-white card-glow hover:-translate-y-0.5 hover:shadow-xl transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${c.color}`} />
              <div className="relative z-10">
                <c.icon size={26} className="mb-6 opacity-90" />
                <p className="text-3xl font-extrabold">{c.value}</p>
                <p className="text-sm font-medium opacity-90">{c.sub}</p>
                <div className="flex items-center gap-1 text-xs font-semibold mt-4 opacity-80 group-hover:opacity-100 group-hover:gap-2 transition-all">
                  {c.label} <ArrowRight size={13} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 card-glow p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} className="text-nublue-600" />
            <h2 className="font-bold text-slate-800">Your Access Profile</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-semibold">Department</p>
              <p className="font-semibold text-slate-700 mt-0.5">{profile?.department}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-semibold">Division</p>
              <p className="font-semibold text-slate-700 mt-0.5">{profile?.division || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-semibold">Position</p>
              <p className="font-semibold text-slate-700 mt-0.5">{profile?.position}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-semibold">Role</p>
              <p className="font-semibold text-slate-700 mt-0.5 capitalize flex items-center gap-1.5">
                {isAdmin && <ShieldCheck size={14} className="text-nugold-500" />}
                {profile?.role}
              </p>
            </div>
          </div>
          {!isAdmin && (
            <p className="text-xs text-slate-400 mt-4">
              You can view file listings from every department, but you'll need to submit an access request to download files outside <span className="font-semibold text-slate-500">{profile?.department}</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
