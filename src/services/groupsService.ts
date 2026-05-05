import { supabase } from '@/lib/supabase'

// Devuelve el programa asignado al grupo (si existe)
export async function getProgramForGroup(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('program:programs(*)')
    .eq('id', groupId)
      .single()

    console.debug('getProgramForGroup:', { groupId, data, error })

    if (error) {
      console.error('Error loading program for group:', error)
      return null
    }
    return (data as any)?.program || null
}

// Asigna (o reemplaza) el program_id en la tabla groups
export async function assignProgramToGroup(groupId: string, programId: string) {
  const { data, error } = await supabase
    .from('groups')
    .update({ program_id: programId, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select('*, program:programs(*)')
    .single()

  if (error) throw error
  return (data as any)?.program || null
}

// Remueve la referencia al programa en la tabla groups (set NULL)
export async function removeProgramFromGroup(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .update({ program_id: null, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getMembersForGroup(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId)
    .order('id', { ascending: false })

  console.debug('getMembersForGroup:', { groupId, data, error })

  if (error) {
    console.error('Error loading group members:', error)
    return []
  }
  return data as any[]
}

export async function addMemberToGroup(groupId: string, profileId: string, role: string = 'student') {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, profile_id: profileId, role })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removeMemberFromGroup(memberId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
}
