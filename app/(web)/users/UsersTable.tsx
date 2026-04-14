"use client"

import { useState } from 'react'
import type { AuthUser } from '@/lib/auth/session'
import { type UserRole, isAdminOrAbove } from '@/lib/auth/roles'
import RoleUpdateDropdown from './RoleUpdateDropdown'

type UserRow = {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

interface UsersTableProps {
  initialUsers: UserRow[]
  currentUser: AuthUser
}

export default function UsersTable({ initialUsers, currentUser }: UsersTableProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    setIsLoading(userId)
    setError(null)

    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_active: !currentStatus } : u
        ))
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to update status')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(null)
    }
  }

  const handleRoleUpdate = (userId: string, newRole: UserRole) => {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, role: newRole } : u
    ))
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className={user.id === currentUser.id ? 'bg-blue-50/30' : ''}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                <div className="text-xs text-gray-500">{user.phone || 'No phone'}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {isAdminOrAbove(currentUser.role) && user.id !== currentUser.id && user.role !== 'owner' ? (
                  <RoleUpdateDropdown
                    userId={user.id}
                    currentRole={user.role}
                    currentUserRole={currentUser.role}
                    onRoleUpdate={handleRoleUpdate}
                  />
                ) : (
                  <span className="text-sm text-gray-700 capitalize">{user.role}</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {isAdminOrAbove(currentUser.role) && user.id !== currentUser.id && (
                  <button
                    onClick={() => toggleStatus(user.id, user.is_active)}
                    disabled={isLoading === user.id}
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                    } disabled:opacity-50`}
                  >
                    {isLoading === user.id ? 'Updating...' : (user.is_active ? 'Deactivate' : 'Activate')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
