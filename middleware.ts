import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/database'

const PROTECTED_ROUTES: ReadonlyArray<{ prefix: string; role: UserRole }> = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/teacher', role: 'teacher' },
  { prefix: '/parent', role: 'parent' },
  { prefix: '/seller', role: 'seller' },
  { prefix: '/buyer', role: 'buyer' },
]

const VALID_ROLES = ['admin', 'teacher', 'parent', 'seller', 'buyer'] as const

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)
}

function findProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.find((route) =>
    pathname === route.prefix || pathname.startsWith(route.prefix + '/')
  )
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoute = findProtectedRoute(request.nextUrl.pathname)

  if (!protectedRoute) {
    return response
  }

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[middleware] profile role lookup failed:', error.message)
    return NextResponse.redirect(new URL('/', request.url))
  }

  const role = isUserRole(profile?.role) ? profile.role : undefined

  if (role !== protectedRoute.role && role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/seller/:path*'],
}
