"use client"

import { useAuthGuard } from '@/hooks/useAuthGuard'
import { signOut } from '@/lib/auth/client-session'

export default function MobileHomePage() {
  const { user, isLoading, isAuthorized } = useAuthGuard()
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 font-medium">Loading...</p>
      </div>
    )
  }

  if (!isAuthorized || !user) return null

  const handleSignOut = async () => {
    await signOut()
    // useAuthGuard's onAuthStateChange will handle redirect to /m/login
  }

  return (
    <div className="p-6 space-y-6 flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user.full_name}
        </h1>
        <p className="text-lg text-gray-600 capitalize">
          Role: {user.role}
        </p>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full max-w-xs py-3 px-4 text-center font-bold text-white bg-red-500 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-transform"
      >
        Sign Out
      </button>
    </div>
  )
}
