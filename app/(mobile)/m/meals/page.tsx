"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { createClient } from '@/lib/supabase/client';
import { MEAL_TYPE_LABELS } from '@/lib/validations/meals';

type TodaysMealItem = {
  item_id: string;
  plan_name: string;
  meal_type: string;
  name: string;
  description: string | null;
  is_available: boolean;
};

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Loading your menu...</p>
    </div>
  );
}

export default function MobileMealsPage() {
  const router = useRouter();
  const { user, isLoading, isAuthorized } = useAuthGuard();
  
  const [meals, setMeals] = useState<Record<string, TodaysMealItem[]>>({});
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [mealsError, setMealsError] = useState<string | null>(null);
  const [today, setToday] = useState<string>('');

  const fetchMeals = useCallback(async () => {
    setIsLoadingMeals(true);
    setMealsError(null);
    try {
      const res = await fetch('/api/meals/today');
      if (!res.ok) throw new Error('Failed to fetch meals');
      
      const result = await res.json();
      setMeals(result.data || {});
      setToday(result.date || new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      console.error('[MOBILE_FETCH_MEALS_ERROR]', err);
      setMealsError('Could not load meals. Please try again.');
    } finally {
      setIsLoadingMeals(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchMeals();
    }
  }, [isAuthorized, fetchMeals]);

  if (isLoading) return <LoadingScreen />;
  if (!isAuthorized) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const hasMeals = Object.values(meals).some(group => group.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Today's Menu</h1>
          <p className="text-sm text-gray-500">{formatDate(today)}</p>
        </div>
        <button
          onClick={fetchMeals}
          disabled={isLoadingMeals}
          className="p-2 text-blue-600 active:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
        >
          <svg 
            className={`w-6 h-6 ${isLoadingMeals ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-8">
        {isLoadingMeals && !hasMeals ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-24 bg-white rounded-2xl border border-gray-100" />
              </div>
            ))}
          </div>
        ) : mealsError ? (
          <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-center">
            <p className="text-red-700 font-medium mb-4">{mealsError}</p>
            <button
              onClick={fetchMeals}
              className="bg-red-600 text-white px-6 py-2 rounded-xl font-semibold shadow-sm active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        ) : !hasMeals ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-lg font-medium">No meals scheduled for today</p>
          </div>
        ) : (
          MEAL_TYPE_ORDER.map(type => {
            const typeItems = meals[type] || [];
            if (typeItems.length === 0) return null;

            return (
              <section key={type} className="space-y-4">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                  {MEAL_TYPE_LABELS[type as keyof typeof MEAL_TYPE_LABELS]}
                </h2>
                <div className="space-y-3">
                  {typeItems.map(item => (
                    <div 
                      key={item.item_id} 
                      className={`bg-white p-5 rounded-2xl border transition-all ${
                        item.is_available 
                          ? 'border-gray-100 shadow-sm' 
                          : 'border-gray-100 opacity-60 grayscale bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">
                          {item.name}
                        </h3>
                        {!item.is_available && (
                          <span className="text-[10px] font-black uppercase tracking-tighter text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                            Unavailable
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-gray-500 text-sm leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
