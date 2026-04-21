'use client'

import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { OrganizationProvider } from '@/hooks/useOrganization'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    const userRole = user.profile?.role
    if (allowedRoles.length > 0 && (!userRole || !allowedRoles.includes(userRole))) {
      switch (userRole) {
        case 'student':
          navigate('/my-courses', { replace: true })
          break
        case 'teacher':
          navigate('/groups', { replace: true })
          break
        case 'admin':
          navigate('/dashboard', { replace: true })
          break
        default:
          navigate('/my-courses', { replace: true })
      }
    }
  }, [user, loading, navigate, allowedRoles, location.pathname])

  if (loading) {
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
    return null
  }

  const userRole = user.profile?.role
  const isAuthorized = allowedRoles.length === 0 || (userRole && allowedRoles.includes(userRole))

  if (!isAuthorized) {
    return null
  }

  const isSuperAdmin = user.profile?.role === 'super_admin'

  return (
    <OrganizationProvider isSuperAdmin={isSuperAdmin}>
      <DashboardLayout>{children}</DashboardLayout>
    </OrganizationProvider>
  )
}
