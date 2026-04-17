// Zod v4 — use { error: '...' } not { errorMap: ... }
// Zod v4 — use z.string().min(n, 'msg') for field errors
// Zod v4 — errorMap was removed in v4
// Zod version check: 4.3.6

import { z } from 'zod';

export const CreateMealPlanSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 chars')
    .max(100)
    .trim(),
  description: z.string()
    .max(500)
    .optional()
    .nullable(),
  start_date: z.string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date must be YYYY-MM-DD'
    ),
  end_date: z.string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date must be YYYY-MM-DD'
    )
}).refine(
  data => data.end_date >= data.start_date,
  {
    message: 'End date must be on or after start date',
    path: ['end_date']
  }
);

export const UpdateMealPlanSchema = z.object({
  name: z.string().min(2).max(100).trim()
    .optional(),
  description: z.string().max(500)
    .optional()
    .nullable(),
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  is_active: z.boolean().optional()
}).refine(
  data => {
    if (data.start_date && data.end_date) {
      return data.end_date >= data.start_date;
    }
    return true;
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date']
  }
);

export const CreateMealPlanItemSchema = z.object({
  meal_date: z.string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date must be YYYY-MM-DD'
    ),
  meal_type: z.enum(
    ['breakfast', 'lunch', 'dinner', 'snack'],
    { error: 'Invalid meal type' }
  ),
  name: z.string()
    .min(2, 'Meal name required')
    .max(200)
    .trim(),
  description: z.string()
    .max(500)
    .optional()
    .nullable(),
  is_available: z.boolean().default(true)
});

export const UpdateMealPlanItemSchema = z.object({
  name: z.string().min(2).max(200).trim()
    .optional(),
  description: z.string().max(500)
    .optional()
    .nullable(),
  is_available: z.boolean().optional(),
  meal_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meal_type: z.enum(
    ['breakfast', 'lunch', 'dinner', 'snack'],
    { error: 'Invalid meal type' }
  ).optional()
});

export type CreateMealPlanInput = z.infer<typeof CreateMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof UpdateMealPlanSchema>;
export type CreateMealPlanItemInput = z.infer<typeof CreateMealPlanItemSchema>;
export type UpdateMealPlanItemInput = z.infer<typeof UpdateMealPlanItemSchema>;

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
};

export const MEAL_TYPE_ORDER: MealType[] = [
  'breakfast', 'lunch', 'snack', 'dinner'
];
