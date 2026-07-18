"use client"

import { useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

export interface UploadedFileResult {
  name: string
  path: string
  url: string | null
}

export interface FileUploadProps {
  bucket: string
  userId: string
  accept: string
  maxSizeMB?: number
  multiple?: boolean
  label: string
  hint?: string
  disabled?: boolean
  onUploaded: (file: UploadedFileResult) => void
  onError?: (message: string) => void
  className?: string
}

const DEFAULT_MAX_SIZE_MB = 5

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
}

function isFileTypeAccepted(file: File, accept: string): boolean {
  const acceptedTypes = accept.split(",").map((type) => type.trim().toLowerCase())
  return acceptedTypes.some((type) => {
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type)
    if (type.endsWith("/*")) return file.type.startsWith(type.replace("/*", "/"))
    return file.type === type
  })
}

/**
 * Generic Supabase Storage uploader used for both the teacher profile photo
 * (public `teacher-photos` bucket) and ID/qualification documents (private
 * `teacher-documents` bucket). Uploads are OPTIONAL everywhere they're used
 * — a failed or skipped upload never blocks onboarding, it only surfaces an
 * inline warning via `onError`.
 */
export function FileUpload({
  bucket,
  userId,
  accept,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  multiple = false,
  label,
  hint,
  disabled = false,
  onUploaded,
  onError,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const uploadFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      const message = `${file.name} exceeds ${maxSizeMB}MB`
      setLocalError(message)
      onError?.(message)
      return
    }
    if (!isFileTypeAccepted(file, accept)) {
      const message = `${file.name} is not an accepted file type`
      setLocalError(message)
      onError?.(message)
      return
    }

    setUploading(true)
    setLocalError(null)
    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
      onUploaded({ name: file.name, path, url: publicData?.publicUrl ?? null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again."
      setLocalError(message)
      onError?.(message)
    } finally {
      setUploading(false)
    }
  }

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      // Sequential on purpose — keeps upload order predictable and avoids
      // hammering Storage with parallel requests from a multi-select.
      await uploadFile(file)
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : label}
      </Button>

      {uploading && (
        <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-surface-elevated">
          {prefersReducedMotion ? (
            <div className="aurora-bg h-full w-1/3 rounded-full" />
          ) : (
            <motion.div
              className="aurora-bg h-full w-1/3 rounded-full"
              animate={{ x: ["-100%", "220%"] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      )}

      {hint && !localError && <p className="text-xs text-text-muted">{hint}</p>}
      {localError && <p className="text-xs text-accent-danger">{localError}</p>}
    </div>
  )
}
