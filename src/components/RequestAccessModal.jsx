import React, { useState } from 'react'
import { X, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'

export default function RequestAccessModal({ file, onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.from('access_requests').insert({
      file_id: file.id,
      requested_by: profile.id,
      requested_by_name: profile.name,
      requester_department: profile.department,
      target_department: file.department,
      reason: reason.trim(),
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
          <h3 className="font-bold text-slate-800">Request Access</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="bg-nublue-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-nublue-700">{file.document_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{file.department}{file.stage ? ` · ${file.stage}` : ''}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Reason for request</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} required
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
              placeholder="Explain why you need access to this file..." />
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-nugold-500 hover:bg-nugold-600 text-nublue-900 font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
            <Send size={16} /> {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
