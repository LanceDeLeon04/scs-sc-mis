import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { CheckCircle2, XCircle, Clock, Inbox } from 'lucide-react'

const statusStyles = {
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  denied: 'bg-red-50 text-red-600 border-red-200',
}

export default function Tickets() {
  const { profile, isAdmin } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('access_requests')
      .select('*, files(document_name, department, stage, module)')
      .order('created_at', { ascending: false })

    if (!isAdmin) query = query.eq('requested_by', profile.id)

    const { data } = await query
    setRequests(data || [])
    setLoading(false)
  }, [isAdmin, profile])

  useEffect(() => { load() }, [load])

  const respond = async (req, status) => {
    await supabase.from('access_requests')
      .update({ status, responded_by: profile.id, responded_at: new Date().toISOString() })
      .eq('id', req.id)

    if (status === 'approved') {
      await supabase.from('file_access_grants').insert({
        file_id: req.file_id, granted_to: req.requested_by,
      })
    }
    load()
  }

  return (
    <div>
      <Navbar title="Access Requests" crumbs={[]} />
      <div className="p-8">
        <div className="flex items-center gap-2 mb-5">
          <Inbox size={18} className="text-nublue-600" />
          <p className="text-sm text-slate-500">
            {isAdmin ? 'All officer requests across departments' : 'Your submitted requests'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
            No access requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-100 card-glow p-5 flex items-center justify-between gap-4 animate-fade-in">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">
                    {req.files?.document_name || 'File removed'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.requester_department} → {req.target_department}
                    {req.files?.stage ? ` · ${req.files.stage}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 italic">"{req.reason}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requested by {req.requested_by_name} · {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusStyles[req.status]}`}>
                    {req.status === 'pending' && <Clock size={12} />}
                    {req.status === 'approved' && <CheckCircle2 size={12} />}
                    {req.status === 'denied' && <XCircle size={12} />}
                    {req.status}
                  </span>

                  {isAdmin && req.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => respond(req, 'approved')}
                        className="text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition">
                        Approve
                      </button>
                      <button onClick={() => respond(req, 'denied')}
                        className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition">
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
