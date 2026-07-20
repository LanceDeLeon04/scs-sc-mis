import React, { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'
import { FolderCard, NewFolderCard } from '../components/FolderGrid.jsx'
import FileCard from '../components/FileCard.jsx'
import UploadModal from '../components/UploadModal.jsx'
import RequestAccessModal from '../components/RequestAccessModal.jsx'
import { supabase, DEPARTMENTS, STORAGE_BUCKET } from '../supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { UploadCloud } from 'lucide-react'

export default function Templates() {
  const { profile, isAdmin } = useAuth()
  const [department, setDepartment] = useState(null)
  const [folderStack, setFolderStack] = useState([])
  const [subfolders, setSubfolders] = useState([])
  const [files, setFiles] = useState([])
  const [grants, setGrants] = useState(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [requestFile, setRequestFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1].id : null

  const hasAccessToDept = (dept) => {
    if (isAdmin) return true
    if (dept === 'GENERAL') return true
    return profile?.department === dept
  }

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
              onDownload={handleDownload}
              onRequestAccess={setRequestFile}
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
      {requestFile && (
        <RequestAccessModal file={requestFile} onClose={() => setRequestFile(null)} />
      )}
    </div>
  )
}
