import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { supabase, DEPARTMENTS, DIVISIONS_BY_DEPARTMENT, APPROVAL_STATUS_LABELS } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import {
  CheckCircle2, Circle, XCircle, Crown, Printer, PenTool, UploadCloud,
  ChevronRight, Settings2, Plus, Trash2, RotateCcw, FileText, Clock, Loader2,
} from 'lucide-react'

const PRINT_POSITIONS = ['Executive Secretary', 'Deputy Secretary']

function StepPill({ step }) {
  const icon =
    step.status === 'approved'
      ? <CheckCircle2 size={14} className="text-emerald-500" />
      : step.status === 'rejected'
        ? <XCircle size={14} className="text-red-500" />
        : <Circle size={14} className="text-slate-300" />
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border
      ${step.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : ''}
      ${step.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' : ''}
      ${step.status === 'pending' ? 'bg-slate-50 border-slate-100 text-slate-500' : ''}`}>
      {icon}
      {step.step_order}. {step.position_title}
      {step.is_president && <Crown size={11} className="text-nugold-500" />}
    </div>
  )
}

export default function Approvals() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState('mine') // mine | progress | printing | chains
  const [files, setFiles] = useState([])
  const [approvalsByFile, setApprovalsByFile] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [chainDept, setChainDept] = useState(DEPARTMENTS[1])
  const [chainDivision, setChainDivision] = useState('') // '' = whole department
  const [chainSteps, setChainSteps] = useState([])
  const [knownPositions, setKnownPositions] = useState([])
  const [newPosition, setNewPosition] = useState('')
  const [newIsPresident, setNewIsPresident] = useState(false)

  const canPrint = isAdmin || PRINT_POSITIONS.includes(profile?.position)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: fileData } = await supabase
      .from('files')
      .select('*')
      .neq('approval_status', 'none')
      .order('submitted_for_approval_at', { ascending: false })

    const ids = (fileData || []).map(f => f.id)
    let approvals = []
    if (ids.length) {
      const { data } = await supabase
        .from('file_approvals')
        .select('*')
        .in('file_id', ids)
        .order('step_order', { ascending: true })
      approvals = data || []
    }
    const grouped = {}
    approvals.forEach(a => { (grouped[a.file_id] ||= []).push(a) })

    setFiles(fileData || [])
    setApprovalsByFile(grouped)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadChain = useCallback(async (dept, division) => {
    let q = supabase.from('approval_chain_steps').select('*').eq('department', dept)
    q = division ? q.eq('division', division) : q.is('division', null)
    const { data } = await q.order('step_order', { ascending: true })
    setChainSteps(data || [])
  }, [])

  // Positions must come from real profiles, never be free-typed, so a
  // chain step can never drift out of sync with what officers are
  // actually assigned in Accounts (typo-proof, per system requirement).
  const loadKnownPositions = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('position').not('position', 'is', null)
    const unique = Array.from(new Set((data || []).map(p => p.position?.trim()).filter(Boolean))).sort()
    setKnownPositions(unique)
  }, [])

  useEffect(() => { if (tab === 'chains') { loadChain(chainDept, chainDivision); loadKnownPositions() } }, [tab, chainDept, chainDivision, loadChain, loadKnownPositions])
  useEffect(() => { setChainDivision('') }, [chainDept])

  const currentPendingStep = (fileId) => {
    const steps = approvalsByFile[fileId] || []
    return steps.find(s => s.status === 'pending')
  }

  const isMyTurn = (fileId) => {
    const step = currentPendingStep(fileId)
    return step && step.position_title === profile?.position
  }

  const mineFiles = useMemo(() => files.filter(f => f.approval_status === 'pending_approval' && isMyTurn(f.id)), [files, approvalsByFile, profile])
  const progressFiles = useMemo(() => files.filter(f => f.approval_status === 'pending_approval'), [files])
  const printingFiles = useMemo(() => files.filter(f => f.approval_status === 'approved_for_printing'), [files])
  const rejectedFiles = useMemo(() => files.filter(f => f.approval_status === 'rejected'), [files])
  const doneFiles = useMemo(() => files.filter(f => f.approval_status === 'done'), [files])

  const act = async (file, step, action) => {
    setBusyId(step.id)
    setMsg(null)
    try {
      const status = action === 'rejected' ? 'rejected' : 'approved'
      const { error: stepErr } = await supabase.from('file_approvals').update({
        status, action, approved_by: profile.id, approved_by_name: profile.name, acted_at: new Date().toISOString(),
      }).eq('id', step.id)
      if (stepErr) throw stepErr

      if (action === 'rejected') {
        await supabase.from('files').update({ approval_status: 'rejected' }).eq('id', file.id)
      } else if (action === 'approved_for_printing') {
        await supabase.from('files').update({ approval_status: 'approved_for_printing' }).eq('id', file.id)
      }
      await load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  const resubmit = async (file) => {
    setBusyId(file.id)
    try {
      await supabase.from('file_approvals').delete().eq('file_id', file.id)
      await supabase.from('files').update({ approval_status: 'none', submitted_for_approval_by: null, submitted_for_approval_at: null }).eq('id', file.id)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const markPrinted = async (file) => {
    setBusyId(file.id)
    await supabase.from('files').update({
      printed: true, printed_by: profile.id, printed_by_name: profile.name, printed_at: new Date().toISOString(),
    }).eq('id', file.id)
    await load()
    setBusyId(null)
  }

  const markWetSigned = async (file) => {
    setBusyId(file.id)
    await supabase.from('files').update({
      wet_signed: true, wet_signed_by: profile.id, wet_signed_by_name: profile.name, wet_signed_at: new Date().toISOString(),
    }).eq('id', file.id)
    await load()
    setBusyId(null)
  }

  const addChainStep = async () => {
    if (!newPosition.trim()) return
    const nextOrder = (chainSteps[chainSteps.length - 1]?.step_order || 0) + 1
    const { error } = await supabase.from('approval_chain_steps').insert({
      department: chainDept, division: chainDivision || null, step_order: nextOrder,
      position_title: newPosition.trim(), is_president: newIsPresident,
    })
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setNewPosition('')
    setNewIsPresident(false)
    loadChain(chainDept, chainDivision)
  }

  const removeChainStep = async (step) => {
    await supabase.from('approval_chain_steps').delete().eq('id', step.id)
    loadChain(chainDept, chainDivision)
  }

  const tabs = [
    { id: 'mine', label: 'Awaiting My Approval', count: mineFiles.length },
    { id: 'progress', label: 'In Progress', count: progressFiles.length },
    ...(canPrint ? [{ id: 'printing', label: 'Ready for Printing', count: printingFiles.length }] : []),
    { id: 'rejected', label: 'Rejected', count: rejectedFiles.length },
    { id: 'done', label: 'Done', count: doneFiles.length },
    ...(isAdmin ? [{ id: 'chains', label: 'Approval Chains', icon: Settings2 }] : []),
  ]

  const list = tab === 'mine' ? mineFiles : tab === 'progress' ? progressFiles : tab === 'printing' ? printingFiles : tab === 'rejected' ? rejectedFiles : tab === 'done' ? doneFiles : []

  return (
    <div>
      <Navbar title="For Review and Printing" />
      <div className="p-8">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                ${tab === t.id ? 'bg-nublue-600 text-white shadow-glow' : 'bg-white text-slate-500 border border-slate-100 hover:bg-nublue-50'}`}>
              {t.icon && <t.icon size={14} />}
              {t.label}
              {typeof t.count === 'number' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {msg && (
          <div className={`mb-4 text-sm rounded-xl px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {msg.text}
          </div>
        )}

        {tab === 'chains' ? (
          <div className="bg-white rounded-2xl border border-slate-100 card-glow p-6 max-w-2xl">
            <p className="text-sm text-slate-500 mb-4">
              Configure the ordered list of positions that must approve a document before it can be printed, per department and
              (optionally) per division. The last step should always be the <span className="font-semibold text-slate-700">President</span> (mark
              "Final approval — President" so they get the Approve for Printing button). Positions are pulled from the officers
              already on file in Accounts — not free-typed — so a chain step can never mismatch someone's actual position.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <select value={chainDept} onChange={e => setChainDept(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={chainDivision} onChange={e => setChainDivision(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Whole department (fallback)</option>
                {(DIVISIONS_BY_DEPARTMENT[chainDept] || []).map(dv => <option key={dv} value={dv}>{dv}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400 mb-4 -mt-2">
              {chainDivision
                ? `Editing the chain for ${chainDept} → ${chainDivision}. Files in this division use this chain instead of the department-wide one.`
                : `Editing the department-wide fallback chain for ${chainDept}, used by any division that doesn't have its own chain.`}
            </p>

            <div className="space-y-2 mb-4">
              {chainSteps.length === 0 && <p className="text-xs text-slate-400">No approval chain set for this department/division yet.</p>}
              {chainSteps.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    {s.step_order}. {s.position_title} {s.is_president && <Crown size={13} className="text-nugold-500" />}
                  </span>
                  <button onClick={() => removeChainStep(s)} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select value={newPosition} onChange={e => setNewPosition(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Select a position…</option>
                {knownPositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <input type="checkbox" checked={newIsPresident} onChange={e => setNewIsPresident(e.target.checked)} /> President (final)
              </label>
              <button onClick={addChainStep} disabled={!newPosition}
                className="flex items-center gap-1 bg-nublue-600 hover:bg-nublue-700 text-white text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-50">
                <Plus size={14} /> Add
              </button>
            </div>
            {knownPositions.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">No positions found in Accounts yet — add officers there first.</p>
            )}
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing here right now.</p>
        ) : (
          <div className="space-y-4">
            {list.map(file => {
              const steps = approvalsByFile[file.id] || []
              const step = currentPendingStep(file.id)
              const mine = step && step.position_title === profile?.position
              const bothDone = file.printed && file.wet_signed
              return (
                <div key={file.id} className="bg-white rounded-2xl border border-slate-100 card-glow p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-nublue-600" />
                        <p className="font-semibold text-slate-800">{file.document_name}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{file.department} · v{file.version_number || '1.0'}</p>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-nublue-50 text-nublue-600">
                      {APPROVAL_STATUS_LABELS[file.approval_status]}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-4">
                    {steps.map((s, i) => (
                      <React.Fragment key={s.id}>
                        <StepPill step={s} />
                        {i < steps.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
                      </React.Fragment>
                    ))}
                  </div>

                  {tab !== 'printing' && step && mine && file.approval_status === 'pending_approval' && (
                    <div className="flex items-center gap-2 mt-4">
                      {step.is_president ? (
                        <button disabled={busyId === step.id} onClick={() => act(file, step, 'approved_for_printing')}
                          className="flex items-center gap-2 bg-nugold-500 hover:bg-nugold-600 text-nublue-900 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                          {busyId === step.id ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />}
                          Approve for Printing
                        </button>
                      ) : (
                        <button disabled={busyId === step.id} onClick={() => act(file, step, 'approved')}
                          className="flex items-center gap-2 bg-nublue-600 hover:bg-nublue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                          {busyId === step.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          Approve
                        </button>
                      )}
                      <button disabled={busyId === step.id} onClick={() => act(file, step, 'rejected')}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  )}

                  {tab === 'rejected' && (file.uploaded_by === profile?.id || isAdmin) && (
                    <button disabled={busyId === file.id} onClick={() => resubmit(file)}
                      className="flex items-center gap-2 mt-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                      <RotateCcw size={14} /> Reset &amp; Resubmit
                    </button>
                  )}

                  {file.approval_status === 'approved_for_printing' && canPrint && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button disabled={busyId === file.id || file.printed} onClick={() => markPrinted(file)}
                          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60
                            ${file.printed ? 'bg-emerald-50 text-emerald-600' : 'bg-nublue-600 hover:bg-nublue-700 text-white'}`}>
                          <Printer size={15} /> {file.printed ? `Printed · ${file.printed_by_name || ''}` : 'Mark as Printed'}
                        </button>
                        <button disabled={busyId === file.id || file.wet_signed} onClick={() => markWetSigned(file)}
                          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60
                            ${file.wet_signed ? 'bg-emerald-50 text-emerald-600' : 'bg-nublue-600 hover:bg-nublue-700 text-white'}`}>
                          <PenTool size={15} /> {file.wet_signed ? `Wet Signed · ${file.wet_signed_by_name || ''}` : 'Mark as Wet Signed'}
                        </button>
                      </div>
                      {bothDone && (
                        <div className="mt-3 flex items-center gap-2 bg-nugold-50 border border-nugold-100 text-nugold-800 text-xs font-semibold rounded-xl px-4 py-3">
                          <UploadCloud size={16} className="shrink-0" />
                          Printed and wet-signed — automatically moved to Done. Don't forget to upload the
                          scanned copy to <span className="font-bold">{file.department} → Final Copies</span>.
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'done' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Printer size={13} className="text-emerald-500" /> Printed · {file.printed_by_name}</span>
                      <span className="flex items-center gap-1.5"><PenTool size={13} className="text-emerald-500" /> Wet Signed · {file.wet_signed_by_name}</span>
                    </div>
                  )}

                  {!mine && step && tab !== 'printing' && tab !== 'done' && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
                      <Clock size={13} /> Waiting on <span className="font-semibold text-slate-500">{step.position_title}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
