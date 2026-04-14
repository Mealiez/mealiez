/*
 * SERVER-ONLY: Route and role guards.
 * Import only in server components and API routes.
 */

import { getCurrentUser, requireAuth, type AuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

/**
 * requireRole()
 * Enforces that the authenticated user has one of the specified roles.
 */
export async function requireRole(
  allowedRoles: AuthUser['role'][]
): Promise<AuthUser> {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard?error=unauthorized')
  }

  return user
}

/**
 * requireOwnerOrAdmin()
 * Shortcut for owner or admin access.
 */
export async function requireOwnerOrAdmin(): Promise<AuthUser> {
  return requireRole(['owner', 'admin'])
}

/**
 * requireOwner()
 * Shortcut for owner-only access.
 */
export async function requireOwner(): Promise<AuthUser> {
  return requireRole(['owner'])
}

/**
 * withTenantId()
 * Utility to append tenant_id to a query object for double-enforcement.
 */
export async function withTenantId<T extends object>(
  query: T
): Promise<T & { tenant_id: string }> {
  const user = await requireAuth()
  return {
    ...query,
    tenant_id: user.tenant_id,
  }
}
