import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'

/**
 * POST /api/meetings/[id]/attachments — returns a short-lived signed URL for
 * a chat attachment. Uploads happen directly from the browser into the
 * private `meeting-attachments` bucket (insert RLS: migration 024). Here the
 * path must belong to THIS meeting, and the signed URL is minted with the
 * caller's own RLS-scoped client, so the storage select policy (organizer /
 * invited participant / admin of that meeting) is what actually authorises
 * the read — a non-participant simply gets "not found".
 */

const BUCKET = 'meeting-attachments'
const SIGNED_URL_TTL_SECONDS = 120

const paramsSchema = z.object({ id: z.string().uuid() })
const bodySchema = z.object({ path: z.string().min(1).max(300) })

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ url: string } | { error: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth.user

  const parsedParams = paramsSchema.safeParse(await context.params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid meeting id' }, { status: 400 })
  }
  const meetingId = parsedParams.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const segments = parsedBody.data.path.split('/')
  const validShape =
    segments.length === 3 &&
    segments[0] === meetingId &&
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
  if (!validShape) {
    return NextResponse.json({ error: 'Invalid attachment path' }, { status: 400 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(parsedBody.data.path, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'File not found or you do not have access' }, { status: 404 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
