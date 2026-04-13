/*
 * SECURITY: tenant_id is assigned ONLY in this route.
 * It is NEVER accepted from client input.
 * It is stored in app_metadata (server-controlled).
 * It is immutable after creation.
 * Do NOT add any endpoint that allows tenant_id updates.
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

    // STEP 4 — Inject tenant_id and role into auth metadata
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
      app_metadata: {
        tenant_id: onboardingResult.tenant_id,
        role:      onboardingResult.role
      }
    })

    if (metadataError) {
      console.warn('[METADATA WARNING]', metadataError)
      // Non-fatal, return success anyway
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
