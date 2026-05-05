'use client'

import { useEffect, useState } from 'react'
import { supabase, type Program, type Assignment, type Group } from '@/lib/supabase'
import { getProgramsByOrganization, createProgram, updateProgram, deleteProgram } from '@/services/programsService'
import { getTeachersByOrganization, getStudentsByOrganization } from '@/services/profileService'
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect'
import toast from 'react-hot-toast'

export function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [programGroups, setProgramGroups] = useState<Group[]>([])
  const [programAssignments, setProgramAssignments] = useState<Assignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration_months: '',
    cover_url: '',
    is_active: true,
    teacher_ids: [] as string[],
    student_ids: [] as string[],
  })

  const [page, setPage] = useState(0)
  const pageSize = 10

  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  useEffect(() => {
    loadOrganizationData()
  }, [])

  async function loadOrganizationData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        await loadPrograms(profile.organization_id)
        try {
          const t = await getTeachersByOrganization(profile.organization_id)
          const s = await getStudentsByOrganization(profile.organization_id)
          setTeachers(t)
          setStudents(s)
        } catch (e) {
          console.error('Error loading teachers/students', e)
        }
      }
    } catch (error) {
      console.error('Error loading org data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPrograms(orgId: string) {
    try {
      const data = await getProgramsByOrganization(orgId)
      setPrograms(data || [])
    } catch (error: any) {
      toast.error('Error al cargar programas: ' + error.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !formData.name) return

    setSaving(true)
    try {
      await createProgram({
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        organization_id: organizationId,
        duration_months: formData.duration_months ? parseInt(formData.duration_months) : null,
        cover_url: formData.cover_url || null,
        is_active: !!formData.is_active,
        teacher_ids: formData.teacher_ids,
        student_ids: formData.student_ids,
      })

      toast.success('Programa creado')
      setShowModal(false)
      setFormData({ name: '', code: '', description: '', duration_months: '', cover_url: '', is_active: true, teacher_ids: [], student_ids: [] })
      if (organizationId) loadPrograms(organizationId)
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
    setSaving(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProgram || !formData.name) return

    setSaving(true)
    try {
      await updateProgram(editingProgram.id, {
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        duration_months: formData.duration_months ? parseInt(formData.duration_months) : null,
        cover_url: formData.cover_url || null,
        is_active: !!formData.is_active,
        teacher_ids: formData.teacher_ids,
        student_ids: formData.student_ids,
      })

      toast.success('Programa actualizado')
      setShowEditModal(false)
      setEditingProgram(null)
      setFormData({ name: '', code: '', description: '', duration_months: '', cover_url: '', is_active: true, teacher_ids: [], student_ids: [] })
      if (organizationId) loadPrograms(organizationId)
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
    setSaving(false)
  }

  async function handleDelete(programId: string) {
    if (!confirm('¿Eliminar este programa?')) return
    try {
      await deleteProgram(programId)
      toast.success('Programa eliminado')
      if (organizationId) loadPrograms(organizationId)
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function openEditModal(program: Program) {
    setEditingProgram(program)
    setFormData({
      name: program.name,
      code: program.code || '',
      description: program.description || '',
      duration_months: program.duration_months?.toString() || '',
      cover_url: program.cover_url || '',
      is_active: program.is_active ?? true,
      teacher_ids: [],
      student_ids: [],
    })
    awaitLoadProgramRelations(program.id)
    setShowEditModal(true)
  }

  async function awaitLoadProgramRelations(programId: string) {
    try {
      const { data: tdata, error: tErr } = await supabase.from('program_teachers').select('profile_id').eq('program_id', programId)
      if (tErr) console.error('Error loading program_teachers', tErr)
      const teacher_ids = (tdata || []).map((r: any) => r.profile_id)

      const { data: sdata, error: sErr } = await supabase.from('program_students').select('profile_id').eq('program_id', programId)
      if (sErr) console.error('Error loading program_students', sErr)
      const student_ids = (sdata || []).map((r: any) => r.profile_id)

      setFormData(fd => ({ ...fd, teacher_ids, student_ids }))
    } catch (e) {
      console.error('Error loading program relations', e)
    }
  }

  async function openProgramDetail(program: Program) {
    setSelectedProgram(program)
    setShowDetailModal(true)
    await loadProgramDetails(program.id)
  }

  async function loadProgramDetails(programId: string) {
    setLoadingAssignments(true)
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('program_id', programId)
    if (groupsError) {
      console.error('Error loading groups:', groupsError)
      setProgramGroups([])
    } else {
      setProgramGroups((groupsData as Group[]) || [])
    }
    const groups = (groupsError ? [] : (groupsData as Group[] || []))
    const groupIds = groups.map((g: Group) => g.id)
    if (groupIds.length > 0) {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .in('group_id', groupIds)
      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError)
        setProgramAssignments([])
      } else {
        setProgramAssignments((assignmentsData as Assignment[]) || [])
      }
    } else {
      setProgramAssignments([])
    }
    setLoadingAssignments(false)
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando...</div>
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Programas</h1>
          <p className="text-sm text-slate-500">Gestiona los programas académicos</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', code: '', description: '', duration_months: '', cover_url: '', is_active: true, teacher_ids: [], student_ids: [] })
            setShowModal(true)
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
        >
          Nuevo Programa
        </button>
      </div>

        <div className="bg-white rounded border">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 text-sm">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Duración</th>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700">
                {programs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No hay programas</td>
                  </tr>
                ) : (
                  programs.slice(page*pageSize, (page+1)*pageSize).map((program) => (
                    <tr key={program.id} className="border-t">
                      <td className="px-4 py-3">{program.name}</td>
                      <td className="px-4 py-3">{program.code || '-'}</td>
                      <td className="px-4 py-3">{program.duration_months ?? '-'}</td>
                      <td className="px-4 py-3">{program.is_active ? 'Sí' : 'No'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(program)} className="px-3 py-1 bg-amber-500 text-white rounded">Editar</button>
                          <button onClick={() => openProgramDetail(program)} className="px-3 py-1 border rounded text-slate-600">Ver</button>
                          <button onClick={() => handleDelete(program.id)} className="px-3 py-1 border rounded text-red-600">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-slate-500">Mostrando {Math.min(programs.length, (page+1)*pageSize)} de {programs.length}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p-1))} className="px-3 py-1 border rounded" disabled={page===0}>Anterior</button>
              <button onClick={() => setPage(p => Math.min(Math.floor((programs.length-1)/pageSize), p+1))} className="px-3 py-1 border rounded" disabled={(page+1)*pageSize >= programs.length}>Siguiente</button>
            </div>
          </div>
        </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Nuevo Programa</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Código</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duración (meses)</label>
                <input
                  type="number"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cover URL</label>
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Activo</label>
                <select
                  value={formData.is_active ? '1' : '0'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === '1' })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Profesores (selección múltiple)</label>
                <SearchableMultiSelect
                  options={teachers.map(t => ({ value: t.id, label: t.full_name || t.email }))}
                  value={formData.teacher_ids}
                  onChange={(vals) => setFormData({ ...formData, teacher_ids: vals })}
                  placeholder="Buscar profesores..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Alumnos (selección múltiple)</label>
                <SearchableMultiSelect
                  options={students.map(s => ({ value: s.id, label: s.full_name || s.email }))}
                  value={formData.student_ids}
                  onChange={(vals) => setFormData({ ...formData, student_ids: vals })}
                  placeholder="Buscar alumnos..."
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Editar Programa</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Código</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duración (meses)</label>
                <input
                  type="number"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingProgram(null) }} className="flex-1 px-4 py-2 border rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
