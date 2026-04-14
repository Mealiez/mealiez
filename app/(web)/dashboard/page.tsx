import { requireAuth } from '@/lib/auth/session'
import SignOutButton from './SignOutButton'

export default async function DashboardPage() {
  const user = await requireAuth()

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome, {user.full_name}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-2">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Tenant ID:</span> {user.tenant_id}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Role:</span> {user.role}
        </p>
      </div>
      <SignOutButton />
    </div>
  )
}
