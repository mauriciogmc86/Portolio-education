'use client'

import { useEffect, useState } from 'react'
import { supabase, type AcademicPeriod } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function PeriodsPage() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    loadOrganizationAndPeriods()
  }, [])

  async function loadOrganizationAndPeriods() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', supabaseUser.id)
      .single()

    if (profile?.organization_id) {
      setOrganizationId(profile.organization_id)
      loadPeriods(profile.organization_id)
    } else {
      setLoading(false)
    }
  }

  async function loadPeriods(orgId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('academic_periods')
      .select('*')
      .eq('organization_id', orgId)
      .order('start_date', { ascending: false })

    if (!error && data) {
      setPeriods(data as AcademicPeriod[])
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !formData.name || !formData.start_date || !formData.end_date) return

    setSaving(true)
    try {
      const { error } = await supabase.from('academic_periods').insert({
        name: formData.name,
        organization_id: organizationId,
        start_date: formData.start_date,
        end_date: formData.end_date,
      })

      if (error) {
        toast.error('Error al crear período: ' + error.message)
      } else {
        toast.success('Período creado con éxito')
        setShowModal(false)
        setFormData({ name: '', start_date: '', end_date: '' })
        loadPeriods(organizationId)
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
          <h1 className="text-2xl font-semibold text-slate-900">Períodos Académicos</h1>
          <p className="text-sm text-slate-500">Define el calendario académico de tu organización</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Período
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Cargando períodos...
          </div>
        ) : periods.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            No hay períodos académicos definidos
          </div>
        ) : (
          periods.map((period) => (
            <div key={period.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">{period.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {new Date(period.start_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} - {new Date(period.end_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    new Date() >= new Date(period.start_date) && new Date() <= new Date(period.end_date)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {new Date() >= new Date(period.start_date) && new Date() <= new Date(period.end_date)
                      ? 'Activo'
                      : 'Inactivo'}
                  </span>
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
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nuevo Período Académico</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Semestre 2024-1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Fin</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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