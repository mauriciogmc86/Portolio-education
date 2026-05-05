'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group, type Assignment } from '@/lib/supabase'
import { getProgramsByOrganization } from '@/services/programsService'
import { getProgramMembers } from '@/services/programsService'
import {
  getProgramForGroup,
  assignProgramToGroup,
  removeProgramFromGroup,
  getMembersForGroup,
  addMemberToGroup,
  removeMemberFromGroup,
} from '@/services/groupsService'

import { getAssignmentsByGroup } from '@/services/assignmentsService'
import toast from 'react-hot-toast'

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)

  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupProgram, setGroupProgram] = useState<any | null>(null)
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [programStudents, setProgramStudents] = useState<any[]>([])
  const [programTeachers, setProgramTeachers] = useState<any[]>([])
  const [memberFilter, setMemberFilter] = useState<'all'|'students'|'teachers'>('all')
  const [programsOrg, setProgramsOrg] = useState<any[]>([])
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [groupAssignments, setGroupAssignments] = useState<Assignment[]>([])

  const [formData, setFormData] = useState({
    name: '',
  })

  useEffect(() => {
    loadOrganizationData()
  }, [])

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
      loadData(profile.organization_id)
      loadProgramsOrg(profile.organization_id)
    } else {
      setLoading(false)
    }
  }

  async function loadData(orgId: string) {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error al cargar grupos: ' + error.message)
    } else if (data) {
      setGroups(data as Group[])
    }
    setLoading(false)
  }

  async function loadProgramsOrg(orgId: string) {
    try {
      const progs = await getProgramsByOrganization(orgId)
      setProgramsOrg(progs)
    } catch (e) {
      console.error('Error loading org programs', e)
    }
  }

  async function openDetail(group: Group) {
    console.debug('openDetail group:', group)
    setSelectedGroup(group)
    setShowDetailModal(true)
    await loadGroupPrograms(group.id)
    await loadGroupMembers(group.id)
    await loadGroupAssignments(group.id)
  }

  async function loadGroupPrograms(groupId: string) {
    try {
      const data = await getProgramForGroup(groupId)
      console.log('loadGroupPrograms result:', { groupId, data })
      setGroupProgram(data || null)
      if (data && data.id) {
        const members = await getProgramMembers(data.id)
        console.log('getProgramMembers returned:', members)
        setProgramStudents(members.students || [])
        setProgramTeachers(members.teachers || [])
      } else {
        setProgramStudents([])
        setProgramTeachers([])
      }
    } catch (e) {
      console.error('Error loading group programs', e)
    }
  }

  async function loadGroupMembers(groupId: string) {
    try {
      const data = await getMembersForGroup(groupId)
      console.debug('loadGroupMembers result:', { groupId, data })
      setGroupMembers(data || [])
    } catch (e) {
      console.error('Error loading members', e)
    }
  }

  async function loadGroupAssignments(groupId: string) {
    try {
      const data = await getAssignmentsByGroup(groupId)
      setGroupAssignments(data || [])
    } catch (e) {
      console.error('Error loading group assignments:', e)
      setGroupAssignments([])
    }
  }

  async function handleAssignProgram(programId: string) {
    if (!selectedGroup) return
    setAssigning(true)
    try {
      await assignProgramToGroup(selectedGroup.id, programId)
      await loadGroupPrograms(selectedGroup.id)
    } catch (e: any) {
      toast.error('Error asignando programa: ' + (e.message || e))
    }
    setAssigning(false)
  }

  async function handleRemoveProgram() {
    if (!selectedGroup) return
    try {
      await removeProgramFromGroup(selectedGroup.id)
      await loadGroupPrograms(selectedGroup.id)
    } catch (e: any) {
      toast.error('Error removiendo programa: ' + (e.message || e))
    }
  }

  async function handleSearchStudents(e: React.FormEvent) {
    e.preventDefault()
    if (!studentSearchQuery.trim() || !organizationId) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('role', 'student')
      .ilike('full_name', `%${studentSearchQuery}%`)
      .limit(10)

    if (!error && data) {
      const enrolledIds = new Set(groupMembers.map(m => m.profile_id))
      const available = data.filter((s: any) => !enrolledIds.has(s.id))
      setStudentSearchResults(available)
    }
  }

  async function enrollStudent(studentId: string) {
    if (!selectedGroup) return
    setEnrolling(true)
    try {
      await addMemberToGroup(selectedGroup.id, studentId)
      setStudentSearchQuery('')
      setStudentSearchResults([])
      await loadGroupMembers(selectedGroup.id)
      toast.success('Alumno añadido al grupo')
    } catch (e: any) {
      toast.error('Error al añadir alumno: ' + (e.message || e))
    }
    setEnrolling(false)
  }

  async function enrollTeacher(teacherId: string) {
    if (!selectedGroup) return
    setEnrolling(true)
    try {
      await addMemberToGroup(selectedGroup.id, teacherId, 'teacher')
      await loadGroupMembers(selectedGroup.id)
      toast.success('Docente añadido al grupo')
    } catch (e: any) {
      toast.error('Error al añadir docente: ' + (e.message || e))
    }
    setEnrolling(false)
  }

  async function removeMember(memberId: string) {
    if (!selectedGroup) return
    try {
      await removeMemberFromGroup(memberId)
      await loadGroupMembers(selectedGroup.id)
      toast.success('Alumno removido')
    } catch (e: any) {
      toast.error('Error al remover alumno')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !formData.name) return

    setSaving(true)
    try {
      const { error } = await supabase.from('groups').insert({
        name: formData.name,
        organization_id: organizationId,
      })

      if (error) {
        toast.error('Error al crear grupo: ' + error.message)
      } else {
        toast.success('Grupo creado con éxito')
        setShowModal(false)
        setFormData({ name: '' })
        loadData(organizationId)
      }
    } catch (error: any) {
      toast.error('Error al conectar con el servidor: ' + error.message)
    }
    setSaving(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingGroup || !formData.name) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: formData.name, updated_at: new Date().toISOString() })
        .eq('id', editingGroup.id)

      if (error) {
        toast.error('Error al actualizar grupo: ' + error.message)
      } else {
        toast.success('Grupo actualizado con éxito')
        setShowEditModal(false)
        setEditingGroup(null)
        setFormData({ name: '' })
        if (organizationId) loadData(organizationId)
      }
    } catch (error: any) {
      toast.error('Error al conectar con el servidor: ' + error.message)
    }
    setSaving(false)
  }

  async function handleDelete(groupId: string) {
    if (!confirm('¿Estás seguro de eliminar este grupo?')) return

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

      if (error) {
        toast.error('Error al eliminar grupo: ' + error.message)
      } else {
        toast.success('Grupo eliminado')
        if (organizationId) loadData(organizationId)
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function openEditModal(group: Group) {
    setEditingGroup(group)
    setFormData({ name: group.name })
    setShowEditModal(true)
  }

  const enrolledIds = new Set([
    ...groupMembers.map(m => m.profile_id || m.profile?.id),
    ...programStudents.map((p: any) => p.id),
    ...programTeachers.map((p: any) => p.id),
  ].filter(Boolean))

  console.log('enrolledIds sample:', {
    size: enrolledIds.size,
    ids: Array.from(enrolledIds).slice(0, 10),
    groupMembersSample: groupMembers.slice(0, 5),
    programStudentsCount: programStudents.length,
    programTeachersCount: programTeachers.length,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Grupos / Aulas</h1>
          <p className="text-sm text-slate-500">Crea y gestiona grupos o aulas para tus cursos</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Grupo
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Cargando grupos...
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            No hay grupos creados
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">{group.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    ID: {group.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(group)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => openDetail(group)}
                    className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    title="Ver detalle"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nuevo Grupo / Aula</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Matemáticas - Sección A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            setShowEditModal(false)
            setEditingGroup(null)
          }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Editar Grupo</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Matemáticas - Sección A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingGroup(null)
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedGroup.name}</h2>
                <p className="text-sm text-slate-500">Gestiona programa y alumnos del grupo</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-slate-200 rounded text-sm">Cerrar</button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-100 p-4">
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-3">
                  <select
                    onChange={(e) => handleAssignProgram(e.target.value)}
                    value={groupProgram?.id || ''}
                    className="px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm"
                  >
                    <option value="">-- Seleccionar programa --</option>
                    {programsOrg.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {groupProgram && (
                    <button onClick={() => handleRemoveProgram()} className="px-3 py-2 bg-red-50 text-red-600 rounded text-sm">Quitar</button>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded p-4">
                {groupProgram && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-700">Miembros del programa</h4>
                      <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => setMemberFilter('all')} className={`px-2 py-1 rounded ${memberFilter==='all' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border'}`}>Todos</button>
                        <button onClick={() => setMemberFilter('teachers')} className={`px-2 py-1 rounded ${memberFilter==='teachers' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border'}`}>Docentes</button>
                        <button onClick={() => setMemberFilter('students')} className={`px-2 py-1 rounded ${memberFilter==='students' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border'}`}>Alumnos</button>
              </div>
                  <div className="mt-6 border-t border-slate-200 pt-4">
                  </div>
              </div>
                      {programTeachers.length > 0 && memberFilter !== 'students' && (
                      <div className="mt-2">
                        <div className="text-xs text-slate-500 mb-1">Docentes</div>
                        <div className="space-y-2">
                          {programTeachers.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-2 bg-white rounded">
                              <div>
                                <p className="text-sm text-slate-800 truncate">{t.full_name || t.email}</p>
                                <p className="text-xs text-slate-500">{t.email}</p>
                              </div>
                              {enrolledIds.has(t.id) ? (
                                <div className="px-2 py-1 text-sm text-slate-500 rounded">Añadido</div>
                              ) : (
                                <button
                                  onClick={() => enrollTeacher(t.id)}
                                  disabled={enrolling}
                                  className="px-2 py-1 bg-primary-50 text-primary-600 rounded"
                                >Agregar</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {programStudents.length > 0 && memberFilter !== 'teachers' && (
                      <div className="mt-3">
                        <div className="text-xs text-slate-500 mb-1">Alumnos</div>
                        <div className="space-y-2">
                          {programStudents.map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded">
                              <div>
                                <p className="text-sm text-slate-800 truncate">{s.full_name || s.email}</p>
                                <p className="text-xs text-slate-500">{s.email}</p>
                              </div>
                              {enrolledIds.has(s.id) ? (
                                <div className="px-2 py-1 text-sm text-slate-500 rounded">Añadido</div>
                              ) : (
                                <button
                                  onClick={() => enrollStudent(s.id)}
                                  disabled={enrolling}
                                  className="px-2 py-1 bg-primary-50 text-primary-600 rounded"
                                >Agregar</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <h4 className="text-sm font-medium text-slate-700 mb-3">Buscar y agregar alumnos</h4>
                <form onSubmit={handleSearchStudents} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button type="submit" className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm">Buscar</button>
                </form>

                {studentSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {studentSearchResults.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded">
                        <div>
                          <p className="text-sm text-slate-800 truncate">{s.full_name || s.email}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                        <button onClick={() => enrollStudent(s.id)} disabled={enrolling} className="px-2 py-1 bg-primary-50 text-primary-600 rounded">Agregar</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 text-xs text-slate-400">Total alumnos: {programStudents.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
