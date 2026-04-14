import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Always run updateSession.
  // This refreshes expiring JWT tokens on every request.
  //
  // Route protection is NOT handled here.
  // Protected routes: requireAuth() in (web)/layout.tsx
  // Public routes:    no auth check in (auth)/layout.tsx
  // Mobile routes:    useAuthGuard hook in each page
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match ALL request paths EXCEPT:
     * - /m/*          mobile routes (Capacitor, client-only)
     * - /api/onboarding/* public API endpoint
     * - _next internals and static files
     */
    '/((?!m/|api/onboarding|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
