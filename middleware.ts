import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public web routes — no auth required
  const publicPaths = ['/login', '/register']
  const isPublicPath = publicPaths.some(
    path => pathname.startsWith(path)
  )

  if (isPublicPath) {
    return NextResponse.next()
  }

  // All other web routes: refresh + validate session
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all web routes EXCEPT:
     * - /m/* (mobile — client-side auth via useAuthGuard)
     * - /api/onboarding/* (public endpoint)
     * - Static files and Next.js internals
     * - Files with extensions (.svg, .png, etc)
     */
    '/((?!m/|api/onboarding|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
