import type { ChatAttachment } from '@/components/video/room-messaging'

export const ATTACHMENT_BUCKET = 'meeting-attachments'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
}

const ALLOWED_MIMES: ReadonlySet<string> = new Set(Object.values(MIME_BY_EXTENSION))

/** Value for the file input's `accept` attribute. */
export const ATTACHMENT_ACCEPT = Object.keys(MIME_BY_EXTENSION)
  .map((ext) => `.${ext}`)
  .join(',')

/** Resolves a file's mime (falling back to its extension when the browser
 *  reports none) or returns null when the type is not allowed. */
export function resolveAttachmentMime(file: File): string | null {
  if (file.type && ALLOWED_MIMES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt = MIME_BY_EXTENSION[ext]
  return !file.type && byExt ? byExt : null
}

/** Client-side validation; returns a user-facing error or null when OK. */
export function validateAttachment(file: File): string | null {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Files must be 10 MB or smaller.'
  if (!resolveAttachmentMime(file)) {
    return 'Unsupported file type. Use images, PDF, Word, PowerPoint, Excel or text files.'
  }
  return null
}

export function safeAttachmentName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(-80)
  return cleaned || 'file'
}

export function buildAttachmentPath(meetingId: string, userId: string, fileName: string): string {
  return `${meetingId}/${userId}/${Date.now()}-${safeAttachmentName(fileName)}`
}

export function toChatAttachment(path: string, file: File, mime: string): ChatAttachment {
  return { name: file.name.slice(0, 120), path, size: file.size, mime }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
