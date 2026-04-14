import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrAbove } from '@/lib/auth/roles'
import UsersTable from './UsersTable'
import InviteUserModal from './InviteUserModal'

export default async function UsersPage() {
  const currentUser = await requireAuth()

  const supabase = await createClient()
  const { data: users } = await supabase
    .from('users')
    .select(`
      id, 
      full_name, 
      phone, 
      role, 
      is_active, 
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-8 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        {isAdminOrAbove(currentUser.role) && (
          <InviteUserModal currentUserRole={currentUser.role} />
        )}
      </header>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <UsersTable
          initialUsers={(users as any[]) ?? []}
          currentUser={currentUser}
        />
      </div>
    </div>
  )
}
