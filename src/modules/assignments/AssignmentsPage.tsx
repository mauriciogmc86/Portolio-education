'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, type Assignment, type Submission, type Group } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import {
  getAssignmentsByGroup,
  getMyAssignments,
  getSubmission,
  getSubmissionsByAssignment,
  createSubmission,
  updateSubmission,
  gradeSubmission,
  uploadFile,
} from '@/services/assignmentsService'

export function AssignmentsPage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    due_date: '',
    max_grade: 100,
    allow_late_submission: false,
  })

  const isTeacher = user?.profile?.role === 'teacher' || user?.profile?.role === 'admin' || user?.profile?.role === 'super_admin'
  const isStudent = user?.profile?.role === 'student'

  useEffect(() => {
    loadData()
    if (isTeacher) {
      loadGroups()
    }
  }, [user, assignmentId])

  async function loadGroups() {
    if (!user?.profile?.organization_id) return

    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', user.profile.organization_id)

    if (data) {
      setGroups(data)
      if (data.length > 0) {
        setSelectedGroupId(data[0].id)
      }
    }
  }

  async function handleCreateAssignment() {
    if (!newAssignment.title || !selectedGroupId || !user) {
      toast.error('El título y el grupo son requeridos')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('assignments').insert({
        title: newAssignment.title,
        description: newAssignment.description || null,
        group_id: selectedGroupId,
        organization_id: user.profile?.organization_id,
        due_date: newAssignment.due_date || null,
        max_grade: newAssignment.max_grade,
        allow_late_submission: newAssignment.allow_late_submission,
      })

      if (error) {
        toast.error('Error al crear tarea: ' + error.message)
      } else {
        toast.success('Tarea creada correctamente')
        setShowCreateModal(false)
        setNewAssignment({
          title: '',
          description: '',
          due_date: '',
          max_grade: 100,
          allow_late_submission: false,
        })
        loadData()
      }
    } catch (error) {
      toast.error('Error al crear la tarea')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadData() {
    if (!user) return

    setLoading(true)
    try {
      if (assignmentId) {
        const [assignmentData, submissionsData] = await Promise.all([
          supabase.from('assignments').select('*').eq('id', assignmentId).single(),
          isTeacher
            ? getSubmissionsByAssignment(assignmentId)
            : Promise.resolve([]),
        ])

        if (assignmentData.data) {
          setSelectedAssignment(assignmentData.data as Assignment)
        }

        if (isTeacher) {
          setSubmissions(submissionsData)
        } else if (isStudent) {
          const sub = await getSubmission(assignmentId, user.id)
          setSubmission(sub)
        }
      } else {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('group_id')
          .eq('student_id', user.id)

        if (enrollments && enrollments.length > 0 && isStudent) {
          const groupIds = enrollments.map(e => e.group_id)
          const { data } = await supabase
            .from('assignments')
            .select('*')
            .in('group_id', groupIds)
            .order('due_date', { ascending: true })

          setAssignments(data || [])
        } else if (isTeacher) {
          const { data } = await supabase
            .from('assignments')
            .select('*')
            .eq('organization_id', user.profile?.organization_id)
            .order('due_date', { ascending: true })

          setAssignments(data || [])
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      toast.error('Error al cargar las tareas')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!selectedAssignment || !user || submitting) return

    setSubmitting(true)
    try {
      let fileUrl = null
      let fileName = null

      if (file) {
        fileUrl = await uploadFile(file, selectedAssignment.id, user.id)
        fileName = file.name
      }

      if (submission) {
        await updateSubmission(submission.id, content || null, fileUrl, fileName)
        toast.success('Entrega actualizada')
      } else {
        await createSubmission(selectedAssignment.id, user.id, content || null, fileUrl, fileName)
        toast.success('Tarea entregada')
      }

      await loadData()
    } catch (error) {
      console.error('Error submitting:', error)
      toast.error('Error al entregar la tarea')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGrade(submissionId: string, grade: number, feedback: string) {
    try {
      await gradeSubmission(submissionId, grade, feedback)
      toast.success('Calificación guardada')
      await loadData()
    } catch (error) {
      console.error('Error grading:', error)
      toast.error('Error al calificar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (assignmentId && selectedAssignment) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/assignments')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Tareas
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {selectedAssignment.title}
          </h2>
          {selectedAssignment.description && (
            <p className="text-slate-600 mb-4">{selectedAssignment.description}</p>
          )}
          {selectedAssignment.due_date && (
            <p className="text-sm text-slate-500">
              Fecha límite: {new Date(selectedAssignment.due_date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {isStudent && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Mi Entrega</h3>
            {submission ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-slate-700">{submission.content || 'Sin contenido'}</p>
                  {submission.file_url && (
                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline text-sm"
                    >
                      Ver archivo adjunto
                    </a>
                  )}
                </div>
                {submission.grade !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Calificación:</span>
                    <span className="font-medium text-slate-900">
                      {submission.grade}/{selectedAssignment.max_grade || 100}
                    </span>
                  </div>
                )}
                {submission.feedback && (
                  <div className="p-4 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-800">{submission.feedback}</p>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Entregado el: {new Date(submission.submitted_at || '').toLocaleString('es-ES')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <div>
                  <label className="block text-sm text-slate-600 mb-2">
                    Archivo adjunto (opcional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? 'Entregando...' : 'Entregar Tarea'}
                </button>
              </div>
            )}
          </div>
        )}

        {isTeacher && submissions.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Entregas ({submissions.length})</h3>
            <div className="space-y-4">
              {submissions.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  submission={sub}
                  maxGrade={selectedAssignment.max_grade || 100}
                  onGrade={handleGrade}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tareas</h1>
          <p className="text-sm text-slate-500">
            {isTeacher ? 'Gestiona las tareas de tus cursos' : 'Entrega tus tareas'}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Tarea
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Mis Tareas</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No hay tareas disponibles
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                onClick={() => navigate(`/assignments/${assignment.id}`)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <h3 className="font-medium text-slate-900 mb-1">
                  {assignment.title}
                </h3>
                {assignment.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {assignment.description}
                  </p>
                )}
                {assignment.due_date && (
                  <p className="text-sm text-slate-500 mt-2">
                    Fecha límite: {new Date(assignment.due_date).toLocaleDateString('es-ES')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 my-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Crear Nueva Tarea</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  placeholder="Título de la tarea"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  placeholder="Descripción de la tarea (opcional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grupo *</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                >
                  <option value="">Seleccionar grupo...</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
                <input
                  type="datetime-local"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Calificación máxima</label>
                  <input
                    type="number"
                    value={newAssignment.max_grade}
                    onChange={(e) => setNewAssignment({ ...newAssignment, max_grade: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  />
                </div>
                <div className="flex items-center h-full pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAssignment.allow_late_submission}
                      onChange={(e) => setNewAssignment({ ...newAssignment, allow_late_submission: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Permitir entrega tardía</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateAssignment}
                  disabled={submitting || !newAssignment.title || !selectedGroupId}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Tarea'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  maxGrade,
  onGrade,
}: {
  submission: Submission
  maxGrade: number
  onGrade: (id: string, grade: number, feedback: string) => void
}) {
  const [grade, setGrade] = useState(submission.grade?.toString() || '')
  const [feedback, setFeedback] = useState(submission.feedback || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onGrade(submission.id, parseInt(grade) || 0, feedback)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-lg space-y-3">
      <div>
        <p className="text-sm text-slate-600">{submission.content || 'Sin contenido'}</p>
        {submission.file_url && (
          <a
            href={submission.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline text-sm block mt-1"
          >
            Ver archivo: {submission.file_name}
          </a>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Entregado: {new Date(submission.submitted_at || '').toLocaleString('es-ES')}
        </p>
      </div>
      <div className="flex gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Calificación</label>
          <input
            type="number"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder={`0-${maxGrade}`}
            className="w-20 px-3 py-1 border border-slate-300 rounded-md text-sm"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
        />
      </div>
    </div>
  )
}