import { supabase, type Profile, type Group } from '@/lib/supabase'

export async function updateFullProfile(profileId: string, data: Partial<Profile>) {
  // Limpiar datos: solo campos permitidos en tabla profiles (sin group_id)
  const allowedFields = ['full_name', 'email', 'role', 'organization_id']
  const cleanData: Record<string, any> = { updated_at: new Date().toISOString() }

  for (const field of allowedFields) {
    if (data[field as keyof Profile] !== undefined && data[field as keyof Profile] !== '') {
      cleanData[field] = data[field as keyof Profile]
    }
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update(cleanData)
    .eq('id', profileId)
    .select()
    .single()

  if (error) throw error
  return updatedProfile as Profile
}

export async function getStudentsByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('role', 'student')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error loading students:', error)
    return []
  }
  return data as Profile[]
}

export async function getGroupsByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) throw error
  return data as Group[]
}

export async function getTeachersByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('role', 'teacher')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error loading teachers:', error)
    return []
  }
  return data as Profile[]
}

export async function getCoordinatorsByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .or('role.eq.admin,role.eq.super_admin')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error loading coordinators:', error)
    return []
  }
  return data as Profile[]
}
