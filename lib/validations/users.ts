import { z } from 'zod'

/**
 * Schema for inviting a new user to a tenant.
 * Note: 'owner' is intentionally excluded as it is only assigned during onboarding.
 */
export const InviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string()
    .min(2, 'Name must be at least 2 chars')
    .max(100)
    .trim(),
  phone: z.string()
    .max(20)
    .optional()
    .nullable(),
  role: z.enum(['admin', 'manager', 'member'], {
    errorMap: () => ({
      message: 'Role must be admin, manager, or member'
    })
  })
})

/**
 * Schema for updating a user's role.
 * Note: 'owner' is excluded to prevent unauthorized role escalation.
 */
export const UpdateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'member'])
})

/**
 * Schema for updating a user's active status.
 */
export const UpdateStatusSchema = z.object({
  is_active: z.boolean()
})

export type InviteUserInput = z.infer<typeof InviteUserSchema>
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>
