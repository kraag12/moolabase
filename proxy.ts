import type { NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { NextResponse } from 'next/server'
import { isAbortError } from './lib/errors/isAbortError'

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.next({ request })
    }
    throw error
  }
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
