'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Exam, type Question, type QuestionOption } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface QuestionWithOptions extends Question {
  options: QuestionOption[]
}

interface ExamWithQuestions extends Exam {
  questions: QuestionWithOptions[]
}

export function ExamCreator() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [exams, setExams] = useState<ExamWithQuestions[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedExam, setSelectedExam] = useState<ExamWithQuestions | null>(null)
  const [userOrgId, setUserOrgId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    timeLimit: '',
    revisable: false,
  })
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
  const [currentQuestion, setCurrentQuestion] = useState({
    text: '',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  })

  useEffect(() => {
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadExams(selectedGroup.id)
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
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setGroups(data as Group[])
    }
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

    const examsWithQuestions = await Promise.all(
      (examsData as Exam[]).map(async (exam) => {
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', exam.id)
          .order('order_index')

        const questionsWithOptions = await Promise.all(
          (questionsData || []).map(async (q) => {
            const { data: optionsData } = await supabase
              .from('question_options')
              .select('*')
              .eq('question_id', q.id)
              .order('order_index')
            return { ...q, options: optionsData || [] }
          })
        )

        return { ...exam, questions: questionsWithOptions }
      })
    )

    setExams(examsWithQuestions)
  }

  function handleOptionChange(index: number, value: string) {
    const newOptions = [...currentQuestion.options]
    newOptions[index] = { ...newOptions[index], text: value }
    setCurrentQuestion({ ...currentQuestion, options: newOptions })
  }

  function handleCorrectSelect(index: number) {
    const newOptions = currentQuestion.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index,
    }))
    setCurrentQuestion({ ...currentQuestion, options: newOptions })
  }

  function addQuestion() {
    if (!currentQuestion.text) {
      toast.error('Ingresa el texto de la pregunta')
      return
    }
    const validOptions = currentQuestion.options.filter(o => o.text.trim())
    if (validOptions.length < 2) {
      toast.error('Ingresa al menos 2 opciones')
      return
    }
    if (!validOptions.some(o => o.isCorrect)) {
      toast.error('Selecciona la respuesta correcta')
      return
    }

    const newQuestion: QuestionWithOptions = {
      id: `temp-${questions.length}`,
      exam_id: '',
      text: currentQuestion.text,
      order_index: questions.length,
      created_at: new Date().toISOString(),
      options: validOptions.map((opt, i) => ({
        id: `temp-opt-${questions.length}-${i}`,
        question_id: '',
        text: opt.text,
        is_correct: opt.isCorrect,
        order_index: i,
        created_at: new Date().toISOString(),
      })),
    }

    setQuestions([...questions, newQuestion])
    setCurrentQuestion({
      text: '',
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ],
    })
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !formData.title || !userOrgId) return
    if (questions.length === 0) {
      toast.error('Agrega al menos una pregunta')
      return
    }

    setCreating(true)
    try {
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          title: formData.title,
          description: formData.description || null,
          group_id: selectedGroup.id,
          organization_id: userOrgId,
          time_limit: formData.timeLimit ? parseInt(formData.timeLimit) : null,
          revisable: formData.revisable,
        })
        .select()
        .single()

      if (examError) {
        toast.error('Error al crear examen: ' + examError.message)
        setCreating(false)
        return
      }

      const examId = examData.id
      const questionInserts = questions.map((q, qIndex) => {
        return supabase.from('questions').insert({
          exam_id: examId,
          text: q.text,
          order_index: qIndex,
        }).select().single()
      })

      const createdQuestions = await Promise.all(questionInserts)

      for (let i = 0; i < createdQuestions.length; i++) {
        const q = createdQuestions[i]
        if (q.error || !q.data) continue

        const questionId = q.data.id
        const originalQ = questions[i]

        const optionInserts = originalQ.options.map((opt, oIndex) => {
          return supabase.from('question_options').insert({
            question_id: questionId,
            text: opt.text,
            is_correct: opt.is_correct,
            order_index: oIndex,
          })
        })

        await Promise.all(optionInserts)
      }

      toast.success('Examen creado con éxito')
      setShowModal(false)
      setFormData({ title: '', description: '', timeLimit: '', revisable: false })
      setQuestions([])
      loadExams(selectedGroup.id)
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setCreating(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Creador de Exámenes</h1>
          <p className="text-sm text-slate-500">Crea exámenes con preguntas de opción múltiple</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!selectedGroup}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Examen
        </button>
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
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              Exámenes {selectedGroup ? `- ${selectedGroup.name}` : ''}
            </h2>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecciona un grupo para ver los exámenes
              </p>
            ) : exams.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay exámenes en este grupo
              </p>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    onClick={() => setSelectedExam(exam)}
                    className={`p-4 bg-slate-50 rounded-lg cursor-pointer transition-colors ${
                      selectedExam?.id === exam.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-slate-900">{exam.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {exam.questions.length} pregunta{exam.questions.length !== 1 ? 's' : ''}
                          {exam.time_limit && ` • ${exam.time_limit} min`}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(exam.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {exam.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{exam.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedExam && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
              <h2 className="text-sm font-medium text-slate-700 mb-3">
                Preguntas de {selectedExam.title}
              </h2>
              <div className="space-y-4">
                {selectedExam.questions.map((q, qIndex) => (
                  <div key={q.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">
                      {qIndex + 1}. {q.text}
                    </p>
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`text-xs px-2 py-1 rounded ${
                            opt.is_correct
                              ? 'bg-green-100 text-green-800 font-medium'
                              : 'bg-white text-slate-600'
                          }`}
                        >
                          {opt.text} {opt.is_correct && '✓'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 my-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Crear Examen</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título del Examen</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título del examen"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción (opcional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo límite (minutos)</label>
                <input
                  type="number"
                  value={formData.timeLimit}
                  onChange={(e) => setFormData({ ...formData, timeLimit: e.target.value })}
                  placeholder="Opcional"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.revisable}
                    onChange={(e) => setFormData({ ...formData, revisable: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Permitir revisión después de completar</span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  Los alumnos podrán ver sus respuestas y las correctas
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Agregar Pregunta</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Texto de la pregunta</label>
                    <input
                      type="text"
                      value={currentQuestion.text}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                      placeholder="Enunciado de la pregunta"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {currentQuestion.options.map((opt, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctOption"
                          checked={opt.isCorrect}
                          onChange={() => handleCorrectSelect(index)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Opción ${index + 1}`}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full px-4 py-2 border border-dashed border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                  >
                    + Agregar Pregunta
                  </button>
                </div>
              </div>

              {questions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Preguntas agregadas ({questions.length})</h3>
                  {questions.map((q, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">{index + 1}. {q.text}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {q.options.filter(o => o.is_correct).map(o => o.text).join(' ✓ ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setQuestions([])
                    setFormData({ title: '', description: '', timeLimit: '', revisable: false })
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || questions.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creando...
                    </>
                  ) : (
                    'Crear Examen'
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