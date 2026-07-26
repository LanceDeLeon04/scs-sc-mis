import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, Clock, CheckCircle2, XCircle, Hourglass, RotateCcw, ArrowRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import AttendanceTimeOutModal from './AttendanceTimeOutModal.jsx'

function todayStr() {
  const d = new Date()
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d - tzOffset).toISOString().slice(0, 10)
}

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

export default function AttendanceWidget() {
  const { profile } = useAuth()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showTimeOut, setShowTimeOut] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('officer_id', profile.id)
      .eq('work_date', todayStr())
      .maybeSingle()
    setRecord(data || null)
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const timeIn = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.from('attendance_records').insert({
      officer_id: profile.id,
      work_date: todayStr(),
      time_in: new Date().toISOString(),
      status: 'open',
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    await load()
  }

  const discardAndRetry = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.from('attendance_records').delete().eq('id', record.id)
    setBusy(false)
    if (error) { setError(error.message); return }
    setRecord(null)
  }

  const statusPill = () => {
    if (!record) return null
    if (record.status === 'open') return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-nublue-600 bg-nublue-50 px-2.5 py-1 rounded-full">
        <Clock size={12} /> Timed in at {fmtTime(record.time_in)}
      </span>
    )
    if (record.status === 'pending') return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
        <Hourglass size={12} /> {record.override_closed_by ? 'Timed out for you' : 'Pending approval'} &middot; {record.approver_position}
      </span>
    )
    if (record.status === 'approved') return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
        <CheckCircle2 size={12} /> Approved{record.reviewed_by_name ? ` by ${record.reviewed_by_name}` : ''}
      </span>
    )
    if (record.status === 'denied') return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
        <XCircle size={12} /> Denied
      </span>
    )
    return null
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 card-glow p-6 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 className="font-bold text-slate-800">Today's Attendance</h2>
          <p className="text-xs text-slate-400 mt-0.5">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <Link to="/attendance" className="flex items-center gap-1 text-xs font-semibold text-nublue-600 hover:text-nublue-700">
          View Attendance <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 mt-4">Loading…</p>
      ) : (
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div>{statusPill()}</div>

          {!record && (
            <button onClick={timeIn} disabled={busy}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-60">
              <LogIn size={16} /> {busy ? 'Timing in…' : 'Time In'}
            </button>
          )}

          {record?.status === 'open' && (
            <button onClick={() => setShowTimeOut(true)}
              className="flex items-center gap-2 bg-nublue-600 hover:bg-nublue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
              <LogOut size={16} /> Time Out
            </button>
          )}

          {record?.status === 'denied' && (
            <button onClick={discardAndRetry} disabled={busy}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-60">
              <RotateCcw size={14} /> {busy ? 'Please wait…' : 'Discard & Time In Again'}
            </button>
          )}
        </div>
      )}

      {record?.status === 'denied' && record?.review_note && (
        <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-semibold">Reason:</span> {record.review_note}
        </p>
      )}

      {record?.override_closed_by && record?.override_note && (
        <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="font-semibold">Note:</span> {record.override_note}
        </p>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">{error}</p>}

      {showTimeOut && (
        <AttendanceTimeOutModal record={record} onClose={() => setShowTimeOut(false)} onSubmitted={load} />
      )}
    </div>
  )
}
