import React from 'react'
import { FileText, Download, Link as LinkIcon, Lock, User, Calendar, Tag, GitBranch } from 'lucide-react'

export default function FileCard({ file, hasAccess, onDownload, onRequestAccess }) {
  const dateStr = file.date_uploaded
    ? new Date(file.date_uploaded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 card-glow hover:-translate-y-0.5 hover:shadow-lg transition-all p-4 flex flex-col animate-fade-in">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-nublue-50 flex items-center justify-center shrink-0">
          <FileText size={20} className="text-nublue-600" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-slate-800 truncate" title={file.document_name}>
            {file.document_name}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-nublue-600 bg-nublue-50 px-2 py-0.5 rounded-full mt-1">
            <GitBranch size={10} /> v{file.version_number || '1.0'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 mb-4 flex-1">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-slate-400" /> {dateStr}
        </div>
        <div className="flex items-center gap-1.5">
          <User size={13} className="text-slate-400" /> {file.uploaded_by_name || 'Unknown'}
        </div>
        {file.division && (
          <div className="flex items-center gap-1.5">
            <Tag size={13} className="text-slate-400" /> {file.division}
          </div>
        )}
      </div>

      {hasAccess ? (
        <button
          onClick={() => onDownload(file)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-nublue-600 hover:bg-nublue-700 text-white rounded-xl py-2 transition"
        >
          {file.external_link ? <LinkIcon size={16} /> : <Download size={16} />}
          {file.external_link ? 'Open Link' : 'Download'}
        </button>
      ) : (
        <button
          onClick={() => onRequestAccess(file)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-nugold-500 hover:bg-nugold-600 text-nublue-900 rounded-xl py-2 transition"
        >
          <Lock size={15} /> Request Access
        </button>
      )}
    </div>
  )
}
