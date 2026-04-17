import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PlanItemsEditor from './PlanItemsEditor';

export default async function MealPlanDetailsPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('meal_plans')
    .select(`
      id, name, description,
      start_date, end_date, is_active,
      meal_plan_items (
        id, meal_date, meal_type,
        name, description, is_available
      )
    `)
    .eq('id', params.id)
    .single();

  if (!plan) notFound();

  const canManage = ['owner', 'admin', 'manager'].includes(user.role);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="flex mb-8 text-sm font-medium text-gray-500">
        <Link href="/meals" className="hover:text-blue-600 transition-colors">Meals</Link>
        <span className="mx-2 text-gray-300">/</span>
        <span className="text-gray-900">{plan.name}</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
              {plan.is_active ? (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-gray-500">{plan.description || "No description provided."}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg w-fit">
              <div className="flex items-center gap-2">
                <span className="font-medium">Starts:</span> {plan.start_date}
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2">
                <span className="font-medium">Ends:</span> {plan.end_date}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlanItemsEditor 
        plan={plan as any} 
        canManage={canManage} 
      />
    </div>
  );
}
