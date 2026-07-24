import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listInvitableUsers, type InvitableUser } from '@/lib/meetings/invitable'

/**
 * GET /api/meetings/invitees?q=&limit= — candidate invitees for the
 * caller's next meeting. Only teachers, sellers, and admins may host a
 * meeting, so only they may look up who they're allowed to invite (see
 * lib/meetings/invitable.ts for the role-based eligibility rules).
 */

interface InviteesErrorResponse {
  error: string
}

interface InviteesResponse {
  users: InvitableUser[]
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(request: Request): Promise<NextResponse<InviteesResponse | InviteesErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const role = (profile as { role: string } | null)?.role ?? ''

  if (role !== 'teacher' && role !== 'seller' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Only teachers, sellers and admins can look up meeting invitees' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || undefined

  const rawLimit = Number(searchParams.get('limit'))
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT

  const users = await listInvitableUsers({
    inviterId: user.id,
    inviterRole: role,
    query,
    limit,
  })

  return NextResponse.json({ users })
}
