/*
 * SECURITY: User Management API
 *
 * tenant_id is ALWAYS sourced from JWT app_metadata.
 * It is NEVER read from request body or query params.
 *
 * ROLE HIERARCHY (high to low):
 *   owner > admin > manager > member
 *
 * Invite rules:
 *   - Only owner or admin can invite users
 *   - Inviter cannot assign a role >= their own role
 *     (admin cannot create another admin or owner)
 *     (owner CAN create admin)
 *
 * owner role is NEVER assignable via invite.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { InviteUserSchema } from '@/lib/validations/users'
import crypto from 'crypto'

// Create a Supabase admin client using service role key
const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const ROLE_RANK: Record<string, number> = {
  owner:   4,
  admin:   3,
  manager: 2,
  member:  1
}

function canAssignRole(
  inviterRole: string,
  targetRole: string
): boolean {
  return ROLE_RANK[inviterRole] > ROLE_RANK[targetRole]
}

function generateTempPassword(): string {
  return crypto.randomUUID().replace(/-/g, '') + 'Aa1!'
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page  = parseInt(searchParams.get('page')  ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const clampedLimit = Math.min(Math.max(limit, 1), 100)
    const offset = (page - 1) * clampedLimit

    const supabase = await createSupabaseServerClient()

    const { data, error, count } = await supabase
      .from('users')
      .select(`
        id,
        auth_id,
        full_name,
        phone,
        role,
        is_active,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + clampedLimit - 1)

    if (error) {
      console.error('[GET USERS ERROR]', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit: clampedLimit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / clampedLimit)
      }
    })
  } catch (err) {
    console.error('[GET USERS CRITICAL ERROR]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['owner', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can invite users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = InviteUserSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, full_name, phone, role } = result.data

    if (!canAssignRole(currentUser.role, role)) {
      return NextResponse.json(
        { error: `A ${currentUser.role} cannot assign the ${role} role` },
        { status: 403 }
      )
    }

    // STEP 5: Check email not already in this tenant via RPC
    const { data: conflict, error: rpcError } = await supabaseAdmin
      .rpc('check_user_email_in_tenant', {
        p_email: email,
        p_tenant_id: currentUser.tenant_id
      })

    if (rpcError) {
      console.error('[RPC ERROR]', rpcError)
      return NextResponse.json({ error: 'Failed to verify user availability' }, { status: 500 })
    }

    if (conflict) {
      return NextResponse.json({ error: 'User already in tenant' }, { status: 409 })
    }

    // STEP 6: Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: generateTempPassword()
    })

    if (authError) {
      console.error('[AUTH CREATE ERROR]', authError)
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    const auth_id = authData.user.id

    // STEP 7: Insert into public.users
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        tenant_id: currentUser.tenant_id,
        auth_id:   auth_id,
        full_name: full_name,
        phone:     phone ?? null,
        role:      role
      })
      .select()
      .single()

    if (insertError) {
      console.error('[PROFILE INSERT ERROR]', insertError)
      await supabaseAdmin.auth.admin.deleteUser(auth_id)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    // STEP 8: Set app_metadata
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      auth_id,
      {
        app_metadata: {
          tenant_id: currentUser.tenant_id,
          role:      role
        }
      }
    )

    if (metadataError) {
      console.error('[METADATA SYNC FAILED]', metadataError)
      // Non-fatal, return success anyway but metadata will need repair
    }

    // STEP 9: Send password reset email
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email
    })

    // STEP 10: Return 201
    return NextResponse.json({
      success: true,
      user: {
        id:        newUser.id,
        full_name: newUser.full_name,
        role:      newUser.role,
        is_active: newUser.is_active
      }
    }, { status: 201 })

  } catch (err) {
    console.error('[POST USER CRITICAL ERROR]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
