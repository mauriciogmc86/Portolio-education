'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Exam, type GradebookEntry, type Profile } from '@/lib/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface GroupStatsData {
  id: string
  name: string
  studentCount: number
}

interface ExamStats {
  id: string
  title: string
  average: number
  passCount: number
  failCount: number
  totalStudents: number
}

interface StudentData {
  id: string
  full_name: string | null
  email: string
}

const COLORS = ['#10B981', '#EF4444']

export function GroupStats() {
  const [groups, setGroups] = useState<GroupStatsData[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupStatsData | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [examStats, setExamStats] = useState<ExamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [userOrgId, setUserOrgId] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadExams(selectedGroup.id)
    }
  }, [selectedGroup])

  useEffect(() => {
    if (selectedGroup && selectedExam) {
      loadExamStats(selectedGroup.id, selectedExam.id)
    }
  }, [selectedGroup, selectedExam])

  async function loadOrganizationData() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', supabaseUser.id)
      .single()

    if (profile?.organization_id) {
      setUserOrgId(profile.organization_id)
      loadGroups(profile.organization_id)
    } else {
      setLoading(false)
    }
  }

  async function loadGroups(orgId: string) {
    const { data: groupsData, error } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error || !groupsData) {
      setGroups([])
      setLoading(false)
      return
    }

    const groupsWithStats = await Promise.all(
      (groupsData as Group[]).map(async (group) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('role', 'student')

        return {
          id: group.id,
          name: group.name,
          studentCount: count || 0,
        }
      })
    )

    setGroups(groupsWithStats)
    setLoading(false)
  }

  async function loadExams(groupId: string) {
    const { data: examsData, error } = await supabase
      .from('exams')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error || !examsData) {
      setExams([])
      return
    }

    setExams(examsData as Exam[])
  }

  async function loadExamStats(groupId: string, examId: string) {
    setLoadingStats(true)

    const { data: members } = await supabase
      .from('group_members')
      .select('profile_id, role')
      .eq('group_id', groupId)
      .eq('role', 'student')

    if (!members || members.length === 0) {
      setExamStats({
        id: examId,
        title: '',
        average: 0,
        passCount: 0,
        failCount: 0,
        totalStudents: 0,
      })
      setLoadingStats(false)
      return
    }

    const studentIds = members.map(m => m.profile_id)

    const { data: gradeEntries } = await supabase
      .from('gradebook_entries')
      .select('*')
      .eq('group_id', groupId)
      .eq('exam_id', examId)
      .in('student_id', studentIds)

    const exam = exams.find(e => e.id === examId)

    const entriesWithGrades = (gradeEntries || []).filter(g => g.grade !== null)
    const totalStudents = entriesWithGrades.length
    
    if (totalStudents === 0) {
      setExamStats({
        id: examId,
        title: exam?.title || '',
        average: 0,
        passCount: 0,
        failCount: 0,
        totalStudents: 0,
      })
      setLoadingStats(false)
      return
    }

    const totalGrade = entriesWithGrades.reduce((sum, g) => sum + g.grade, 0)
    const average = totalGrade / totalStudents
    const passCount = entriesWithGrades.filter(g => g.grade >= 60).length
    const failCount = totalStudents - passCount

    setExamStats({
      id: examId,
      title: exam?.title || '',
      average: Math.round(average * 100) / 100,
      passCount,
      failCount,
      totalStudents,
    })
    setLoadingStats(false)
  }

  const pieData = examStats ? [
    { name: 'Aprobados', value: examStats.passCount },
    { name: 'Reprobados', value: examStats.failCount },
  ] : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas del Grupo</h1>
        <p className="text-sm text-slate-500">Analiza el rendimiento de tus alumnos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">Seleccionar Grupo</h2>
            {loading ? (
              <div className="animate-pulse h-10 bg-slate-100 rounded-lg" />
            ) : (
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const group = groups.find(g => g.id === e.target.value)
                  setSelectedGroup(group || null)
                  setSelectedExam(null)
                  setExamStats(null)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                <option value="">Seleccionar grupo...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.studentCount} alum.)
                  </option>
                ))}
              </select>
            )}

            <div className="mt-4">
              <h2 className="text-sm font-medium text-slate-700 mb-3">Seleccionar Examen</h2>
              {!selectedGroup ? (
                <p className="text-xs text-slate-500">Selecciona un grupo primero</p>
              ) : exams.length === 0 ? (
                <p className="text-xs text-slate-500">No hay exámenes en este grupo</p>
              ) : (
                <select
                  value={selectedExam?.id || ''}
                  onChange={(e) => {
                    const exam = exams.find(ex => ex.id === e.target.value)
                    setSelectedExam(exam || null)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  <option value="">Seleccionar examen...</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selectedGroup ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                Selecciona un grupo para ver las estadísticas
              </p>
            </div>
          ) : !selectedExam ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                Selecciona un examen para ver las estadísticas
              </p>
            </div>
          ) : loadingStats ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <svg className="animate-spin w-6 h-6 mx-auto text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-slate-500 mt-2">Cargando estadísticas...</p>
            </div>
          ) : !examStats || examStats.totalStudents === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                No hay calificaciones para este examen aún
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-medium text-slate-700 mb-4">
                  Distribución de Notas - {selectedExam.title}
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{examStats.passCount}</div>
                    <div className="text-xs text-green-700">Aprobados</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{examStats.failCount}</div>
                    <div className="text-xs text-red-700">Reprobados</div>
                  </div>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-medium text-slate-700 mb-4">
                  Promedio General del Grupo
                </h2>
                
                <div className="text-center p-6">
                  <div className="text-5xl font-bold text-primary-600 mb-2">
                    {examStats.average}%
                  </div>
                  <div className="text-sm text-slate-500">
                    Promedio en {selectedExam.title}
                  </div>
                </div>

                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { nombre: 'Promedio', promedio: examStats.average }
                      ]}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="nombre" width={60} />
                      <Tooltip />
                      <Bar dataKey="promedio" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}