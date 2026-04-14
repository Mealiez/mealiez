/*
 * SECURITY: Tenant Onboarding Route
 * 
 * tenant_id is NEVER accepted from client input.
 * tenant_id is generated server-side in SQL function.
 * tenant_id is stored in app_metadata (server-only).
 * tenant_id is immutable after creation.
 * 
 * FAILURE MODES:
 * - Auth creation fails     → return 500, nothing to clean
 * - SQL function fails      → return 500, delete auth user
 * - Metadata inject fails   → CRITICAL: rollback everything
 * - Metadata verify fails   → CRITICAL: rollback everything
 * 
 * A user must NEVER exist without tenant_id in app_metadata.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

/**
 * Rollback helper for onboarding failures
 */
async function rollbackOnboarding(
  auth_id: string, 
  reason: string
): Promise<void> {
  console.error(`[ONBOARDING ROLLBACK] Reason: ${reason}`)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_id)
  if (error) {
    console.error('[ROLLBACK FAILED] Auth user orphaned:', auth_id, error)
  }
}

const RegisterSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8).max(72),
  full_name: z.string().min(2).max(100).trim(),
  org_name:  z.string().min(2).max(100).trim()
})

export async function POST(request: NextRequest) {
  try {
    // STEP 1 — Parse and validate body
    const body = await request.json()
    const result = RegisterSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, full_name, org_name } = result.data

    // STEP 2 — Check email and create auth user
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      console.error('[AUTH ERROR]', authError)
      return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
    }

    const auth_id = userData.user.id

    // STEP 3 — Call onboarding function
    const { data: onboardingResult, error: dbError } = await supabaseAdmin.rpc('onboard_new_tenant', {
      p_auth_id:   auth_id,
      p_full_name: full_name,
      p_org_name:  org_name,
      p_plan:      'free'
    })

    if (dbError) {
      console.error('[DB ERROR]', dbError)
      // Compensating action: Delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(auth_id)
      return NextResponse.json({ error: 'Tenant setup failed' }, { status: 500 })
    }

    // STEP 4 — Inject tenant_id into JWT app_metadata
    // CRITICAL: failure here = zombie account
    // Must rollback entirely if this fails
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
      app_metadata: {
        tenant_id: onboardingResult.tenant_id,
        role:      onboardingResult.role
      }
    })

    if (metadataError) {
      console.error('[METADATA FAILED]', metadataError)
      await rollbackOnboarding(auth_id, 'app_metadata injection failed')
      return NextResponse.json(
        { error: 'Account setup failed. Please try again.' },
        { status: 500 }
      )
    }

    // STEP 4b — Verify metadata was actually written
    const { data: verifyUser, error: verifyError } = await supabaseAdmin.auth.admin.getUserById(auth_id)
    
    const writtenTenantId = verifyUser?.user?.app_metadata?.tenant_id

    if (verifyError || !writtenTenantId) {
      console.error('[METADATA VERIFY FAILED]', { verifyError, writtenTenantId })
      await rollbackOnboarding(auth_id, 'app_metadata verification failed')
      return NextResponse.json(
        { error: 'Account setup failed. Please try again.' },
        { status: 500 }
      )
    }

    // STEP 6 — Return success
    return NextResponse.json(
      {
        success: true,
        message: 'Account created. Please sign in.',
        tenant_id: onboardingResult.tenant_id,
        slug: onboardingResult.slug
      },
      { status: 201 }
    )

  } catch (err) {
    console.error('[CRITICAL REGISTRATION ERROR]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
