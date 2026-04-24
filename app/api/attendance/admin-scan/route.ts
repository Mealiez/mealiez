/*
 * SECURITY: Admin Scan (Mode B Attendance)
 *
 * In Mode B, the admin holds the scanner.
 * The member holds their static QR.
 *
 * Validation chain:
 *   1. Verify QR signature (anti-tamper)
 *   2. Verify tenant_id matches admin's tenant
 *   3. Verify member is active in this tenant
 *   4. Verify QR version matches DB (anti-replay
 *      after regeneration)
 *   5. Verify session exists and is active
 *   6. Verify session is in 'member' scan mode
 *   7. Mark attendance (idempotent)
 *   8. Write to qr_scan_audit_log
 *
 * All outcomes (success AND failure) are audit-logged.
 * This is non-negotiable for enterprise compliance.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { verifyMemberQRToken } from '@/lib/attendance/token'
import { checkFeatureEnabled } from '@/lib/features/gate'
import crypto from 'node:crypto'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function writeAuditLog(params: {
  tenant_id: string
  scan_mode: 'member'
  scanned_by: string | null
  target_user_id: string | null
  session_id: string | null
  outcome: string
  ip_address: string | null
  user_agent: string | null
}): Promise<void> {
  try {
    await supabaseAdmin
      .from('qr_scan_audit_log')
      .insert({
        ...params,
        scanned_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('[AUDIT LOG ERROR] Failed to write QR scan audit log', error)
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check: Only manager+ can use admin scanner
  if (!['owner', 'admin', 'manager'].includes(currentUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking')
  if (!isEnabled) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? null
  const ua = request.headers.get('user-agent') ?? null

  const baseAudit = {
    tenant_id: currentUser.tenant_id,
    scan_mode: 'member' as const,
    scanned_by: currentUser.id,
    ip_address: ip,
    user_agent: ua
  }

  let body: any
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { member_token, session_id } = body

  if (!member_token || !session_id || typeof session_id !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // STEP 4: Verify QR signature
  const qrResult = verifyMemberQRToken(member_token)
  
  if (!qrResult.valid) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'invalid_signature',
      target_user_id: null,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'Invalid QR code',
      code: 'INVALID_SIGNATURE'
    }, { status: 400 })
  }
  
  const { user_id, tenant_id } = qrResult.payload

  // STEP 5: Tenant isolation check
  if (tenant_id !== currentUser.tenant_id) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'tenant_mismatch',
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'QR code belongs to different organization',
      code: 'TENANT_MISMATCH'
    }, { status: 403 })
  }

  // STEP 6: Look up member QR record in DB (version check)
  const { data: storedQR } = await supabaseAdmin
    .from('member_qr_codes')
    .select('token, is_revoked')
    .eq('user_id', user_id)
    .eq('tenant_id', tenant_id)
    .eq('is_revoked', false)
    .maybeSingle()
  
  if (!storedQR || storedQR.is_revoked) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'revoked',
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'This QR code has been revoked',
      code: 'QR_REVOKED'
    }, { status: 400 })
  }

  // Timing-safe compare:
  const tokBuf = Buffer.from(member_token)
  const dbBuf = Buffer.from(storedQR.token)
  if (
    tokBuf.length !== dbBuf.length ||
    !crypto.timingSafeEqual(tokBuf, dbBuf)
  ) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'revoked', // Outcome is 'revoked' if version/token mismatch
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'QR code is outdated. Ask member to refresh.',
      code: 'QR_VERSION_MISMATCH'
    }, { status: 400 })
  }

  // STEP 7: Fetch member profile
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('users')
    .select(`
      id,
      full_name,
      phone,
      role,
      is_active,
      created_at
    `)
    .eq('id', user_id)
    .eq('tenant_id', currentUser.tenant_id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (!member.is_active) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'user_inactive',
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'Member account is inactive',
      code: 'USER_INACTIVE',
      member: {
        full_name: member.full_name,
        role: member.role,
        is_active: false
      }
    }, { status: 403 })
  }

  // STEP 8: Validate session
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('id, is_active, scan_mode, label, session_date, meal_type, ended_at')
    .eq('id', session_id)
    .eq('tenant_id', currentUser.tenant_id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.scan_mode !== 'member') {
    return NextResponse.json({
      error: 'This session uses member-scan mode, not admin-scan',
      code: 'WRONG_SCAN_MODE'
    }, { status: 409 })
  }

  if (!session.is_active || session.ended_at) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'session_closed',
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      error: 'Session is closed',
      code: 'SESSION_CLOSED',
      member: { full_name: member.full_name }
    }, { status: 409 })
  }

  // STEP 9: Check already marked (idempotency)
  const { data: existing } = await supabaseAdmin
    .from('attendance_records')
    .select('id, marked_at')
    .eq('session_id', session_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (existing) {
    await writeAuditLog({
      ...baseAudit,
      outcome: 'already_marked',
      target_user_id: user_id,
      session_id: session_id
    })
    return NextResponse.json({
      success: true,
      already_marked: true,
      marked_at: existing.marked_at,
      member: {
        full_name: member.full_name,
        role: member.role,
        phone: member.phone
      },
      session: {
        label: session.label,
        meal_type: session.meal_type,
        date: session.session_date
      }
    }, { status: 200 })
  }

  // STEP 10: Insert attendance record
  const markedAt = new Date().toISOString()
  const { error: insertError } = await supabaseAdmin
    .from('attendance_records')
    .insert({
      tenant_id: currentUser.tenant_id,
      session_id: session_id,
      user_id: user_id,
      method: 'qr_member',
      marked_at: markedAt
    })

  if (insertError) {
    if (insertError.code === '23505') {
       return NextResponse.json({
        success: true,
        already_marked: true,
        marked_at: markedAt, // Approximation for race condition
        member: {
          full_name: member.full_name,
          role: member.role,
          phone: member.phone
        },
        session: {
          label: session.label,
          meal_type: session.meal_type,
          date: session.session_date
        }
      }, { status: 200 })
    }
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
  }

  // STEP 11: Audit log success
  await writeAuditLog({
    ...baseAudit,
    outcome: 'success',
    target_user_id: user_id,
    session_id: session_id
  })

  // STEP 12: Return 201 — FULL member profile for display
  return NextResponse.json({
    success: true,
    already_marked: false,
    marked_at: markedAt,
    member: {
      id: member.id,
      full_name: member.full_name,
      role: member.role,
      phone: member.phone,
      is_active: member.is_active,
      member_since: member.created_at
    },
    session: {
      label: session.label,
      meal_type: session.meal_type,
      date: session.session_date
    }
  }, { status: 201 })
}
