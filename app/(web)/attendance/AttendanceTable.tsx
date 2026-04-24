"use client";

import { useState } from 'react';
import Link from 'next/link';
import CreateSessionModal from './CreateSessionModal';
import MyQRModal from '@/components/web/MyQRModal';
import MemberScannerModal from '@/components/web/MemberScannerModal';

/*
 * CLIENT COMPONENT: Attendance List Table
 * Displays sessions and allows managers to close them.
 */

export type AttendanceSession = {
  id: string;
  session_date: string;
  meal_type: string;
  label: string;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  scan_mode?: 'session' | 'member';
};

interface AttendanceTableProps {
  initialSessions: AttendanceSession[];
  canManage: boolean;
}

export default function AttendanceTable({ initialSessions, canManage }: AttendanceTableProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>(initialSessions);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const closeSession = async (id: string) => {
    if (!confirm('Are you sure you want to close this session? QR codes will stop working.')) return;
    
    setIsLoading(id);
    try {
      const res = await fetch(`/api/attendance/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      
      if (res.ok) {
        setSessions(prev =>
          prev.map(s => (s.id === id ? { ...s, is_active: false, ended_at: new Date().toISOString() } : s))
        );
      }
    } catch (err) {
      console.error('[CLOSE_SESSION_ERROR]', err);
    } finally {
      setIsLoading(null);
    }
  };

  const handleSessionCreated = (session: AttendanceSession) => {
    setSessions(prev => [session, ...prev]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
           {!canManage && <MyQRModal />}
        </div>
        <div className="flex gap-3">
          {canManage && (
            <CreateSessionModal onSessionCreated={handleSessionCreated} />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Label</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Meal Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Started</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No attendance sessions found for today.
                  </td>
                </tr>
              ) : (
                sessions.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{session.label}</td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-gray-600">{session.meal_type}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{session.session_date}</td>
                    <td className="px-6 py-4 text-center">
                      {session.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-4">
                      {session.is_active && canManage && (
                        <Link
                          href={`/attendance/${session.id}`}
                          className="text-blue-600 hover:text-blue-800 font-bold text-sm"
                        >
                          View QR
                        </Link>
                      )}
                      {session.is_active && canManage && (
                        <button
                          onClick={() => closeSession(session.id)}
                          disabled={isLoading === session.id}
                          className="text-red-600 hover:text-red-800 font-bold text-sm disabled:opacity-50"
                        >
                          {isLoading === session.id ? 'Closing...' : 'Close'}
                        </button>
                      )}
                      
                      {session.is_active && !canManage && (
                        <MemberScannerModal />
                      )}

                      {session.is_active && !canManage && (
                        <MyQRModal trigger={
                          <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm">
                            My QR
                          </button>
                        } />
                      )}

                      <Link
                        href={`/attendance/${session.id}`}
                        className="text-gray-600 hover:text-gray-900 font-bold text-sm"
                      >
                        Report
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
