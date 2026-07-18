"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { File as FileIcon, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/teacher/FileUpload"
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS } from "@/components/teacher/onboarding-schema"
import type { DocumentKind, OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherDocumentsStepProps {
  form: UseFormReturn<OnboardingValues>
  userId: string | null
}

/**
 * ID / qualification document uploads. Entirely optional — a teacher can
 * finish onboarding without uploading anything, and a failed upload only
 * shows an inline warning (via FileUpload's onError) rather than blocking
 * progress. Files go to the private `teacher-documents` bucket at
 * `${userId}/${filename}`; only `{ name, path, kind }` metadata is kept in
 * form state and later saved to `teachers.documents`.
 */
export function TeacherDocumentsStep({ form, userId }: TeacherDocumentsStepProps) {
  const { watch, setValue } = form
  const documents = watch("documents")
  const [kind, setKind] = useState<DocumentKind>("id")
  const [warning, setWarning] = useState<string | null>(null)

  const removeDocument = (index: number) => {
    setValue(
      "documents",
      documents.filter((_, i) => i !== index),
      { shouldValidate: true }
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-elevated/40 p-4">
        <p className="text-sm text-text-muted">
          Upload an ID document and any teaching qualifications or certifications. This is optional — you can finish
          setup and add these later from your profile. Files are kept private and reviewed by admins only.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Document Type</Label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
          className="flex h-10 w-full max-w-xs rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        >
          {DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {userId ? (
        <FileUpload
          bucket="teacher-documents"
          userId={userId}
          accept="application/pdf,image/jpeg,image/png"
          maxSizeMB={5}
          multiple
          label="Upload document(s)"
          hint="PDF, JPG or PNG up to 5MB each."
          onUploaded={(file) => {
            setWarning(null)
            setValue("documents", [...documents, { name: file.name, path: file.path, kind }], { shouldValidate: true })
          }}
          onError={(message) => setWarning(message)}
        />
      ) : (
        <p className="text-xs text-text-muted">Sign-in required to upload documents.</p>
      )}

      {warning && (
        <p className="rounded-lg border border-accent-warning/30 bg-accent-warning/10 p-2.5 text-xs text-accent-warning">
          {warning} — this won&apos;t block finishing setup; you can retry from your profile later.
        </p>
      )}

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc, index) => (
            <li
              key={`${doc.path}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileIcon className="h-4 w-4 shrink-0 text-accent-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{doc.name}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
                    {DOCUMENT_KIND_LABELS[doc.kind]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeDocument(index)}
                aria-label={`Remove ${doc.name}`}
                className="shrink-0 text-text-muted transition-colors duration-150 hover:text-accent-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
