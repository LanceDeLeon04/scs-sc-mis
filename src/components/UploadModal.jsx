import React, { useState } from 'react'
import { X, UploadCloud, Link as LinkIcon, Paperclip } from 'lucide-react'
import { supabase, STORAGE_BUCKET } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'

export default function UploadModal({ module, department, stage, folderId, onClose, onUploaded, editingFile }) {
  const { profile } = useAuth()
  const isEdit = !!editingFile
  const [documentName, setDocumentName] = useState(editingFile?.document_name || '')
  const [version, setVersion] = useState(editingFile?.version_number || '1.0')
  const [division, setDivision] = useState(editingFile?.division || profile?.division || '')
  const [mode, setMode] = useState(editingFile?.external_link ? 'link' : 'file')
  const [file, setFile] = useState(null)
  const [link, setLink] = useState(editingFile?.external_link || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async (e) => {
    e.preventDefault()
    setError('')
    if (!documentName.trim()) { setError('Document name is required.'); return }
    if (mode === 'file' && !isEdit && !file) { setError('Please choose a file to upload.'); return }
    if (mode === 'link' && !link.trim()) { setError('Please provide a link.'); return }

    setLoading(true)
    try {
      let storage_path = isEdit ? editingFile.storage_path : null
      let external_link = mode === 'link' ? link.trim() : null
      const oldPath = editingFile?.storage_path

      if (mode === 'file' && file) {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const path = `${department}/${module}/${stage || 'general'}/${safeName}`
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file)
        if (upErr) throw upErr
        storage_path = path
      } else if (mode === 'link') {
        storage_path = null
      }

      if (isEdit) {
        // .select() lets us tell a real update apart from a Row-Level-Security
        // silenced no-op (Supabase returns success + 0 rows, not an error).
        const { data: updData, error: updErr } = await supabase.from('files').update({
          document_name: documentName.trim(),
          division: division.trim() || null,
          version_number: version.trim() || '1.0',
          storage_path,
          external_link,
        }).eq('id', editingFile.id).select()
        if (updErr) throw updErr
        if (!updData || updData.length === 0) {
          throw new Error(
            "You don't have permission to edit this file, or the database migration " +
            "005_owner_edit_delete.sql hasn't been run on this project yet."
          )
        }

        // if a new attachment replaced an old one, or we switched to a link, clean up the old object
        if (oldPath && oldPath !== storage_path) {
          await supabase.storage.from(STORAGE_BUCKET).remove([oldPath])
        }
      } else {
        const { error: insErr } = await supabase.from('files').insert({
          document_name: documentName.trim(),
          module,
          department,
          stage: module === 'documents' ? stage : null,
          folder_id: folderId || null,
          division: division.trim() || null,
          version_number: version.trim() || '1.0',
          storage_path,
          external_link,
          uploaded_by: profile.id,
          uploaded_by_name: profile.name,
        })
        if (insErr) throw insErr
      }

      onUploaded && onUploaded()
      onClose()
    } catch (err) {
      setError(err.message || (isEdit ? 'Update failed.' : 'Upload failed.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg card-glow border-t-4 border-nugold-500 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud size={20} className="text-nublue-600" />
            {isEdit ? 'Edit' : 'Upload'} {module === 'templates' ? 'Template' : 'Document'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div><span className="font-semibold">Department:</span> {department}</div>
            {stage && <div><span className="font-semibold">Stage:</span> {stage}</div>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Document Name</label>
            <input value={documentName} onChange={e => setDocumentName(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500"
              placeholder="e.g. Meeting Minutes - July 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Version No.</label>
              <input value={version} onChange={e => setVersion(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Division Name</label>
              <input value={division} onChange={e => setDivision(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500" />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded-xl py-2 border transition ${mode === 'file' ? 'bg-nublue-600 text-white border-nublue-600' : 'border-slate-200 text-slate-500'}`}>
              <Paperclip size={15} /> Attachment
            </button>
            <button type="button" onClick={() => setMode('link')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded-xl py-2 border transition ${mode === 'link' ? 'bg-nublue-600 text-white border-nublue-600' : 'border-slate-200 text-slate-500'}`}>
              <LinkIcon size={15} /> External Link
            </button>
          </div>

          {mode === 'file' ? (
            <div>
              {isEdit && editingFile?.storage_path && !file && (
                <p className="text-[11px] text-slate-400 mb-1">Leave empty to keep the current attachment.</p>
              )}
              <input type="file" onChange={e => setFile(e.target.files[0])}
                className="w-full text-sm border border-dashed border-slate-300 rounded-xl px-3 py-3" />
            </div>
          ) : (
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nublue-500" />
          )}

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full bg-nublue-600 hover:bg-nublue-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
            {isEdit ? (loading ? 'Saving…' : 'Save Changes') : (loading ? 'Uploading…' : 'Upload File')}
          </button>
        </form>
      </div>
    </div>
  )
}
