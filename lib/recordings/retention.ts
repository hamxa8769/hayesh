import { createAdminClient } from '@/lib/supabase/admin'
import { deleteRecordingObject } from '@/lib/recordings/r2'

if (typeof window !== 'undefined') {
  throw new Error('lib/recordings/retention.ts must never be imported client-side')
}

interface ExpiredRow {
  id: string
  storage_key: string | null
}

/** Deletes recordings past expires_at from storage and marks them `deleted`. */
export async function purgeExpiredRecordings(limit = 100): Promise<{ deleted: number; failed: number }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('meeting_recordings')
    .select('id, storage_key')
    .eq('status', 'ready')
    .lt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Could not load expired recordings: ${error.message}`)

  let deleted = 0
  let failed = 0
  for (const row of (data ?? []) as ExpiredRow[]) {
    try {
      if (row.storage_key) await deleteRecordingObject(row.storage_key)
      const { error: updateError } = await admin
        .from('meeting_recordings')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'ready')
      if (updateError) throw new Error(updateError.message)
      deleted += 1
    } catch (err: unknown) {
      failed += 1
      console.error('purgeExpiredRecordings failed for', row.id, err instanceof Error ? err.message : err)
    }
  }
  return { deleted, failed }
}
