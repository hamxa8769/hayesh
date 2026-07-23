import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_AI_SERVICE_MODEL } from "@/lib/ai/claude"
import { DEFAULT_AI_SERVICES } from "@/lib/ai/default-services"
import type { AIService } from "@/types/database"

/**
 * /api/admin/ai-services
 *
 * Admin-only CRUD for public.ai_services, plus a one-click seed action for
 * the curated default catalog. Migration 013 revokes SELECT on
 * ai_services.system_prompt for anon/authenticated — this route is the ONLY
 * place the system prompt is ever read or written, and it always goes
 * through the service-role client (createAdminClient()), never the
 * request-scoped cookie client. requireAdmin() re-checks profiles.role
 * server-side on every call; the client-sent body is never trusted for
 * authorization.
 */

interface ErrorResponse {
  error: string
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<ErrorResponse> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}

const inputFieldSchema = z
  .object({
    field_name: z
      .string()
      .trim()
      .min(1, "Field name is required")
      .max(60)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must be a valid identifier (letters, numbers, underscores)"),
    label: z.string().trim().min(1, "Label is required").max(150),
    type: z.enum(["text", "textarea", "file", "select"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).max(30).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options && f.options.length > 0), {
    message: "Select fields need at least one option",
    path: ["options"],
  })

const urlOrEmpty = z
  .union([z.literal(""), z.string().trim().url("Must be a valid URL")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))

const baseServiceFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(3000),
  category: z.string().trim().min(1, "Category is required").max(100),
  thumbnail_url: urlOrEmpty,
  status: z.enum(["active", "paused", "draft"]),
  price_pkr: z.number().min(0, "Price cannot be negative").nullable(),
  price_usd: z.number().min(0, "Price cannot be negative").nullable(),
  ai_model: z.string().trim().min(1, "Model is required").max(100),
  system_prompt: z.string().trim().min(1, "System prompt is required").max(20000),
  output_format: z.enum(["text", "code", "document", "json"]),
  delivery_time_hrs: z.number().int().min(0, "Cannot be negative").max(720),
  input_schema: z.array(inputFieldSchema).max(30).default([]),
  revisions_allowed: z.number().int().min(0, "Cannot be negative").max(20),
}

const createServiceSchema = z.object({
  action: z.literal("create").optional(),
  ...baseServiceFields,
})

const seedActionSchema = z.object({ action: z.literal("seed") })

const postBodySchema = z.union([seedActionSchema, createServiceSchema])

const patchBodySchema = z
  .object({ id: z.string().trim().min(1, "id is required") })
  .and(z.object(baseServiceFields).partial())
  .refine((v) => (v.system_prompt === undefined ? true : v.system_prompt.trim().length > 0), {
    message: "System prompt cannot be empty",
    path: ["system_prompt"],
  })

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request"
}

export async function GET(): Promise<NextResponse<{ services: AIService[] } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  // Admin editor needs system_prompt on every row — read via the
  // service-role client, which is the only client allowed to SELECT it.
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("ai_services")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ services: (data ?? []) as AIService[] })
}

export async function POST(
  request: Request
): Promise<NextResponse<{ service: AIService } | { seeded: number; skipped: number } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = postBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const adminClient = createAdminClient()

  if (parsed.data.action === "seed") {
    // Idempotent: only insert defaults whose title doesn't already exist.
    const { data: existing, error: existingError } = await adminClient.from("ai_services").select("title")
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    const existingTitles = new Set((existing ?? []).map((r) => r.title))
    const toInsert = DEFAULT_AI_SERVICES.filter((s) => !existingTitles.has(s.title))

    if (toInsert.length === 0) {
      return NextResponse.json({ seeded: 0, skipped: DEFAULT_AI_SERVICES.length })
    }

    const { error: insertError } = await adminClient.from("ai_services").insert(toInsert)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ seeded: toInsert.length, skipped: DEFAULT_AI_SERVICES.length - toInsert.length })
  }

  // create
  const { action: _action, ...fields } = parsed.data
  void _action
  const { data, error } = await adminClient
    .from("ai_services")
    .insert({ ...fields, ai_model: fields.ai_model || DEFAULT_AI_SERVICE_MODEL })
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }

  return NextResponse.json({ service: data as AIService }, { status: 201 })
}

export async function PATCH(request: Request): Promise<NextResponse<{ service: AIService } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const { id, ...fields } = parsed.data
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("ai_services")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  return NextResponse.json({ service: data as AIService })
}

export async function DELETE(request: Request): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from("ai_services").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
