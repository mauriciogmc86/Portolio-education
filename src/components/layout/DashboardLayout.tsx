'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Profile, Organization } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import { useAuth } from '@/hooks/useAuth'
import { getUnreadMessagesCount, subscribeToAllMessages } from '@/services/chatService'

type MenuItem = {
  label: string
  href: string
  icon: ReactNode
}

const baseMenuConfig: Record<Profile['role'], MenuItem[]> = {
  super_admin: [
    { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
    { label: 'Escuelas', href: '/organizations', icon: <BuildingIcon /> },
    { label: 'Tareas', href: '/assignments', icon: <AssignmentIcon /> },
    { label: 'Foro', href: '/forum', icon: <ForumIcon /> },
    { label: 'Chat', href: '/chat', icon: <ChatIcon unreadCount={0} /> },
    { label: 'Configuración', href: '/settings', icon: <CogIcon /> },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
    { label: 'Mis Profesores/Alumnos', href: '/users', icon: <UsersIcon /> },
    { label: 'Períodos', href: '/periods', icon: <CalendarIcon /> },
    { label: 'Mis Grupos', href: '/groups', icon: <AcademicIcon /> },
    { label: 'Cursos', href: '/courses', icon: <BookIcon /> },
    { label: 'Tareas', href: '/assignments', icon: <AssignmentIcon /> },
    { label: 'Foro', href: '/forum', icon: <ForumIcon /> },
    { label: 'Chat', href: '/chat', icon: <ChatIcon unreadCount={0} /> },
    { label: 'Exámenes', href: '/exams', icon: <ClipboardIcon /> },
    { label: 'Libreta', href: '/gradebook', icon: <BookIcon /> },
    { label: 'Estadísticas', href: '/group-stats', icon: <ChartIcon /> },
    { label: 'Configuración', href: '/settings', icon: <CogIcon /> },
  ],
  teacher: [
    { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
    { label: 'Mis Grupos', href: '/groups', icon: <AcademicIcon /> },
    { label: 'Tareas', href: '/assignments', icon: <AssignmentIcon /> },
    { label: 'Foro', href: '/forum', icon: <ForumIcon /> },
    { label: 'Chat', href: '/chat', icon: <ChatIcon unreadCount={0} /> },
    { label: 'Exámenes', href: '/exams', icon: <ClipboardIcon /> },
    { label: 'Libreta', href: '/gradebook', icon: <BookIcon /> },
    { label: 'Estadísticas', href: '/group-stats', icon: <ChartIcon /> },
    { label: 'Configuración', href: '/settings', icon: <CogIcon /> },
  ],
  student: [
    { label: 'Mis Cursos', href: '/my-courses', icon: <BookIcon /> },
    { label: 'Tareas', href: '/assignments', icon: <AssignmentIcon /> },
    { label: 'Foro', href: '/forum', icon: <ForumIcon /> },
    { label: 'Chat', href: '/chat', icon: <ChatIcon unreadCount={0} /> },
    { label: 'Mi Progreso', href: '/my-progress', icon: <ChartIcon /> },
  ],
}

const superAdminOrgMenuItems: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
  { label: 'Profesores/Alumnos', href: '/users', icon: <UsersIcon /> },
  { label: 'Períodos', href: '/periods', icon: <CalendarIcon /> },
  { label: 'Grupos', href: '/groups', icon: <AcademicIcon /> },
  { label: 'Cursos', href: '/courses', icon: <BookIcon /> },
  { label: 'Tareas', href: '/assignments', icon: <AssignmentIcon /> },
  { label: 'Foro', href: '/forum', icon: <ForumIcon /> },
  { label: 'Chat', href: '/chat', icon: <ChatIcon unreadCount={0} /> },
  { label: 'Exámenes', href: '/exams', icon: <ClipboardIcon /> },
  { label: 'Libreta', href: '/gradebook', icon: <BookIcon /> },
  { label: 'Estadísticas', href: '/group-stats', icon: <ChartIcon /> },
]

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m9.99 4h.01m2.01 0h.01M9 9h3m-3 4h3" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function CogIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function AcademicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function AssignmentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ForumIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ChatIcon({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="relative">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  )
}

function GlobalSwitcher({ organizations, selectedOrgId, onSelect, onClear }: {
  organizations: Organization[]
  selectedOrgId: string | null
  onSelect: (orgId: string) => void
  onClear: () => void
}) {
  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedOrgId || ''}
        onChange={(e) => {
          if (e.target.value) {
            onSelect(e.target.value)
          }
        }}
        className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[180px]"
      >
        <option value="">Global (Todas las escuelas)</option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {selectedOrg && (
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-700"
          title="Limpiar selección"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const {
    selectedOrgId,
    setSelectedOrgId,
    organizations,
    selectedOrg,
    isSuperAdmin,
  } = useOrganization()

  useEffect(() => {
    if (!user) return

    const currentUser = user

    async function loadUnreadCount() {
      try {
        const count = await getUnreadMessagesCount(currentUser.id, currentUser.profile?.organization_id || undefined)
        setUnreadCount(count)
      } catch (error) {
        console.error('Error loading unread count:', error)
      }
    }

    loadUnreadCount()

    const channel = subscribeToAllMessages(currentUser.id, (message) => {
      if (message.sender_id !== currentUser.id) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    function handleChatRead(event: Event) {
      const customEvent = event as CustomEvent<{ count: number }>
      setUnreadCount((prev) => Math.max(0, prev - customEvent.detail.count))
    }

    window.addEventListener('chat-read', handleChatRead)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      window.removeEventListener('chat-read', handleChatRead)
    }
  }, [user])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  const role = user?.profile?.role || 'student'
  const menuConfig = isSuperAdmin && selectedOrgId
    ? { ...baseMenuConfig, super_admin: [...baseMenuConfig.super_admin, ...superAdminOrgMenuItems] }
    : baseMenuConfig
  const menuItems = menuConfig[role]

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full">
        <div className="p-4 border-b border-slate-200">
          {selectedOrg?.logo_url ? (
            <div className="flex items-center gap-3">
              <img 
                src={selectedOrg.logo_url} 
                alt={selectedOrg.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <span className="font-semibold text-slate-900 truncate">{selectedOrg.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {(selectedOrg?.name || user?.profile?.organization_id || 'LMS')[0].toUpperCase()}
                </span>
              </div>
              <span className="font-semibold text-slate-900">{selectedOrg?.name || 'LMS'}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.href
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.href === '/chat' ? <ChatIcon unreadCount={unreadCount} /> : item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64">
        {selectedOrg?.banner_url && (
          <div className="h-24 w-full">
            <img 
              src={selectedOrg.banner_url} 
              alt="Banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <header className={`hidden md:flex ${selectedOrg?.banner_url ? 'h-16' : ''} items-center justify-between px-8 bg-white border-b border-slate-200`}>
          <h2 className="text-lg font-medium text-slate-900 capitalize">
            {menuItems.find((item) => location.pathname === item.href)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            {isSuperAdmin && (
              <GlobalSwitcher
                organizations={organizations}
                selectedOrgId={selectedOrgId}
                onSelect={setSelectedOrgId}
                onClear={() => setSelectedOrgId(null)}
              />
            )}
            <span className="text-sm text-slate-600">{user?.profile?.full_name || user?.profile?.email}</span>
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {(user?.profile?.full_name || user?.profile?.email || 'U')[0].toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}