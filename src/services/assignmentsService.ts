'use client'

import { supabase, type Assignment, type Submission } from '@/lib/supabase'

export async function getAssignmentsByGroup(groupId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('group_id', groupId)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data as Assignment[]
}

export async function getMyAssignments(studentId: string, organizationId: string): Promise<Assignment[]> {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('organization_id', organizationId)

  if (!enrollments || enrollments.length === 0) return []

  const groupIds = enrollments.map(e => e.group_id)

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .in('group_id', groupIds)
    .eq('organization_id', organizationId)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data as Assignment[]
}

export async function getSubmission(assignmentId: string, studentId: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Submission | null
}

export async function getSubmissionsByAssignment(assignmentId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Submission[]
}

export async function createSubmission(
  assignmentId: string,
  studentId: string,
  content: string | null,
  fileUrl: string | null,
  fileName: string | null
): Promise<Submission> {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      content,
      file_url: fileUrl,
      file_name: fileName,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as Submission
}

export async function updateSubmission(
  submissionId: string,
  content: string | null,
  fileUrl: string | null,
  fileName: string | null
): Promise<Submission> {
  const { data, error } = await supabase
    .from('submissions')
    .update({
      content,
      file_url: fileUrl,
      file_name: fileName,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single()

  if (error) throw error
  return data as Submission
}

export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback: string | null
): Promise<Submission> {
  const { data, error } = await supabase
    .from('submissions')
    .update({
      grade,
      feedback,
    })
    .eq('id', submissionId)
    .select()
    .single()

  if (error) throw error
  return data as Submission
}

export async function uploadFile(file: File, assignmentId: string, studentId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${assignmentId}/${studentId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage.from('submissions').upload(fileName, file)

  if (error) throw error

  const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(fileName)

  return urlData.publicUrl
}