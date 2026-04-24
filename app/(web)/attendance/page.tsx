import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import AttendanceTable from './AttendanceTable';

/*
 * SERVER COMPONENT: Attendance Dashboard
 * Fetches today's sessions and checks user roles.
 */

export default async function AttendancePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  // Fetch today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select(`
      id, session_date, meal_type, label,
      is_active, started_at, ended_at, scan_mode
    `)
    .eq('session_date', today)
    .order('started_at', { ascending: false });

  const canManage = ['owner', 'admin', 'manager'].includes(user.role);

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-gray-500 font-medium">{formattedDate}</p>
        </div>
      </div>

      <AttendanceTable initialSessions={sessions || []} canManage={canManage} />
    </div>
  );
}
