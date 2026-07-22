import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { supabase, GRIEVANCE_EVIDENCE_BUCKET, GRIEVANCE_STATUS_LABELS } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import {
  MessageSquare, ShieldAlert, Clock, Search, CheckCircle2, XCircle,
  Paperclip, User, Calendar, Tag, X, Download, Save, Loader2,
} from 'lucide-react'

const statusIcon = { submitted: Clock, under_review: Search, resolved: CheckCircle2, dismissed: XCircle }
const statusStyle = {
  submitted: 'bg-amber-50 text-amber-600 border-amber-200',
  under_review: 'bg-nublue-50 text-nublue-600 border-nublue-200',
  resolved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  dismissed: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_OPTIONS = ['submitted', 'under_review', 'resolved', 'dismissed']
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'formal_complaint', label: 'Formal Complaints' },
]

function DetailPanel({ item, isAdmin, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status)
  const [resolution, setResolution] = useState(item.resolution || '')
  const [adminNotes, setAdminNotes] = useState(item.admin_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState([])

  useEffect(() => {
    let cancelled = false
    async function loadEvidence() {
      if (!item.evidence_paths?.length) { setEvidenceUrls([]); return }
      const urls = []
      for (const path of item.evidence_paths) {
        const { data } = await supabase.storage.from(GRIEVANCE_EVIDENCE_BUCKET).createSignedUrl(path, 300)
        if (data?.signedUrl) urls.push({ path, url: data.signedUrl, name: path.split('/').pop() })
      }
      if (!cancelled) setEvidenceUrls(urls)
    }
    loadEvidence()
    return () => { cancelled = true }
  }, [item])

  const save = async () => {
    setSaving(true)
    setError('')
    const { data, error: updErr } = await supabase.from('grievances')
      .update({ status, resolution: resolution.trim() || null, admin_notes: adminNotes.trim() || null })
      .eq('id', item.id)
      .select()
    setSaving(false)
    if (updErr) { setError(updErr.message); return }
    if (!data || data.length === 0) {
      setError('Denied — only admins can update a grievance. Check that your profile role is "admin".')
      return
    }
    onSaved(data[0])
  }

  const TypeIcon = item.type === 'formal_complaint' ? ShieldAlert : MessageSquare

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto card-glow border-t-4 border-nugold-500 animate-fade-in">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'formal_complaint' ? 'bg-red-50 text-red-600' : 'bg-nublue-50 text-nublue-600'}`}>
              <TypeIcon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{item.ticket_number}</p>
              <h3 className="font-bold text-slate-800 truncate">{item.subject}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Tag size={13} className="text-slate-400" /> {item.type === 'formal_complaint' ? 'Formal Complaint' : 'Feedback'}</span>
            {item.department && <span className="flex items-center gap-1.5"><Tag size={13} className="text-slate-400" /> {item.department}</span>}
            <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /> {new Date(item.created_at).toLocaleString()}</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <User size={12} /> Submitted By
            </p>
            {item.is_anonymous ? (
              <p className="text-sm text-slate-500 italic">Anonymous</p>
            ) : (
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{item.submitter_name || '—'}</p>
                {item.submitter_email && <p className="text-xs text-slate-500">{item.submitter_email}</p>}
                {item.submitter_contact && <p className="text-xs text-slate-500">{item.submitter_contact}</p>}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Details</p>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{item.details}</p>
          </div>

          {item.type === 'formal_complaint' && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Paperclip size={12} /> Evidence ({item.evidence_paths?.length || 0})
              </p>
              {evidenceUrls.length === 0 ? (
                <p className="text-xs text-slate-400">No evidence attached.</p>
              ) : (
                <div className="space-y-1.5">
                  {evidenceUrls.map(e => (
                    <a key={e.path} href={e.url} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 hover:border-nublue-300 hover:text-nublue-600 transition">
                      <span className="truncate">{e.name}</span>
                      <Download size={13} className="shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} disabled={!isAdmin}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500 disabled:bg-slate-50 disabled:text-slate-400">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{GRIEVANCE_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Response (visible to the submitter when they track this ticket)</label>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} disabled={!isAdmin}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="What was done about this..." />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Internal Notes (staff only)</label>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} disabled={!isAdmin}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="Internal-only context, who's handling it, etc." />
            </div>
            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 whitespace-pre-line">{error}</div>}
            {isAdmin && (
              <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-nublue-600 hover:bg-nublue-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Grievances() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [alertState, setAlertState] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('grievances').select('*').order('created_at', { ascending: false })
    if (error) setAlertState({ title: 'Could not load grievances', message: error.message })
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(i => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    return true
  })

  return (
    <div>
      <Navbar title="Feedback & Grievances" crumbs={[]} />
      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-sm text-slate-400">{filtered.length} of {items.length} submissions</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1">
              {TYPE_FILTERS.map(t => (
                <button key={t.value} onClick={() => setTypeFilter(t.value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${typeFilter === t.value ? 'bg-nublue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-nublue-500">
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{GRIEVANCE_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
            No submissions match these filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const TypeIcon = item.type === 'formal_complaint' ? ShieldAlert : MessageSquare
              const StatusIcon = statusIcon[item.status]
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 card-glow hover:-translate-y-0.5 hover:shadow-lg transition-all p-5 flex items-center gap-4 animate-fade-in"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'formal_complaint' ? 'bg-red-50 text-red-600' : 'bg-nublue-50 text-nublue-600'}`}>
                    <TypeIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-800 truncate">{item.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.ticket_number} · {item.is_anonymous ? 'Anonymous' : (item.submitter_name || 'Unnamed')}
                      {item.department ? ` · ${item.department}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusStyle[item.status]}`}>
                      {StatusIcon && <StatusIcon size={11} />} {GRIEVANCE_STATUS_LABELS[item.status]}
                    </span>
                    <span className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <DetailPanel
          item={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
            setSelected(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!alertState}
        title={alertState?.title}
        message={alertState?.message}
        danger
        onConfirm={() => setAlertState(null)}
      />
    </div>
  )
}
