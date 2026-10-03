# Hayesh — Final Roadmap (remaining work)

Status as of the commerce release (branch `claude/inspiring-meitner-wr64ay`):
the product is functionally complete for **launch on the manual payment
rail**. Everything below is ordered by business impact. Each phase is sized
for one or two focused Claude Code sessions. Start each phase in a **new
session**, and ship each one as its own PR.

Legend: 🧑‍💼 = operator task (you, outside code) · 🛠 = development task

## Progress (updated after the launch-readiness pass)

| Phase | Status |
|---|---|
| 0 — Launch blockers | ✅ Done in code (legal pages, email, maintenance mode, ratings, structured error logging + `/api/health`). **Operator still owns 0.1** (migrations, env vars, payment accounts) and legal review. |
| 1 — Trust & retention | ✅ Done (messaging, trust section, monthly report card, receipts) |
| 2 — Payment automation | 🟡 Refunds, payout CSV export and USD pricing done. **Simpaisa blocked** on a merchant account + API docs. |
| 3 — Revenue expansion | 🟡 Featured listings and AI Studio catalogue + revisions done. **Parent Premium deferred**: today's benefits (unlimited demos, matching) are already free, so it needs a real product decision on what premium unlocks before charging for it. Translation fee waits on Phase 6. |
| 4 — Meetings polish | ✅ Done (needs a live LiveKit call to verify UX; recording still needs `LIVEKIT_EGRESS_S3_*`) |
| 5 — JARVIS with real actions | ✅ Read-only tools done. Write actions intentionally not added. |
| 6 — Live voice translation | 🔴 Not started — needs Deepgram + ElevenLabs keys and a LiveKit agent worker. |
| 7 — Engineering quality | ✅ CI, unit tests, Playwright E2E (every money flow, against local Supabase), legacy cleanup. Upstash rate limiting still recommended at scale. |

---

## Phase 0 — Launch blockers (do before announcing the site)

| # | Task | Who | Done when |
|---|---|---|---|
| 0.1 | Run migrations 016–019 in Supabase, set Vercel env vars, fill payment accounts in Admin → Settings (see `docs/PRODUCTION.md` §3) | 🧑‍💼 | Smoke test in PRODUCTION.md §3.7 passes on the live domain |
| 0.2 | **Legal pages**: `/terms`, `/privacy`, `/refund-policy`, `/contact`. Link them in the landing footer, the dashboard footer and at checkout ("By paying you agree to…"). Stripe and the payment banks expect these. | 🛠 + 🧑‍💼 (business name, address, support email) | Pages live and linked; checkout shows the agreement line |
| 0.3 | **Transactional email** via Resend: payment received / confirmed / rejected, order delivered, tuition renewal due, past due. Reuse the existing `notifyUser` calls in `lib/payments/*` — add a `sendEmail` next to each. Set a custom SMTP in Supabase Auth so signup emails come from your domain. | 🛠 + 🧑‍💼 (Resend account, DNS records) | Each money event sends one email; signup mail arrives from `@yourdomain` |
| 0.4 | **Maintenance mode**: the `maintenance_mode` setting exists but nothing enforces it. Middleware should show a maintenance page to non-admins when it is on. | 🛠 | Toggling the setting takes the site down for everyone but admins |
| 0.5 | **Error monitoring**: Sentry for Next.js + an uptime check on `/` and `/api/cron/commerce` (last-run). | 🛠 + 🧑‍💼 (Sentry account) | Errors from production appear in Sentry with a release tag |
| 0.6 | **Rating aggregates**: `teachers.average_rating / total_reviews` are never updated (TODO in `components/teacher-public/ReviewForm.tsx`). Add a DB trigger on `teacher_reviews`. Only allow reviews from parents with a paid subscription or completed demo. | 🛠 | Cards and search show real ratings; non-customers can't review |

**Estimate:** 2 sessions of dev + 1–2 days operator setup.

---

## Phase 1 — Trust & retention (weeks 1–2 after launch)

| # | Task | Done when |
|---|---|---|
| 1.1 | **Messaging** (`messages` table already exists): an order thread for buyer ↔ seller and a student thread for parent ↔ teacher, with Supabase Realtime, unread counts in the bell, and attachments later. Replace the `/buyer/messages` placeholder. Only parties to an order or subscription may message (RLS). | Both sides chat live; admin can read a thread when a dispute is opened |
| 1.2 | **Landing page trust copy**: an escrow explainer ("You pay Hayesh — the tutor is paid after delivery"), the verified-teacher process, payment-method logos and a refund promise. | One clear trust section above the fold |
| 1.3 | **Monthly report card**: from `sessions` attendance + `assignments` grades, generate a per-child monthly summary in the parent portal and by email. This is what makes parents renew. | Parent sees an auto report on the 1st of each month |
| 1.4 | **Receipts**: a downloadable receipt (HTML → PDF) for every completed transaction, with reference code, NTN placeholder and amount breakdown. | "Download receipt" on parent and buyer payment history |

**Estimate:** 3 sessions.

---

## Phase 2 — Payment automation (weeks 3–4)

| # | Task | Done when |
|---|---|---|
| 2.1 | **Simpaisa** (needs a merchant account + API docs from Simpaisa 🧑‍💼): a JazzCash/Easypaisa/card-PK tab on checkout that settles through `markTransactionPaid` from a verified `/api/webhooks/simpaisa`. Keep the manual rail as a fallback. | Local wallet payments confirm without admin action |
| 2.2 | **Payout batches**: an admin export of approved withdrawals (CSV for bulk IBFT), with "mark batch paid". | Weekly payouts take minutes, not hours |
| 2.3 | **Refund tooling**: an admin "refund" on any completed transaction with a reason, a ledger entry and a customer notification (today only dispute refunds exist). | Full and partial refunds are recorded in the ledger |
| 2.4 | **USD pricing for international parents**: show `*_price_usd` when country ≠ PK and charge USD through Stripe (checkout currently prefers PKR). | A non-PK parent sees and pays in USD |

**Estimate:** 2–3 sessions (2.1 depends on Simpaisa onboarding).

---

## Phase 3 — Revenue expansion (weeks 4–6)

| # | Task | Revenue stream |
|---|---|---|
| 3.1 | **Featured listings**: teachers and sellers buy 7/30-day featuring through the existing checkout (`type: 'featured'`); the cron expires `featured_until`; featured listings rank first in search. | Featured fee |
| 3.2 | **Parent Premium plan** ($9.99 / ₨2,500 monthly): unlimited demo bookings, priority matching, report cards, JARVIS homework help. Reuse the tuition renewal machinery. | Subscription |
| 3.3 | **AI Studio catalogue**: seed 6 high-intent services (CV rewrite, essay feedback, homework explainer, lesson-plan generator, O/A-level past-paper solver, Urdu↔English translation) plus buyer revisions (the `revision_requests` column already exists). | 100%-margin orders |
| 3.4 | **Translation add-on fee**: admin bills enabled teachers monthly through checkout once Phase 6 ships. | Translation fee |

**Estimate:** 3 sessions.

---

## Phase 4 — Meetings polish (from `docs/meeting-todo.md`)

1. Transient chat bubbles over the stage
2. Emoji picker in chat
3. Request-to-present → host allow/deny (data channel only)
4. In-call invite of registered users (small endpoint + `InviteePicker`)
5. Chat attachments (`meeting-attachments` bucket + RLS)
6. Turn on recording: set the `LIVEKIT_EGRESS_S3_*` env vars 🧑‍💼

**Estimate:** 2 sessions.

---

## Phase 5 — JARVIS with real actions

Function calling, read-only first, scoped by role. Tools: "my upcoming sessions", "my child's progress", "pending payments", "find a teacher for <subject> under <price>". For admins, add "today's verification queue", "revenue this month" and "pending approvals". Every tool runs server-side with the caller's session client so RLS applies. Write actions come later, each needing an explicit confirmation step.

**Estimate:** 2 sessions.

---

## Phase 6 — Live voice translation

Deepgram STT → Claude translate → ElevenLabs TTS inside LiveKit rooms, only for teachers the admin enabled, with a target of < 1 s round trip. It falls back gracefully when disabled mid-session. Build it as a LiveKit agent or worker, not in the browser.

**Estimate:** 3–4 sessions (highest technical risk; do last).

---

## Phase 7 — Engineering quality (run alongside phases 1–3)

| # | Task |
|---|---|
| 7.1 | **CI**: a GitHub Action running `npm ci`, `next build` (lint included) and type-check on every PR |
| 7.2 | **Playwright smoke tests** for the 6 flows in PRODUCTION.md §3.7 against a Supabase test project |
| 7.3 | **Unit tests** for `lib/payments/*` (commission split, settlement idempotency, escrow release) |
| 7.4 | Move rate limiting to Upstash Redis (currently per-instance memory) |
| 7.5 | Clean up legacy code: `components/layout/CosmosBackground.tsx` + tsparticles deps (old design system), the unused `/api/upload` caller paths, and the existing lint warnings |
| 7.6 | Keep `CLAUDE.md` "Current Phase" pointed at this roadmap |

---

## Metrics to watch from day one

* Demo → paid enrolment conversion (target ≥ 25%)
* Monthly tuition renewal rate (target ≥ 80%)
* Payment verification time (target < 4 h). If it slips, prioritise Phase 2.1
* Gig dispute rate (target < 3% of orders)
* AI Studio orders per week and the share of revenue at 100% margin

---

## Suggested calendar

| Week | Phases |
|---|---|
| 0 (now) | Phase 0 → **public launch** |
| 1–2 | Phase 1 + 7.1/7.2 |
| 3–4 | Phase 2 + 7.3/7.4 |
| 4–6 | Phase 3 + Phase 4 |
| 7 | Phase 5 |
| 8–9 | Phase 6 |
