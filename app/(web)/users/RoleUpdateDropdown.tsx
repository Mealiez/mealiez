"use client"

import { useState } from 'react'
import { type UserRole, getAssignableRoles, ROLE_LABELS } from '@/lib/auth/roles'

interface RoleUpdateDropdownProps {
  userId: string
  currentRole: UserRole
  currentUserRole: UserRole
  onRoleUpdate: (userId: string, newRole: UserRole) => void
}

export default function RoleUpdateDropdown({
  userId,
  currentRole,
  currentUserRole,
  onRoleUpdate
}: RoleUpdateDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignableRoles = getAssignableRoles(currentUserRole)

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole) return
    
    setIsUpdating(true)
    setError(null)

    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (res.ok) {
        onRoleUpdate(userId, newRole)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to update role')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-col">
      <select
        value={currentRole}
        onChange={e => handleRoleChange(e.target.value as UserRole)}
        disabled={isUpdating}
        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      >
        <option value={currentRole} disabled>{ROLE_LABELS[currentRole]}</option>
        {assignableRoles.map(role => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-600 mt-1">{error}</span>}
    </div>
  )
}
