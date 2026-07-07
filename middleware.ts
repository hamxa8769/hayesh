import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

// Admin client for profile lookups in middleware (bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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

  // Use admin client for profile lookup (bypasses RLS, avoids 406)
  const admin = getAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    // Profile doesn't exist — create it from auth metadata
    const userRole = user.user_metadata?.role as string
    const fullName = user.user_metadata?.full_name as string

    if (isUserRole(userRole)) {
      await admin.from('profiles').upsert({
        id: user.id,
        email: user.email || '',
        full_name: fullName || user.email?.split('@')[0] || 'User',
        role: userRole,
      })

      if (userRole !== protectedRoute.role && userRole !== 'admin') {
        const roleHome: Record<string, string> = {
          teacher: '/teacher/dashboard',
          parent: '/parent/dashboard',
          seller: '/seller/dashboard',
          buyer: '/buyer/dashboard',
          admin: '/admin',
        }
        return NextResponse.redirect(new URL(roleHome[userRole] || '/', request.url))
      }

      return response
    }

    console.error('[middleware] profile not found for user:', user.id)
    return NextResponse.redirect(new URL('/', request.url))
  }

  const role = isUserRole(profile.role) ? profile.role : undefined

  if (role !== protectedRoute.role && role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/seller/:path*', '/buyer/:path*'],
}
