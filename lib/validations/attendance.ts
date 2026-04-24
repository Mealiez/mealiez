import { z } from 'zod';

// Zod v4 — use { error: '...' } not { errorMap }

export const CreateSessionSchema = z.object({
  session_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Date must be YYYY-MM-DD'
  ),
  meal_type: z.enum(
    ['breakfast', 'lunch', 'dinner', 'snack'],
    { error: 'Invalid meal type' }
  ),
  label: z.string()
    .min(2, 'Label required')
    .max(100)
    .trim(),
  meal_plan_item_id: z.string()
    .uuid('Invalid plan item ID')
    .optional()
    .nullable(),
  scan_mode: z.enum(['session', 'member']).default('session'),
});

export const UpdateSessionSchema = z.object({
  label: z.string().min(2).max(100).trim()
    .optional(),
  is_active: z.boolean().optional(),
  scan_mode: z.enum(['session', 'member']).optional(),
});

export const MarkAttendanceSchema = z.object({
  session_token: z.string()
    .min(1, 'Token required'),
  // Raw token string from QR decode
  // Server verifies signature and expiry
});

export const ManualMarkSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  method: z.literal('manual'),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;
export type ManualMarkInput = z.infer<typeof ManualMarkSchema>;
