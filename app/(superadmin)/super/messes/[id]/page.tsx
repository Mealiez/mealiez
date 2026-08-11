import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MessPlanBadge from '../MessPlanBadge'
import FeatureToggle from './FeatureToggle'

/**
 * PRODUCTION-GRADE PAGE: Mess Detail
 * 
 * This page uses the high-privilege createAdminClient() factory.
 * Lazy initialization is enforced inside the Server Component to ensure
 * side-effect free builds and secure credential handling.
 */

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

export default async function MessDetailPage({ params }: { params: { id: string } }) {
  const superUser = await requireSuperAdmin()
  
  // Lazy-initialize the admin client inside the request scope.
  const supabaseAdmin = createAdminClient()

  // Fetch tenant + users + features in parallel
  const [tenantRes, usersRes, featuresRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('users')
      .select('id, full_name, role, is_active, created_at')
      .eq('tenant_id', params.id)
      .order('role', { ascending: false }),
    supabaseAdmin.from('tenant_features')
      .select('feature_key, is_enabled, updated_at')
      .eq('tenant_id', params.id)
  ])

  if (tenantRes.error || !tenantRes.data) {
    return notFound()
  }

  const tenant = tenantRes.data
  const users = usersRes.data ?? []
  const features = featuresRes.data ?? []

  const stats = {
    user_count: users.length,
    admin_count: users.filter(u => u.role === 'admin').length,
    manager_count: users.filter(u => u.role === 'manager').length,
    member_count: users.filter(u => u.role === 'member').length
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/super/messes" className="text-gray-500 hover:text-white transition-colors">
          Messes
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-gray-300 font-medium">{tenant.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile + Stats */}
        <div className="lg:col-span-1 space-y-8">
          {/* Tenant Profile Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-6 flex items-center justify-between">
              Organization Profile
              <MessPlanBadge tenantId={tenant.id} currentPlan={tenant.plan} />
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Full Name</p>
                <p className="text-gray-200 mt-0.5">{tenant.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Slug / ID</p>
                <p className="text-gray-400 text-xs mt-0.5">{tenant.slug}</p>
                <p className="text-[10px] text-gray-600 mt-1 font-mono">{tenant.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">City</p>
                  <p className="text-gray-200 mt-0.5">{tenant.city || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">State</p>
                  <p className="text-gray-200 mt-0.5">{tenant.state || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Contact Email</p>
                <p className="text-gray-200 mt-0.5">{tenant.contact_email || '—'}</p>
              </div>
              <div className="pt-4 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-600">
                <p>Created: {new Date(tenant.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(tenant.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <a
                href={`mailto:${tenant.contact_email}`}
                className="flex items-center justify-between w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                Send Support Email
                <span>✉️</span>
              </a>
              <Link
                href={`/super/audit?tenant_id=${tenant.id}`}
                className="flex items-center justify-between w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                View Audit Log
                <span>📋</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Users + Features */}
        <div className="lg:col-span-2 space-y-8">
          {/* User List */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Mess Personnel</h2>
              <span className="text-xs text-gray-500">{stats.user_count} total users</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-6 py-4 font-medium">Name</th>
                    <th className="text-left px-6 py-4 font-medium">Role</th>
                    <th className="text-left px-6 py-4 font-medium">Status</th>
                    <th className="text-left px-6 py-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 text-gray-200 font-medium">{user.full_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user.role === 'admin' ? 'bg-red-900/30 text-red-400 border border-red-800/50' :
                          user.role === 'manager' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50' :
                          'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="text-green-500 text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="mb-6">
              <h2 className="text-white font-semibold">Feature Control</h2>
              <p className="text-xs text-gray-500 mt-1">
                Toggle platform capabilities for this mess. Super Admin overrides bypass plan restrictions.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURE_KEYS.map(key => {
                const existing = features.find(f => f.feature_key === key)
                const isEnabled = existing ? existing.is_enabled : false
                
                return (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-800 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-200 capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-indigo-400 font-medium uppercase mt-0.5">
                        Super Admin Override
                      </p>
                    </div>
                    <FeatureToggle
                      tenantId={tenant.id}
                      featureKey={key}
                      initialEnabled={isEnabled}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
