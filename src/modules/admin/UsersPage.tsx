'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Profile, type Group } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import {
  updateFullProfile,
  getGroupsByOrganization,
  getTeachersByOrganization,
  getCoordinatorsByOrganization,
  getStudentsByOrganization,
} from '@/services/profileService'
import { UserTable } from './UserTable'

type UserRole = 'coordinators' | 'teachers' | 'students'

export function UsersPage() {
  const [coordinatorUsers, setCoordinatorUsers] = useState<Profile[]>([])
  const [teacherUsers, setTeacherUsers] = useState<Profile[]>([])
  const [studentUsers, setStudentUsers] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<UserRole>('coordinators')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    role: 'student' as 'teacher' | 'student' | 'admin' | 'super_admin',
  })

  const [createFormData, setCreateFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'student' as 'teacher' | 'student' | 'admin',
  })

  useEffect(() => {
    loadOrganizationAndData()
  }, [])

  async function loadOrganizationAndData() {
    setLoading(true)
    console.log('Iniciando carga de organización y datos...')
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('Error obteniendo usuario autenticado:', authError)
      setLoading(false)
      return
    }
    console.log('Usuario autenticado:', supabaseUser?.id)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role, email')
      .eq('id', supabaseUser?.id)
      .single()

    if (profileError) {
      console.error('Error obteniendo perfil del usuario:', profileError)
      setLoading(false)
      return
    }

    console.log('Perfil del usuario:', profile)

    if (profile?.organization_id) {
      const orgId = profile.organization_id
      setOrganizationId(orgId)
      console.log('Organization ID:', orgId)

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('organization_id', orgId)
      console.log('TODOS los perfiles en la organización:', allProfiles)

      await Promise.all([
        loadCoordinators(orgId),
        loadTeachers(orgId),
        loadStudents(orgId),
        loadGroups(orgId),
      ])
    } else {
      console.warn('Usuario sin organization_id asignado')
      toast.error('No tienes una organización asignada')
    }
    setLoading(false)
  }

  async function loadCoordinators(orgId: string) {
    console.log('Cargando coordinadores para org:', orgId)
    const data = await getCoordinatorsByOrganization(orgId)
    console.log('Coordinadores cargados:', data.length, data)
    setCoordinatorUsers(data)
  }

  async function loadTeachers(orgId: string) {
    console.log('Cargando profesores para org:', orgId)
    const data = await getTeachersByOrganization(orgId)
    console.log('Profesores cargados:', data.length, data)
    setTeacherUsers(data)
  }

  async function loadStudents(orgId: string) {
    console.log('Cargando estudiantes para org:', orgId)
    const data = await getStudentsByOrganization(orgId)
    console.log('Estudiantes cargados:', data.length, data)
    setStudentUsers(data)
  }

  async function loadGroups(orgId: string) {
    console.log('Cargando grupos para org:', orgId)
    const data = await getGroupsByOrganization(orgId)
    console.log('Grupos cargados:', data.length, data)
    setGroups(data)
  }

  function openEditModal(user: Profile) {
    setSelectedUser(user)
    setEditFormData({
      full_name: user.full_name || '',
      email: user.email,
      role: user.role as 'teacher' | 'student' | 'admin' | 'super_admin',
    })
    setEditModalOpen(true)
  }

  function openCreateModal() {
    setCreateFormData({
      full_name: '',
      email: '',
      password: '',
      role: 'student',
    })
    setCreateModalOpen(true)
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !organizationId) return

    setSaving(true)
    try {
      await updateFullProfile(selectedUser.id, editFormData)
      toast.success('Perfil actualizado con éxito')
      setEditModalOpen(false)
      await loadOrganizationAndData()
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message)
    }
    setSaving(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !createFormData.email || !createFormData.password) return

    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createFormData.email,
        password: createFormData.password,
      })

      if (authError) {
        toast.error('Error al registrar usuario: ' + authError.message)
        setSaving(false)
        return
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: createFormData.email,
          full_name: createFormData.full_name,
          role: createFormData.role,
          organization_id: organizationId,
        })

        if (profileError) {
          toast.error('Error al crear perfil: ' + profileError.message)
        } else {
          toast.success('Usuario creado con éxito')
          setCreateModalOpen(false)
          await loadOrganizationAndData()
        }
      }
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setSaving(false)
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-purple-100 text-purple-700'
      case 'teacher':
        return 'bg-blue-100 text-blue-700'
      case 'student':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Coordinador'
      case 'super_admin':
        return 'Super Admin'
      case 'teacher':
        return 'Profesor'
      case 'student':
        return 'Estudiante'
      default:
        return role
    }
  }

  const currentUsers = useMemo(() => {
    switch (activeTab) {
      case 'coordinators':
        return coordinatorUsers
      case 'teachers':
        return teacherUsers
      case 'students':
        return studentUsers
      default:
        return []
    }
  }, [activeTab, coordinatorUsers, teacherUsers, studentUsers])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestiona los usuarios de tu organización</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UserRole)} defaultValue="coordinators">
            <TabsList>
              <TabsTrigger value="coordinators">Coordinadores</TabsTrigger>
              <TabsTrigger value="teachers">Profesores</TabsTrigger>
              <TabsTrigger value="students">Estudiantes</TabsTrigger>
            </TabsList>

            <TabsContent value="coordinators" className="mt-0">
              <UserTable
                users={coordinatorUsers}
                onEdit={openEditModal}
                getRoleBadgeClass={getRoleBadgeClass}
                getRoleLabel={getRoleLabel}
                activeTab={activeTab}
              />
            </TabsContent>

            <TabsContent value="teachers" className="mt-0">
              <UserTable
                users={teacherUsers}
                onEdit={openEditModal}
                getRoleBadgeClass={getRoleBadgeClass}
                getRoleLabel={getRoleLabel}
                activeTab={activeTab}
              />
            </TabsContent>

            <TabsContent value="students" className="mt-0">
              <UserTable
                users={studentUsers}
                onEdit={openEditModal}
                getRoleBadgeClass={getRoleBadgeClass}
                getRoleLabel={getRoleLabel}
                activeTab={activeTab}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal de Edición */}
      <Dialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Editar Usuario"
        description="Modifica los datos del usuario"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={editFormData.full_name}
              onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
            <select
              value={editFormData.role}
              onChange={(e) => {
                const newRole = e.target.value as 'teacher' | 'student' | 'admin' | 'super_admin'
                setEditFormData({
                  ...editFormData,
                  role: newRole,
                })
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="admin">Coordinador</option>
              <option value="teacher">Profesor</option>
              <option value="student">Estudiante</option>
            </select>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Modal de Creación */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Nuevo Usuario"
        description="Registra un nuevo usuario en el sistema"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={createFormData.full_name}
              onChange={(e) => setCreateFormData({ ...createFormData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={createFormData.email}
              onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={createFormData.password}
              onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
            <select
              value={createFormData.role}
              onChange={(e) => {
                const newRole = e.target.value as 'teacher' | 'student' | 'admin'
                setCreateFormData({
                  ...createFormData,
                  role: newRole,
                })
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="admin">Coordinador</option>
              <option value="teacher">Profesor</option>
              <option value="student">Estudiante</option>
            </select>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear Usuario'}
            </button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
