import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, DEPARTMENTS, GRIEVANCE_EVIDENCE_BUCKET, GRIEVANCE_STATUS_LABELS } from '../supabaseClient'
import {
  ArrowLeft, MessageSquare, ShieldAlert, Search, ClipboardList,
  Paperclip, X, Copy, Check, Send, AlertTriangle, CheckCircle2,
  Clock, XCircle, Loader2,
} from 'lucide-react'

const statusIcon = {
  submitted: Clock,
  under_review: Search,
  resolved: CheckCircle2,
  dismissed: XCircle,
}
const statusStyle = {
  submitted: 'bg-amber-50 text-amber-600 border-amber-200',
  under_review: 'bg-nublue-50 text-nublue-600 border-nublue-200',
  resolved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  dismissed: 'bg-slate-100 text-slate-500 border-slate-200',
}

function Shell({ children }) {
  return (
    <div
      className="min-h-screen w-full relative overflow-y-auto bg-nublue-900 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/LogInBG.png')" }}
    >
      <div className="fixed inset-0 bg-gradient-to-r from-nublue-900/90 via-nublue-900/70 to-nublue-900/30" />
      <div className="fixed inset-0 bg-gradient-to-t from-nublue-900/60 via-transparent to-nublue-900/40" />
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-nugold-500/20 rounded-full blur-3xl" />
      <div className="fixed bottom-0 right-0 w-[30rem] h-[30rem] bg-nublue-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-screen w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl animate-fade-in">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition mb-4">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/25 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-6 sm:p-8 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl" />
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabSwitch({ tab, setTab }) {
  return (
    <div className="relative flex bg-white/10 border border-white/20 rounded-xl p-1 mb-6">
      <button
        onClick={() => setTab('report')}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition ${tab === 'report' ? 'bg-nugold-500 text-nublue-900' : 'text-white/70 hover:text-white'}`}
      >
        <ClipboardList size={14} /> Report
      </button>
      <button
        onClick={() => setTab('track')}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition ${tab === 'track' ? 'bg-nugold-500 text-nublue-900' : 'text-white/70 hover:text-white'}`}
      >
        <Search size={14} /> Track
      </button>
    </div>
  )
}

function ReportForm() {
  const [type, setType] = useState('feedback')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState('')
  const [department, setDepartment] = useState('')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { ticket_number, access_code }
  const [copied, setCopied] = useState('')

  const isComplaint = type === 'formal_complaint'

  const addFiles = (e) => {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    setFiles(prev => [...prev, ...chosen])
  }
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* clipboard unavailable, ignore */ }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!subject.trim()) { setError('Please enter a subject.'); return }
    if (!details.trim()) { setError('Please describe what happened.'); return }
    if (isComplaint && !name.trim()) { setError('Name is required for a formal complaint.'); return }
    if (isComplaint && files.length === 0) { setError('Please attach at least one piece of evidence (screenshot, photo, document).'); return }

    setLoading(true)
    try {
      let evidence_paths = []
      if (files.length) {
        for (const f of files) {
          const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const path = `submissions/${safeName}`
          const { error: upErr } = await supabase.storage.from(GRIEVANCE_EVIDENCE_BUCKET).upload(path, f)
          if (upErr) throw upErr
          evidence_paths.push(path)
        }
      }

      const { data, error: rpcErr } = await supabase.rpc('submit_grievance', {
        p_type: type,
        p_is_anonymous: isComplaint ? false : isAnonymous,
        p_submitter_name: isComplaint || !isAnonymous ? name.trim() : null,
        p_submitter_email: isComplaint || !isAnonymous ? email.trim() : null,
        p_submitter_contact: isComplaint || !isAnonymous ? contact.trim() : null,
        p_subject: subject.trim(),
        p_details: details.trim(),
        p_department: department || null,
        p_evidence_paths: evidence_paths,
      })
      if (rpcErr) throw rpcErr
      const row = Array.isArray(data) ? data[0] : data
      setResult(row)
    } catch (err) {
      setError(err.message || 'Could not submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="relative animate-fade-in">
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <div className="w-12 h-12 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-emerald-300" />
          </div>
          <h2 className="text-lg font-bold text-white">Submitted</h2>
          <p className="text-xs text-white/60 max-w-sm">
            Save your ticket number and access code below — you'll need both to check on this later.
            They can't be recovered if lost.
          </p>
        </div>

        {[
          { label: 'Ticket Number', value: result.ticket_number, key: 'ticket' },
          { label: 'Access Code', value: result.access_code, key: 'code' },
        ].map(({ label, value, key }) => (
          <div key={key} className="flex items-center justify-between gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3 mb-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{label}</p>
              <p className="text-base font-bold text-nugold-300 tracking-wide truncate">{value}</p>
            </div>
            <button
              onClick={() => copy(value, key)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition"
              title="Copy"
            >
              {copied === key ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            </button>
          </div>
        ))}

        <Link
          to="/login"
          className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-nugold-400 to-nugold-500 hover:from-nugold-300 hover:to-nugold-400 text-nublue-900 font-bold py-2.5 rounded-xl transition"
        >
          Done
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setType('feedback') }}
          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-left transition ${type === 'feedback' ? 'bg-nugold-400/15 border-nugold-400/50' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}
        >
          <MessageSquare size={18} className={type === 'feedback' ? 'text-nugold-300' : 'text-white/60'} />
          <span className={`text-xs font-bold ${type === 'feedback' ? 'text-nugold-300' : 'text-white/80'}`}>Feedback</span>
          <span className="text-[10px] text-white/50 text-center leading-snug">General comments, can be anonymous</span>
        </button>
        <button
          type="button"
          onClick={() => { setType('formal_complaint'); setIsAnonymous(false) }}
          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-left transition ${type === 'formal_complaint' ? 'bg-nugold-400/15 border-nugold-400/50' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}
        >
          <ShieldAlert size={18} className={type === 'formal_complaint' ? 'text-nugold-300' : 'text-white/60'} />
          <span className={`text-xs font-bold ${type === 'formal_complaint' ? 'text-nugold-300' : 'text-white/80'}`}>Formal Complaint</span>
          <span className="text-[10px] text-white/50 text-center leading-snug">Requires details &amp; evidence, trackable</span>
        </button>
      </div>

      {type === 'feedback' && (
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-nugold-500" />
          Submit anonymously (no name or contact info)
        </label>
      )}

      {(type === 'formal_complaint' || !isAnonymous) && (
        <div className="grid grid-cols-2 gap-3">
          <div className={type === 'formal_complaint' ? '' : 'col-span-2'}>
            <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">
              Name {type === 'formal_complaint' && <span className="text-nugold-300">*</span>}
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400"
              placeholder="Juan Dela Cruz" />
          </div>
          {type === 'formal_complaint' && (
            <div>
              <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Contact No.</label>
              <input value={contact} onChange={e => setContact(e.target.value)}
                className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400"
                placeholder="09xx xxx xxxx" />
            </div>
          )}
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400"
              placeholder="you@email.com (optional)" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Department</label>
          <select value={department} onChange={e => setDepartment(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-nugold-400">
            <option value="" className="text-slate-800">Not sure / N-A</option>
            {DEPARTMENTS.map(d => <option key={d} value={d} className="text-slate-800">{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Subject <span className="text-nugold-300">*</span></label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400"
            placeholder="Short title" />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">
          Details <span className="text-nugold-300">*</span>
        </label>
        <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4}
          className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400 resize-none"
          placeholder={isComplaint ? 'Describe what happened, when, and who was involved, in as much detail as possible.' : 'Share your thoughts...'} />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">
          Evidence {isComplaint && <span className="text-nugold-300">* required</span>}
          {!isComplaint && <span className="text-white/40 normal-case font-normal"> (optional)</span>}
        </label>
        <label className="mt-1 flex items-center justify-center gap-2 border border-dashed border-white/30 hover:border-nugold-400/60 rounded-xl px-3 py-3 text-xs text-white/60 hover:text-white/90 cursor-pointer transition">
          <Paperclip size={14} /> Attach screenshots, photos, or documents
          <input type="file" multiple onChange={addFiles} className="hidden" />
        </label>
        {files.length > 0 && (
          <div className="mt-2 space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] text-white/70 truncate">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-white/40 hover:text-red-300 shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-100 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-nugold-400 to-nugold-500 hover:from-nugold-300 hover:to-nugold-400 text-nublue-900 font-bold py-2.5 rounded-xl transition disabled:opacity-60">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {loading ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  )
}

function TrackForm() {
  const [ticket, setTicket] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!ticket.trim() || !code.trim()) { setError('Enter both your ticket number and access code.'); return }
    setLoading(true)
    setSearched(false)
    try {
      const { data, error: rpcErr } = await supabase.rpc('track_grievance', {
        p_ticket_number: ticket.trim(),
        p_access_code: code.trim(),
      })
      if (rpcErr) throw rpcErr
      const row = Array.isArray(data) ? data[0] : data
      setResult(row || null)
      setSearched(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const StatusIcon = result ? statusIcon[result.status] : null

  return (
    <div className="relative space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Ticket Number</label>
          <input value={ticket} onChange={e => setTicket(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400 uppercase"
            placeholder="GRV-2026-0001" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Access Code</label>
          <input value={code} onChange={e => setCode(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-nugold-400 uppercase"
            placeholder="8-character code" />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-100 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-nugold-400 to-nugold-500 hover:from-nugold-300 hover:to-nugold-400 text-nublue-900 font-bold py-2.5 rounded-xl transition disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Looking up…' : 'Track'}
        </button>
      </form>

      {searched && !result && (
        <div className="flex items-center gap-2 text-xs text-white/70 bg-white/5 border border-white/15 rounded-xl px-3 py-3">
          <XCircle size={15} className="text-white/40 shrink-0" />
          No match found. Double-check your ticket number and access code.
        </div>
      )}

      {result && (
        <div className="bg-white/10 border border-white/20 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">{result.ticket_number}</p>
              <p className="text-sm font-bold text-white mt-0.5">{result.subject}</p>
            </div>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusStyle[result.status]}`}>
              {StatusIcon && <StatusIcon size={12} />}
              {GRIEVANCE_STATUS_LABELS[result.status] || result.status}
            </span>
          </div>
          <div className="text-[11px] text-white/50 flex flex-wrap gap-x-3 gap-y-1">
            <span>{result.type === 'formal_complaint' ? 'Formal Complaint' : 'Feedback'}</span>
            {result.department && <span>· {result.department}</span>}
            <span>· Submitted {new Date(result.submitted_at).toLocaleDateString()}</span>
          </div>
          {result.resolution && (
            <div className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold text-nugold-300 uppercase tracking-wide mb-1">Response</p>
              <p className="text-xs text-white/80 leading-relaxed whitespace-pre-line">{result.resolution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Grievance() {
  const [tab, setTab] = useState('report')

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-2">
        <img src="/SCSLogo.png" alt="SCS Logo" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="text-base font-extrabold text-white leading-tight">Feedback &amp; Grievance</h1>
          <p className="text-[11px] text-white/60">SCS Student Council · no account needed</p>
        </div>
      </div>
      <p className="relative text-[11px] text-white/60 leading-snug mb-5">
        Report a concern or check on one you already submitted. Formal complaints require your details and
        supporting evidence and generate a trackable ticket. Feedback can be submitted anonymously.
      </p>

      <TabSwitch tab={tab} setTab={setTab} />
      {tab === 'report' ? <ReportForm /> : <TrackForm />}
    </Shell>
  )
}
