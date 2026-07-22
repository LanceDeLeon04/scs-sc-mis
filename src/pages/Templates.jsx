import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import { FolderCard, NewFolderCard } from '../components/FolderGrid.jsx'
import FileCard from '../components/FileCard.jsx'
import UploadModal from '../components/UploadModal.jsx'
import RequestAccessModal from '../components/RequestAccessModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { supabase, DEPARTMENTS, STORAGE_BUCKET } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { UploadCloud } from 'lucide-react'

// Supabase does NOT return an error when a delete/update is blocked by
// Row-Level Security -- it just reports success with 0 rows affected.
// diagnosePermission compares the same conditions the RLS policy checks,
// using data already in memory, so a denial tells you exactly which
// condition failed instead of a generic message.
function diagnosePermission(profile, isAdmin, item, kind) {
  if (isAdmin) {
    return `Denied even though your profile role is "${profile?.role}". This means the ` +
      `admin check itself isn't matching in the database -- your logged-in session's ` +
      `auth.uid() may not equal profiles.id for "${profile?.email}". Check that in Supabase.`
  }
  const lines = []
  const ownerField = kind === 'folder' ? item.created_by : item.uploaded_by
  lines.push(`your profile: role="${profile?.role}", department="${profile?.department}", id=${profile?.id}`)
  lines.push(`this ${kind}: ${kind === 'folder' ? 'created_by' : 'uploaded_by'}=${ownerField}, module="${item.module}", stage="${item.stage}", department="${item.department}"`)
  if (ownerField !== profile?.id) lines.push(`-> NOT the owner (ids don't match)`)
  if (item.module !== 'documents') lines.push(`-> module is "${item.module}", policy requires "documents"`)
  if (item.stage !== 'Document Drafts') lines.push(`-> stage is "${item.stage}", policy requires "Document Drafts"`)
  if (item.department !== profile?.department) lines.push(`-> department mismatch`)
  return lines.join('\n')
}

export default function Templates() {
  const { profile, isAdmin } = useAuth()
  const [department, setDepartment] = useState(null)
  const [folderStack, setFolderStack] = useState([])
  const [subfolders, setSubfolders] = useState([])
  const [files, setFiles] = useState([])
  const [grants, setGrants] = useState(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [editingFile, setEditingFile] = useState(null)
  const [requestFile, setRequestFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [alertState, setAlertState] = useState(null)

  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1].id : null

  const hasAccessToDept = (dept) => {
    if (isAdmin) return true
    if (dept === 'GENERAL') return true
    return profile?.department === dept
  }

  // Templates can only be uploaded by admins, so only admins (or the
  // original uploader, if that were ever allowed) can edit/delete them.
  // View-only officers never get edit/delete here.
  const canManageFile = (file) => isAdmin || file.uploaded_by === profile?.id
  const canManageFolder = (folder) => isAdmin || folder.created_by === profile?.id

  const loadContents = useCallback(async () => {
    if (!department) return
    setLoading(true)
    let folderQuery = supabase
      .from('folders')
      .select('*')
      .eq('module', 'templates')
      .eq('department', department)
      .order('created_at', { ascending: true })

    folderQuery = currentFolderId
      ? folderQuery.eq('parent_folder_id', currentFolderId)
      : folderQuery.is('parent_folder_id', null)

    const { data: folderData } = await folderQuery

    let fileQuery = supabase
      .from('files')
      .select('*')
      .eq('module', 'templates')
      .eq('department', department)
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
  }, [department, currentFolderId])

  useEffect(() => { loadContents() }, [loadContents])

  const createFolder = async (name) => {
    const { error } = await supabase.from('folders').insert({
      module: 'templates', department, name,
      parent_folder_id: currentFolderId, created_by: profile.id,
    })
    if (error) return { error }
    loadContents()
    return { error: null }
  }

  const renameFolder = async (folder, newName) => {
    const { data, error } = await supabase.from('folders').update({ name: newName }).eq('id', folder.id).select()
    if (error) return { error }
    if (!data || data.length === 0) return { error: { message: diagnosePermission(profile, isAdmin, folder, 'folder') } }
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
        if (!data || data.length === 0) { setAlertState({ title: 'Denied — here\'s why', message: diagnosePermission(profile, isAdmin, folder, 'folder') }); return }
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
        if (!data || data.length === 0) { setAlertState({ title: 'Denied — here\'s why', message: diagnosePermission(profile, isAdmin, file, 'file') }); return }
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
  folderStack.forEach(f => crumbs.push(f.name))

  const handleCrumbClick = (i) => {
    if (i === -1) { setDepartment(null); setFolderStack([]); return }
    if (i === 0) { setFolderStack([]); return }
    setFolderStack(folderStack.slice(0, i - 1))
  }

  if (!department) {
    return (
      <div>
        <Navbar title="Templates" crumbs={[]} />
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

  return (
    <div>
      <Navbar title={`Templates · ${department}`} crumbs={crumbs} onCrumbClick={handleCrumbClick} />
      <div className="px-8 pt-6 flex items-center justify-between">
        <p className="text-sm text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''} · {subfolders.length} folder{subfolders.length !== 1 ? 's' : ''}</p>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-nublue-600 hover:bg-nublue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-glow">
            <UploadCloud size={16} /> Upload Template
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
          module="templates" department={department} stage={null} folderId={currentFolderId}
          onClose={() => setShowUpload(false)} onUploaded={loadContents}
        />
      )}
      {editingFile && (
        <UploadModal
          module="templates" department={department} stage={null} folderId={currentFolderId}
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
