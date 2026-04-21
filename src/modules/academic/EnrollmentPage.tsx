'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Profile, type GroupMember } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function EnrollmentPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<(GroupMember & { profile: Profile })[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id)
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
      setOrganizationId(profile.organization_id)
      loadGroups(profile.organization_id)
    } else {
      setLoading(false)
    }
  }

  async function loadGroups(orgId: string) {
    setLoading(true)
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

  async function loadMembers(groupId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setMembers(data as (GroupMember & { profile: Profile })[])
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !organizationId) return

    setSearching(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('role', 'student')
      .ilike('full_name', `%${searchQuery}%`)
      .limit(10)

    if (!error && data) {
      const enrolledIds = new Set(members.map(m => m.profile_id))
      const availableStudents = data.filter(s => !enrolledIds.has(s.id))
      setSearchResults(availableStudents)
    }
    setSearching(false)
  }

  async function enrollStudent(studentId: string) {
    if (!selectedGroup) return

    setEnrolling(true)
    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: selectedGroup.id,
        profile_id: studentId,
        role: 'student',
      })

      if (error) {
        toast.error('Error al matricular: ' + error.message)
      } else {
        toast.success('Alumno matriculado')
        setSearchResults([])
        setSearchQuery('')
        loadMembers(selectedGroup.id)
      }
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setEnrolling(false)
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId)

    if (!error && selectedGroup) {
      toast.success('Alumno removido')
      loadMembers(selectedGroup.id)
    } else {
      toast.error('Error al remover')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Matrículas</h1>
        <p className="text-sm text-slate-500">Gestiona la inscripción de alumnos en grupos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
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

          {selectedGroup && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
              <h2 className="text-sm font-medium text-slate-700 mb-3">Buscar Alumno</h2>
              <form onSubmit={handleSearch} className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-medium text-slate-500 uppercase">Resultados</h3>
                  {searchResults.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm text-slate-700 truncate">
                        {student.full_name || student.email}
                      </span>
                      <button
                        onClick={() => enrollStudent(student.id)}
                        disabled={enrolling}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              Alumnos Inscritos {selectedGroup ? `- ${selectedGroup.name}` : ''}
            </h2>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecciona un grupo para ver los alumnos inscritos
              </p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay alumnos matriculados en este grupo
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                        {(member.profile?.full_name || member.profile?.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member.profile?.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {member.profile?.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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