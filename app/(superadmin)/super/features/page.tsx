import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

const FEATURE_KEYS = [
  'meal_management',
  'attendance_tracking',
  'inventory_management',
  'pre_meal_requests',
  'custom_reports',
  'billing',
  'branch_management',
  'settings_module',
  'channel_attendance'
]

export default async function FeatureControlPage() {
  const superUser = await requireSuperAdmin()
  
  const supabaseAdmin = createAdminClient()

  // Fetch all tenants
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name, plan')
    .order('name', { ascending: true })

  // Fetch all feature flags
  const { data: allFeatures } = await supabaseAdmin
    .from('tenant_features')
    .select('tenant_id, feature_key, is_enabled')

  // Build feature map per tenant
  const featureMap: Record<string, Record<string, boolean>> = {}
  for (const f of allFeatures ?? []) {
    if (!featureMap[f.tenant_id]) featureMap[f.tenant_id] = {}
    featureMap[f.tenant_id][f.feature_key] = f.is_enabled
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Feature Flag Control</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Override feature flags for any tenant. Changes take effect immediately.
        </p>
      </div>

      <div className="mb-8 p-4 bg-amber-900/20 border border-amber-900/50 rounded-2xl flex items-start gap-4">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="text-amber-200 text-sm font-semibold">Warning: Elevated Controls</p>
          <p className="text-amber-400/70 text-xs mt-0.5">
            Changes here bypass plan restrictions. Use with caution — intended for support and testing only.
            To toggle flags, visit the individual mess detail page.
          </p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-4 font-medium">Tenant</th>
                <th className="text-left px-6 py-4 font-medium">Plan</th>
                {FEATURE_KEYS.map(key => (
                  <th key={key} className="text-center px-4 py-4 font-medium min-w-[100px]">
                    <span className="block truncate max-w-[80px] mx-auto" title={key}>
                      {key.split('_')[0]}...
                    </span>
                  </th>
                ))}
                <th className="text-right px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {tenants?.map(tenant => (
                <tr key={tenant.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-gray-200 font-medium truncate max-w-[200px]" title={tenant.name}>
                      {tenant.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-800 text-gray-400 border border-gray-700">
                      {tenant.plan}
                    </span>
                  </td>
                  {FEATURE_KEYS.map(key => {
                    const isEnabled = featureMap[tenant.id]?.[key] ?? false
                    return (
                      <td key={key} className="px-4 py-4 text-center">
                        {isEnabled ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="Enabled" />
                        ) : (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-700" title="Disabled" />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/super/messes/${tenant.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {(!tenants || tenants.length === 0) && (
                <tr>
                  <td colSpan={FEATURE_KEYS.length + 3} className="px-6 py-12 text-center text-gray-500 italic">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
