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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, loading: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    user: {
      id: user.id,
      email: user.email!,
      profile: profile as Profile | null,
    },
    loading: false,
  }
})()

export function useAuth(): AuthState {
  return use(authPromise) as AuthState
}