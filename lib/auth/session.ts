/*
 * SERVER-ONLY: Do not import this in client components
 * or any file inside app/(mobile)/
 * Use lib/auth/client-session.ts for client-side auth.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

export type AuthUser = {
  id: string           // auth.uid()
  auth_id: string      // same as id, explicit alias
  tenant_id: string    // from app_metadata
  role: 'owner' | 'admin' | 'manager' | 'member'
  full_name: string    // from public.users table
  email: string        // from auth.users
  is_active: boolean   // from public.users table
}

/**
 * getSession()
 * Wrapped in React cache() for deduplication across the same request.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) return null

  // Although getUser is the source of truth, we retrieve the session
  // object to fulfill the requirement of returning both.
  const { data: { session } } = await supabase.auth.getSession()
  
  return { user, session }
})

/**
 * getCurrentUser()
 * Assembles the full user profile including tenant and role context.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const sessionData = await getSession()
  if (!sessionData) return null

  const { user } = sessionData
  const tenant_id = user.app_metadata?.tenant_id as string | undefined
  const role = user.app_metadata?.role as AuthUser['role'] | undefined

  if (!tenant_id) {
    console.error('[AUTH] tenant_id missing from JWT')
    return null
  }

  const supabase = await createClient()
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
 * requireAuth()
 * Used in server components to enforce authentication and redirect if missing.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  return user
}
