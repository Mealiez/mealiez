"use client";

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import AdminScanner from './AdminScanner';

/*
 * CLIENT COMPONENT: QR Code Display
 * Generates QR from token and handles countdown/refresh.
 * Extended with Dual-Mode Toggle (Mode A vs Mode B).
 */

type ScanMode = 'session' | 'member';

interface QRDisplayProps {
  session: {
    id: string;
    scan_mode: 'session' | 'member';
  };
  initialToken: string | null;
  isActive: boolean;
  mealType: string;
  sessionDate: string;
  tenantId: string;
}

export default function QRDisplay({
  session,
  initialToken,
  isActive,
}: QRDisplayProps) {
  const [activeScanMode, setActiveScanMode] = useState<ScanMode>(
    session.scan_mode ?? 'session'
  );

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(initialToken);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [isExpired, setIsExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  // Sync state if prop changes (e.g. from server refresh)
  useEffect(() => {
    if (session.scan_mode) {
      setActiveScanMode(session.scan_mode);
    }
  }, [session.scan_mode]);

  // Handle mode switch with persistence
  const handleModeSwitch = async (newMode: ScanMode) => {
    if (newMode === activeScanMode) return;
    
    setIsUpdatingMode(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_mode: newMode })
      });

      if (res.ok) {
        setActiveScanMode(newMode);
      } else {
        console.error('[MODE_SWITCH_ERROR] Failed to update DB');
      }
    } catch (err) {
      console.error('[MODE_SWITCH_ERROR]', err);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  // Refresh token from server
  const refreshToken = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}`);
      const data = await res.json();
      if (data.qr_token) {
        setToken(data.qr_token);
        setTimeLeft(900);
        setIsExpired(false);
      }
    } catch (err) {
      console.error('[QR_REFRESH_ERROR]', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [session.id]);

  // Generate QR image when token changes
  useEffect(() => {
    if (!token) {
      setQrDataUrl(null);
      return;
    }
    
    QRCode.toDataURL(token, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    }).then(url => setQrDataUrl(url))
      .catch(err => console.error('[QR_GEN_ERROR]', err));
  }, [token]);

  // Countdown timer logic
  useEffect(() => {
    if (!isActive || isExpired || isRefreshing) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isExpired, isRefreshing]);

  // Auto-refresh when expired
  useEffect(() => {
    if (isExpired && isActive) {
      refreshToken();
    }
  }, [isExpired, isActive, refreshToken]);

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 w-full max-w-sm aspect-square text-center">
        <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 font-bold">Session is closed</p>
        <p className="text-gray-400 text-sm mt-1">QR code is disabled</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft > 300) return 'text-green-600';
    if (timeLeft > 60) return 'text-yellow-600';
    return 'text-red-600 animate-pulse';
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm">
      {/* Scan Mode Toggle */}
      <div className="flex items-center gap-1 p-1 
                      bg-gray-100 rounded-xl 
                      w-fit mb-6">
        
        <button
          onClick={() => handleModeSwitch('session')}
          disabled={isUpdatingMode}
          className={`px-4 py-2 rounded-lg text-sm 
                      font-medium transition-all ${
            activeScanMode === 'session'
              ? 'bg-white shadow text-indigo-700'
              : 'text-gray-500 hover:text-gray-700'
          } ${isUpdatingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          📺 Session QR
        </button>

        <button
          onClick={() => handleModeSwitch('member')}
          disabled={isUpdatingMode}
          className={`px-4 py-2 rounded-lg text-sm 
                      font-medium transition-all ${
            activeScanMode === 'member'
              ? 'bg-white shadow text-indigo-700'
              : 'text-gray-500 hover:text-gray-700'
          } ${isUpdatingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          🪪 Member Scan
        </button>
      </div>

      {activeScanMode === 'session' ? (
        <div className="flex flex-col items-center space-y-8 w-full">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-25 transition duration-1000 group-hover:opacity-50"></div>
            <div className="relative bg-white p-4 rounded-2xl border border-gray-100 shadow-inner overflow-hidden">
              {isRefreshing && (
                <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-300">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Refreshing</p>
                </div>
              )}
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Attendance QR Code"
                  className="w-full h-auto transition-opacity duration-300"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-[300px] h-[300px] bg-gray-50 animate-pulse" />
              )}
            </div>
          </div>

          <div className="text-center space-y-3">
            <div className={`text-4xl font-black font-mono tracking-tight ${getTimerColor()}`}>
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Members scan this to mark attendance
            </p>
          </div>

          <button
            onClick={refreshToken}
            disabled={isRefreshing}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Manual Refresh</span>
          </button>
        </div>
      ) : (
        <AdminScanner sessionId={session.id} />
      )}
    </div>
  );
}
