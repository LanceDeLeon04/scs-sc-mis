import React, { useEffect } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

/**
 * Replaces window.confirm() / window.alert() with an in-app dialog
 * (no more "localhost says..." browser popups).
 *
 * Usage:
 *   <ConfirmDialog
 *     open={!!confirmState}
 *     title="Delete file?"
 *     message="This cannot be undone."
 *     danger
 *     confirmLabel="Delete"
 *     onConfirm={...}
 *     onCancel={() => setConfirmState(null)}
 *   />
 *
 * For a plain notice (replacing alert()), omit onCancel and it renders
 * as a single-button "OK" dialog.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  danger = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') (onCancel || onConfirm)?.()
      if (e.key === 'Enter') onConfirm?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const isAlert = !onCancel

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => (onCancel || onConfirm)?.()}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-sm card-glow border-t-4 animate-fade-in ${danger ? 'border-red-500' : 'border-nublue-500'}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                danger ? 'bg-red-50 text-red-600' : 'bg-nublue-50 text-nublue-600'
              }`}
            >
              {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800">{title}</h3>
              {message && <p className="text-sm text-slate-500 mt-1 leading-snug">{message}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          {!isAlert && (
            <button
              onClick={onCancel}
              className="flex-1 text-sm font-semibold rounded-xl py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              {cancelLabel}
            </button>
          )}
          <button
            autoFocus
            onClick={onConfirm}
            className={`flex-1 text-sm font-semibold rounded-xl py-2 text-white transition ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-nublue-600 hover:bg-nublue-700'
            }`}
          >
            {isAlert ? 'OK' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
