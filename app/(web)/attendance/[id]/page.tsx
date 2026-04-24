import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { generateQRToken } from '@/lib/attendance/token';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import QRDisplay from './QRDisplay';
import AttendanceLog from './AttendanceLog';

/*
 * SERVER COMPONENT: Attendance Session Details
 * Displays session info, QR code for scanning, and live log.
 */

export default async function SessionPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Fetch session data
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!session) notFound();

  // Fetch initial attendance summary
  const { data: summary } = await supabase
    .rpc('get_session_attendance_summary', {
      p_session_id: params.id
    });

  // Generate initial QR token if session is active
  const qrToken = session.is_active
    ? generateQRToken(
        session.id,
        session.tenant_id,
        session.meal_type,
        session.session_date.toString()
      )
    : null;

  const canManage = ['owner', 'admin', 'manager'].includes(user.role);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
        <Link href="/attendance" className="hover:text-gray-900 transition-colors">Attendance</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900">{session.label}</span>
      </nav>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{session.label}</h1>
          <div className="flex items-center space-x-4 mt-2 text-sm font-semibold text-gray-500">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {session.session_date}
            </span>
            <span className="flex items-center capitalize">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {session.meal_type}
            </span>
            {session.is_active ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 ring-1 ring-inset ring-green-600/20">
                Active Session
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-600/20">
                Closed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: QR Interaction */}
        <div className="bg-white p-10 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
          {canManage ? (
            <QRDisplay
              session={session}
              initialToken={qrToken}
              isActive={session.is_active}
              mealType={session.meal_type}
              sessionDate={session.session_date.toString()}
              tenantId={session.tenant_id}
            />
          ) : (
            <div className="w-full max-w-sm flex flex-col items-center space-y-8">
               {session.is_active ? (
                 <>
                   {session.scan_mode === 'member' ? (
                      <div className="text-center space-y-6">
                         <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                           <span className="text-2xl">🪪</span>
                         </div>
                         <h2 className="text-xl font-black text-gray-900">Member Scan Mode</h2>
                         <p className="text-sm text-gray-500">The admin is scanning badges. Please show your QR code to the admin.</p>
                         <MyQRModal />
                      </div>
                   ) : (
                      <div className="text-center space-y-6">
                         <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                           <span className="text-2xl">📷</span>
                         </div>
                         <h2 className="text-xl font-black text-gray-900">Session QR Mode</h2>
                         <p className="text-sm text-gray-500">Scan the session QR code shown on the screen using your camera.</p>
                         <MemberScannerModal />
                      </div>
                   )}
                 </>
               ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                       </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Session Closed</h2>
                    <p className="text-sm text-gray-500">This attendance session is no longer active.</p>
                  </div>
               )}
            </div>
          )}
        </div>

        {/* Right: Live Attendance Log */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm min-h-[500px] h-full flex flex-col">
          <AttendanceLog
            sessionId={session.id}
            initialData={summary ? summary[0] : null}
            isActive={session.is_active}
          />
        </div>
      </div>
    </div>
  );
}
