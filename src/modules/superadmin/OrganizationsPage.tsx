'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Organization } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import toast from 'react-hot-toast'

export function OrganizationsPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { setSelectedOrgId } = useOrganization()
  const userProfile = user?.profile

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    admin_full_name: '',
    admin_email: '',
    admin_password: '',
  })

  // Super Admin global: rol super_admin (dueño de infraestructura)
  // Nota: El super_admin debe tener organization_id = null en la base de datos
  const isSuperAdmin = userProfile?.role === 'super_admin'

  useEffect(() => {
    // Si ya cargó la autenticación y el usuario no es super_admin, redirigir
    if (!authLoading && user && !isSuperAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isSuperAdmin, user, authLoading, navigate])

  useEffect(() => {
    if (isSuperAdmin) {
      loadOrganizations()
    }
  }, [isSuperAdmin])

  async function loadOrganizations() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setOrganizations(data as Organization[])
    }
    setLoading(false)
  }

  function handleManageOrg(org: Organization) {
    setSelectedOrgId(org.id)
    navigate('/dashboard')
  }

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name || !formData.slug || !formData.admin_email || !formData.admin_password || !formData.admin_full_name) {
      toast.error('Por favor completa todos los campos')
      return
    }

    setSaving(true)
    let orgId: string | null = null

    try {
      // Check if slug already exists
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', formData.slug)
        .single()

      if (existingOrg) {
        toast.error('El slug ya está en uso. Por favor, elige otro.')
        setSaving(false)
        return
      }

      // Step 1: Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          slug: formData.slug,
        })
        .select('id')
        .single()

      if (orgError) throw new Error('Error al crear organización: ' + orgError.message)
      orgId = orgData.id

      // Step 2: Create auth user for admin
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.admin_email,
        password: formData.admin_password,
      })

      if (authError) throw new Error('Error al crear usuario administrador: ' + authError.message)
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // Step 3: Create admin profile linked to organization
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: formData.admin_email,
        full_name: formData.admin_full_name,
        role: 'admin',
        organization_id: orgId,
      })

      if (profileError) throw new Error('Error al asignar perfil de administrador: ' + profileError.message)

      toast.success('Organización y administrador creados exitosamente')
      setShowModal(false)
      setFormData({ name: '', slug: '', admin_full_name: '', admin_email: '', admin_password: '' })
      loadOrganizations()
    } catch (error) {
      // Cleanup: if organization was created, attempt to delete it
      if (orgId) {
        await supabase.from('organizations').delete().eq('id', orgId)
      }
      const message = error instanceof Error ? error.message : 'Error al crear organización'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  // Mientras carga la autenticación, mostrar spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  // Si no es super_admin global, no renderizar el contenido (la redirección ya se disparó)
  if (!isSuperAdmin) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Escuelas</h1>
          <p className="text-sm text-slate-500">Gestiona las organizaciones/escuelas de la plataforma</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Escuela
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Nombre</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Slug (URL)</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Fecha de creación</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Cargando escuelas...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No hay escuelas registradas
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">{org.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">{org.slug}</code>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(org.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleManageOrg(org)}
                      className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nueva Escuela</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Escuela</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleNameChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Se usará para la URL: tudominio.com/{formData.slug || 'escuela'}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="text-sm font-medium text-slate-900 mb-3">Administrador Inicial</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Administrador</label>
                    <input
                      type="text"
                      value={formData.admin_full_name}
                      onChange={(e) => setFormData({ ...formData, admin_full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
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
                  {saving ? 'Creando...' : 'Crear Escuela'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrganizationsPage
