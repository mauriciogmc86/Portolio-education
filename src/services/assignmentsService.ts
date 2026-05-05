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

export async function updateAssignment(
   assignmentId: string,
   payload: {
     title?: string
     description?: string | null
     group_id?: string
     program_id?: string | null
     due_date?: string | null
     max_grade?: number | null
     allow_late_submission?: boolean
   }
): Promise<Assignment> {
   const { data, error } = await supabase
     .from('assignments')
     .update({
       title: payload.title,
       description: payload.description,
       group_id: payload.group_id,
       program_id: payload.program_id,
       due_date: payload.due_date,
       max_grade: payload.max_grade,
       allow_late_submission: payload.allow_late_submission,
       updated_at: new Date().toISOString(),
     })
     .eq('id', assignmentId)
     .select()
     .single()

   if (error) throw error
   return data as Assignment
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
   const { error } = await supabase
     .from('assignments')
     .delete()
     .eq('id', assignmentId)

   if (error) throw error
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

export async function uploadAssignmentFile(file: File, assignmentId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${assignmentId}/${Date.now()}-${file.name}`

  // Use existing bucket for post files
  const { data, error } = await supabase.storage.from('post-files').upload(fileName, file)

  if (error) throw error

  const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(fileName)

  return urlData.publicUrl
}

export async function createAssignment(
   payload: {
     title: string
     description?: string | null
     group_id: string
     program_id?: string | null
     organization_id?: string | null
     due_date?: string | null
     max_grade?: number | null
     allow_late_submission?: boolean
   },
   file?: File | null,
   uploaderId?: string | null
): Promise<Assignment> {
const { data, error } = await supabase
      .from('assignments')
      .insert({
        title: payload.title,
        description: payload.description || null,
        group_id: payload.group_id,
        program_id: payload.program_id || null,
        organization_id: payload.organization_id || null,
        due_date: payload.due_date || null,
        max_grade: payload.max_grade || 100,
        allow_late_submission: payload.allow_late_submission ?? false,
        created_by: uploaderId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

   if (error) {
     console.error('Assignment insert error:', {
       message: error.message,
       details: error.details,
       hint: error.hint,
       code: error.code,
       payload: payload
     })
     throw error
   }

   const assignment = data as Assignment

if (file) {
     const fileUrl = await uploadAssignmentFile(file, assignment.id)
     const timestamp = new Date().toISOString()
     
     // Determine file type from extension
     const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown'
     const fileTypeMap: Record<string, string> = {
       'pdf': 'pdf',
       'doc': 'document',
       'docx': 'document',
       'xls': 'spreadsheet',
       'xlsx': 'spreadsheet',
       'ppt': 'presentation',
       'pptx': 'presentation',
       'png': 'image',
       'jpg': 'image',
       'jpeg': 'image',
       'gif': 'image',
       'mp4': 'video',
       'mov': 'video',
       'mp3': 'audio',
       'wav': 'audio',
       'zip': 'archive',
     }
     const fileType = fileTypeMap[fileExt] || 'document'

     // Insert metadata into content_files and link to assignment
     const { error: cfError } = await supabase.from('content_files').insert({
       organization_id: payload.organization_id,
       category_id: null,
       uploaded_by: uploaderId,
       title: payload.title,
       description: payload.description || null,
       file_name: file.name,
       file_url: fileUrl,
       file_type: fileType,
       file_size: null,
       mime_type: file.type || null,
       thumbnail_url: null,
       duration_secs: null,
       downloads_count: 0,
       is_public: true,
       tags: null,
       created_at: timestamp,
       updated_at: timestamp,
       assignment_id: assignment.id,
     })

    if (cfError) {
       console.error('Content file insert error:', {
         message: cfError.message,
         details: cfError.details,
         hint: cfError.hint,
         code: cfError.code,
       })
       throw cfError
     }

    // Return the created assignment (no need to update assignments row)
    return assignment
  }

  return assignment
}