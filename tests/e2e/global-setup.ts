import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { E2E_SERVICE_KEY, E2E_SUPABASE_URL, EMAIL, PASSWORD, type E2ERole } from "./env"
import { writeFileSync } from "node:fs"
import { SEED_FILE } from "./env"

/**
 * Resets the LOCAL database to a known state and seeds one user per role,
 * an approved teacher, an approved seller + gig, an AI service and payee
 * accounts. Writes the created ids to tests/e2e/.seed.json for the specs.
 */
const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

export interface SeedData {
  users: Record<E2ERole, string>
  teacherId: string
  sellerId: string
  gigId: string
  aiServiceId: string
}

function psql(sql: string): void {
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], { stdio: "pipe" })
}

export default async function globalSetup(): Promise<void> {
  // Wipe app data (CASCADE follows every FK from profiles) and test users.
  psql(`
    truncate public.profiles, public.ai_services cascade;
    delete from auth.users where email like '%@e2e.hayesh.test';
    -- platform_settings.updated_by references profiles, so the CASCADE above
    -- empties it too: restore every setting the app reads.
    insert into public.platform_settings (key, value) values
      ('teacher_commission_pct', '15'), ('seller_commission_pct', '18'),
      ('teacher_registration_fee_pkr', '2000'), ('seller_registration_fee_pkr', '1000'),
      ('maintenance_mode', 'false'), ('gig_auto_complete_days', '3'),
      ('payment_bank_name', '"Meezan Bank"'), ('payment_account_title', '"Hayesh Pvt Ltd"'),
      ('payment_account_number', '"0123456789"'), ('payment_iban', '""'),
      ('payment_jazzcash_number', '"03001234567"'), ('payment_easypaisa_number', '""'),
      ('payment_instructions', '""'),
      ('featured_7d_price_pkr', '1500'), ('featured_30d_price_pkr', '5000')
    on conflict (key) do update set value = excluded.value;
  `)

  const admin = createClient(E2E_SUPABASE_URL, E2E_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const users = {} as Record<E2ERole, string>
  for (const role of Object.keys(EMAIL) as E2ERole[]) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL[role],
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role, full_name: `E2E ${role[0].toUpperCase()}${role.slice(1)}` },
    })
    if (error || !data.user) throw new Error(`createUser ${role}: ${error?.message}`)
    users[role] = data.user.id
  }
  // The signup trigger never grants admin — promote server-side like an operator would.
  await admin.from("profiles").update({ role: "admin" }).eq("id", users.admin)

  const { data: teacher, error: tErr } = await admin
    .from("teachers")
    .insert({
      user_id: users.teacher,
      status: "approved",
      display_name: "E2E Teacher",
      tagline: "Maths that finally clicks",
      subjects: [{ subject: "Mathematics", level: "advanced" }],
      private_price_pkr: 15000,
      standard_price_pkr: 9000,
      group_price_pkr: 6000,
    })
    .select("id")
    .single()
  if (tErr) throw new Error(`teacher: ${tErr.message}`)

  const { data: seller, error: sErr } = await admin
    .from("sellers")
    .insert({ user_id: users.seller, status: "approved", display_name: "E2E Studio", registration_fee_paid: true })
    .select("id")
    .single()
  if (sErr) throw new Error(`seller: ${sErr.message}`)

  const { data: gig, error: gErr } = await admin
    .from("gigs")
    .insert({
      seller_id: seller.id,
      status: "approved",
      title: "E2E Logo Design",
      category: "design",
      description: "A clean logo for your brand.",
      basic_title: "Starter",
      basic_price_pkr: 5000,
      basic_delivery_days: 3,
      basic_revisions: 1,
      standard_title: "Business",
      standard_price_pkr: 9000,
      standard_delivery_days: 4,
      standard_revisions: 2,
      premium_title: "Brand kit",
      premium_price_pkr: 15000,
      premium_delivery_days: 5,
      premium_revisions: 3,
    })
    .select("id")
    .single()
  if (gErr) throw new Error(`gig: ${gErr.message}`)

  const { data: service, error: aErr } = await admin
    .from("ai_services")
    .insert({
      title: "E2E Essay Feedback",
      description: "Detailed feedback on your essay.",
      category: "writing",
      status: "active",
      price_pkr: 500,
      system_prompt: "SECRET-E2E-PROMPT",
      input_schema: [{ field_name: "topic", label: "Essay topic", type: "text", required: true }],
    })
    .select("id")
    .single()
  if (aErr) throw new Error(`ai service: ${aErr.message}`)

  const seed: SeedData = { users, teacherId: teacher.id, sellerId: seller.id, gigId: gig.id, aiServiceId: service.id }
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2))
}
