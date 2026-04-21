'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Post, type Assignment, type Submission, type GradebookEntry } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [assignments, setAssignments] = useState<(Assignment & { submission?: Submission | null })[]>([])
  const [grades, setGrades] = useState<GradebookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudentData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadPosts(selectedGroup.id)
      loadAssignments(selectedGroup.id)
    }
  }, [selectedGroup])

  async function loadStudentData() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { data: membershipData, error } = await supabase
      .from('group_members')
      .select('*, group:groups(*)')
      .eq('profile_id', supabaseUser.id)
      .eq('role', 'student')

    if (!error && membershipData) {
      const groups = membershipData
        .filter(m => m.group)
        .map(m => m.group)
      setMyGroups(groups as Group[])

      if (groups.length > 0) {
        setSelectedGroup(groups[0] as Group)
      }

      await loadAllGrades(supabaseUser.id)
      await loadAllAssignments(groups.map(g => g.id))
    }
    setLoading(false)
  }

  async function loadAllGrades(studentId: string) {
    const { data } = await supabase
      .from('gradebook_entries')
      .select('*')
      .eq('student_id', studentId)

    if (data) {
      setGrades(data)
    }
  }

  async function loadAllAssignments(groupIds: string[]) {
    if (groupIds.length === 0) return

    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('*')
      .in('group_id', groupIds)
      .order('due_date', { ascending: true })

    if (assignmentsData && user) {
      const assignmentsWithSubmissions = await Promise.all(
        assignmentsData.map(async (assignment) => {
          const { data: submission } = await supabase
            .from('submissions')
            .select('*')
            .eq('assignment_id', assignment.id)
            .eq('student_id', user.id)
            .single()

          return { ...assignment, submission: submission || null }
        })
      )
      setAssignments(assignmentsWithSubmissions)
    }
  }

  async function loadPosts(groupId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data) {
      setPosts(data as Post[])
    }
  }

  async function loadAssignments(groupId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('group_id', groupId)
      .order('due_date', { ascending: true })

    if (!error && data) {
      const now = new Date().toISOString()
      const pending = data.filter(a => !a.due_date || a.due_date > now)
      return pending.length
    }
    return 0
  }

  const pendingAssignments = assignments.filter(a => {
    if (!a.due_date) return false
    return a.due_date > new Date().toISOString() && !a.submission
  })

  const completedAssignments = assignments.filter(a => a.submission)

  const averageGrade = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + g.grade, 0) / grades.length)
    : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-slate-200 rounded mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="col-span-1 space-y-3">
              <div className="h-32 bg-slate-200 rounded-xl" />
            </div>
            <div className="col-span-3 space-y-3">
              <div className="h-24 bg-slate-200 rounded-xl" />
              <div className="h-24 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (myGroups.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Mis Cursos</h1>
          <p className="text-sm text-slate-500">Visualiza tus cursos y materiales</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-slate-900 mb-2">No tienes cursos asignados</h2>
          <p className="text-sm text-slate-500">
            Contacta a tu profesor o administrador para que te asigne a un grupo
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Mi Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen de tu progreso académico</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{myGroups.length}</p>
              <p className="text-xs text-slate-500">Cursos activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pendingAssignments.length}</p>
              <p className="text-xs text-slate-500">Tareas pendientes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{completedAssignments.length}</p>
              <p className="text-xs text-slate-500">Tareas entregadas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{averageGrade}%</p>
              <p className="text-xs text-slate-500">Promedio</p>
            </div>
          </div>
        </div>
      </div>

      {pendingAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Tareas Pendientes</h2>
          <div className="space-y-2">
            {pendingAssignments.slice(0, 5).map((assignment) => (
              <div
                key={assignment.id}
                onClick={() => navigate(`/assignments/${assignment.id}`)}
                className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{assignment.title}</p>
                  {assignment.due_date && (
                    <p className="text-xs text-slate-500">
                      Vence: {new Date(assignment.due_date).toLocaleDateString('es-ES')}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
          {pendingAssignments.length > 5 && (
            <button
              onClick={() => navigate('/assignments')}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700"
            >
              Ver todas las tareas ({pendingAssignments.length})
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-2">
            <h2 className="text-sm font-medium text-slate-700 px-3 py-2">Mis Cursos</h2>
            <div className="space-y-1">
              {myGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors ${
                    selectedGroup?.id === group.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              Materiales {selectedGroup ? `- ${selectedGroup.name}` : ''}
            </h2>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecciona un curso para ver los materiales
              </p>
            ) : posts.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">
                  No hay materiales disponibles en este curso
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Pregunta a tu profesor cuando incluirá materiales
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-900">{post.title}</h3>
                      {post.content && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{post.content}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(post.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {post.file_url ? (
                      <a
                        href={post.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={post.file_name || undefined}
                        className="ml-4 flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Descargar
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 ml-4">Sin archivo</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}