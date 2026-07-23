import React from 'react'
import { FileText, Download, Link as LinkIcon, Lock, User, Calendar, Tag, GitBranch, Pencil, Trash2, Send, ShieldCheck, Clock, XCircle } from 'lucide-react'

const APPROVAL_BADGE = {
  pending_approval: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-600', icon: Clock },
  approved_for_printing: { label: 'Approved for Printing', cls: 'bg-emerald-50 text-emerald-600', icon: ShieldCheck },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600', icon: XCircle },
}

export default function FileCard({ file, hasAccess, canManage, onDownload, onRequestAccess, onEdit, onDelete, canSubmitForApproval, onSubmitForApproval }) {
  const badge = file.approval_status && file.approval_status !== 'none' ? APPROVAL_BADGE[file.approval_status] : null
  const dateStr = file.date_uploaded
    ? new Date(file.date_uploaded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 card-glow hover:-translate-y-0.5 hover:shadow-lg transition-all p-4 flex flex-col animate-fade-in relative">
      {canManage && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button
            onClick={() => onEdit(file)}
            title="Edit"
            aria-label="Edit file"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-nublue-50 active:bg-nublue-100 text-slate-500 hover:text-nublue-600 transition"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(file)}
            title="Delete"
            aria-label="Delete file"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 active:bg-red-100 text-slate-500 hover:text-red-600 transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-nublue-50 flex items-center justify-center shrink-0">
          <FileText size={20} className="text-nublue-600" />
        </div>
        <div className="min-w-0 pr-12">
          <p className="font-semibold text-sm text-slate-800 truncate" title={file.document_name}>
            {file.document_name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-nublue-600 bg-nublue-50 px-2 py-0.5 rounded-full">
              <GitBranch size={10} /> v{file.version_number || '1.0'}
            </span>
            {badge && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.cls}`}>
                <badge.icon size={10} /> {badge.label}
              </span>
            )}
            {file.is_confidential && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800 text-white" title="Only Administrative Department can access this document">
                <Lock size={10} /> Confidential
              </span>
            )}
          </div>
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

      {canSubmitForApproval && (
        <button
          onClick={() => onSubmitForApproval(file)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-nublue-50 hover:bg-nublue-100 text-nublue-700 rounded-xl py-2 mt-2 transition"
        >
          <Send size={15} /> Submit for Approval
        </button>
      )}
    </div>
  )
}
