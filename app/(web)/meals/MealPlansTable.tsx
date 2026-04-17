"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export type MealPlan = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
};

interface Props {
  initialPlans: MealPlan[];
  canManage: boolean;
}

export default function MealPlansTable({ initialPlans, canManage }: Props) {
  const [plans, setPlans] = useState<MealPlan[]>(initialPlans);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Expose an event for sibling components to notify this table
  useEffect(() => {
    const handleNewPlan = (event: CustomEvent<MealPlan>) => {
      setPlans(prev => [event.detail, ...prev]);
    };
    window.addEventListener('mealPlanCreated' as any, handleNewPlan as any);
    return () => window.removeEventListener('mealPlanCreated' as any, handleNewPlan as any);
  }, []);

  async function activatePlan(planId: string) {
    if (!confirm('Activating this plan will deactivate the currently active plan. Continue?')) return;
    
    setIsLoading(planId);
    setError(null);
    
    try {
      const res = await fetch(`/api/meals/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });

      if (!res.ok) throw new Error('Failed to activate plan');

      setPlans(prev => prev.map(p => ({
        ...p,
        is_active: p.id === planId
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(null);
    }
  }

  async function deletePlan(planId: string) {
    if (!confirm('Are you sure you want to delete this plan? This cannot be undone.')) return;

    setIsLoading(planId);
    setError(null);

    try {
      const res = await fetch(`/api/meals/plans/${planId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete plan');
      }

      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {plans.map((plan) => (
            <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{plan.name}</div>
                <div className="text-sm text-gray-500 truncate max-w-xs">{plan.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {plan.start_date} <span className="text-gray-300 mx-1">→</span> {plan.end_date}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {plan.is_active ? (
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(plan.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <Link 
                  href={`/meals/${plan.id}`}
                  className="text-blue-600 hover:text-blue-900"
                >
                  View / Edit
                </Link>

                {canManage && !plan.is_active && (
                  <>
                    <button
                      onClick={() => activatePlan(plan.id)}
                      disabled={isLoading !== null}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      disabled={isLoading !== null}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                No meal plans found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
