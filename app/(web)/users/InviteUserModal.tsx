"use client"

import { useState } from 'react'
import { InviteUserSchema } from '@/lib/validations/users'
import { type UserRole, getAssignableRoles, ROLE_LABELS } from '@/lib/auth/roles'

interface InviteUserModalProps {
  currentUserRole: UserRole
}

export default function InviteUserModal({ currentUserRole }: InviteUserModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null)

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: getAssignableRoles(currentUserRole)[0] || 'member' as UserRole
  })

  const assignableRoles = getAssignableRoles(currentUserRole)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setFieldErrors(null)
    setSuccess(null)

    const result = InviteUserSchema.safeParse(form)
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (res.status === 201) {
        setSuccess(`Invitation sent to ${form.email}`)
        setForm({ email: '', full_name: '', phone: '', role: assignableRoles[0] || 'member' })
        setTimeout(() => {
          setIsOpen(false)
          setSuccess(null)
        }, 2000)
      } else if (res.status === 409) {
        setError('This user is already in your team')
      } else if (res.status === 403) {
        setError('You do not have permission')
      } else if (res.status === 400) {
        setFieldErrors(data.details?.fieldErrors || null)
      } else {
        setError('Something went wrong. Try again.')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Invite Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-100 rounded">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {fieldErrors?.full_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.full_name[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {fieldErrors?.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {assignableRoles.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
