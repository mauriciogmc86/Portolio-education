'use client'

import { useEffect, useState } from 'react'
import { supabase, type Profile, type Group } from '@/lib/supabase'
import { getStudentsByOrganization, getGroupsByOrganization } from '@/services/profileService'
import toast from 'react-hot-toast'

export function StudentGroupAssignment() {
  const [students, setStudents] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizationData()
  }, [])

  async function loadOrganizationData() {
    try {
      setLoading(true)
      setError(null)

      const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !supabaseUser) {
        setError('Error de autenticación')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', supabaseUser.id)
        .single()

      if (profileError) {
        setError('Error al cargar perfil: ' + profileError.message)
        setLoading(false)
        return
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        await Promise.all([
          loadStudents(profile.organization_id),
          loadGroups(profile.organization_id)
        ])
      } else {
        setError('No tienes una organización asignada')
      }
    } catch (err: any) {
      setError('Error inesperado: ' + (err.message || 'Desconocido'))
    } finally {
      setLoading(false)
    }
  }

  async function loadStudents(orgId: string) {
    try {
      const data = await getStudentsByOrganization(orgId)
      setStudents(data || [])
    } catch (error: any) {
      toast.error('Error al cargar estudiantes: ' + error.message)
      setStudents([])
    }
  }

  async function loadGroups(orgId: string) {
    try {
      const data = await getGroupsByOrganization(orgId)
      setGroups(data || [])
    } catch (error: any) {
      toast.error('Error al cargar grupos: ' + error.message)
      setGroups([])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Asignación de Grupos</h1>
        <p className="text-sm text-slate-500">
          Nota: La tabla profiles no tiene columna group_id. Use la tabla group_members para asignar grupos.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-900">
                  {student.full_name || 'Sin nombre'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{student.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    student.role === 'admin' || student.role === 'super_admin'
                      ? 'bg-purple-100 text-purple-700'
                      : student.role === 'teacher'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                   }`}>
                     {student.role === 'admin' ? 'Coordinador' : student.role === 'super_admin' ? 'Super Admin' : student.role === 'teacher' ? 'Profesor' : 'Estudiante'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
