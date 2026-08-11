import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { MarkAttendanceSchema } from '@/lib/validations/attendance';
import { verifyQRToken } from '@/lib/attendance/token';
import { checkFeatureEnabled } from '@/lib/features/gate';

/**
 * PRODUCTION-GRADE API ROUTE
 * Enforcing Node.js runtime for stable QR token verification and session handling.
 */
export const runtime = 'nodejs'

/*
 * CRITICAL SECURITY: Mark attendance endpoint.
 * This endpoint is called by members scanning a QR.
 */

function getTokenError(reason: string): string {
  switch (reason) {
    case 'Token expired':
      return 'This QR code has expired. Ask your admin to refresh it.';
    case 'Invalid signature':
      return 'Invalid QR code. Please scan the correct code.';
    default:
      return 'Invalid QR code. Please try again.';
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id, marked_at, method, user_id,
        users ( full_name, avatar_url )
      `)
      .eq('session_id', sessionId)
      .eq('tenant_id', currentUser.tenant_id)
      .order('marked_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[MARK_ATTENDANCE_GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ROLE-BASED AUTH: Only members can mark their own attendance via QR
    if (currentUser.role !== 'member') {
      return NextResponse.json(
        { error: 'Managers and Admins cannot mark their own attendance via QR scan.', code: 'STAFF_SELF_MARK_FORBIDDEN' },
        { status: 403 }
      );
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'attendance_tracking');
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Attendance tracking is not enabled.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = MarkAttendanceSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // STEP 4: Verify QR token
    const result = verifyQRToken(validated.data.session_token);

    if (!result.valid) {
      return NextResponse.json(
        { error: getTokenError(result.reason), code: result.reason },
        { status: 400 }
      );
    }

    // STEP 5: Cross-validate tenant
    if (result.payload.tenant_id !== currentUser.tenant_id) {
      return NextResponse.json(
        { error: 'This QR code belongs to a different organization.', code: 'TENANT_MISMATCH' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, is_active, label, branch_id, attendance_mode, project_name')
      .eq('id', result.payload.session_id)
      .eq('tenant_id', currentUser.tenant_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.is_active) {
      return NextResponse.json(
        { error: 'This attendance session is closed.', code: 'SESSION_CLOSED' },
        { status: 409 }
      );
    }

    let verification_status = 'VERIFIED';
    let detected_channel_id = null;
    let assigned_channel_id = null;
    let location_source = null;

    if (session.attendance_mode === 'CHANNEL') {
      const { latitude, longitude, accuracy, location_timestamp } = validated.data;
      
      if (!latitude || !longitude) {
        return NextResponse.json(
          { error: 'Location coordinates required for channel-based attendance.', code: 'LOCATION_UNAVAILABLE' },
          { status: 400 }
        );
      }

      if (accuracy && accuracy > 150) {
        return NextResponse.json(
          { error: 'Your location accuracy is too low. Please move to an open area and try again.', code: 'LOW_ACCURACY' },
          { status: 400 }
        );
      }

      // Fetch user's assigned channel
      const { data: userRecord } = await supabase
        .from('users')
        .select('channel_id')
        .eq('id', currentUser.id)
        .single();
      assigned_channel_id = userRecord?.channel_id || null;

      // Detect channel using RPC
      const { data: detectedChannelId, error: detectError } = await supabase.rpc('detect_channel', {
        p_tenant_id: currentUser.tenant_id,
        p_project_name: session.project_name || null,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy || 0
      });

      if (detectError) {
        console.error('Geofence error', detectError);
      } else {
        detected_channel_id = detectedChannelId;
      }

      location_source = 'GPS_GEOFENCE';

      if (!detected_channel_id) {
        return NextResponse.json(
          { error: 'No active work channel was detected at your current location.', code: 'LOCATION_UNAVAILABLE' },
          { status: 403 }
        );
      }

      if (assigned_channel_id !== detected_channel_id) {
        verification_status = 'CHANNEL_MISMATCH';
      }
    } else {
      // BRANCH VERIFICATION: Ensure user belongs to the session's branch
      if (session.branch_id && session.branch_id !== (currentUser.branch_id || null)) {
        return NextResponse.json(
          { 
            error: 'Branch Mismatch: You are not registered with this branch.', 
            code: 'BRANCH_MISMATCH' 
          },
          { status: 403 }
        );
      }
    }

    // STEP 7: Insert attendance record (idempotent)
    const insertPayload: any = {
        tenant_id: currentUser.tenant_id,
        session_id: result.payload.session_id,
        user_id: currentUser.id,
        method: 'qr',
        attendance_mode: session.attendance_mode || 'BRANCH',
    };

    if (session.attendance_mode === 'CHANNEL') {
        insertPayload.latitude = validated.data.latitude;
        insertPayload.longitude = validated.data.longitude;
        insertPayload.gps_accuracy = validated.data.accuracy;
        insertPayload.location_timestamp = validated.data.location_timestamp ? new Date(validated.data.location_timestamp).toISOString() : new Date().toISOString();
        insertPayload.assigned_channel_id = assigned_channel_id;
        insertPayload.detected_channel_id = detected_channel_id;
        insertPayload.location_source = location_source;
        insertPayload.verification_status = verification_status;
    }

    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .insert(insertPayload)
      .select()
      .single();

    if (recordError) {
      // Handle unique constraint violation (idempotency)
      if (recordError.code === '23505') {
        return NextResponse.json({
          success: true,
          already_marked: true,
          message: 'You have already marked attendance for this session.'
        }, { status: 200 });
      }
      throw recordError;
    }

    if (session.attendance_mode === 'CHANNEL' && verification_status === 'CHANNEL_MISMATCH') {
      return NextResponse.json({
        status: 'CHANNEL_MISMATCH',
        assigned_channel_id,
        detected_channel_id
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      already_marked: false,
      message: `Attendance marked for ${session.label}`,
      marked_at: record.marked_at,
      session: {
        label: session.label,
        meal_type: result.payload.meal_type
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('[MARK_ATTENDANCE_POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
