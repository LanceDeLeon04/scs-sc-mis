import React, { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { supabase, ATTENDANCE_EVIDENCE_BUCKET, ATTENDANCE_STATUS_LABELS } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import {
  Clock, CheckCircle2, XCircle, Hourglass, Image as ImageIcon,
  Loader2, ClipboardList, FileText, CalendarCheck, Users, X,
} from 'lucide-react'

const statusStyle = {
  open: 'bg-nublue-50 text-nublue-600 border-nublue-100',
  pending: 'bg-amber-50 text-amber-600 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  denied: 'bg-red-50 text-red-600 border-red-100',
}
const statusIcon = { open: Clock, pending: Hourglass, approved: CheckCircle2, denied: XCircle }

function EvidenceViewer({ paths, onClose }) {
  const [urls, setUrls] = useState([])
  useEffect(() => {
    (async () => {
      const out = []
      for (const p of paths || []) {
        const { data } = await supabase.storage.from(ATTENDANCE_EVIDENCE_BUCKET).createSignedUrl(p, 300)
        if (data?.signedUrl) out.push(data.signedUrl)
      }
      setUrls(out)
    })()
  }, [paths])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl card-glow p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><ImageIcon size={16} /> Photo Evidence</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {urls.length === 0 ? (
          <p className="text-sm text-slate-400">Loading photos…</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {urls.map((u, i) => (
              <img key={i} src={u} alt={`Evidence ${i + 1}`} className="w-full rounded-xl border border-slate-100 object-cover" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RecordCard({ r, canAct, onApprove, onDeny, busy }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const Icon = statusIcon[r.status] || Clock
  const [note, setNote] = useState('')
  const [showDenyBox, setShowDenyBox] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 card-glow p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{r.officer_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{r.department} &middot; {r.position} &middot; {r.work_date}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusStyle[r.status]}`}>
          <Icon size={12} /> {ATTENDANCE_STATUS_LABELS[r.status]}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
        <div className="bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-slate-400 font-semibold uppercase">Time In</p>
          <p className="text-slate-700 font-medium mt-0.5">{new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-slate-400 font-semibold uppercase">Time Out</p>
          <p className="text-slate-700 font-medium mt-0.5">{r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
        </div>
      </div>

      {r.accomplishments && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5"><ClipboardList size={12} /> Accomplishments</p>
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{r.accomplishments}</p>
        </div>
      )}

      {r.report && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5"><FileText size={12} /> Detailed Report</p>
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{r.report}</p>
        </div>
      )}

      {r.evidence_paths?.length > 0 && (
        <button onClick={() => setShowEvidence(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-nublue-600 hover:text-nublue-700 mt-3">
          <ImageIcon size={13} /> View Photo Evidence ({r.evidence_paths.length})
        </button>
      )}

      {r.status === 'denied' && r.review_note && (
        <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-semibold">Reason:</span> {r.review_note}
        </p>
      )}
      {r.status === 'approved' && r.reviewed_by_name && (
        <p className="text-xs text-emerald-600 mt-3">Reviewed by {r.reviewed_by_name}</p>
      )}

      {canAct && r.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {showDenyBox && (
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Reason for denial…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500 mb-2" />
          )}
          <div className="flex items-center gap-2">
            <button disabled={busy} onClick={() => onApprove(r)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approve
            </button>
            {!showDenyBox ? (
              <button disabled={busy} onClick={() => setShowDenyBox(true)}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                <XCircle size={15} /> Deny
              </button>
            ) : (
              <button disabled={busy} onClick={() => onDeny(r, note)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />} Confirm Deny
              </button>
            )}
          </div>
        </div>
      )}

      {showEvidence && <EvidenceViewer paths={r.evidence_paths} onClose={() => setShowEvidence(false)} />}
    </div>
  )
}

export default function Attendance() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState('mine') // mine | approvals
  const [mine, setMine] = useState([])
  const [pendingForMe, setPendingForMe] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: mineData }, { data: forMeData }] = await Promise.all([
      supabase.from('attendance_records').select('*').eq('officer_id', profile?.id).order('work_date', { ascending: false }),
      isAdmin
        ? supabase.from('attendance_records').select('*').eq('status', 'pending').order('submitted_at', { ascending: false })
        : supabase.from('attendance_records').select('*').eq('status', 'pending').eq('approver_position', profile?.position).order('submitted_at', { ascending: false }),
    ])
    setMine(mineData || [])
    setPendingForMe(forMeData || [])
    setLoading(false)
  }, [profile, isAdmin])

  useEffect(() => { if (profile?.id) load() }, [profile, load])

  const approve = async (r) => {
    setBusyId(r.id)
    setMsg(null)
    const { error } = await supabase.from('attendance_records').update({
      status: 'approved', reviewed_by: profile.id, reviewed_by_name: profile.name, reviewed_at: new Date().toISOString(),
    }).eq('id', r.id)
    setBusyId(null)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    load()
  }

  const deny = async (r, note) => {
    setBusyId(r.id)
    setMsg(null)
    const { error } = await supabase.from('attendance_records').update({
      status: 'denied', reviewed_by: profile.id, reviewed_by_name: profile.name, reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || 'Denied.',
    }).eq('id', r.id)
    setBusyId(null)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    load()
  }

  const list = tab === 'mine' ? mine : pendingForMe

  return (
    <div>
      <Navbar title="Attendance" />
      <div className="p-8">
        <div className="flex items-center gap-2 mb-6 bg-white border border-slate-100 rounded-xl p-1 w-fit card-glow">
          <button onClick={() => setTab('mine')}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition ${tab === 'mine' ? 'bg-nublue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <CalendarCheck size={15} /> My Attendance
          </button>
          <button onClick={() => setTab('approvals')}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition relative ${tab === 'approvals' ? 'bg-nublue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={15} /> For My Approval
            {pendingForMe.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-nugold-500 text-nublue-900 px-1.5 py-0.5 rounded-full">{pendingForMe.length}</span>
            )}
          </button>
        </div>

        {msg && (
          <div className={`text-xs rounded-lg px-3 py-2 mb-4 border ${msg.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400">
            {tab === 'mine' ? 'No attendance records yet.' : 'Nothing pending your approval right now.'}
          </p>
        ) : (
          <div className="space-y-4">
            {list.map(r => (
              <RecordCard key={r.id} r={r} canAct={tab === 'approvals'} onApprove={approve} onDeny={deny} busy={busyId === r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
