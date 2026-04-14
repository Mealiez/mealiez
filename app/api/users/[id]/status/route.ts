import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth/session'
import { UpdateStatusSchema } from '@/lib/validations/users'

// Create a Supabase admin client using service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // STEP 1: Get current user
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // STEP 2: requireOwnerOrAdmin
    if (!['owner', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // STEP 3: Validate body
    const body = await request.json()
    const result = UpdateStatusSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // STEP 4: Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, role, tenant_id, is_active')
      .eq('id', params.id)
      .single()

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // STEP 5: Verify same tenant
    if (targetUser.tenant_id !== currentUser.tenant_id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // STEP 6: Block owner deactivation
    if (targetUser.role === 'owner') {
      return NextResponse.json({ error: 'Cannot deactivate the owner' }, { status: 403 })
    }

    // STEP 7: Block self-deactivation
    if (targetUser.auth_id === currentUser.auth_id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 403 })
    }

    // STEP 8: UPDATE is_active
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_active: result.data.is_active })
      .eq('id', params.id)
      .eq('tenant_id', currentUser.tenant_id)

    if (updateError) {
      console.error('[STATUS UPDATE ERROR]', updateError)
      return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 })
    }

    // STEP 9: Return 200
    return NextResponse.json({ success: true, is_active: result.data.is_active })

  } catch (err) {
    console.error('[PATCH STATUS CRITICAL ERROR]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
