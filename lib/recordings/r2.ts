import { AwsClient } from 'aws4fetch'

if (typeof window !== 'undefined') {
  throw new Error('lib/recordings/r2.ts must never be imported client-side')
}

const DEFAULT_PRESIGN_SECONDS = 60 * 60

export function isRecordingStorageConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_EGRESS_S3_ENDPOINT?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_BUCKET?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_SECRET?.trim()
  )
}

function storage(): { client: AwsClient; base: string } {
  const endpoint = process.env.LIVEKIT_EGRESS_S3_ENDPOINT
  const bucket = process.env.LIVEKIT_EGRESS_S3_BUCKET
  const accessKeyId = process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY
  const secretAccessKey = process.env.LIVEKIT_EGRESS_S3_SECRET
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Recording storage is not configured')
  }
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: process.env.LIVEKIT_EGRESS_S3_REGION || 'auto',
  })
  return { client, base: `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}` }
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** A time-limited GET URL for a stored recording (path-style). */
export async function presignRecordingUrl(key: string, expiresInSeconds = DEFAULT_PRESIGN_SECONDS): Promise<string> {
  const { client, base } = storage()
  const url = new URL(objectUrl(base, key))
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds))
  const signed = await client.sign(url.toString(), { method: 'GET', aws: { signQuery: true } })
  return signed.url
}

/** Deletes an object; a missing object (404) counts as success. */
export async function deleteRecordingObject(key: string): Promise<void> {
  const { client, base } = storage()
  const response = await client.fetch(objectUrl(base, key), { method: 'DELETE' })
  if (response.status === 204 || response.status === 404 || response.status === 200) return
  throw new Error(`Deleting recording failed (${response.status})`)
}
