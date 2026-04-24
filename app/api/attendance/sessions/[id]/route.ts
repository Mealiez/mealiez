import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { UpdateSessionSchema } from '@/lib/validations/attendance';
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate';
import { generateQRToken } from '@/lib/attendance/token';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking');
    if (!isEnabled) return featureDisabledResponse();

    const supabase = await createClient();

    // STEP 3: Fetch session with attendance count
    const { data: summary, error: rpcError } = await supabase
      .rpc('get_session_attendance_summary', {
        p_session_id: params.id
      });

    if (rpcError || !summary || summary.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch session directly to get is_active and other details for token generation
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, is_active, meal_type, session_date, tenant_id')
      .eq('id', params.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const qr_token = session.is_active
      ? generateQRToken(
          session.id,
          session.tenant_id,
          session.meal_type,
          session.session_date.toString()
        )
      : null;

    return NextResponse.json({
      session: summary[0],
      qr_token,
      is_active: session.is_active
    });
  } catch (error: any) {
    console.error('[SESSION_DETAIL_GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validated = UpdateSessionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();
    const updateData: Record<string, any> = {};

    if (validated.data.label !== undefined) {
      updateData.label = validated.data.label;
    }

    if (validated.data.is_active !== undefined) {
      updateData.is_active = validated.data.is_active;
      if (!validated.data.is_active) {
        updateData.ended_at = new Date().toISOString();
      } else {
        updateData.ended_at = null;
      }
    }

    if (validated.data.scan_mode !== undefined) {
      updateData.scan_mode = validated.data.scan_mode;
    }

    const { error: updateError } = await supabase
      .from('attendance_sessions')
      .update(updateData)
      .eq('id', params.id)
      .eq('tenant_id', currentUser.tenant_id); // Security: ensure tenant match

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[SESSION_PATCH]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking');
    if (!isEnabled) return featureDisabledResponse();

    if (!['owner', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    // Only allow delete if session has 0 records
    const { count, error: countError } = await supabase
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', params.id);

    if (countError) throw countError;

    if (count && count > 0) {
      return NextResponse.json({
        error: 'Cannot delete session with records.',
        hint: 'Close the session instead.'
      }, { status: 409 });
    }

    const { error: deleteError } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('id', params.id)
      .eq('tenant_id', currentUser.tenant_id);

    if (deleteError) throw deleteError;

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('[SESSION_DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
