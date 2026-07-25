import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import Sidebar from './components/Sidebar.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Templates from './pages/Templates.jsx'
import Documents from './pages/Documents.jsx'
import Tickets from './pages/Tickets.jsx'
import Accounts from './pages/Accounts.jsx'
import Settings from './pages/Settings.jsx'
import Grievance from './pages/Grievance.jsx'
import Grievances from './pages/Grievances.jsx'
import Approvals from './pages/Approvals.jsx'
import Attendance from './pages/Attendance.jsx'

function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-nublue-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-nugold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/70 text-sm font-medium">Loading SCS Repository…</p>
      </div>
    </div>
  )
}

function ProtectedLayout({ children, adminOnly = false }) {
  const { session, profile, loading, isAdmin } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <LoadingScreen />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen bg-[#f5f8ff]">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <LoadingScreen /> : session ? <Navigate to="/" replace /> : <Login />}
      />
      {/* Public — no login required, students report/track from here */}
      <Route path="/grievance" element={<Grievance />} />
      <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/templates" element={<ProtectedLayout><Templates /></ProtectedLayout>} />
      <Route path="/documents" element={<ProtectedLayout><Documents /></ProtectedLayout>} />
      <Route path="/tickets" element={<ProtectedLayout><Tickets /></ProtectedLayout>} />
      <Route path="/grievances" element={<ProtectedLayout><Grievances /></ProtectedLayout>} />
      <Route path="/approvals" element={<ProtectedLayout><Approvals /></ProtectedLayout>} />
      <Route path="/attendance" element={<ProtectedLayout><Attendance /></ProtectedLayout>} />
      <Route path="/accounts" element={<ProtectedLayout adminOnly><Accounts /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
