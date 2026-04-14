export const ROLE_RANK = {
  owner:   4,
  admin:   3,
  manager: 2,
  member:  1
} as const

export type UserRole = keyof typeof ROLE_RANK

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:   'Owner',
  admin:   'Admin',
  manager: 'Manager',
  member:  'Member'
}

/**
 * Roles that can be assigned via invite.
 * 'owner' is excluded as it is only assigned during onboarding.
 */
export const ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'manager',
  'member'
]

/**
 * canAssignRole()
 * Logic to ensure an inviter or admin can only assign roles that are 
 * strictly below their own rank.
 */
export function canAssignRole(
  inviterRole: UserRole,
  targetRole: UserRole
): boolean {
  return ROLE_RANK[inviterRole] > ROLE_RANK[targetRole]
}

/**
 * outranks()
 * Returns true if roleA has a higher rank than roleB.
 */
export function outranks(
  roleA: UserRole,
  roleB: UserRole
): boolean {
  return ROLE_RANK[roleA] > ROLE_RANK[roleB]
}

/**
 * isAdminOrAbove()
 * Returns true if the role is Admin or Owner.
 */
export function isAdminOrAbove(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['admin']
}

/**
 * getAssignableRoles()
 * Returns a filtered list of roles the inviter is allowed to assign.
 */
export function getAssignableRoles(
  inviterRole: UserRole
): UserRole[] {
  return ASSIGNABLE_ROLES.filter(
    role => canAssignRole(inviterRole, role)
  )
}
