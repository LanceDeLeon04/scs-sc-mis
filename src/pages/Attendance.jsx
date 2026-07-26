import React, { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { supabase, ATTENDANCE_EVIDENCE_BUCKET, ATTENDANCE_STATUS_LABELS } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import {
  Clock, CheckCircle2, XCircle, Hourglass, Image as ImageIcon,
  Loader2, ClipboardList, FileText, CalendarCheck, Users, X,
  Trash2, AlertTriangle, BarChart3,
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

function RecordCard({ r, canAct, onApprove, onDeny, busy, canDelete, onDelete, deleteBusy }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const Icon = statusIcon[r.status] || Clock
  const [note, setNote] = useState('')
  const [showDenyBox, setShowDenyBox] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 card-glow p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{r.officer_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{r.department} &middot; {r.position} &middot; {r.work_date}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusStyle[r.status]}`}>
            <Icon size={12} /> {ATTENDANCE_STATUS_LABELS[r.status]}
          </span>
          {canDelete && (
            <button
              disabled={deleteBusy}
              onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return } onDelete(r) }}
              title={`Delete ${r.officer_name}'s record for ${r.work_date}`}
              className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition disabled:opacity-50 ${confirmDelete ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100'}`}>
              {deleteBusy ? <Loader2 size={12} className="animate-spin" /> : confirmDelete ? <AlertTriangle size={12} /> : <Trash2 size={12} />}
              {confirmDelete ? 'Confirm' : 'Delete'}
            </button>
          )}
        </div>
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
  const { profile, isAdmin, isCouncilPresident } = useAuth()
  const canManageAll = isAdmin || isCouncilPresident
  const [tab, setTab] = useState('mine') // mine | approvals | summary
  const [mine, setMine] = useState([])
  const [pendingForMe, setPendingForMe] = useState([])
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [deleteBusyId, setDeleteBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: mineData }, { data: forMeData }, { data: allData }] = await Promise.all([
      supabase.from('attendance_records').select('*').eq('officer_id', profile?.id).order('work_date', { ascending: false }),
      isAdmin
        ? supabase.from('attendance_records').select('*').eq('status', 'pending').order('submitted_at', { ascending: false })
        : supabase.from('attendance_records').select('*').eq('status', 'pending').eq('approver_position', profile?.position).order('submitted_at', { ascending: false }),
      canManageAll
        ? supabase.from('attendance_records').select('*').order('work_date', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setMine(mineData || [])
    setPendingForMe(forMeData || [])
    setAll(allData || [])
    setLoading(false)
  }, [profile, isAdmin, canManageAll])

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

  // Available to admins and to whoever currently holds the Council
  // President position -- lets them remove a specific officer's
  // attendance record for a specific day (e.g. a mistaken/duplicate
  // entry), backed by the RLS delete policy in
  // migrations/015_council_president_attendance_delete.sql.
  const deleteRecord = async (r) => {
    setDeleteBusyId(r.id)
    setMsg(null)
    const { error } = await supabase.from('attendance_records').delete().eq('id', r.id)
    setDeleteBusyId(null)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setMsg({ type: 'success', text: `Deleted ${r.officer_name}'s attendance record for ${r.work_date}.` })
    load()
  }

  // Per-officer roll-up for the Summary tab.
  const summary = React.useMemo(() => {
    const byOfficer = new Map()
    for (const r of all) {
      const key = r.officer_id
      if (!byOfficer.has(key)) {
        byOfficer.set(key, {
          officer_id: r.officer_id, officer_name: r.officer_name, department: r.department,
          position: r.position, total: 0, approved: 0, pending: 0, denied: 0, open: 0,
        })
      }
      const s = byOfficer.get(key)
      s.total += 1
      s[r.status] = (s[r.status] || 0) + 1
    }
    return Array.from(byOfficer.values()).sort((a, b) => a.officer_name.localeCompare(b.officer_name))
  }, [all])

  const list = tab === 'mine' ? mine : tab === 'approvals' ? pendingForMe : tab === 'all' ? all : []

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
          {canManageAll && (
            <>
              <button onClick={() => setTab('all')}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition ${tab === 'all' ? 'bg-nublue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Users size={15} /> All Records
              </button>
              <button onClick={() => setTab('summary')}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition ${tab === 'summary' ? 'bg-nublue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                <BarChart3 size={15} /> Summary
              </button>
            </>
          )}
        </div>

        {msg && (
          <div className={`text-xs rounded-lg px-3 py-2 mb-4 border ${msg.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            {msg.text}
          </div>
        )}

        {tab === 'summary' ? (
          loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : summary.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance records yet.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 card-glow p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                    <th className="py-2 pr-3 font-semibold">Officer</th>
                    <th className="py-2 pr-3 font-semibold">Position</th>
                    <th className="py-2 pr-3 font-semibold">Department</th>
                    <th className="py-2 pr-3 font-semibold text-center">Total</th>
                    <th className="py-2 pr-3 font-semibold text-center">Approved</th>
                    <th className="py-2 pr-3 font-semibold text-center">Pending</th>
                    <th className="py-2 pr-3 font-semibold text-center">Denied</th>
                    <th className="py-2 font-semibold text-center">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.officer_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{s.officer_name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{s.position}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{s.department}</td>
                      <td className="py-2.5 pr-3 text-center text-slate-600">{s.total}</td>
                      <td className="py-2.5 pr-3 text-center text-emerald-600 font-semibold">{s.approved || 0}</td>
                      <td className="py-2.5 pr-3 text-center text-amber-600 font-semibold">{s.pending || 0}</td>
                      <td className="py-2.5 pr-3 text-center text-red-500 font-semibold">{s.denied || 0}</td>
                      <td className="py-2.5 text-center text-nublue-600 font-semibold">{s.open || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400">
            {tab === 'mine' ? 'No attendance records yet.'
              : tab === 'approvals' ? 'Nothing pending your approval right now.'
              : 'No attendance records yet.'}
          </p>
        ) : (
          <div className="space-y-4">
            {list.map(r => (
              <RecordCard
                key={r.id} r={r} canAct={tab === 'approvals'} onApprove={approve} onDeny={deny} busy={busyId === r.id}
                canDelete={canManageAll} onDelete={deleteRecord} deleteBusy={deleteBusyId === r.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
