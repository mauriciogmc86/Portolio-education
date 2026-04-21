'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Profile, type GradebookEntry, type Exam } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface StudentGrade extends Profile {
  grades: StudentGradeEntry[]
  average: number
}

interface StudentGradeEntry {
  id: string
  exam_id: string | null
  exam_title: string
  grade: number
  weight: number
}

interface GroupWithStats {
  id: string
  name: string
  studentCount: number
}

export function Gradebook() {
  const [groups, setGroups] = useState<GroupWithStats[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupWithStats | null>(null)
  const [students, setStudents] = useState<StudentGrade[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGrades, setLoadingGrades] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentGrade | null>(null)
  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [manualGrade, setManualGrade] = useState('')
  const [gradeWeight, setGradeWeight] = useState('1')
  const [savingGrade, setSavingGrade] = useState(false)

  const [userOrgId, setUserOrgId] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id)
    }
  }, [selectedGroup])

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

  async function loadGroupData(groupId: string) {
    setLoadingGrades(true)

    const { data: members } = await supabase
      .from('group_members')
      .select('profile_id, role')
      .eq('group_id', groupId)

    if (!members || members.length === 0) {
      setStudents([])
      setLoadingGrades(false)
      return
    }

    const studentIds = members
      .filter(m => m.role === 'student')
      .map(m => m.profile_id)

    if (studentIds.length === 0) {
      setStudents([])
      setLoadingGrades(false)
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', studentIds)

    const { data: gradeEntries } = await supabase
      .from('gradebook_entries')
      .select('*')
      .eq('group_id', groupId)
      .in('student_id', studentIds)

    const { data: examsData } = await supabase
      .from('exams')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    setExams(examsData || [])

    const studentsWithGrades = (profiles || []).map(student => {
      const studentGrades: StudentGradeEntry[] = (gradeEntries || [])
        .filter(g => g.student_id === student.id)
        .map(g => {
          const exam = (examsData || []).find(e => e.id === g.exam_id)
          return {
            id: g.id,
            exam_id: g.exam_id,
            exam_title: exam?.title || 'Tarea',
            grade: g.grade,
            weight: g.weight,
          }
        })

      const totalWeight = studentGrades.reduce((sum, g) => sum + g.weight, 0)
      const weightedSum = studentGrades.reduce((sum, g) => sum + (g.grade * g.weight), 0)
      const average = totalWeight > 0 ? weightedSum / totalWeight : 0

      return {
        ...student,
        grades: studentGrades,
        average: Math.round(average * 100) / 100,
      }
    })

    setStudents(studentsWithGrades)
    setLoadingGrades(false)
  }

  async function handleAddGrade(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !selectedStudent || !manualGrade || !userOrgId) return

    setSavingGrade(true)
    try {
      const examId = selectedExamId || null
      let examTitle = 'Tarea'

      if (examId) {
        const exam = exams.find(e => e.id === examId)
        if (exam) examTitle = exam.title
      }

      const { error } = await supabase.from('gradebook_entries').insert({
        student_id: selectedStudent.id,
        group_id: selectedGroup.id,
        exam_id: examId,
        attempt_id: null,
        grade: parseFloat(manualGrade),
        weight: parseFloat(gradeWeight),
      })

      if (error) {
        toast.error('Error al agregar calificación: ' + error.message)
        setSavingGrade(false)
        return
      }

      toast.success('Calificación agregada')
      setShowAddModal(false)
      setSelectedStudent(null)
      setSelectedExamId('')
      setManualGrade('')
      setGradeWeight('1')
      loadGroupData(selectedGroup.id)
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setSavingGrade(false)
  }

  function getGradeColor(grade: number) {
    if (grade >= 90) return 'text-green-600 bg-green-50'
    if (grade >= 80) return 'text-blue-600 bg-blue-50'
    if (grade >= 70) return 'text-yellow-600 bg-yellow-50'
    if (grade >= 60) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  function getAverageColor(average: number) {
    if (average >= 90) return 'text-green-700 bg-green-100'
    if (average >= 80) return 'text-blue-700 bg-blue-100'
    if (average >= 70) return 'text-yellow-700 bg-yellow-100'
    if (average >= 60) return 'text-orange-700 bg-orange-100'
    return 'text-red-700 bg-red-100'
  }

  function exportToCSV() {
    if (!selectedGroup || students.length === 0) return

    const headers = ['Alumno', 'Email', 'Promedio', ...exams.map(e => e.title), 'Última Actualización']
    const rows = students.map(student => {
      const gradesMap: Record<string, number> = {}
      student.grades.forEach(g => {
        if (g.exam_id) {
          gradesMap[g.exam_id] = g.grade
        }
      })
      const examGrades = exams.map(e => gradesMap[e.id] ?? '')
      const lastGrade = student.grades[student.grades.length - 1]
      const lastUpdate = lastGrade ? new Date(lastGrade.id).toLocaleDateString('es-ES') : ''

      return [
        student.full_name || 'Sin nombre',
        student.email,
        student.average.toString(),
        ...examGrades,
        lastUpdate,
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `calificaciones_${selectedGroup.name}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Libreta de Calificaciones</h1>
        <p className="text-sm text-slate-500">Verifica las notas de tus alumnos</p>
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
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">
                Alumnos {selectedGroup ? `- ${selectedGroup.name}` : ''}
              </h2>
              {selectedGroup && students.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a1 1 0 01-1-1V7a1 1 0 011-1h5a1 1 0 001-1V5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 001 1h4a1 1 0 001-1v-9a1 1 0 00-1-1h-4z" />
                  </svg>
                  Exportar CSV
                </button>
              )}
            </div>

            {!selectedGroup ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  Selecciona un grupo para ver las calificaciones
                </p>
              </div>
            ) : loadingGrades ? (
              <div className="p-8 text-center">
                <svg className="animate-spin w-6 h-6 mx-auto text-primary-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-slate-500 mt-2">Cargando calificaciones...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  No hay alumnos en este grupo
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Alumno
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Calificaciones
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                        Promedio
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary-700">
                                {student.full_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {student.full_name || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-slate-500">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {student.grades.length === 0 ? (
                              <span className="text-xs text-slate-400">Sin calificaciones</span>
                            ) : (
                              student.grades.map((grade) => (
                                <span
                                  key={grade.id}
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getGradeColor(grade.grade)}`}
                                  title={grade.exam_title}
                                >
                                  {Math.round(grade.grade)}%
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {student.grades.length > 0 ? (
                            <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-bold ${getAverageColor(student.average)}`}>
                              {student.average}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedStudent(student)
                              setShowAddModal(true)
                            }}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                          >
                            + Agregar Nota
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Agregar Calificación
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Alumno: {selectedStudent?.full_name}
            </p>
            <form onSubmit={handleAddGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Examen/Tarea (opcional)
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  <option value="">Seleccionar examen...</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Calificación (0-100)
                </label>
                <input
                  type="number"
                  value={manualGrade}
                  onChange={(e) => setManualGrade(e.target.value)}
                  placeholder="85"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Peso (ponderación)
                </label>
                <input
                  type="number"
                  value={gradeWeight}
                  onChange={(e) => setGradeWeight(e.target.value)}
                  placeholder="1"
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Peso para el promedio. Default: 1
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedStudent(null)
                    setSelectedExamId('')
                    setManualGrade('')
                    setGradeWeight('1')
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGrade || !manualGrade}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingGrade ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}