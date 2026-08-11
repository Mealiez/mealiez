/*
 * SECURITY: Channel Management API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/session'
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate'

export const runtime = 'nodejs'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const isFeatureEnabled = await checkFeatureEnabled(user.tenant_id, 'channel_attendance')
    if (!isFeatureEnabled) return featureDisabledResponse()

    const body = await request.json()
    const { name, code, project_name, description, geometry_type, latitude, longitude, radius, geometry, is_active } = body

    const supabaseAdmin = createAdminClient()
    
    let geomValue = null;
    if (geometry_type === 'POINT_RADIUS' && latitude && longitude) {
        geomValue = `POINT(${longitude} ${latitude})`;
    } else if (geometry_type === 'POLYGON' && geometry) {
        geomValue = geometry;
    }

    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .update({
        name,
        code,
        project_name,
        description,
        geometry_type,
        latitude,
        longitude,
        radius,
        is_active,
        geometry: geomValue
      })
      .eq('id', params.id)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Channel code already exists' }, { status: 409 })
      throw error
    }

    return NextResponse.json({ data: channel })
  } catch (err: any) {
    console.error('[CHANNEL PUT ERROR]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from('channels')
      .delete()
      .eq('id', params.id)
      .eq('tenant_id', user.tenant_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[CHANNEL DELETE ERROR]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
