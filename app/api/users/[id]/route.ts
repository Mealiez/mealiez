import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdminOrAbove } from '@/lib/auth/roles'

/**
 * Individual User Operations (GET Details, DELETE Permanent)
 */
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = createAdminClient()
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdminOrAbove(currentUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        tenants (name),
        branches (name)
      `)
      .eq('id', params.id)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Also get Auth details
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.auth_id)

    return NextResponse.json({
      data: {
        ...user,
        email: authUser?.user?.email,
        last_sign_in: authUser?.user?.last_sign_in_at
      }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = createAdminClient()
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only admins can delete, and cannot delete themselves
    if (!isAdminOrAbove(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Fetch user to get auth_id
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('auth_id, tenant_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Security check: must be same tenant
    if (user.tenant_id !== currentUser.tenant_id && (currentUser.role as string) !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Delete from Auth (cascades to public.users via schema but we do it explicitly to be safe)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.auth_id)
    if (deleteAuthError) {
      console.error('[DELETE AUTH ERROR]', deleteAuthError)
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 })
    }

    // Note: If ON DELETE CASCADE is set on auth_id, public.users record is already gone.
    // But we'll try to delete it just in case cascade is missing.
    await supabaseAdmin.from('users').delete().eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE USER CRASH]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = createAdminClient()
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only admins can update profile fields like branch/designation
    if (!isAdminOrAbove(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { branch_id, channel_id, designation_id, enrollment_no } = body

    const updateData: Record<string, any> = {}
    if (branch_id !== undefined) updateData.branch_id = branch_id
    if (channel_id !== undefined) updateData.channel_id = channel_id
    if (designation_id !== undefined) updateData.designation_id = designation_id
    if (enrollment_no !== undefined) updateData.enrollment_no = enrollment_no

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', params.id)
      .eq('tenant_id', currentUser.tenant_id) // Security: ensure same tenant
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update app_metadata if branch_id changed for token consistency
    if (branch_id !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(data.auth_id, {
        app_metadata: { branch_id }
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH USER CRITICAL ERROR]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
