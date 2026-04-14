import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match ALL request paths EXCEPT:
     * - /m/* (mobile routes — handled client-side)
     * - /api/onboarding/* (public onboarding endpoints)
     * - _next/static, _next/image, favicon.ico
     * - Files with extensions (.svg, .png, etc)
     */
    '/((?!m/|api/onboarding|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
