"use client"

/*
 * Usage in every protected mobile page:
 * 
 * const { user, isLoading, isAuthorized } = useAuthGuard()
 * if (isLoading) return <LoadingScreen />
 * if (!isAuthorized) return null
 * // render page
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientUser, onAuthStateChange, type AuthUser } from '@/lib/auth/client-session'

export function useAuthGuard(options?: {
  requiredRole?: AuthUser['role'][]
  redirectTo?: string
}) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      const currentUser = await getClientUser()

      if (!isMounted) return

      if (!currentUser) {
        router.replace(options?.redirectTo ?? '/m/login')
        return
      }

      if (options?.requiredRole && !options.requiredRole.includes(currentUser.role)) {
        router.replace('/m/unauthorized')
        return
      }

      setUser(currentUser)
      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()

    const subscription = onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace('/m/login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAuth()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, options?.redirectTo, options?.requiredRole])

  return { user, isLoading, isAuthorized }
}
