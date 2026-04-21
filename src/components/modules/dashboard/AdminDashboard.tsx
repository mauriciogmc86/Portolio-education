'use client'

import { useEffect, useState } from 'react'
import { supabase, type Profile } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface Stats {
  studentsCount: number
  groupsCount: number
  examsCount: number
  organizationsCount?: number
  loading: boolean
}

export function AdminDashboard() {
  const { user } = useAuth()
  const userProfile = user?.profile as Profile | null
  const isSuperAdmin = userProfile?.role === 'super_admin'

  const [stats, setStats] = useState<Stats>({
    studentsCount: 0,
    groupsCount: 0,
    examsCount: 0,
    organizationsCount: 0,
    loading: true,
  })

  useEffect(() => {
    async function fetchStats() {
      setStats(prev => ({ ...prev, loading: true }))

      if (isSuperAdmin) {
        // Global metrics across all organizations
        const [studentsRes, orgsRes, examsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('organizations').select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
        ])

        setStats({
          studentsCount: studentsRes.count || 0,
          groupsCount: 0, // Not directly aggregated; maybe sum groups across orgs?
          examsCount: examsRes.count || 0,
          organizationsCount: orgsRes.count || 0,
          loading: false,
        })
      } else if (userProfile?.organization_id) {
        // Organization-specific metrics
        const orgId = userProfile.organization_id
        const [studentsRes, groupsRes, examsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('organization_id', orgId),
          supabase.from('groups').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
          supabase.from('exams').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        ])

        setStats({
          studentsCount: studentsRes.count || 0,
          groupsCount: groupsRes.count || 0,
          examsCount: examsRes.count || 0,
          loading: false,
        })
      } else {
        setStats({
          studentsCount: 0,
          groupsCount: 0,
          examsCount: 0,
          loading: false,
        })
      }
    }

    fetchStats()
  }, [isSuperAdmin, userProfile?.organization_id])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        {isSuperAdmin ? 'Dashboard Global' : 'Dashboard'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              {isSuperAdmin ? 'Total de Alumnos (Plataforma)' : 'Total de Alumnos'}
            </p>
          </div>
          {stats.loading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.studentsCount}</p>
          )}
        </div>

        {isSuperAdmin ? (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Escuelas Activas</p>
            </div>
            {stats.loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-2" />
            ) : (
              <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.organizationsCount}</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Total de Grupos</p>
            </div>
            {stats.loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-2" />
            ) : (
              <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.groupsCount}</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m9.99 4h.01m2.01 0h.01M9 9h3m-3 4h3" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              {isSuperAdmin ? 'Exámenes Totales' : 'Exámenes Creados'}
            </p>
          </div>
          {stats.loading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.examsCount}</p>
          )}
        </div>
      </div>
    </div>
  )
}