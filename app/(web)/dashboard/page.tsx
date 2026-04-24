import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import DashboardGrid from './DashboardGrid';
import { getVisibleCards, MODULE_CARDS } from '@/lib/dashboard/cards';

/*
 * Dashboard Page
 * Main landing page for the web application.
 * Dynamically displays module cards based on role and tenant feature flags.
 */

export default async function DashboardPage() {
  // STEP 1: Get authenticated user
  const user = await requireAuth();

  // STEP 2: Fetch tenant feature flags
  const supabase = await createClient();

  const { data: features } = await supabase
    .from('tenant_features')
    .select('feature_key, is_enabled')
    .eq('tenant_id', user.tenant_id);
  // RLS auto-scopes to user's tenant

  // Extract enabled feature keys
  const enabledFeatures: string[] = (features ?? [])
    .filter((f) => f.is_enabled)
    .map((f) => f.feature_key);

  // STEP 3: Filter cards server-side
  const visibleCards = getVisibleCards(user.role, enabledFeatures);

  // STEP 4: Build role context string for subtitle
  const roleContext: Record<string, string> = {
    owner: 'You have full access to all modules.',
    admin: 'You have administrative access.',
    manager: 'You can manage meals and attendance.',
    member: 'You can view meals and attendance.',
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.full_name} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">{roleContext[user.role]}</p>
      </div>

      {/* Role + feature context bar */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-gray-200 flex flex-wrap items-center gap-4">
        {/* Role badge */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Your Role
          </p>
          <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-indigo-50 text-indigo-700 capitalize">
            {user.role}
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Active features */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Active Features
          </p>
          <div className="flex flex-wrap gap-2">
            {enabledFeatures.length === 0 && (
              <span className="text-xs text-gray-400">No features enabled</span>
            )}
            {enabledFeatures.map((feature) => (
              <span
                key={feature}
                className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200"
              >
                {feature.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Module count */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Modules Available
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {visibleCards.length} of {MODULE_CARDS.length}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {visibleCards.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-medium">No modules available</p>
          <p className="text-sm mt-1">
            Contact your administrator to enable features.
          </p>
        </div>
      )}

      {/* Module cards grid */}
      {visibleCards.length > 0 && (
        <DashboardGrid cards={visibleCards} userRole={user.role} />
      )}
    </div>
  );
}
