'use client'

import { supabase, type Profile } from '@/lib/supabase'

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !user) {
    throw new Error(error?.message || 'Failed to sign in')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    profile: profile as Profile | null,
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    profile: profile as Profile | null,
  }
}

export async function checkAuth(): Promise<AuthUser | null> {
  return getCurrentUser()
}