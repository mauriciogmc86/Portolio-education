'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Group, type Exam, type Question, type QuestionOption, type ExamAttempt, type GradebookEntry } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface QuestionWithOptions extends Question {
  options: QuestionOption[]
}

interface ExamWithQuestions extends Exam {
  questions: QuestionWithOptions[]
}

interface Answer {
  questionId: string
  selectedOptionId: string | null
}

export function TakeExam() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [exams, setExams] = useState<ExamWithQuestions[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [activeExam, setActiveExam] = useState<ExamWithQuestions | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadExams(selectedGroup.id)
    }
  }, [selectedGroup])

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && activeExam && !examCompleted) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && activeExam && !examCompleted) {
      handleSubmitExam()
    }
  }, [timeLeft, activeExam, examCompleted])

  async function loadUserData() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    setUserId(supabaseUser.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', supabaseUser.id)
      .single()

    if (profile) {
      setUserRole(profile.role)
      if (profile.role === 'student') {
        loadStudentGroups(profile.organization_id, supabaseUser.id)
      } else {
        if (profile.organization_id) {
          loadTeacherGroups(profile.organization_id)
        }
      }
    }
  }

  async function loadTeacherGroups(orgId: string) {
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

  async function loadStudentGroups(orgId: string, studentId: string) {
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

  async function checkExistingAttempt(examId: string, studentId: string): Promise<boolean> {
    const { data } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .single()

    return !!data
  }

  async function startExam(exam: ExamWithQuestions) {
    if (!userId) return

    const hasAttempt = await checkExistingAttempt(exam.id, userId)
    if (hasAttempt) {
      toast.error('Ya has completado este examen')
      return
    }

    setActiveExam(exam)
    setAnswers(exam.questions.map(q => ({ questionId: q.id, selectedOptionId: null })))
    setCurrentQuestionIndex(0)
    setExamCompleted(false)
    setScore(null)
    setAttempt(null)
    setStartTime(new Date())

    if (exam.time_limit) {
      setTimeLeft(exam.time_limit * 60)
    } else {
      setTimeLeft(null)
    }

    const { data: attemptData } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        student_id: userId,
        score: null,
        max_score: exam.questions.length,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      .select()
      .single()

    if (attemptData) {
      setAttempt(attemptData)
    }
  }

  function selectAnswer(optionId: string) {
    setAnswers(prev =>
      prev.map(a =>
        a.questionId === activeExam?.questions[currentQuestionIndex].id
          ? { ...a, selectedOptionId: optionId }
          : a
      )
    )
  }

  function goToQuestion(index: number) {
    setCurrentQuestionIndex(index)
  }

  async function handleSubmitExam() {
    if (!activeExam || !userId || !attempt) return

    setSubmitting(true)
    try {
      let correctCount = 0

      for (const question of activeExam.questions) {
        const answer = answers.find(a => a.questionId === question.id)
        if (!answer?.selectedOptionId) continue

        const selectedOption = question.options.find(o => o.id === answer.selectedOptionId)
        if (selectedOption?.is_correct) {
          correctCount++
        }
      }

      const finalScore = correctCount
      const maxScore = activeExam.questions.length

      const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({
          score: finalScore,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attempt.id)

      if (updateError) {
        toast.error('Error al guardar resultado')
        setSubmitting(false)
        return
      }

      await supabase.from('gradebook_entries').insert({
        student_id: userId,
        group_id: activeExam.group_id,
        exam_id: activeExam.id,
        attempt_id: attempt.id,
        grade: (finalScore / maxScore) * 100,
        weight: 1,
      })

      setScore(finalScore)
      setExamCompleted(true)
      setTimeLeft(null)
      toast.success(`Examen completado: ${finalScore}/${maxScore}`)
    } catch (error) {
      toast.error('Error al procesar el examen')
    }
    setSubmitting(false)
  }

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  if (activeExam && !examCompleted) {
    const question = activeExam.questions[currentQuestionIndex]
    const currentAnswer = answers.find(a => a.questionId === question.id)

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-slate-900">{activeExam.title}</h1>
            {timeLeft !== null && (
              <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                timeLeft < 60 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
              }`}>
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {activeExam.questions.map((q, idx) => {
              const ans = answers.find(a => a.questionId === q.id)
              const isAnswered = !!ans?.selectedOptionId
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(idx)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                    idx === currentQuestionIndex
                      ? 'bg-primary-600 text-white'
                      : isAnswered
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-6">
            <span className="text-sm text-slate-500">
              Pregunta {currentQuestionIndex + 1} de {activeExam.questions.length}
            </span>
            <h2 className="text-lg font-medium text-slate-900 mt-1">{question.text}</h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => selectAnswer(option.id)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  currentAnswer?.selectedOptionId === option.id
                    ? 'border-primary-500 bg-primary-50 text-primary-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => goToQuestion(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            {currentQuestionIndex < activeExam.questions.length - 1 ? (
              <button
                onClick={() => goToQuestion(currentQuestionIndex + 1)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Finalizar Examen'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (examCompleted && score !== null) {
    const percentage = Math.round((score / (activeExam?.questions.length || 1)) * 100)
    const isPassing = percentage >= 60
    const showFeedback = activeExam?.revisable

    if (showFeedback && showResults) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-slate-900">Resultados: {activeExam?.title}</h1>
              <button
                onClick={() => setShowResults(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Volver al resumen
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {activeExam?.questions.map((question, qIndex) => {
              const answer = answers.find(a => a.questionId === question.id)
              const selectedOption = answer?.selectedOptionId ? question.options.find(o => o.id === answer.selectedOptionId) : null
              const correctOption = question.options.find(o => o.is_correct)
              const isCorrect = selectedOption?.is_correct

              return (
                <div
                  key={question.id}
                  className={`bg-white rounded-xl border p-4 ${
                    isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {isCorrect ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        {qIndex + 1}. {question.text}
                      </p>
                      <div className="space-y-1">
                        {question.options.map((option) => {
                          const isSelected = option.id === answer?.selectedOptionId
                          const isCorrectOption = option.is_correct
                          
                          let bgClass = 'bg-white'
                          if (isSelected && isCorrectOption) {
                            bgClass = 'bg-green-100 border-green-500'
                          } else if (isSelected && !isCorrectOption) {
                            bgClass = 'bg-red-100 border-red-500'
                          } else if (isCorrectOption) {
                            bgClass = 'bg-green-100 border-green-500'
                          }

                          return (
                            <div
                              key={option.id}
                              className={`text-xs px-2 py-1.5 rounded border ${bgClass}`}
                            >
                              {option.text}
                              {isCorrectOption && <span className="ml-1 font-medium text-green-700">(Correcta)</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              setShowResults(false)
            }}
            className="mt-4 w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Volver al resumen
          </button>
        </div>
      )
    }

    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isPassing ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isPassing ? (
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">¡Examen Completado!</h1>
          <p className="text-slate-600 mb-4">{activeExam?.title}</p>
          <div className="text-4xl font-bold text-primary-600 mb-2">
            {score}/{activeExam?.questions.length}
          </div>
          <p className="text-sm text-slate-500 mb-6">
            {percentage}% de aciertos
          </p>

          <div className="space-y-3">
            {showFeedback && (
              <button
                onClick={() => setShowResults(true)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Ver Revisión
              </button>
            )}
            <button
              onClick={() => {
                setActiveExam(null)
                setExamCompleted(false)
                setScore(null)
                setShowResults(false)
              }}
              className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Volver a Exámenes
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Exámenes</h1>
        <p className="text-sm text-slate-500">Responde los exámenes asignados a tus grupos</p>
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
              Exámenes Disponibles {selectedGroup ? `- ${selectedGroup.name}` : ''}
            </h2>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecciona un grupo para ver los exámenes
              </p>
            ) : exams.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay exámenes disponibles en este grupo
              </p>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-slate-900">{exam.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {exam.questions.length} pregunta{exam.questions.length !== 1 ? 's' : ''}
                          {exam.time_limit && ` • ${exam.time_limit} min`}
                        </p>
                        {exam.description && (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{exam.description}</p>
                        )}
                      </div>
                      {userRole === 'student' && (
                        <button
                          onClick={() => startExam(exam)}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors font-medium"
                        >
                          Iniciar
                        </button>
                      )}
                    </div>
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