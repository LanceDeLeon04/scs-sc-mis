import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import { FolderCard, NewFolderCard } from '../components/FolderGrid.jsx'
import FileCard from '../components/FileCard.jsx'
import UploadModal from '../components/UploadModal.jsx'
import RequestAccessModal from '../components/RequestAccessModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { supabase, DEPARTMENTS, DOC_SUBFOLDERS, STORAGE_BUCKET } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { UploadCloud } from 'lucide-react'

// Supabase does NOT return an error when a delete/update is blocked by
// Row-Level Security -- it just reports success with 0 rows affected.
// Without .select() we can't tell "deleted" apart from "silently blocked",
// which is why edit/delete could look like it does nothing at all.
const PERMISSION_HINT =
  "You may not have permission to do this, or the database migration " +
  "005_owner_edit_delete.sql hasn't been run on this project yet."

export default function Documents() {
  const { profile, isAdmin } = useAuth()
  const [department, setDepartment] = useState(null)
  const [stage, setStage] = useState(null)
  const [folderStack, setFolderStack] = useState([]) // [{id,name}]
  const [subfolders, setSubfolders] = useState([])
  const [files, setFiles] = useState([])
  const [grants, setGrants] = useState(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [editingFile, setEditingFile] = useState(null)
  const [requestFile, setRequestFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmState, setConfirmState] = useState(null) // { title, message, danger, onConfirm }
  const [alertState, setAlertState] = useState(null) // { title, message }

  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1].id : null

  const canUploadHere = () => {
    if (!department || !stage) return false
    if (isAdmin) return true
    // officers: only their own department + Document Drafts
    return profile.department === department && stage === 'Document Drafts'
  }

  // A user may edit/delete a file or folder only in places they'd be allowed
  // to upload, and only items they themselves created (admins can manage
  // anything). View-only access never grants edit/delete.
  const canManageFile = (file) => {
    if (isAdmin) return true
    return canUploadHere() && file.uploaded_by === profile.id
  }

  const canManageFolder = (folder) => {
    if (isAdmin) return true
    return canUploadHere() && folder.created_by === profile.id
  }

  const hasAccessToDept = (dept) => {
    if (isAdmin) return true
    if (dept === 'GENERAL') return true
    return profile?.department === dept
  }

  const loadContents = useCallback(async () => {
    if (!department || !stage) return
    setLoading(true)
    let folderQuery = supabase
      .from('folders')
      .select('*')
      .eq('module', 'documents')
      .eq('department', department)
      .eq('stage', stage)
      .order('created_at', { ascending: true })

    folderQuery = currentFolderId
      ? folderQuery.eq('parent_folder_id', currentFolderId)
      : folderQuery.is('parent_folder_id', null)

    const { data: folderData } = await folderQuery

    let fileQuery = supabase
      .from('files')
      .select('*')
      .eq('module', 'documents')
      .eq('department', department)
      .eq('stage', stage)
      .order('date_uploaded', { ascending: false })

    fileQuery = currentFolderId
      ? fileQuery.eq('folder_id', currentFolderId)
      : fileQuery.is('folder_id', null)

    const { data: fileData } = await fileQuery

    setSubfolders(folderData || [])
    setFiles(fileData || [])

    if (!hasAccessToDept(department) && fileData?.length) {
      const { data: grantData } = await supabase
        .from('file_access_grants')
        .select('file_id')
        .eq('granted_to', profile.id)
        .in('file_id', fileData.map(f => f.id))
      setGrants(new Set((grantData || []).map(g => g.file_id)))
    } else {
      setGrants(new Set())
    }
    setLoading(false)
  }, [department, stage, currentFolderId])

  useEffect(() => { loadContents() }, [loadContents])

  const createFolder = async (name) => {
    const { error } = await supabase.from('folders').insert({
      module: 'documents', department, stage, name,
      parent_folder_id: currentFolderId, created_by: profile.id,
    })
    if (error) return { error }
    loadContents()
    return { error: null }
  }

  const renameFolder = async (folder, newName) => {
    // .select() lets us tell a real update from an RLS-silenced no-op.
    const { data, error } = await supabase.from('folders').update({ name: newName }).eq('id', folder.id).select()
    if (error) return { error }
    if (!data || data.length === 0) return { error: { message: PERMISSION_HINT } }
    loadContents()
    return { error: null }
  }

  const deleteFolder = (folder) => {
    setConfirmState({
      title: 'Delete folder?',
      message: `Delete folder "${folder.name}"? Files inside will not be deleted, but will move up one level.`,
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState(null)
        const { data, error } = await supabase.from('folders').delete().eq('id', folder.id).select()
        if (error) { setAlertState({ title: 'Could not delete folder', message: error.message }); return }
        if (!data || data.length === 0) { setAlertState({ title: 'Could not delete folder', message: PERMISSION_HINT }); return }
        loadContents()
      },
    })
  }

  const deleteFile = (file) => {
    setConfirmState({
      title: 'Delete file?',
      message: `Delete "${file.document_name}"? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState(null)
        const { data, error } = await supabase.from('files').delete().eq('id', file.id).select()
        if (error) { setAlertState({ title: 'Could not delete file', message: error.message }); return }
        if (!data || data.length === 0) { setAlertState({ title: 'Could not delete file', message: PERMISSION_HINT }); return }
        if (file.storage_path) {
          await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path])
        }
        loadContents()
      },
    })
  }

  const handleDownload = async (file) => {
    if (file.external_link) { window.open(file.external_link, '_blank'); return }
    if (file.storage_path) {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storage_path, 60)
      if (!error && data) window.open(data.signedUrl, '_blank')
    }
  }

  const crumbs = []
  if (department) crumbs.push(department)
  if (stage) crumbs.push(stage)
  folderStack.forEach(f => crumbs.push(f.name))

  const handleCrumbClick = (i) => {
    if (i === -1) { setDepartment(null); setStage(null); setFolderStack([]); return }
    if (i === 0) { setStage(null); setFolderStack([]); return }
    if (i === 1) { setFolderStack([]); return }
    setFolderStack(folderStack.slice(0, i - 1))
  }

  // LEVEL 1: department selection
  if (!department) {
    return (
      <div>
        <Navbar title="Documents" crumbs={[]} />
        <div className="p-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {DEPARTMENTS.map(d => (
            <FolderCard key={d} label={d} sublabel={hasAccessToDept(d) ? 'Your access' : 'Request required'}
              color={hasAccessToDept(d) ? 'blue' : 'gold'}
              onClick={() => setDepartment(d)} />
          ))}
        </div>
      </div>
    )
  }

  // LEVEL 2: stage selection (Drafts / Final Copies)
  if (!stage) {
    return (
      <div>
        <Navbar title={department} crumbs={crumbs} onCrumbClick={handleCrumbClick} />
        <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {DOC_SUBFOLDERS.map(s => (
            <FolderCard key={s} label={s}
              sublabel={s === 'Final Copies' ? 'Admin uploads only' : 'Drafts & working files'}
              onClick={() => setStage(s)} />
          ))}
        </div>
      </div>
    )
  }

  // LEVEL 3+: folders + files inside stage
  return (
    <div>
      <Navbar title={`${department} · ${stage}`} crumbs={crumbs} onCrumbClick={handleCrumbClick} />
      <div className="px-8 pt-6 flex items-center justify-between">
        <p className="text-sm text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''} · {subfolders.length} folder{subfolders.length !== 1 ? 's' : ''}</p>
        {canUploadHere() && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-nublue-600 hover:bg-nublue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-glow">
            <UploadCloud size={16} /> Upload File
          </button>
        )}
      </div>

      <div className="p-8 pt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {subfolders.map(f => (
          <FolderCard key={f.id} label={f.name} sublabel="Folder"
            canManage={canManageFolder(f)}
            onRename={(newName) => renameFolder(f, newName)}
            onDelete={() => deleteFolder(f)}
            onClick={() => setFolderStack([...folderStack, { id: f.id, name: f.name }])} />
        ))}
        <NewFolderCard onCreate={createFolder} />
      </div>

      {loading ? (
        <p className="px-8 text-sm text-slate-400">Loading files…</p>
      ) : (
        <div className="px-8 pb-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map(file => (
            <FileCard
              key={file.id}
              file={file}
              hasAccess={hasAccessToDept(department) || grants.has(file.id)}
              canManage={canManageFile(file)}
              onDownload={handleDownload}
              onRequestAccess={setRequestFile}
              onEdit={setEditingFile}
              onDelete={deleteFile}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          module="documents" department={department} stage={stage} folderId={currentFolderId}
          onClose={() => setShowUpload(false)} onUploaded={loadContents}
        />
      )}
      {editingFile && (
        <UploadModal
          module="documents" department={department} stage={stage} folderId={currentFolderId}
          editingFile={editingFile}
          onClose={() => setEditingFile(null)} onUploaded={loadContents}
        />
      )}
      {requestFile && (
        <RequestAccessModal file={requestFile} onClose={() => setRequestFile(null)} />
      )}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        danger={confirmState?.danger}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
      <ConfirmDialog
        open={!!alertState}
        title={alertState?.title}
        message={alertState?.message}
        danger
        onConfirm={() => setAlertState(null)}
      />
    </div>
  )
}
