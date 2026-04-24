"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

/*
 * CLIENT COMPONENT: Create Attendance Session Modal
 * Handles session creation with automatic label generation.
 */

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

interface CreateSessionModalProps {
  onSessionCreated: (session: any, qr_token: string) => void;
}

export default function CreateSessionModal({ onSessionCreated }: CreateSessionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    meal_type: 'lunch',
    label: '',
    scan_mode: 'session',
  });

  // Auto-generate label on meal_type or date change
  useEffect(() => {
    try {
      const d = new Date(form.session_date);
      const formatted = d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const mealLabel = MEAL_TYPE_LABELS[form.meal_type] || 'Session';
      const label = `${mealLabel} - ${formatted}`;
      setForm(prev => ({ ...prev, label }));
    } catch (e) {
      // Handle invalid date gracefully
    }
  }, [form.session_date, form.meal_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.status === 201) {
        onSessionCreated(data.session, data.qr_token);
        setIsOpen(false);
      } else if (res.status === 409) {
        setError(data.error || 'An active session already exists for this meal and date');
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Session</Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Start New Session</h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700">Session Date</label>
                <input
                  type="date"
                  value={form.session_date}
                  onChange={e => setForm(prev => ({ ...prev, session_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700">Meal Type</label>
                <select
                  value={form.meal_type}
                  onChange={e => setForm(prev => ({ ...prev, meal_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")` }}
                  required
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700">Label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Lunch - 05 Jan 2025"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700">Initial Scan Mode</label>
                <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, scan_mode: 'session' }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.scan_mode === 'session' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    📺 Session QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, scan_mode: 'member' }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.scan_mode === 'member' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    🪪 Member Scan
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {form.scan_mode === 'session' 
                    ? 'Members scan the screen to check in.' 
                    : 'Admin scans member badges using the camera.'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)} type="button" disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Start Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
