'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase, type Organization } from '@/lib/supabase'

type OrganizationContextType = {
  selectedOrgId: string | null
  selectedOrg: Organization | null
  organizations: Organization[]
  setSelectedOrgId: (orgId: string | null) => void
  loading: boolean
  isSuperAdmin: boolean
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

const STORAGE_KEY = 'selected_organization_id'

export function OrganizationProvider({ children, isSuperAdmin }: { children: ReactNode; isSuperAdmin: boolean }) {
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOrganizations() {
      if (!isSuperAdmin) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('organizations')
        .select('*')
        .order('name')

      if (data) {
        setOrganizations(data as Organization[])
      }
      setLoading(false)
    }

    loadOrganizations()
  }, [isSuperAdmin])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && organizations.find(o => o.id === stored)) {
      setSelectedOrgIdState(stored)
    }
  }, [organizations])

  useEffect(() => {
    if (selectedOrgId && organizations.length > 0) {
      const org = organizations.find(o => o.id === selectedOrgId)
      setSelectedOrg(org || null)
    } else {
      setSelectedOrg(null)
    }
  }, [selectedOrgId, organizations])

  function setSelectedOrgId(orgId: string | null) {
    setSelectedOrgIdState(orgId)
    if (orgId) {
      localStorage.setItem(STORAGE_KEY, orgId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrgId,
        selectedOrg,
        organizations,
        setSelectedOrgId,
        loading,
        isSuperAdmin,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}