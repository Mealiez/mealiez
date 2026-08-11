/*
 * SECURITY: Super Admin API
 */

import { getSuperAdminUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, NextRequest } from 'next/server'

/**
 * PRODUCTION-GRADE API ROUTE
 * Enforcing Node.js runtime for dynamic feature management.
 */
export const runtime = 'nodejs'

const FEATURE_KEYS = [
  'meal_management',
  'attendance_tracking',
  'inventory_management',
  'pre_meal_requests',
  'custom_reports',
  'billing',
  'branch_management',
  'settings_module',
  'channel_attendance'
]

export async function PATCH(request: NextRequest) {
  // Lazy-initialize the admin client inside the request handler.
  const supabaseAdmin = createAdminClient()
  
  const superUser = await getSuperAdminUser()
  if (!superUser) {
    return NextResponse.json(
      { error: 'Unauthorized. Super admin access required.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { tenant_id, feature_key, is_enabled } = body

    // Validate body
    if (!tenant_id || typeof tenant_id !== 'string') {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
    }
    if (!feature_key || !FEATURE_KEYS.includes(feature_key)) {
      return NextResponse.json({ error: 'Invalid feature_key' }, { status: 400 })
    }
    if (typeof is_enabled !== 'boolean') {
      return NextResponse.json({ error: 'is_enabled must be a boolean' }, { status: 400 })
    }

    // Super admin can toggle ANY feature regardless of the tenant's plan.
    const { error } = await supabaseAdmin
      .from('tenant_features')
      .upsert({
        tenant_id,
        feature_key,
        is_enabled,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,feature_key'
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      tenant_id,
      feature_key,
      is_enabled
    })
  } catch (error: any) {
    console.error('[SUPER ADMIN FEATURES PATCH ERROR]', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
