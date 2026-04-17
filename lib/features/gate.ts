/*
 * SERVER-ONLY: Feature flag gate.
 * Import only in API routes and server components.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Checks if a specific feature is enabled for a given tenant.
 * Uses a service role client to bypass RLS for administrative feature checks.
 */
export async function checkFeatureEnabled(
  tenantId: string,
  featureKey: string
): Promise<boolean> {
  // Validate input
  if (!tenantId || !featureKey) {
    console.error('[FEATURE GATE] Missing tenantId or featureKey');
    return false;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { 
      auth: { 
        autoRefreshToken: false,
        persistSession: false 
      } 
    }
  );

  const { data, error } = await supabaseAdmin
    .rpc('is_feature_enabled', {
      p_tenant_id: tenantId,
      p_feature: featureKey
    });

  if (error) {
    console.error('[FEATURE GATE ERROR]', {
      tenantId,
      featureKey,
      error: error.message,
      code: error.code
    });
    return false;
    // Fail closed — if we cannot check,
    // deny access rather than grant it
  }

  const isEnabled = data === true;
  
  if (!isEnabled) {
    console.warn(`[FEATURE GATE] Feature '${featureKey}' is DISABLED for tenant '${tenantId}'`);
  }

  return isEnabled;
}

/**
 * Standard error response for disabled features.
 */
export function featureDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'This feature is not enabled for your plan.',
      code: 'FEATURE_DISABLED'
    },
    { status: 403 }
  );
}
