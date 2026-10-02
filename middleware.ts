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

// ── Maintenance mode ────────────────────────────────────────
// platform_settings.maintenance_mode is public-readable; cache it briefly so
// every request doesn't cost a database round trip.
const MAINTENANCE_CACHE_MS = 30_000
let maintenanceCache: { value: boolean; at: number } | null = null

// Paths that keep working during maintenance (admins sign in, payment
// webhooks and cron keep settling money, the maintenance page itself).
const MAINTENANCE_EXEMPT = ['/maintenance', '/auth', '/admin', '/api/webhooks', '/api/cron', '/api/profile', '/api/health']

async function isMaintenanceOn(): Promise<boolean> {
  const now = Date.now()
  if (maintenanceCache && now - maintenanceCache.at < MAINTENANCE_CACHE_MS) return maintenanceCache.value
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await anon.from('platform_settings').select('value').eq('key', 'maintenance_mode').maybeSingle()
    const value = data?.value === true || data?.value === 'true'
    maintenanceCache = { value, at: now }
    return value
  } catch {
    return maintenanceCache?.value ?? false
  }
}

async function isAdminUser(userId: string): Promise<boolean> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
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

  const path = request.nextUrl.pathname
  if (!MAINTENANCE_EXEMPT.some((p) => path === p || path.startsWith(p + '/')) && (await isMaintenanceOn())) {
    if (!user || !(await isAdminUser(user.id))) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Hayesh is under maintenance. Please try again shortly.' }, { status: 503 })
      }
      return NextResponse.rewrite(new URL('/maintenance', request.url), { status: 503 })
    }
  }

  // Signed-out visitors get the marketing landing page at "/". A signed-in user
  // gets the /explore marketplace instead — their role dashboard is still one
  // click away via the navbar. /explore is not a protected route, so this
  // cannot loop.
  if (request.nextUrl.pathname === "/") {
    if (user) return NextResponse.redirect(new URL("/explore", request.url))
    return response
  }

  // Checkout and orders pages need a session but no particular role.
  if (request.nextUrl.pathname.startsWith('/checkout')) {
    if (user) return response
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

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
    // Never trust a self-asserted 'admin' from signup metadata — admins are
    // promoted server-side only. Mirrors the whitelist in handle_new_user().
    const role = meta?.role as string
    if (['teacher','parent','seller','buyer'].includes(role)) {
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
  // Every route except static assets, so maintenance mode applies site-wide;
  // role gating below only acts on the protected prefixes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
