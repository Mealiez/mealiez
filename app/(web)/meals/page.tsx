import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import MealPlansTable from './MealPlansTable';
import CreatePlanModal from './CreatePlanModal';

export default async function MealsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from('meal_plans')
    .select(`
      id, name, description,
      start_date, end_date, is_active,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  const canManage = ['owner', 'admin', 'manager'].includes(user.role);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meal Plans</h1>
          <p className="text-gray-500 mt-1">Manage your mess meal schedules</p>
        </div>
        {canManage && <CreatePlanModal />}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <MealPlansTable 
          initialPlans={plans || []} 
          canManage={canManage} 
        />
      </div>
    </div>
  );
}
