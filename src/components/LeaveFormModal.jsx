import React, { useEffect, useState } from 'react'
import { X, Send, CalendarDays } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'

export default function LeaveFormModal({ onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [reason, setReason] = useState('')
  const [substituteId, setSubstituteId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [officers, setOfficers] = useState([])
  const [myLeaveRequests, setMyLeaveRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const MAX_CONSECUTIVE_DAYS = 5
  const MAX_MONTHLY_DAYS = 5

  // Substitute picks from real officer profiles (not free-typed), same
  // reasoning as the approval-chain position picker in Approvals.jsx —
  // keeps the record tied to an actual account.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, position')
        .neq('id', profile?.id)
        .order('name', { ascending: true })
      setOfficers(data || [])
    })()
  }, [profile])

  // Own pending/approved requests, used to compute the running monthly
  // total client-side (mirrors the DB trigger in
  // migrations/017_leave_request_limits.sql, which is the source of
  // truth -- this is just for a friendly heads-up before submitting).
  useEffect(() => {
    (async () => {
      if (!profile?.id) return
      const { data } = await supabase
        .from('leave_requests')
        .select('date_from, date_to, status')
        .eq('requested_by', profile.id)
        .in('status', ['pending', 'approved'])
      setMyLeaveRequests(data || [])
    })()
  }, [profile])

  const daysInRange = (from, to) => {
    if (!from || !to) return 0
    const a = new Date(from + 'T00:00:00')
    const b = new Date(to + 'T00:00:00')
    return Math.round((b - a) / 86400000) + 1
  }

  const daysOverlapMonth = (from, to, monthStart, monthEnd) => {
    const start = new Date(from + 'T00:00:00') > monthStart ? new Date(from + 'T00:00:00') : monthStart
    const end = new Date(to + 'T00:00:00') < monthEnd ? new Date(to + 'T00:00:00') : monthEnd
    const diff = Math.round((end - start) / 86400000) + 1
    return diff > 0 ? diff : 0
  }

  // For each calendar month the requested range touches, how many days
  // is the officer already committed to (excluding this new request),
  // and how many would this request add.
  const monthlyBreakdown = () => {
    if (!dateFrom || !dateTo) return []
    const months = []
    let cursor = new Date(dateFrom + 'T00:00:00')
    const end = new Date(dateTo + 'T00:00:00')
    while (cursor <= end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const existing = myLeaveRequests.reduce(
        (sum, r) => sum + daysOverlapMonth(r.date_from, r.date_to, monthStart, monthEnd), 0
      )
      const adding = daysOverlapMonth(dateFrom, dateTo, monthStart, monthEnd)
      months.push({
        label: monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        existing, adding, total: existing + adding,
      })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return months
  }

  const breakdown = monthlyBreakdown()
  const consecutiveDays = daysInRange(dateFrom, dateTo)
  const overConsecutiveLimit = consecutiveDays > MAX_CONSECUTIVE_DAYS
  const overMonthlyLimit = breakdown.some(m => m.total > MAX_MONTHLY_DAYS)

  const submit = async (e) => {
    e.preventDefault()
    if (dateTo < dateFrom) { setError('Date To cannot be before Date From.'); return }
    if (overConsecutiveLimit) {
      setError(`A single leave request can't exceed ${MAX_CONSECUTIVE_DAYS} consecutive days (this one is ${consecutiveDays}).`)
      return
    }
    if (overMonthlyLimit) {
      const bad = breakdown.find(m => m.total > MAX_MONTHLY_DAYS)
      setError(`This would bring your ${bad.label} leave total to ${bad.total} days — the monthly limit is ${MAX_MONTHLY_DAYS}.`)
      return
    }
    setLoading(true)
    setError('')

    const substitute = officers.find(o => o.id === substituteId)

    const { error } = await supabase.from('leave_requests').insert({
      requested_by: profile.id,
      requested_by_name: profile.name,
      department: profile.department,
      position: profile.position,
      reason: reason.trim(),
      substitute_id: substitute?.id || null,
      substitute_name: substitute?.name || null,
      date_from: dateFrom,
      date_to: dateTo,
      status: 'pending',
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    onSubmitted && onSubmitted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md card-glow border-t-4 border-nugold-500 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays size={18} className="text-nublue-600" /> Leave Form
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="bg-nublue-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-nublue-700">{profile?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.department} · {profile?.position}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Date From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Date To</label>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} required
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500" />
            </div>
          </div>

          {dateFrom && dateTo && dateTo >= dateFrom && (
            <div className={`text-xs rounded-xl px-3 py-2 border space-y-1 ${overConsecutiveLimit || overMonthlyLimit ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
              <p>
                {consecutiveDays} consecutive day{consecutiveDays === 1 ? '' : 's'} requested
                {overConsecutiveLimit && ` — exceeds the ${MAX_CONSECUTIVE_DAYS}-day max per request.`}
              </p>
              {breakdown.map(m => (
                <p key={m.label}>
                  {m.label}: {m.total} / {MAX_MONTHLY_DAYS} day{MAX_MONTHLY_DAYS === 1 ? '' : 's'} used
                  {m.existing > 0 && ` (${m.existing} already filed + ${m.adding} this request)`}
                  {m.total > MAX_MONTHLY_DAYS && ' — over the monthly limit.'}
                </p>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Substitute for Tasks</label>
            <select value={substituteId} onChange={e => setSubstituteId(e.target.value)} required
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500">
              <option value="">Select who will cover your tasks…</option>
              {officers.map(o => (
                <option key={o.id} value={o.id}>{o.name}{o.position ? ` — ${o.position}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} required
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
              placeholder="Explain the reason for your leave..." />
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={loading || overConsecutiveLimit || overMonthlyLimit}
            className="w-full flex items-center justify-center gap-2 bg-nugold-500 hover:bg-nugold-600 text-nublue-900 font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
            <Send size={16} /> {loading ? 'Submitting…' : 'Submit Leave Form'}
          </button>
        </form>
      </div>
    </div>
  )
}
