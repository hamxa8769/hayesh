import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/database'

const PROTECTED: Record<string, UserRole> = {
  '/admin': 'admin',
  '/teacher': 'teacher',
  '/parent': 'parent',
  '/seller': 'seller',
  '/buyer': 'buyer',
}

function getRole(pathname: string): UserRole | null {
  for (const [prefix, role] of Object.entries(PROTECTED)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return role
  }
  return null
}

function getHome(role: UserRole): string {
  const homes: Record<string, string> = {
    admin: '/admin',
    teacher: '/teacher/dashboard',
    parent: '/parent/dashboard',
    seller: '/seller/dashboard',
    buyer: '/buyer/dashboard',
  }
  return homes[role] || '/'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const requiredRole = getRole(request.nextUrl.pathname)

  if (!requiredRole) return response

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile) {
    const meta = user.user_metadata
    const role = meta?.role as string
    if (['admin','teacher','parent','seller','buyer'].includes(role)) {
      await admin.from('profiles').upsert({
        id: user.id,
        email: user.email || '',
        full_name: meta?.full_name || user.email?.split('@')[0] || 'User',
        role,
      })
      if (role !== requiredRole && role !== 'admin') {
        return NextResponse.redirect(new URL(getHome(role as UserRole), request.url))
      }
      return response
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (profile.role !== requiredRole && profile.role !== 'admin') {
    return NextResponse.redirect(new URL(getHome(profile.role), request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/seller/:path*', '/buyer/:path*'],
}
