/*
 * SECURITY: Member QR Code API
 *
 * Member QR tokens are PERMANENT identity tokens.
 * They embed: user_id + tenant_id + version + signature.
 *
 * Threat model:
 *   - If a member screenshots their QR and shares it,
 *     an attacker could mark attendance.
 *   - Mitigation: admin regenerates QR (increments version,
 *     old token immediately invalid at DB level).
 *
 * tenant_id: ALWAYS from JWT app_metadata.
 * token:     ALWAYS server-generated via generateMemberQRToken().
 * version:   ALWAYS sourced from DB record (not client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { generateMemberQRToken } from '@/lib/attendance/token'
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking')
  if (!isEnabled) {
    return featureDisabledResponse()
  }

  const supabase = await createClient()
  const { data: qrRecord } = await supabase
    .from('member_qr_codes')
    .select('id, token, issued_at, is_revoked')
    .eq('tenant_id', currentUser.tenant_id)
    .eq('user_id', currentUser.id)
    .eq('is_revoked', false)
    .maybeSingle()

  if (qrRecord) {
    return NextResponse.json({
      token: qrRecord.token,
      issued_at: qrRecord.issued_at,
      user_id: currentUser.id,
      full_name: currentUser.full_name
    })
  }

  // Auto-generate QR for first-time fetch
  const version = 1
  const generatedToken = generateMemberQRToken(
    currentUser.id,
    currentUser.tenant_id,
    version
  )

  const { error: rpcError } = await supabaseAdmin.rpc('generate_member_qr', {
    p_user_id: currentUser.id,
    p_tenant_id: currentUser.tenant_id,
    p_issued_by: currentUser.id,
    p_token: generatedToken
  })

  if (rpcError) {
    console.error('[MEMBER QR ERROR] Failed to auto-generate QR', rpcError)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }

  // Fetch the newly created record to get the correct issued_at
  const { data: newRecord } = await supabase
    .from('member_qr_codes')
    .select('issued_at')
    .eq('token', generatedToken)
    .single()

  return NextResponse.json({
    token: generatedToken,
    issued_at: newRecord?.issued_at || new Date().toISOString(),
    user_id: currentUser.id,
    full_name: currentUser.full_name
  }, { status: 201 })
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking')
  if (!isEnabled) {
    return featureDisabledResponse()
  }

  if (!['owner', 'admin', 'manager'].includes(currentUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetUserId = body.user_id
  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, full_name, is_active, tenant_id')
    .eq('id', targetUserId)
    .eq('tenant_id', currentUser.tenant_id)
    .maybeSingle()

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!targetUser.is_active) {
    return NextResponse.json({ error: 'Cannot generate QR for inactive user' }, { status: 409 })
  }

  // Determine version (increment)
  const { count } = await supabaseAdmin
    .from('member_qr_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId)

  const version = (count ?? 0) + 1

  const token = generateMemberQRToken(
    targetUserId,
    currentUser.tenant_id,
    version
  )

  const { error: rpcError } = await supabaseAdmin.rpc('generate_member_qr', {
    p_user_id: targetUserId,
    p_tenant_id: currentUser.tenant_id,
    p_issued_by: currentUser.id,
    p_token: token
  })

  if (rpcError) {
    console.error('[MEMBER QR ERROR] Failed to generate QR', rpcError)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    token: token,
    user_id: targetUserId,
    full_name: targetUser.full_name,
    version: version,
    generated_by: currentUser.full_name
  }, { status: 201 })
}
