import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import { supabase, DEPARTMENTS, DIVISIONS_BY_DEPARTMENT, ACCOUNT_DEFAULT_PASSWORD } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import {
  UserPlus, ShieldCheck, User, Mail, Lock, Briefcase, Building2, Layers,
  Pencil, Trash2, KeyRound, X, Loader2, AlertTriangle,
} from 'lucide-react'

function EditAccountModal({ account, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: account.name || '',
    email: account.email || '',
    position: account.position || '',
    department: account.department || DEPARTMENTS[0],
    division: account.division || '',
    role: account.role || 'officer',
  })
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const setDepartment = (e) => {
    const department = e.target.value
    setForm(f => ({ ...f, department, division: '' }))
  }

  const invoke = (action, extra = {}) =>
    supabase.functions.invoke('manage-officer', { body: { action, userId: account.id, ...extra } })

  const handleSave = async (e) => {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    try {
      const { data, error } = await invoke('update', {
        name: form.name.trim(),
        email: form.email.trim(),
        position: form.position.trim(),
        department: form.department,
        division: form.division.trim() || null,
        role: form.role,
      })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'Failed to update account.')
      onSaved()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update account.' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    setMsg(null)
    setResetting(true)
    try {
      const { data, error } = await invoke('reset-password')
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'Failed to reset password.')
      setMsg({ type: 'success', text: `Password reset to the default (${ACCOUNT_DEFAULT_PASSWORD}).` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to reset password.' })
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setMsg(null)
    setDeleting(true)
    try {
      const { data, error } = await invoke('delete')
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'Failed to delete account.')
      onSaved()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete account.' })
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg card-glow p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Pencil size={16} /> Edit Account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          <Field label="Full Name" icon={User} value={form.name} onChange={set('name')} required />
          <Field label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} required />
          <Field label="Position" icon={Briefcase} value={form.position} onChange={set('position')} required />

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</label>
            <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500">
              <Building2 size={16} className="text-nublue-400 mr-2 shrink-0" />
              <select value={form.department} onChange={setDepartment} className="w-full outline-none text-sm bg-transparent">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Division</label>
            <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500">
              <Layers size={16} className="text-nublue-400 mr-2 shrink-0" />
              <select value={form.division} onChange={set('division')} className="w-full outline-none text-sm bg-transparent">
                <option value="">Select division…</option>
                {(DIVISIONS_BY_DEPARTMENT[form.department] || []).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role Tag</label>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, role: 'officer' }))}
                className={`flex-1 text-sm font-medium rounded-xl py-2 border transition ${form.role === 'officer' ? 'bg-nublue-600 text-white border-nublue-600' : 'border-slate-200 text-slate-500'}`}>
                Officer
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, role: 'admin' }))}
                className={`flex-1 flex items-center justify-center gap-1 text-sm font-medium rounded-xl py-2 border transition ${form.role === 'admin' ? 'bg-nugold-500 text-nublue-900 border-nugold-500' : 'border-slate-200 text-slate-500'}`}>
                <ShieldCheck size={14} /> Administrative
              </button>
            </div>
          </div>

          {msg && (
            <div className={`text-xs rounded-lg px-3 py-2 border ${msg.type === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-nublue-600 hover:bg-nublue-700 text-white font-semibold py-2.5 rounded-xl transition shadow-glow disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
          <button onClick={handleResetPassword} disabled={resetting}
            className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
            {resetting ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Reset Password to Default
          </button>

          <button onClick={handleDelete} disabled={deleting}
            className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-60 ${confirmDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}>
            {deleting ? <Loader2 size={15} className="animate-spin" /> : confirmDelete ? <AlertTriangle size={15} /> : <Trash2 size={15} />}
            {deleting ? 'Deleting…' : confirmDelete ? 'Click again to confirm delete' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Accounts() {
  const { profile } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '', email: '', password: '', position: '', department: DEPARTMENTS[1], division: '', role: 'officer',
  })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setAccounts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const setDepartment = (e) => {
    const department = e.target.value
    setForm(f => ({ ...f, department, division: '' }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg(null)
    setSubmitting(true)
    try {
      // Calls the deployed `create-officer` Edge Function, which uses the
      // service-role key server-side to create the auth user with
      // email_confirm: true — no confirmation email is sent, and it isn't
      // subject to Supabase's client-side auth email rate limit the way
      // supabase.auth.signUp() is.
      const { data, error: fnErr } = await supabase.functions.invoke('create-officer', {
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          position: form.position.trim(),
          department: form.department,
          division: form.division.trim() || null,
          role: form.role,
        },
      })
      if (fnErr) throw fnErr
      if (!data?.ok) throw new Error(data?.error || 'Failed to create account.')

      setMsg({
        type: 'success',
        text: `Account created for ${form.name}. They can sign in immediately — no email confirmation needed.`,
      })
      setForm({ name: '', email: '', password: '', position: '', department: DEPARTMENTS[1], division: '', role: 'officer' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create account.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Navbar title="Manage Accounts" />
      <div className="p-8 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 card-glow p-6 h-fit">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus size={18} className="text-nublue-600" />
            <h2 className="font-bold text-slate-800">Create Officer Account</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <Field label="Full Name" icon={User} value={form.name} onChange={set('name')} placeholder="Juan Dela Cruz" required />
            <Field label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} placeholder="officer@scs.edu.ph" required />
            <Field label="Temporary Password" icon={Lock} type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required minLength={6} />
            <Field label="Position" icon={Briefcase} value={form.position} onChange={set('position')} placeholder="e.g. Secretary" required />

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</label>
              <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500">
                <Building2 size={16} className="text-nublue-400 mr-2 shrink-0" />
                <select value={form.department} onChange={setDepartment}
                  className="w-full outline-none text-sm bg-transparent">
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Division</label>
              <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500">
                <Layers size={16} className="text-nublue-400 mr-2 shrink-0" />
                <select value={form.division} onChange={set('division')}
                  className="w-full outline-none text-sm bg-transparent">
                  <option value="">Select division…</option>
                  {(DIVISIONS_BY_DEPARTMENT[form.department] || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role Tag</label>
              <div className="mt-1 flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, role: 'officer' }))}
                  className={`flex-1 text-sm font-medium rounded-xl py-2 border transition ${form.role === 'officer' ? 'bg-nublue-600 text-white border-nublue-600' : 'border-slate-200 text-slate-500'}`}>
                  Officer
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, role: 'admin' }))}
                  className={`flex-1 flex items-center justify-center gap-1 text-sm font-medium rounded-xl py-2 border transition ${form.role === 'admin' ? 'bg-nugold-500 text-nublue-900 border-nugold-500' : 'border-slate-200 text-slate-500'}`}>
                  <ShieldCheck size={14} /> Administrative
                </button>
              </div>
            </div>

            {msg && (
              <div className={`text-xs rounded-lg px-3 py-2 border ${msg.type === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                {msg.text}
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full bg-nublue-600 hover:bg-nublue-700 text-white font-semibold py-2.5 rounded-xl transition shadow-glow disabled:opacity-60">
              {submitting ? 'Creating…' : 'Create Account'}
            </button>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Accounts are created via the <code className="bg-slate-100 px-1 rounded">create-officer</code> Edge
              Function — officers can sign in immediately with no email confirmation step.
            </p>
          </form>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 card-glow p-6">
          <h2 className="font-bold text-slate-800 mb-4">All Accounts</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                    <th className="py-2 pr-3 font-semibold"></th>
                    <th className="py-2 pr-3 font-semibold">Member ID</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Email</th>
                    <th className="py-2 pr-3 font-semibold">Position</th>
                    <th className="py-2 pr-3 font-semibold">Department</th>
                    <th className="py-2 pr-3 font-semibold">Division</th>
                    <th className="py-2 pr-3 font-semibold">Role</th>
                    <th className="py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="py-2.5 pr-3">
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.name} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-nublue-100 text-nublue-600 flex items-center justify-center text-[10px] font-bold">
                            {(a.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 font-mono text-xs">{a.member_id || '—'}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{a.name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.email || '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.position}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.department}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.division || '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${a.role === 'admin' ? 'bg-nugold-100 text-nugold-700' : 'bg-nublue-50 text-nublue-600'}`}>
                          {a.role === 'admin' && <ShieldCheck size={10} />} {a.role}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => setEditingAccount(a)}
                          className="flex items-center gap-1 text-xs font-semibold text-nublue-600 hover:text-nublue-700">
                          <Pencil size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSaved={() => { setEditingAccount(null); load() }}
        />
      )}
    </div>
  )
}

function Field({ label, icon: Icon, ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="mt-1 flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-nublue-500 transition">
        <Icon size={16} className="text-nublue-400 mr-2 shrink-0" />
        <input {...props} className="w-full outline-none text-sm bg-transparent" />
      </div>
    </div>
  )
}
