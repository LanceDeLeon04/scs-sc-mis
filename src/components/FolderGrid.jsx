import React, { useState } from 'react'
import { Folder, FolderPlus, X, Pencil, Trash2, Check } from 'lucide-react'

export function FolderCard({ label, sublabel, onClick, color = 'blue', canManage, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(label)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const colorMap = {
    blue: 'bg-nublue-50 text-nublue-600 group-hover:bg-nublue-600 group-hover:text-white',
    gold: 'bg-nugold-100 text-nugold-700 group-hover:bg-nugold-500 group-hover:text-nublue-900',
  }

  const submitRename = async () => {
    if (!name.trim() || submitting) return
    if (name.trim() === label) { setRenaming(false); return }
    setSubmitting(true)
    setError('')
    try {
      const result = await onRename(name.trim())
      if (result?.error) {
        setError(result.error.message || 'Could not rename folder.')
        return
      }
      setRenaming(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (renaming) {
    return (
      <div className="rounded-2xl border-2 border-nublue-300 bg-white p-4 flex flex-col gap-2 min-h-[128px] justify-center">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Rename folder</span>
          <button onClick={() => { setRenaming(false); setName(label); setError('') }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitRename() }}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
        />
        {error && <p className="text-[11px] text-red-600 leading-snug">{error}</p>}
        <button
          onClick={submitRename}
          disabled={submitting}
          className="flex items-center justify-center gap-1.5 bg-nublue-600 hover:bg-nublue-700 text-white text-xs font-semibold rounded-lg py-1.5 transition disabled:opacity-60"
        >
          <Check size={13} /> {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    )
  }

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="w-full bg-white rounded-2xl border border-slate-100 card-glow hover:-translate-y-0.5 hover:shadow-lg transition-all p-5 flex flex-col items-start gap-3 text-left animate-fade-in"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${colorMap[color]}`}>
          <Folder size={24} />
        </div>
        <div className={canManage ? 'pr-12 w-full' : 'w-full'}>
          <p className="font-semibold text-sm text-slate-800 truncate">{label}</p>
          {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
      </button>
      {canManage && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setRenaming(true) }}
            title="Rename"
            aria-label="Rename folder"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-nublue-50 active:bg-nublue-100 text-slate-500 hover:text-nublue-600 transition"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete"
            aria-label="Delete folder"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 active:bg-red-100 text-slate-500 hover:text-red-600 transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

export function NewFolderCard({ onCreate }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      // onCreate may return an { error } result (see Documents.jsx / Templates.jsx).
      // Await it so we can surface a real message instead of failing silently.
      const result = await onCreate(name.trim())
      if (result?.error) {
        setError(result.error.message || 'Could not create folder.')
        return
      }
      setOpen(false)
      setName('')
    } catch (err) {
      setError(err.message || 'Could not create folder.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-dashed border-nublue-200 hover:border-nublue-400 transition-colors p-5 flex flex-col items-center justify-center gap-2 text-nublue-400 hover:text-nublue-600 min-h-[128px]"
      >
        <FolderPlus size={26} />
        <span className="text-xs font-semibold">New Folder</span>
      </button>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-nublue-300 bg-white p-4 flex flex-col gap-2 min-h-[128px] justify-center">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Folder name</span>
        <button onClick={() => { setOpen(false); setName(''); setError('') }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="e.g. Minutes of the Meeting"
        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
      />
      {error && <p className="text-[11px] text-red-600 leading-snug">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="bg-nublue-600 hover:bg-nublue-700 text-white text-xs font-semibold rounded-lg py-1.5 transition disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </div>
  )
}
