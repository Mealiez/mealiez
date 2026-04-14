"use client"

/*
 * CLIENT-SIDE AUTH HELPER
 * Safe to use in client components and all mobile routes.
 * Reads session from browser storage via Supabase client.
 */

import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/session'

/**
 * getClientSession()
 * Reads session from browser storage. Fast and safe for mobile.
 */
export async function getClientSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * getClientUser()
 * Assembles the full user profile with tenant context from browser storage and public.users.
 */
export async function getClientUser(): Promise<AuthUser | null> {
  const session = await getClientSession()
  if (!session) return null

  const { user } = session
  const tenant_id = user.app_metadata?.tenant_id as string | undefined
  const role = user.app_metadata?.role as AuthUser['role'] | undefined

  if (!tenant_id) return null

  const supabase = createClient()
  const { data: profile, error } = await supabase
    .from('users')
    .select('full_name, is_active')
    .eq('auth_id', user.id)
    .single()

  if (error || !profile || profile.is_active === false) {
    return null
  }

  return {
    id: user.id,
    auth_id: user.id,
    tenant_id,
    role: role || 'member',
    full_name: profile.full_name,
    email: user.email!,
    is_active: profile.is_active
  }
}

/**
 * signOut()
 * Clears browser session and signs out the user.
 */
export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * onAuthStateChange()
 * Subscribes to authentication state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const supabase = createClient()
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return subscription
}
