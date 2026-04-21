'use client'

import { useEffect, useState } from 'react'
import { supabase, type GradebookEntry, type Exam } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

interface GradeEntryData {
  id: string
  examId: string | null
  examTitle: string
  grade: number
  createdAt: string
}

interface GroupData {
  id: string
  name: string
}

export function MyProgress() {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null)
  const [grades, setGrades] = useState<GradeEntryData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadUserData()
  }, [])

  useEffect(() => {
    if (selectedGroup && userId) {
      loadGrades(selectedGroup.id, userId)
    }
  }, [selectedGroup, userId])

  async function loadUserData() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    setUserId(supabaseUser.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', supabaseUser.id)
      .single()

    if (profile?.organization_id) {
      loadGroups(profile.organization_id, supabaseUser.id)
    } else {
      setLoading(false)
    }
  }

  async function loadGroups(orgId: string, studentId: string) {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', studentId)

    if (!memberships || memberships.length === 0) {
      setGroups([])
      setLoading(false)
      return
    }

    const groupIds = memberships.map(m => m.group_id)
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setGroups(data as GroupData[])
    }
    setLoading(false)
  }

  async function loadGrades(groupId: string, studentId: string) {
    setLoadingGrades(true)

    const { data: gradeEntries } = await supabase
      .from('gradebook_entries')
      .select('*')
      .eq('group_id', groupId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })

    if (!gradeEntries || gradeEntries.length === 0) {
      setGrades([])
      setLoadingGrades(false)
      return
    }

    const examIds = [...new Set(gradeEntries.map(g => g.exam_id).filter(Boolean))]
    
    const { data: examsData } = await supabase
      .from('exams')
      .select('*')
      .in('id', examIds)

    const gradesWithExams: GradeEntryData[] = gradeEntries.map(g => {
      const exam = examsData?.find(e => e.id === g.exam_id)
      return {
        id: g.id,
        examId: g.exam_id,
        examTitle: exam?.title || 'Tarea',
        grade: g.grade,
        createdAt: g.created_at,
      }
    })

    setGrades(gradesWithExams)
    setLoadingGrades(false)
  }

  const chartData = grades.map(g => ({
    name: g.examTitle.length > 15 ? g.examTitle.substring(0, 15) + '...' : g.examTitle,
    nota: g.grade,
    fecha: new Date(g.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
  }))

  const average = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + g.grade, 0) / grades.length * 100) / 100
    : 0

  const latestGrade = grades.length > 0 ? grades[grades.length - 1].grade : 0
  const bestGrade = grades.length > 0 ? Math.max(...grades.map(g => g.grade)) : 0

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600 bg-green-50'
    if (grade >= 80) return 'text-blue-600 bg-blue-50'
    if (grade >= 70) return 'text-yellow-600 bg-yellow-50'
    if (grade >= 60) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Mi Progreso</h1>
        <p className="text-sm text-slate-500">Revisa tu historial académico</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">Seleccionar Grupo</h2>
            {loading ? (
              <div className="animate-pulse h-10 bg-slate-100 rounded-lg" />
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-500">No estás en ningún grupo</p>
            ) : (
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const group = groups.find(g => g.id === e.target.value)
                  setSelectedGroup(group || null)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                <option value="">Seleccionar grupo...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selectedGroup ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                Selecciona un grupo para ver tu progreso
              </p>
            </div>
          ) : loadingGrades ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <svg className="animate-spin w-6 h-6 mx-auto text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-slate-500 mt-2">Cargando calificaciones...</p>
            </div>
          ) : grades.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                No tienes calificaciones en este grupo
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{latestGrade}%</div>
                  <div className="text-xs text-slate-500">Última Nota</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{average}%</div>
                  <div className="text-xs text-slate-500">Promedio</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{bestGrade}%</div>
                  <div className="text-xs text-slate-500">Mejor Nota</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-medium text-slate-700 mb-4">
                  Evolución de Notas
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="fecha" 
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="nota" 
                        stroke="#7C3AED" 
                        strokeWidth={2}
                        dot={{ fill: '#7C3AED', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="text-sm font-medium text-slate-700">
                    Historial de Calificaciones
                  </h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {[...grades].reverse().slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {entry.examTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-bold ${getGradeColor(entry.grade)}`}>
                        {entry.grade}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}