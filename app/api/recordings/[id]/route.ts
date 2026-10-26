import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isRecordingStorageConfigured, presignRecordingUrl } from '@/lib/recordings/r2'

const PRESIGN_SECONDS = 60 * 60
const NO_STORE = { 'Cache-Control': 'no-store' }

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Recording not found' }, { status: 404, headers: NO_STORE })
}

/** GET /api/recordings/[id] — 302 to a 1-hour presigned URL if the caller can read the ready, unexpired recording (RLS decides). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

  const { data: row } = await supabase
    .from('meeting_recordings')
    .select('id, status, storage_key, expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!row || row.status !== 'ready' || !row.storage_key) return notFound()
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return notFound()
  if (!isRecordingStorageConfigured()) {
    return NextResponse.json({ error: 'Recording storage is not configured' }, { status: 501, headers: NO_STORE })
  }

  try {
    const url = await presignRecordingUrl(row.storage_key, PRESIGN_SECONDS)
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE })
  } catch (error: unknown) {
    console.error('recording presign failed', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not open recording' }, { status: 500, headers: NO_STORE })
  }
}
