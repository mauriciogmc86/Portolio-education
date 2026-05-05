'use client'

import { use } from 'react'
import { supabase, type Profile } from '@/lib/supabase'

type AuthState = {
  user: {
    id: string
    email: string
    profile: Profile | null
  } | null
  loading: boolean
}

const authPromise = (async (): Promise<AuthState> => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, loading: false }
  }

  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && status !== 406) {
      console.error('Error detallado al cargar perfil:', error.message)
      console.error('Código de error:', error.code)
      console.error('Status HTTP:', status)
      return {
        user: {
          id: user.id,
          email: user.email!,
          profile: null,
        },
        loading: false,
      }
    }

    // status === 406 significa "Not Found" - el perfil no existe
    if (status === 406 || error?.code === 'PGRST116') {
      console.warn('Perfil no encontrado para el usuario:', user.id)
      return {
        user: {
          id: user.id,
          email: user.email!,
          profile: null,
        },
        loading: false,
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email!,
        profile: data as Profile,
      },
      loading: false,
    }
  } catch (error: any) {
    console.error('Error inesperado en useAuth:', error)
    return {
      user: {
        id: user.id,
        email: user.email!,
        profile: null,
      },
      loading: false,
    }
  }
})()

export function useAuth(): AuthState {
  return use(authPromise) as AuthState
}