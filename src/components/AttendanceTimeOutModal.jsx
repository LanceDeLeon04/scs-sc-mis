import React, { useState } from 'react'
import { X, Send, LogOut, Camera, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { ATTENDANCE_EVIDENCE_BUCKET } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'

export default function AttendanceTimeOutModal({ record, onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [accomplishments, setAccomplishments] = useState('')
  const [report, setReport] = useState('')
  const [photos, setPhotos] = useState([]) // File[]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addPhotos = (e) => {
    const chosen = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    setPhotos(prev => [...prev, ...chosen])
  }
  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!accomplishments.trim()) { setError('Please list your accomplishments for the day.'); return }
    if (!report.trim()) { setError('Please provide a detailed report.'); return }
    if (photos.length === 0) { setError('At least one photo evidence is required to time out.'); return }

    setLoading(true)
    try {
      const evidence_paths = []
      for (const f of photos) {
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const path = `${profile.id}/${record.id}/${safeName}`
        const { error: upErr } = await supabase.storage.from(ATTENDANCE_EVIDENCE_BUCKET).upload(path, f)
        if (upErr) throw upErr
        evidence_paths.push(path)
      }

      const { error: updErr } = await supabase.from('attendance_records').update({
        time_out: new Date().toISOString(),
        accomplishments: accomplishments.trim(),
        report: report.trim(),
        evidence_paths,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      }).eq('id', record.id)
      if (updErr) throw updErr

      onSubmitted && onSubmitted()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg card-glow border-t-4 border-nugold-500 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <LogOut size={18} className="text-nublue-600" /> Time Out
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="bg-nublue-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-nublue-700">{profile?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Timed in at {record?.time_in ? new Date(record.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Accomplishments for the Day</label>
            <textarea value={accomplishments} onChange={e => setAccomplishments(e.target.value)} rows={3} required
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
              placeholder="What did you get done today?" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Detailed Report</label>
            <textarea value={report} onChange={e => setReport(e.target.value)} rows={5} required
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
              placeholder="Give a full account of your work today -- tasks handled, meetings attended, issues encountered, etc." />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Photo Evidence <span className="text-red-500">* required</span>
            </label>
            <label className="mt-1 flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-nublue-400 rounded-xl px-3 py-3 text-xs text-slate-500 hover:text-nublue-700 cursor-pointer transition">
              <Camera size={15} /> Attach photo(s) of your work/output
              <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
            </label>
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                    <button type="button" onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white shadow">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-nugold-500 hover:bg-nugold-600 text-nublue-900 font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Submitting…' : 'Submit & Time Out'}
          </button>
        </form>
      </div>
    </div>
  )
}
