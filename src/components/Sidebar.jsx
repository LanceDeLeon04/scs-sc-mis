import React, { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { supabase, AVATAR_BUCKET } from '../supabaseClient'
import { LayoutGrid, FileStack, FileSpreadsheet, Inbox, UserPlus, LogOut, ShieldCheck, Camera, Loader2 } from 'lucide-react'

const linkBase = 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors'
const linkActive = 'bg-nublue-600 text-white shadow-glow'
const linkIdle = 'text-slate-500 hover:bg-nublue-50 hover:text-nublue-700'

export default function Sidebar() {
  const { profile, isAdmin, signOut, session, refreshProfile } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)

  const handleAvatarClick = () => {
    setAvatarError(null)
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError('Image must be under 3MB.')
      return
    }

    const userId = session?.user?.id
    if (!userId) return

    setUploading(true)
    setAvatarError(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      // cache-bust so the new photo shows immediately even with the same filename
      const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
      if (profileErr) throw profileErr

      await refreshProfile()
    } catch (err) {
      setAvatarError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <img src="/SCSLogo.png" alt="SCS Logo" className="w-10 h-10 object-contain" />
        <div className="min-w-0">
          <p className="font-extrabold text-nublue-700 text-sm leading-tight">SCS Student Council</p>
          <p className="text-[11px] text-slate-400 gold-underline inline-block pb-0.5">File Repository</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1.5">
        <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <LayoutGrid size={18} /> Dashboard
        </NavLink>
        <NavLink to="/templates" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <FileSpreadsheet size={18} /> Templates
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <FileStack size={18} /> Documents
        </NavLink>
        <NavLink to="/tickets" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <Inbox size={18} /> Access Requests
        </NavLink>
        {isAdmin && (
          <NavLink to="/accounts" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
            <UserPlus size={18} /> Manage Accounts
          </NavLink>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            title="Click to change your profile picture"
            className="relative w-9 h-9 rounded-full shrink-0 group focus:outline-none focus:ring-2 focus:ring-nublue-500 focus:ring-offset-1 rounded-full"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile?.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-nublue-600 text-white flex items-center justify-center text-xs font-bold">
                {(profile?.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {uploading ? <Loader2 size={14} className="text-white animate-spin" /> : <Camera size={13} className="text-white" />}
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{profile?.name}</p>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              {isAdmin && <ShieldCheck size={11} className="text-nugold-500" />}
              {profile?.position}
            </p>
          </div>
        </div>
        {avatarError && (
          <p className="text-[10px] text-red-500 mb-2 -mt-1">{avatarError}</p>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-2 transition"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  )
}
