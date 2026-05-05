import { supabase, type Program } from '@/lib/supabase'

export async function getProgramsByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error loading programs:', error)
    throw error
  }
  return data as Program[]
}

export async function createProgram(program: {
  name: string
  code?: string | null
  description?: string | null
  organization_id: string
  duration_months?: number | null
  cover_url?: string | null
  is_active?: boolean
  teacher_ids?: string[]
  student_ids?: string[]
}) {
  // Usar RPC para crear programa y relaciones atómicamente
  const rpcRes = await supabase.rpc('create_program_with_relations', {
    p_name: program.name,
    p_code: program.code || null,
    p_description: program.description || null,
    p_organization_id: program.organization_id,
    p_duration_months: program.duration_months || null,
    p_cover_url: program.cover_url || null,
    p_is_active: program.is_active ?? true,
    p_teacher_ids: program.teacher_ids || null,
    p_student_ids: program.student_ids || null,
  })

  if (rpcRes.error) {
    console.error('RPC create_program_with_relations error:', rpcRes.error)
    throw rpcRes.error
  }

  // rpc returns array of programs rows; take first
  const created = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data
  return created as Program
}

export async function updateProgram(programId: string, updates: {
  name?: string
  code?: string | null
  description?: string | null
  duration_months?: number | null
  cover_url?: string | null
  is_active?: boolean
  teacher_ids?: string[]
  student_ids?: string[]
}) {
  // Llamar RPC para actualizar atómicamente
  const rpcRes = await supabase.rpc('update_program_with_relations', {
    p_program_id: programId,
    p_name: updates.name || null,
    p_code: updates.code || null,
    p_description: updates.description || null,
    p_duration_months: updates.duration_months || null,
    p_cover_url: (updates as any).cover_url || null,
    p_is_active: updates.is_active ?? null,
    p_teacher_ids: updates.teacher_ids || null,
    p_student_ids: updates.student_ids || null,
  })

  if (rpcRes.error) {
    console.error('RPC update_program_with_relations error:', rpcRes.error)
    throw rpcRes.error
  }

  const updated = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data
  return updated as Program
}

export async function deleteProgram(programId: string) {
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId)

  if (error) {
    console.error('Error deleting program:', error)
    throw error
  }
}

export async function getProgramMembers(programId: string) {
  try {
    // First try RPC (SECURITY DEFINER) to avoid RLS blocking joins
    const rpcRes = await supabase.rpc('rpc_get_program_members', { p_program_id: programId })
    if (!rpcRes.error && rpcRes.data) {
      const parsed = typeof rpcRes.data === 'string' ? JSON.parse(rpcRes.data) : rpcRes.data
      const students = parsed.students || []
      const teachers = parsed.teachers || []
      console.debug('getProgramMembers via RPC:', { programId, studentsCount: students.length, teachersCount: teachers.length })
      return { students, teachers }
    }

    // Fallback: try direct selects (may be blocked by RLS)
    const { data: studentRows, error: studentErr } = await supabase
      .from('program_students')
      .select('profile:profiles(*)')
      .eq('program_id', programId)

    if (studentErr) throw studentErr

    const { data: teacherRows, error: teacherErr } = await supabase
      .from('program_teachers')
      .select('profile:profiles(*)')
      .eq('program_id', programId)

    if (teacherErr) throw teacherErr

    const students = (studentRows || []).map((r: any) => r.profile)
    const teachers = (teacherRows || []).map((r: any) => r.profile)

    console.debug('getProgramMembers (fallback):', { programId, rawStudentRows: studentRows, rawTeacherRows: teacherRows, studentsCount: students.length, teachersCount: teachers.length })

    return { students, teachers }
  } catch (error) {
    console.error('Error loading program members:', error)
    return { students: [], teachers: [] }
  }
}
