/*
 * SECURITY: Channel Management API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/session'
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate'

export const runtime = 'nodejs'

/**
 * GET /api/channels
 * Lists all active channels for the tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = (page - 1) * limit

    const supabaseAdmin = createAdminClient()
    const { data, error, count } = await supabaseAdmin
      .from('channels')
      .select('*', { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ data, count })
  } catch (err: any) {
    console.error('[CHANNELS GET ERROR]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/channels
 * Creates a new channel. Enforces plan limits.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Check feature flag
    const isFeatureEnabled = await checkFeatureEnabled(user.tenant_id, 'channel_attendance')
    if (!isFeatureEnabled) {
      return featureDisabledResponse()
    }

    // 2. Check Role (Admin only)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create channels' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, project_name, description, geometry_type, latitude, longitude, radius, geometry } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 3. Plan Limit Validation
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('plan')
      .eq('id', user.tenant_id)
      .single()

    const { count } = await supabaseAdmin
      .from('channels')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', user.tenant_id)

    const channelLimit = tenant?.plan === 'enterprise' ? 999 : (tenant?.plan === 'pro' ? 20 : 0)
    
    if ((count || 0) >= channelLimit) {
      return NextResponse.json({ 
        error: `Plan limit reached. Your ${tenant?.plan} plan allows only ${channelLimit} channel(s).`,
        code: 'LIMIT_REACHED'
      }, { status: 403 })
    }

    let geomValue = null;
    if (geometry_type === 'POINT_RADIUS' && latitude && longitude) {
        geomValue = `POINT(${longitude} ${latitude})`;
    } else if (geometry_type === 'POLYGON' && geometry) {
        geomValue = geometry;
    }

    // 4. Insert
    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .insert({
        tenant_id: user.tenant_id,
        name,
        code,
        project_name,
        description,
        geometry_type,
        latitude,
        longitude,
        radius,
        geometry: geomValue
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Channel code already exists' }, { status: 409 })
      }
      throw error
    }

    // Re-fetch to get actual geometry if needed or return what we have
    return NextResponse.json({ data: channel }, { status: 201 })
  } catch (err: any) {
    console.error('[CHANNELS POST ERROR]', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
