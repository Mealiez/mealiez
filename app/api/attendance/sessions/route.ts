import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CreateSessionSchema } from '@/lib/validations/attendance';
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate';
import { generateQRToken } from '@/lib/attendance/token';

/*
 * SECURITY: Attendance Sessions API
 * tenant_id sourced from JWT only.
 * Feature flag: attendance_tracking must be enabled.
 */

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking');
    if (!isEnabled) return featureDisabledResponse();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createClient();
    let query = supabase
      .from('attendance_sessions')
      .select(`
        id,
        session_date,
        meal_type,
        label,
        is_active,
        started_at,
        ended_at,
        started_by (id, full_name)
      `, { count: 'exact' })
      .eq('tenant_id', currentUser.tenant_id)
      .order('session_date', { ascending: false })
      .order('started_at', { ascending: false })
      .range(from, to);

    if (date) query = query.eq('session_date', date);
    if (status === 'active') query = query.eq('is_active', true);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('[SESSIONS_GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking');
    if (!isEnabled) return featureDisabledResponse();

    if (!['owner', 'admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = CreateSessionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();

    // Check no active session for same date + meal_type in this tenant
    const { data: conflict } = await supabase
      .from('attendance_sessions')
      .select('id, label')
      .eq('tenant_id', currentUser.tenant_id)
      .eq('session_date', validated.data.session_date)
      .eq('meal_type', validated.data.meal_type)
      .eq('is_active', true)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({
        error: `An active ${validated.data.meal_type} session already exists for ${validated.data.session_date}`,
        existing_id: conflict.id,
      }, { status: 409 });
    }

    const { data: session, error: insertError } = await supabase
      .from('attendance_sessions')
      .insert({
        tenant_id: currentUser.tenant_id,
        meal_plan_item_id: validated.data.meal_plan_item_id ?? null,
        session_date: validated.data.session_date,
        meal_type: validated.data.meal_type,
        label: validated.data.label,
        scan_mode: validated.data.scan_mode,
        is_active: true,
        started_by: currentUser.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const qr_token = generateQRToken(
      session.id,
      currentUser.tenant_id,
      session.meal_type,
      session.session_date
    );

    return NextResponse.json({
      success: true,
      session,
      qr_token,
      qr_url: `/m/attendance/scan`,
      expires_in: 900, // 15 minutes
    }, { status: 201 });
  } catch (error: any) {
    console.error('[SESSIONS_POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
