'use client'

import { useEffect, useState } from 'react'
import { supabase, type Group } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

    if (!error && data) {
      setGroups(data as Group[])
    }
    setLoading(false)
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
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Grupos / Aulas</h1>
          <p className="text-sm text-slate-500">Crea y gestiona grupos o aulas para tus cursos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
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
    </div>
  )
}